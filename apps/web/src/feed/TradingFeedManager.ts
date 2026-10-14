import { accessToken, isGuestMode } from '../auth/oidc';
import { getAssetBasePrice } from '../catalog/assets';
import { calculateFullJitterDelay, reconnectDelay } from './backoff';
import { FeedCircuitBreaker, type CircuitState } from './circuit-breaker';
import { TokenBucketRateLimiter } from './token-bucket';
import { getStaggeredDelay } from './staggered-startup';
import { tickAction, type Tick } from './protocol';

export type PrivateEvent = {
  type: 'wallet_balance' | 'contract_settled';
  available_minor?: number;
  reserved_minor?: number;
  contract_id?: string;
  result?: string;
  stake_minor?: number;
  payout_minor?: number;
  symbol?: string;
  direction?: 'UP' | 'DOWN' | 'SUBE' | 'BAJA';
};

export type SymbolFeedState = 'LIVE' | 'DEGRADED' | 'STALE' | 'DEAD';

export type TickCallback = (tick: Tick) => void;
export type PrivateCallback = (event: PrivateEvent) => void;
export type StatusCallback = (connected: boolean, stale: boolean) => void;
export type CircuitBreakerCallback = (state: CircuitState, remainingMs: number) => void;
export type SymbolStateCallback = (state: SymbolFeedState, ageMs: number) => void;

export interface SymbolFeedMetrics {
  symbol: string;
  tick_age_seconds: number;
  feed_gap_count: number;
  latency_ms: number;
  staleness_alert: boolean;
  reconnect_count: number;
  feed_state?: SymbolFeedState;
  out_of_order_count?: number;
  delayed_tick_count?: number;
}

const customSymbolThresholds = new Map<string, number>();

/**
 * Perigo 1 (Método 3): Threshold de Staleness ajustado por frequência esperada do instrumento.
 * - Índices Sintéticos de alta frequência (R_10, R_25, R_50, R_75, R_100, SYNTH*, VOL*, CRASH*, BOOM*): 4000ms
 * - Forex OTC (EURUSD-OTC, GBPUSD-OTC, USDJPY-OTC): 4000ms
 * - Criptomoedas (BTC*, ETH*, SOL*): 4500ms
 * - Commodities / Ações (XAU*, XAG*, AAPL*, TSLA*): 6000ms
 */
export function setSymbolStalenessThreshold(symbol: string, thresholdMs: number): void {
  if (thresholdMs > 0) {
    customSymbolThresholds.set(symbol.toUpperCase(), thresholdMs);
  }
}

export function getSymbolStalenessThresholdMs(symbol: string): number {
  const upper = (symbol || '').toUpperCase();
  const custom = customSymbolThresholds.get(upper);
  if (custom !== undefined) return custom;

  if (
    upper.startsWith('XAU') ||
    upper.startsWith('XAG') ||
    upper.startsWith('AAPL') ||
    upper.startsWith('TSLA') ||
    upper.startsWith('MSFT')
  ) {
    return 6000;
  }
  if (upper.startsWith('BTC') || upper.startsWith('ETH') || upper.startsWith('SOL')) {
    return 4500;
  }
  return 4000;
}

export class TradingFeedManager {
  private socket: WebSocket | null = null;
  private symbolSubscribers = new Map<string, Set<TickCallback>>();
  private symbolLastSequences = new Map<string, number>();
  private symbolLastTickAt = new Map<string, number>();
  private symbolStaleListeners = new Map<string, Set<(isStale: boolean, ageMs: number) => void>>();
  private symbolStaleStates = new Map<string, boolean>();
  private symbolFeedStates = new Map<string, SymbolFeedState>();
  private symbolStateListeners = new Map<string, Set<SymbolStateCallback>>();
  private symbolOutOfOrderCounts = new Map<string, number>();
  private symbolDelayedCounts = new Map<string, number>();
  private symbolFallbackFailed = new Map<string, boolean>();
  private symbolStaleFallbackAttempted = new Map<string, boolean>();
  private autoRestFallbackEnabled = false;
  private symbolLatencies = new Map<string, number>();
  private symbolGapCounts = new Map<string, number>();
  private symbolReconnectCounts = new Map<string, number>();
  private totalReconnectCount = 0;
  private symbolResyncing = new Map<string, boolean>();
  private symbolTickBuffers = new Map<string, Tick[]>();
  private symbolLastPrices = new Map<string, string>();
  private privateListeners = new Set<PrivateCallback>();
  private statusListeners = new Set<StatusCallback>();
  private circuitBreakerListeners = new Set<CircuitBreakerCallback>();
  private serverClockOffsetMs = 0;

  // Técnicas de Resiliência contra Reconnect Storm (Perigo 3)
  private circuitBreaker = new FeedCircuitBreaker({ failureThreshold: 3, openDurationMs: 30000 });
  private tokenBucket = new TokenBucketRateLimiter({ capacity: 10, refillRatePerSecond: 1 });
  private initialConnectDone = false;
  private connecting = false;

  private connected = false;
  private stale = true;
  private attempt = 0;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleInterval: ReturnType<typeof setInterval> | null = null;
  private guestFallbackInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private wsUrl = (import.meta as any).env?.VITE_WS_URL ?? (
    typeof window !== 'undefined' && window.location
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      : 'ws://localhost:3001/ws'
  )) {
    this.startStaleChecker();
    this.startGuestFallback();
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
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.doConnect();
        }, initialDelay);
        return;
      }
    }

    this.doConnect();
  }

  private doConnect() {
    if (this.closed || this.connecting || (this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING))) return;
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
    this.connecting = true;
    try {
      await this.tokenBucket.waitForToken(1);
    } catch {
      if (!this.closed) this.scheduleReconnect();
      return;
    } finally {
      this.connecting = false;
    }
    if (this.closed) return;

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
      if (this.closed || current !== this.socket) return;
      try {
        if (!guest) {
          const token = await accessToken();
          if (!this.closed && current === this.socket && current.readyState === WebSocket.OPEN) {
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
        if (this.closed || current !== this.socket) return;
        this.circuitBreaker.recordFailure();
        this.notifyCircuitBreakerStatus();
        current.close(4401, 'Authentication required');
      }
    };

    current.onmessage = (message) => {
      if (this.closed || current !== this.socket) return;
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

      if (data.type === 'authenticated' || data.type === 'auth_ok') {
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

        // Se o ativo está no meio de um processo de resync/rebuild, enfileira no buffer com teto estrito de memória
        if (this.symbolResyncing.get(incoming.symbol)) {
          let buffer = this.symbolTickBuffers.get(incoming.symbol);
          if (!buffer) {
            buffer = [];
            this.symbolTickBuffers.set(incoming.symbol, buffer);
          }
          if (buffer.length >= 500) {
            buffer.shift();
          }
          buffer.push(incoming);
          return;
        }

        const action = tickAction(lastSeq, incoming.sequence);

        if (action === 'duplicate') {
          this.symbolOutOfOrderCounts.set(
            incoming.symbol,
            (this.symbolOutOfOrderCounts.get(incoming.symbol) ?? 0) + 1
          );
          return;
        }
        if (action === 'gap') {
          this.symbolGapCounts.set(
            incoming.symbol,
            (this.symbolGapCounts.get(incoming.symbol) ?? 0) + 1
          );
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
      if (this.closed || current !== this.socket) return;
      this.connected = false;
      this.notifyStatus();
    };

    current.onclose = () => {
      if (this.closed || current !== this.socket) return;
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
    this.totalReconnectCount += 1;
    for (const sym of this.symbolSubscribers.keys()) {
      this.symbolReconnectCounts.set(sym, (this.symbolReconnectCounts.get(sym) ?? 0) + 1);
    }

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

  /**
   * Public ingestion entry point for ticks (validates sequence, timestamp monotonicity, and age).
   * Returns true if the tick was accepted, false if rejected (out-of-order or delayed).
   */
  public ingestTick(incoming: Tick): boolean {
    if (this.closed) return false;
    const lastSeq = this.symbolLastSequences.get(incoming.symbol);
    if (lastSeq !== undefined && incoming.sequence <= lastSeq) {
      this.symbolOutOfOrderCounts.set(
        incoming.symbol,
        (this.symbolOutOfOrderCounts.get(incoming.symbol) ?? 0) + 1
      );
      return false;
    }
    return this.applyTick(incoming);
  }

  private applyTick(incoming: Tick): boolean {
    if (this.closed) return false;
    const arrivalTime = Date.now();
    const hasExplicitEventTime =
      typeof incoming.event_time === 'number' ||
      (typeof incoming.ts === 'string' && incoming.ts.length > 0);
    const parsedTs = incoming.ts ? Date.parse(incoming.ts) : NaN;
    const eventTime = typeof incoming.event_time === 'number'
      ? incoming.event_time
      : (Number.isFinite(parsedTs) ? parsedTs : arrivalTime);

    const lastSeq = this.symbolLastSequences.get(incoming.symbol);
    const lastTickAt = this.symbolLastTickAt.get(incoming.symbol);

    // Regra 4: Rejeitar tick fora de ordem (timestamp < último aceito ou sequence < último aceito)
    if (
      (lastTickAt !== undefined && eventTime < lastTickAt) ||
      (lastSeq !== undefined && incoming.sequence < lastSeq)
    ) {
      this.symbolOutOfOrderCounts.set(
        incoming.symbol,
        (this.symbolOutOfOrderCounts.get(incoming.symbol) ?? 0) + 1
      );
      return false;
    }

    // Modo de falha 4: Rejeitar tick atrasado (Delayed tick: age > staleness threshold na chegada)
    const tickAgeAtArrival = Math.max(0, arrivalTime - eventTime);
    const threshold = (tickAgeAtArrival > 1000 || customSymbolThresholds.size > 0)
      ? getSymbolStalenessThresholdMs(incoming.symbol)
      : 4000;

    if (hasExplicitEventTime && tickAgeAtArrival > threshold) {
      this.symbolDelayedCounts.set(
        incoming.symbol,
        (this.symbolDelayedCounts.get(incoming.symbol) ?? 0) + 1
      );
      // Se o ativo não possui cotação fresca, garante que o estado reflita STALE
      const currentAge = lastTickAt !== undefined ? Math.max(0, arrivalTime - lastTickAt) : tickAgeAtArrival;
      if (currentAge > threshold) {
        this.transitionSymbolState(incoming.symbol, 'STALE', currentAge);
        if (this.symbolStaleStates.get(incoming.symbol) !== true) {
          this.symbolStaleStates.set(incoming.symbol, true);
          this.notifySymbolStalenessListeners(incoming.symbol, true, currentAge);
        }
      }
      return false;
    }

    incoming.event_time = eventTime;
    incoming.arrival_time = arrivalTime;
    incoming.latency_ms = tickAgeAtArrival;
    this.symbolLatencies.set(incoming.symbol, incoming.latency_ms);

    this.symbolLastSequences.set(incoming.symbol, incoming.sequence);
    this.symbolLastTickAt.set(incoming.symbol, eventTime);
    this.symbolLastPrices.set(incoming.symbol, incoming.price);
    if (this.symbolFallbackFailed.get(incoming.symbol)) {
      this.symbolFallbackFailed.set(incoming.symbol, false);
    }
    if (this.symbolStaleFallbackAttempted.get(incoming.symbol)) {
      this.symbolStaleFallbackAttempted.set(incoming.symbol, false);
    }

    const degradedThreshold = Math.floor(threshold * 0.5);
    const nextState: SymbolFeedState = tickAgeAtArrival > degradedThreshold ? 'DEGRADED' : 'LIVE';
    if (this.symbolFeedStates.get(incoming.symbol) !== nextState) {
      this.transitionSymbolState(incoming.symbol, nextState, tickAgeAtArrival);
    }

    // De-staleness imediata no recebimento de tick fresco
    if (this.symbolStaleStates.get(incoming.symbol) !== false) {
      this.symbolStaleStates.set(incoming.symbol, false);
      this.stale = false;
      this.notifySymbolStalenessListeners(incoming.symbol, false, tickAgeAtArrival);
    }

    const callbacks = this.symbolSubscribers.get(incoming.symbol);
    if (callbacks) {
      for (const cb of Array.from(callbacks)) {
        if (callbacks.has(cb)) {
          try { cb(incoming); } catch { /* ignore */ }
        }
      }
    }
    return true;
  }

  private notifySymbolStalenessListeners(symbol: string, isStale: boolean, ageMs: number) {
    const staleCbs = this.symbolStaleListeners.get(symbol);
    if (staleCbs) {
      for (const cb of Array.from(staleCbs)) {
        if (staleCbs.has(cb)) {
          try { cb(isStale, ageMs); } catch { /* ignore */ }
        }
      }
    }
  }

  private transitionSymbolState(symbol: string, nextState: SymbolFeedState, ageMs: number) {
    const prevState = this.symbolFeedStates.get(symbol);
    if (prevState !== nextState) {
      this.symbolFeedStates.set(symbol, nextState);
      const stateCbs = this.symbolStateListeners.get(symbol);
      if (stateCbs) {
        for (const cb of Array.from(stateCbs)) {
          if (stateCbs.has(cb)) {
            try { cb(nextState, ageMs); } catch { /* ignore */ }
          }
        }
      }
    }
  }

  /**
   * Regra 3 e 5: Executa REST fallback para símbolo STALE e marca como DEAD se o fallback falhar.
   */
  public async fetchRestFallback(symbol: string): Promise<boolean> {
    return this.triggerSnapshotRebuild(symbol);
  }

  public setAutoRestFallback(enabled: boolean): void {
    this.autoRestFallbackEnabled = enabled;
  }

  public async triggerSnapshotRebuild(symbol: string, initialGapTick?: Tick): Promise<boolean> {
    if (this.closed || this.symbolResyncing.get(symbol)) return false;
    this.symbolResyncing.set(symbol, true);
    const hadSubscribersAtStart = (this.symbolSubscribers.get(symbol)?.size ?? 0) > 0;

    let buffer = this.symbolTickBuffers.get(symbol);
    if (!buffer) {
      buffer = [];
      this.symbolTickBuffers.set(symbol, buffer);
    }
    if (initialGapTick) {
      buffer.push(initialGapTick);
    }

    // Tenta via REST snapshot endpoint (Subetapa 4 / Regra 3: REST fallback pra símbolo stale)
    try {
      const restBase = import.meta.env.VITE_API_URL ?? (
        typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3001'
      );
      const res = await fetch(`${restBase}/api/v1/snapshot?symbol=${encodeURIComponent(symbol)}`);
      if (this.closed || (hadSubscribersAtStart && !this.symbolSubscribers.has(symbol))) {
        this.symbolResyncing.delete(symbol);
        this.symbolTickBuffers.delete(symbol);
        return false;
      }
      if (res && res.ok) {
        const snap = await res.json();
        if (this.closed || (hadSubscribersAtStart && !this.symbolSubscribers.has(symbol))) {
          this.symbolResyncing.delete(symbol);
          this.symbolTickBuffers.delete(symbol);
          return false;
        }
        if (snap && Number.isSafeInteger(snap.sequence) && snap.price !== undefined) {
          const recovered = this.applySnapshotAndDrainBuffer(symbol, {
            sequence: Number(snap.sequence),
            price: String(snap.price),
            ts: typeof snap.ts === 'string' ? snap.ts : new Date().toISOString(),
            event_time: typeof snap.event_time === 'number' ? snap.event_time : undefined,
          });
          if (recovered) {
            return true;
          }
        }
      }
    } catch {
      // Fallback falhou
    }

    if (this.closed || (hadSubscribersAtStart && !this.symbolSubscribers.has(symbol))) {
      this.symbolResyncing.delete(symbol);
      this.symbolTickBuffers.delete(symbol);
      return false;
    }

    // Correção crítica: libera flag de resync para não travar futuros ticks WS no buffer
    this.symbolResyncing.set(symbol, false);

    // Regra 5: Marcar símbolo como DEAD se o fallback REST falhar
    this.markSymbolDead(symbol);

    // Pede catch-up / resubscribe via WS
    this.sendSubscribe(symbol, true);
    return false;
  }

  private markSymbolDead(symbol: string) {
    this.symbolFallbackFailed.set(symbol, true);
    this.symbolStaleStates.set(symbol, true);
    const last = this.symbolLastTickAt.get(symbol);
    const age = last ? Math.max(0, Date.now() - last) : 99999;
    this.transitionSymbolState(symbol, 'DEAD', age);
    this.notifySymbolStalenessListeners(symbol, true, age);
  }

  private applySnapshotAndDrainBuffer(
    symbol: string,
    snap: { sequence: number; price: string; ts: string; event_time?: number }
  ): boolean {
    if (this.closed) return false;
    const arrivalTime = Date.now();
    const parsedTs = snap.ts ? Date.parse(snap.ts) : NaN;
    const eventTime = typeof snap.event_time === 'number'
      ? snap.event_time
      : (Number.isFinite(parsedTs) ? parsedTs : arrivalTime);
    const latencyMs = Math.max(0, arrivalTime - eventTime);
    const threshold = getSymbolStalenessThresholdMs(symbol);
    const lastTickAt = this.symbolLastTickAt.get(symbol);

    // Rejeita snapshot cujo timestamp seja mais velho que o último aceito ou já esteja stale
    if ((lastTickAt !== undefined && eventTime < lastTickAt) || latencyMs > threshold) {
      this.symbolResyncing.set(symbol, false);
      return false;
    }

    this.symbolLastSequences.set(symbol, snap.sequence);
    this.symbolLastTickAt.set(symbol, eventTime);
    this.symbolLatencies.set(symbol, latencyMs);
    this.symbolLastPrices.set(symbol, snap.price);
    this.symbolFallbackFailed.set(symbol, false);
    this.symbolStaleFallbackAttempted.set(symbol, false);

    const degradedThreshold = Math.floor(threshold * 0.5);
    this.transitionSymbolState(symbol, latencyMs > degradedThreshold ? 'DEGRADED' : 'LIVE', latencyMs);

    // De-staleness imediata
    if (this.symbolStaleStates.get(symbol) !== false) {
      this.symbolStaleStates.set(symbol, false);
      this.stale = false;
      this.notifySymbolStalenessListeners(symbol, false, latencyMs);
    }

    // Notifica gráficos do snapshot com tick sintético
    const callbacks = this.symbolSubscribers.get(symbol);
    if (callbacks) {
      for (const cb of Array.from(callbacks)) {
        if (callbacks.has(cb)) {
          try {
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
          } catch { /* ignore */ }
        }
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
    return true;
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

    let initialTickTimer: ReturnType<typeof setTimeout> | null = null;

    // Se o WS ainda não conectou no modo convidado, emite o tick inicial imediatamente
    if (import.meta.env.VITE_DEMO_OFFLINE_FEED === '1' &&
      (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) && isGuestMode()) {
      const isCrypto = symbol.startsWith('BTC') || symbol.startsWith('ETH');
      const isJpy = symbol.includes('JPY');
      const precision = isCrypto ? 2 : isJpy ? 3 : getAssetBasePrice(symbol) > 500 ? 2 : 5;
      const initialPrice = this.symbolLastPrices.get(symbol) ?? getAssetBasePrice(symbol).toFixed(precision);
      this.symbolLastPrices.set(symbol, initialPrice);
      this.symbolLastTickAt.set(symbol, Date.now());
      this.symbolStaleStates.set(symbol, false);
      for (const listener of this.symbolStaleListeners.get(symbol) ?? []) listener(false, 0);
      const seq = this.symbolLastSequences.get(symbol) ?? 1000;
      initialTickTimer = setTimeout(() => {
        initialTickTimer = null;
        if (this.closed || !this.symbolSubscribers.get(symbol)?.has(callback)) return;
        try {
          callback({
            type: 'tick',
            symbol,
            sequence: seq,
            price: initialPrice,
            ts: new Date().toISOString(),
          });
        } catch { /* ignore */ }
      }, 0);
    }

    // Only send subscribe frame over WS if this is the FIRST chart asking for this symbol
    if (wasEmpty) {
      this.sendSubscribe(symbol, false);
    }

    // Return cleanup function for this specific chart
    return () => {
      if (initialTickTimer !== null) {
        clearTimeout(initialTickTimer);
        initialTickTimer = null;
      }
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
    const initialStale = this.isSymbolStale(symbol);
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

  public onSymbolStateChange(symbol: string, callback: SymbolStateCallback): () => void {
    let set = this.symbolStateListeners.get(symbol);
    if (!set) {
      set = new Set();
      this.symbolStateListeners.set(symbol, set);
    }
    set.add(callback);

    const last = this.symbolLastTickAt.get(symbol);
    const age = last ? Math.max(0, Date.now() - last) : Infinity;
    const initialState = this.getSymbolState(symbol);
    this.symbolFeedStates.set(symbol, initialState);
    callback(initialState, age === Infinity ? 99999 : age);

    return () => {
      set?.delete(callback);
      if (set?.size === 0) {
        this.symbolStateListeners.delete(symbol);
      }
    };
  }

  public getSymbolState(symbol: string): SymbolFeedState {
    if (this.symbolFallbackFailed.get(symbol)) return 'DEAD';
    const threshold = getSymbolStalenessThresholdMs(symbol);
    const degradedThreshold = Math.floor(threshold * 0.5);
    const last = this.symbolLastTickAt.get(symbol);

    if (!last) {
      return this.symbolFeedStates.get(symbol) ?? 'STALE';
    }

    if (!isGuestMode() && !this.connected && this.socket !== null) {
      return 'STALE';
    }

    const age = Math.max(0, Date.now() - last);
    if (age > threshold) return 'STALE';
    if (age > degradedThreshold) return 'DEGRADED';
    return 'LIVE';
  }

  public isSymbolStale(symbol: string): boolean {
    if (this.symbolFallbackFailed.get(symbol)) return true;
    const threshold = getSymbolStalenessThresholdMs(symbol);
    if (isGuestMode() && (this.symbolLastTickAt.get(symbol) ?? 0) > 0) {
      const last = this.symbolLastTickAt.get(symbol)!;
      return Date.now() - last > threshold;
    }
    if (!this.connected && this.socket !== null) return true;
    const last = this.symbolLastTickAt.get(symbol);
    if (!last) return true;
    return Date.now() - last > threshold;
  }

  public getSymbolTickAge(symbol: string): number {
    const last = this.symbolLastTickAt.get(symbol);
    if (!last) return Infinity;
    return Date.now() - last;
  }

  public getSymbolOutOfOrderCount(symbol: string): number {
    return this.symbolOutOfOrderCounts.get(symbol) ?? 0;
  }

  public getSymbolDelayedCount(symbol: string): number {
    return this.symbolDelayedCounts.get(symbol) ?? 0;
  }

  /**
   * Perigo 1 (Método 7): Retorna as 5 métricas obrigatórias de saúde do feed por símbolo.
   */
  public getSymbolFeedMetrics(symbol: string): SymbolFeedMetrics {
    const ageMs = this.getSymbolTickAge(symbol);
    return {
      symbol,
      tick_age_seconds: ageMs === Infinity ? -1 : Math.max(0, Number((ageMs / 1000).toFixed(3))),
      feed_gap_count: this.symbolGapCounts.get(symbol) ?? 0,
      latency_ms: this.symbolLatencies.get(symbol) ?? 0,
      staleness_alert: this.isSymbolStale(symbol),
      reconnect_count: this.symbolReconnectCounts.get(symbol) ?? this.totalReconnectCount,
    };
  }

  private notifyStatus() {
    for (const cb of this.statusListeners) cb(this.connected, this.stale);
  }

  private startGuestFallback() {
    if ((import.meta as any).env?.VITE_DEMO_OFFLINE_FEED !== '1') return;
    if (this.guestFallbackInterval) return;
    this.guestFallbackInterval = setInterval(() => {
      // Quando o WebSocket oficial está conectado, não interferir com ticks locais
      if (this.socket && this.socket.readyState === WebSocket.OPEN && this.connected) return;
      if (!isGuestMode()) return;

      const now = Date.now();
      for (const [symbol, callbacks] of this.symbolSubscribers.entries()) {
        if (!callbacks || callbacks.size === 0) continue;
        const lastTickTime = this.symbolLastTickAt.get(symbol) ?? 0;
        if (now - lastTickTime < 450) continue;

        let currentPrice = Number(this.symbolLastPrices.get(symbol));
        if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
          currentPrice = getAssetBasePrice(symbol);
        }

        const isCrypto = symbol.startsWith('BTC') || symbol.startsWith('ETH');
        const isJpy = symbol.includes('JPY');
        const step = isCrypto ? 2.5 : isJpy ? 0.02 : currentPrice > 500 ? 0.25 : 0.00015;
        const precision = isCrypto ? 2 : isJpy ? 3 : currentPrice > 500 ? 2 : 5;

        // Ornstein-Uhlenbeck drift leve em direção ao preço-base com ruído gaussiano (Box-Muller via CSPRNG)
        const simSeq = (this.symbolLastSequences.get(symbol) ?? 1000) + 1;
        const base = getAssetBasePrice(symbol);
        const pull = (base - currentPrice) * 0.015;
        
        // CSPRNG Web Crypto (Conformidade M-01 / B-06 / A-07): Proibição total de Math.random
        const randBuffer = new Uint32Array(2);
        if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
          window.crypto.getRandomValues(randBuffer);
        } else {
          randBuffer[0] = Math.floor(Date.now() % 4294967296);
          randBuffer[1] = Math.floor((Date.now() * 31) % 4294967296);
        }
        const u1 = Math.max(1e-15, (randBuffer[0] + 1) / 4294967297.0);
        const u2 = (randBuffer[1] + 1) / 4294967297.0;
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const noise = z * step * 0.75;
        const nextPrice = Math.max(0.0001, currentPrice + pull + noise);
        const priceStr = nextPrice.toFixed(precision);

        this.symbolLastSequences.set(symbol, simSeq);
        this.symbolLastPrices.set(symbol, priceStr);
        this.symbolLastTickAt.set(symbol, now);
        this.symbolStaleStates.set(symbol, false);
        this.symbolFallbackFailed.set(symbol, false);
        this.transitionSymbolState(symbol, 'LIVE', 0);

        const tick: Tick = {
          type: 'tick',
          symbol,
          sequence: simSeq,
          price: priceStr,
          ts: new Date(now).toISOString(),
        };

        for (const cb of callbacks) {
          try { cb(tick); } catch { /* ignore */ }
        }

        const staleListeners = this.symbolStaleListeners.get(symbol);
        if (staleListeners) {
          for (const cb of staleListeners) {
            try { cb(false, 0); } catch { /* ignore */ }
          }
        }
      }

      if (this.stale && this.symbolSubscribers.size > 0) {
        this.stale = false;
        this.notifyStatus();
      }
    }, 500);
  }

  private startStaleChecker() {
    this.staleInterval = setInterval(() => {
      const now = Date.now();

      const trackedSymbols = new Set<string>([
        ...this.symbolStaleListeners.keys(),
        ...this.symbolStateListeners.keys(),
        ...this.symbolSubscribers.keys(),
        ...this.symbolLastTickAt.keys(),
      ]);

      // 1. Checagem individual por símbolo (LIVE -> DEGRADED -> STALE -> DEAD)
      for (const symbol of trackedSymbols) {
        const last = this.symbolLastTickAt.get(symbol);
        const age = last ? Math.max(0, now - last) : Infinity;
        const threshold = getSymbolStalenessThresholdMs(symbol);
        const isDead = this.symbolFallbackFailed.get(symbol) === true;
        const isStale = isDead || (isGuestMode()
          ? (age > threshold)
          : ((!this.connected && this.socket !== null) || age > threshold));

        const nextState = this.getSymbolState(symbol);
        this.transitionSymbolState(symbol, nextState, age === Infinity ? 99999 : age);

        const prevStale = this.symbolStaleStates.get(symbol);
        if (prevStale !== isStale) {
          this.symbolStaleStates.set(symbol, isStale);
          this.notifySymbolStalenessListeners(symbol, isStale, age === Infinity ? 99999 : age);
        }

        if (
          this.autoRestFallbackEnabled &&
          nextState === 'STALE' &&
          !this.symbolStaleFallbackAttempted.get(symbol)
        ) {
          this.symbolStaleFallbackAttempted.set(symbol, true);
          void this.triggerSnapshotRebuild(symbol);
        }
      }

      // 2. Conectividade global de fallback
      let anyRecent = false;
      for (const [symbol, last] of this.symbolLastTickAt.entries()) {
        if (now - last < getSymbolStalenessThresholdMs(symbol) && !this.symbolFallbackFailed.get(symbol)) {
          anyRecent = true;
          break;
        }
      }
      const newStale = this.symbolLastTickAt.size > 0 ? !anyRecent : (!this.connected && !isGuestMode());
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
    if (this.guestFallbackInterval) clearInterval(this.guestFallbackInterval);
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

  public getLastPrice(symbol: string): string | null {
    return this.symbolLastPrices.get(symbol) ?? null;
  }

  // Perigo 6 (Técnica 3): Limite estrito de 4–6 charts simultâneos na mesma aba
  public static readonly MAX_CONCURRENT_CHARTS = 6;
  private activeChartInstances = new Set<string>();

  public registerChartInstance(chartId: string): {
    allowed: boolean;
    activeCount: number;
    maxAllowed: number;
    warning?: string;
  } {
    if (this.activeChartInstances.has(chartId)) {
      return {
        allowed: true,
        activeCount: this.activeChartInstances.size,
        maxAllowed: TradingFeedManager.MAX_CONCURRENT_CHARTS,
      };
    }

    if (this.activeChartInstances.size >= TradingFeedManager.MAX_CONCURRENT_CHARTS) {
      return {
        allowed: false,
        activeCount: this.activeChartInstances.size,
        maxAllowed: TradingFeedManager.MAX_CONCURRENT_CHARTS,
        warning: `MAX_CHARTS_LIMIT_REACHED: Limite máximo de ${TradingFeedManager.MAX_CONCURRENT_CHARTS} gráficos simultâneos atingido.`,
      };
    }

    this.activeChartInstances.add(chartId);
    return {
      allowed: true,
      activeCount: this.activeChartInstances.size,
      maxAllowed: TradingFeedManager.MAX_CONCURRENT_CHARTS,
    };
  }

  public unregisterChartInstance(chartId: string): void {
    this.activeChartInstances.delete(chartId);
  }

  public getActiveChartCount(): number {
    return this.activeChartInstances.size;
  }
}

// Global shared singleton for the browser window
export const tradingFeedManager = new TradingFeedManager();
