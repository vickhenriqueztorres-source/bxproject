import { accessToken, isGuestMode } from '../auth/oidc';
import { calculateFullJitterDelay, reconnectDelay } from './backoff';
import { FeedCircuitBreaker, type CircuitState } from './circuit-breaker';
import { TokenBucketRateLimiter } from './token-bucket';
import { getStaggeredDelay } from './staggered-startup';
import { tickAction, type Tick } from './protocol';

export type PrivateEvent = {
  type: 'wallet_balance' | 'contract_settled';
  available_minor?: number;
  contract_id?: string;
  result?: string;
  payout_minor?: number;
};

export type TickCallback = (tick: Tick) => void;
export type PrivateCallback = (event: PrivateEvent) => void;
export type StatusCallback = (connected: boolean, stale: boolean) => void;
export type CircuitBreakerCallback = (state: CircuitState, remainingMs: number) => void;

export class TradingFeedManager {
  private socket: WebSocket | null = null;
  private symbolSubscribers = new Map<string, Set<TickCallback>>();
  private symbolLastSequences = new Map<string, number>();
  private symbolLastTickAt = new Map<string, number>();
  private symbolStaleListeners = new Map<string, Set<(isStale: boolean, ageMs: number) => void>>();
  private symbolStaleStates = new Map<string, boolean>();
  private symbolLatencies = new Map<string, number>();
  private symbolResyncing = new Map<string, boolean>();
  private symbolTickBuffers = new Map<string, Tick[]>();
  private privateListeners = new Set<PrivateCallback>();
  private statusListeners = new Set<StatusCallback>();
  private circuitBreakerListeners = new Set<CircuitBreakerCallback>();
  private serverClockOffsetMs = 0;

  // Técnicas de Resiliência contra Reconnect Storm (Perigo 3)
  private circuitBreaker = new FeedCircuitBreaker({ failureThreshold: 3, openDurationMs: 30000 });
  private tokenBucket = new TokenBucketRateLimiter({ capacity: 10, refillRatePerSecond: 1 });
  private initialConnectDone = false;

  private connected = false;
  private stale = true;
  private attempt = 0;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private wsUrl = import.meta.env.VITE_WS_URL ?? (
    typeof window !== 'undefined' && window.location
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      : 'ws://localhost:3001/ws'
  )) {
    this.startStaleChecker();
  }

  public setWsUrl(url: string) {
    if (this.wsUrl !== url) {
      this.wsUrl = url;
      this.disconnect();
      this.connect();
    }
  }

  public connect(forceImmediate = false) {
    if (this.closed || (this.socket && this.socket.readyState === WebSocket.OPEN)) return;

    // Staggered Startup (Técnica 4): espalha início no arranque inicial
    if (!this.initialConnectDone) {
      this.initialConnectDone = true;
      const initialDelay = getStaggeredDelay(10000, forceImmediate);
      if (initialDelay > 0) {
        setTimeout(() => {
          this.doConnect();
        }, initialDelay);
        return;
      }
    }

    this.doConnect();
  }

  private doConnect() {
    if (this.closed || (this.socket && this.socket.readyState === WebSocket.OPEN)) return;
    if (isGuestMode()) {
      this.connectInternal(true);
      return;
    }
    this.connectInternal(false);
  }

  private async connectInternal(guest: boolean) {
    // Circuit Breaker (Técnica 2): impede martelar gateway caído
    if (!this.circuitBreaker.canExecute()) {
      const remainingMs = this.circuitBreaker.getTimeUntilRetryMs();
      this.notifyCircuitBreakerStatus();
      this.scheduleReconnect(remainingMs);
      return;
    }

    // Token Bucket (Técnica 3): limita throughput de handshakes
    await this.tokenBucket.waitForToken(1);

    if (this.circuitBreaker.getState() === 'HALF_OPEN') {
      this.circuitBreaker.recordAttempt();
    }

    try {
      this.socket = new WebSocket(this.wsUrl);
    } catch {
      this.circuitBreaker.recordFailure();
      this.notifyCircuitBreakerStatus();
      this.scheduleReconnect();
      return;
    }

    const current = this.socket;

    current.onopen = async () => {
      try {
        if (!guest) {
          const token = await accessToken();
          if (current.readyState === WebSocket.OPEN) {
            current.send(JSON.stringify({ type: 'auth', token }));
          }
        } else {
          // In guest mode, request public ticks feed
          this.connected = true;
          this.attempt = 0;
          this.circuitBreaker.recordSuccess();
          this.notifyCircuitBreakerStatus();
          this.notifyStatus();
          this.resubscribeAll();
        }
      } catch {
        this.circuitBreaker.recordFailure();
        this.notifyCircuitBreakerStatus();
        current.close(4401, 'Authentication required');
      }
    };

    current.onmessage = (message) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(String(message.data));
      } catch {
        return;
      }

      if (data.type === 'ping') {
        if (typeof data.server_ts === 'number') {
          this.serverClockOffsetMs = data.server_ts - Date.now();
        }
        if (current.readyState === WebSocket.OPEN) {
          current.send(JSON.stringify({ type: 'pong', client_ts: Date.now() }));
        }
        return;
      }

      if (data.type === 'authenticated') {
        this.connected = true;
        this.attempt = 0;
        this.circuitBreaker.recordSuccess();
        this.notifyCircuitBreakerStatus();
        this.notifyStatus();
        this.resubscribeAll();
        return;
      }

      if (data.type === 'snapshot' && typeof data.symbol === 'string' && Number.isSafeInteger(data.sequence)) {
        const symbol = data.symbol;
        this.applySnapshotAndDrainBuffer(symbol, {
          sequence: Number(data.sequence),
          price: String(data.price ?? '0'),
          ts: typeof data.ts === 'string' ? data.ts : new Date().toISOString(),
        });
        return;
      }

      if (data.type === 'catchup_ticks' && Array.isArray(data.ticks)) {
        const ticks = data.ticks as Tick[];
        ticks.sort((a, b) => a.sequence - b.sequence);
        for (const tick of ticks) {
          const lastSeq = this.symbolLastSequences.get(tick.symbol) ?? 0;
          if (tick.sequence > lastSeq) {
            this.applyTick(tick);
          }
        }
        return;
      }

      if (data.type === 'resync_required' && typeof data.symbol === 'string') {
        this.triggerSnapshotRebuild(data.symbol);
        return;
      }

      if (data.type === 'tick' && typeof data.symbol === 'string' && typeof data.price === 'string') {
        const incoming = data as Tick;
        const lastSeq = this.symbolLastSequences.get(incoming.symbol) ?? 0;

        // Se o ativo está no meio de um processo de resync/rebuild, enfileira no buffer
        if (this.symbolResyncing.get(incoming.symbol)) {
          let buffer = this.symbolTickBuffers.get(incoming.symbol);
          if (!buffer) {
            buffer = [];
            this.symbolTickBuffers.set(incoming.symbol, buffer);
          }
          buffer.push(incoming);
          return;
        }

        const action = tickAction(lastSeq, incoming.sequence);

        if (action === 'duplicate') return;
        if (action === 'gap') {
          // Detectou gap: suspende deltas e dispara rebuild via snapshot REST (Subetapa 4)
          this.triggerSnapshotRebuild(incoming.symbol, incoming);
          return;
        }

        this.applyTick(incoming);
        return;
      }

      if (data.type === 'wallet_balance' || data.type === 'contract_settled') {
        const event = data as PrivateEvent;
        for (const cb of this.privateListeners) cb(event);
      }
    };

    current.onerror = () => {
      this.connected = false;
      this.notifyStatus();
    };

    current.onclose = () => {
      this.connected = false;
      this.notifyStatus();
      this.circuitBreaker.recordFailure();
      this.notifyCircuitBreakerStatus();
      if (!this.closed) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(forcedDelay?: number) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (forcedDelay !== undefined && forcedDelay > 0) {
      this.reconnectTimer = setTimeout(() => {
        this.connect(true);
      }, forcedDelay);
      return;
    }

    // Se o Circuit Breaker estiver OPEN, respeita o tempo de cooldown de 30s
    if (this.circuitBreaker.getState() === 'OPEN') {
      const remaining = Math.max(1000, this.circuitBreaker.getTimeUntilRetryMs());
      this.notifyCircuitBreakerStatus();
      this.reconnectTimer = setTimeout(() => {
        this.connect(true);
      }, remaining);
      return;
    }

    this.attempt += 1;
    // Exponential backoff com Full Jitter canônico AWS (Técnica 1)
    const delay = calculateFullJitterDelay(this.attempt);
    this.reconnectTimer = setTimeout(() => {
      this.connect(true);
    }, delay);
  }

  public getCircuitBreakerState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  public getCircuitBreakerCooldownRemaining(): number {
    return this.circuitBreaker.getTimeUntilRetryMs();
  }

  public getAvailableTokens(): number {
    return this.tokenBucket.getAvailableTokens();
  }

  public onCircuitBreakerChange(cb: CircuitBreakerCallback): () => void {
    this.circuitBreakerListeners.add(cb);
    cb(this.circuitBreaker.getState(), this.circuitBreaker.getTimeUntilRetryMs());
    return () => this.circuitBreakerListeners.delete(cb);
  }

  private notifyCircuitBreakerStatus(): void {
    const state = this.circuitBreaker.getState();
    const remaining = this.circuitBreaker.getTimeUntilRetryMs();
    for (const listener of this.circuitBreakerListeners) {
      try {
        listener(state, remaining);
      } catch (err) {
        console.error('Error notifying circuit breaker listener:', err);
      }
    }
  }

  private resubscribeAll() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    for (const [symbol, callbacks] of this.symbolSubscribers.entries()) {
      if (callbacks.size > 0) {
        this.sendSubscribe(symbol, true);
      }
    }
  }

  private applyTick(incoming: Tick) {
    const arrivalTime = Date.now();
    const eventTime = typeof incoming.event_time === 'number'
      ? incoming.event_time
      : (incoming.ts ? Date.parse(incoming.ts) : arrivalTime);

    incoming.event_time = eventTime;
    incoming.arrival_time = arrivalTime;
    incoming.latency_ms = Math.max(0, arrivalTime - eventTime);
    this.symbolLatencies.set(incoming.symbol, incoming.latency_ms);

    this.symbolLastSequences.set(incoming.symbol, incoming.sequence);
    this.symbolLastTickAt.set(incoming.symbol, eventTime);

    // De-staleness imediata no recebimento de tick
    if (this.symbolStaleStates.get(incoming.symbol) !== false) {
      this.symbolStaleStates.set(incoming.symbol, false);
      this.stale = false;
      const staleCbs = this.symbolStaleListeners.get(incoming.symbol);
      if (staleCbs) {
        for (const cb of staleCbs) cb(false, 0);
      }
    }

    const callbacks = this.symbolSubscribers.get(incoming.symbol);
    if (callbacks) {
      for (const cb of callbacks) cb(incoming);
    }
  }

  public async triggerSnapshotRebuild(symbol: string, initialGapTick?: Tick) {
    if (this.symbolResyncing.get(symbol)) return;
    this.symbolResyncing.set(symbol, true);

    let buffer = this.symbolTickBuffers.get(symbol);
    if (!buffer) {
      buffer = [];
      this.symbolTickBuffers.set(symbol, buffer);
    }
    if (initialGapTick) {
      buffer.push(initialGapTick);
    }

    // Tenta via REST snapshot endpoint (Subetapa 4)
    try {
      const restBase = import.meta.env.VITE_API_URL ?? (
        typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3001'
      );
      const res = await fetch(`${restBase}/api/v1/snapshot?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const snap = await res.json();
        if (snap && Number.isSafeInteger(snap.sequence)) {
          this.applySnapshotAndDrainBuffer(symbol, snap);
          return;
        }
      }
    } catch {
      // Fallback para WS catch-up se REST falhar
    }

    // Se REST falhou, pede catch-up / resubscribe via WS
    this.sendSubscribe(symbol, true);
  }

  private applySnapshotAndDrainBuffer(symbol: string, snap: { sequence: number; price: string; ts: string; event_time?: number }) {
    const arrivalTime = Date.now();
    const eventTime = typeof snap.event_time === 'number'
      ? snap.event_time
      : (snap.ts ? Date.parse(snap.ts) : arrivalTime);
    const latencyMs = Math.max(0, arrivalTime - eventTime);

    this.symbolLastSequences.set(symbol, snap.sequence);
    this.symbolLastTickAt.set(symbol, eventTime);
    this.symbolLatencies.set(symbol, latencyMs);

    // De-staleness imediata
    if (this.symbolStaleStates.get(symbol) !== false) {
      this.symbolStaleStates.set(symbol, false);
      this.stale = false;
      const staleCbs = this.symbolStaleListeners.get(symbol);
      if (staleCbs) {
        for (const cb of staleCbs) cb(false, 0);
      }
    }

    // Notifica gráficos do snapshot com tick sintético
    const callbacks = this.symbolSubscribers.get(symbol);
    if (callbacks) {
      for (const cb of callbacks) {
        cb({
          type: 'tick',
          symbol,
          sequence: snap.sequence,
          price: snap.price,
          ts: snap.ts,
          event_time: eventTime,
          arrival_time: arrivalTime,
          latency_ms: latencyMs,
        });
      }
    }

    // Drena buffer ordenado aplicando apenas ticks posteriores ao snapshot
    const buffer = this.symbolTickBuffers.get(symbol) || [];
    buffer.sort((a, b) => a.sequence - b.sequence);

    let currentSeq = snap.sequence;
    for (const tick of buffer) {
      if (tick.sequence === currentSeq + 1) {
        this.applyTick(tick);
        currentSeq = tick.sequence;
      }
    }

    this.symbolTickBuffers.delete(symbol);
    this.symbolResyncing.set(symbol, false);
  }

  private sendSubscribe(symbol: string, resume = false) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const lastSeq = this.symbolLastSequences.get(symbol);
    this.socket.send(
      JSON.stringify({
        type: 'subscribe',
        symbol,
        ...(resume && lastSeq && lastSeq > 0 ? { lastSequence: lastSeq } : {}),
      })
    );
  }

  public sendBatchSubscribe(symbols: string[]) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || symbols.length === 0) return;
    this.socket.send(JSON.stringify({ type: 'subscribe', symbols }));
  }

  private sendUnsubscribe(symbol: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'unsubscribe', symbol }));
  }

  public sendBatchUnsubscribe(symbols: string[]) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || symbols.length === 0) return;
    this.socket.send(JSON.stringify({ type: 'unsubscribe', symbols }));
  }

  /**
   * Subscribe to a symbol's ticks.
   * If this symbol is already subscribed by another chart, reuses the existing subscription (De-duplication).
   */
  public subscribeSymbol(symbol: string, callback: TickCallback): () => void {
    let callbacks = this.symbolSubscribers.get(symbol);
    const wasEmpty = !callbacks || callbacks.size === 0;

    if (!callbacks) {
      callbacks = new Set();
      this.symbolSubscribers.set(symbol, callbacks);
    }

    callbacks.add(callback);

    // Only send subscribe frame over WS if this is the FIRST chart asking for this symbol
    if (wasEmpty) {
      this.sendSubscribe(symbol, false);
    }

    // Return cleanup function for this specific chart
    return () => {
      const set = this.symbolSubscribers.get(symbol);
      if (set) {
        set.delete(callback);
        // Only send unsubscribe to the server if NO charts are looking at this symbol anymore
        if (set.size === 0) {
          this.symbolSubscribers.delete(symbol);
          this.symbolTickBuffers.delete(symbol);
          this.symbolResyncing.delete(symbol);
          this.sendUnsubscribe(symbol);
        }
      }
    };
  }

  public getActiveSymbols(): string[] {
    return Array.from(this.symbolSubscribers.keys());
  }

  public subscribePrivate(callback: PrivateCallback): () => void {
    this.privateListeners.add(callback);
    return () => {
      this.privateListeners.delete(callback);
    };
  }

  public onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.connected, this.stale);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public onSymbolStaleness(symbol: string, callback: (isStale: boolean, ageMs: number) => void): () => void {
    let set = this.symbolStaleListeners.get(symbol);
    if (!set) {
      set = new Set();
      this.symbolStaleListeners.set(symbol, set);
    }
    set.add(callback);

    const last = this.symbolLastTickAt.get(symbol);
    const age = last ? Date.now() - last : Infinity;
    const initialStale = !this.connected || age > 4000;
    this.symbolStaleStates.set(symbol, initialStale);
    callback(initialStale, age === Infinity ? 99999 : age);

    return () => {
      set?.delete(callback);
      if (set?.size === 0) {
        this.symbolStaleListeners.delete(symbol);
        this.symbolStaleStates.delete(symbol);
      }
    };
  }

  public isSymbolStale(symbol: string): boolean {
    if (!this.connected) return true;
    const last = this.symbolLastTickAt.get(symbol);
    if (!last) return true;
    return Date.now() - last > 4000;
  }

  public getSymbolTickAge(symbol: string): number {
    const last = this.symbolLastTickAt.get(symbol);
    if (!last) return Infinity;
    return Date.now() - last;
  }

  private notifyStatus() {
    for (const cb of this.statusListeners) cb(this.connected, this.stale);
  }

  private startStaleChecker() {
    this.staleInterval = setInterval(() => {
      const now = Date.now();

      // 1. Checagem individual por símbolo para eliminar o ponto cego multi-gráficos
      for (const [symbol, callbacks] of this.symbolStaleListeners.entries()) {
        const last = this.symbolLastTickAt.get(symbol);
        const age = last ? now - last : Infinity;
        const isStale = !this.connected || age > 4000;
        const prevStale = this.symbolStaleStates.get(symbol);

        if (prevStale !== isStale) {
          this.symbolStaleStates.set(symbol, isStale);
          for (const cb of callbacks) {
            cb(isStale, age === Infinity ? 99999 : age);
          }
        }
      }

      // 2. Conectividade global de fallback
      let anyRecent = false;
      for (const last of this.symbolLastTickAt.values()) {
        if (now - last < 4000) {
          anyRecent = true;
          break;
        }
      }
      const newStale = this.symbolLastTickAt.size > 0 ? !anyRecent : !this.connected;
      if (newStale !== this.stale) {
        this.stale = newStale;
        this.notifyStatus();
      }
    }, 1000);
  }

  public disconnect() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.staleInterval) clearInterval(this.staleInterval);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.notifyStatus();
  }

  public getSubscriberCount(symbol: string): number {
    return this.symbolSubscribers.get(symbol)?.size ?? 0;
  }

  public getActiveSymbolsCount(): number {
    return this.symbolSubscribers.size;
  }

  public getSymbolLatency(symbol: string): number {
    return this.symbolLatencies.get(symbol) ?? 0;
  }

  public getServerTimeOffset(): number {
    return this.serverClockOffsetMs;
  }

  public getCalibratedNow(): number {
    return Date.now() + this.serverClockOffsetMs;
  }
}

// Global shared singleton for the browser window
export const tradingFeedManager = new TradingFeedManager();
