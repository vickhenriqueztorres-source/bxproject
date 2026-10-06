import { accessToken, isGuestMode } from '../auth/oidc';
import { reconnectDelay } from './backoff';
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

export class TradingFeedManager {
  private socket: WebSocket | null = null;
  private symbolSubscribers = new Map<string, Set<TickCallback>>();
  private symbolLastSequences = new Map<string, number>();
  private symbolLastTickAt = new Map<string, number>();
  private privateListeners = new Set<PrivateCallback>();
  private statusListeners = new Set<StatusCallback>();

  private connected = false;
  private stale = true;
  private attempt = 0;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001/ticks') {
    this.startStaleChecker();
  }

  public setWsUrl(url: string) {
    if (this.wsUrl !== url) {
      this.wsUrl = url;
      this.disconnect();
      this.connect();
    }
  }

  public connect() {
    if (this.closed || (this.socket && this.socket.readyState === WebSocket.OPEN)) return;
    if (isGuestMode()) {
      // Guest mode operates against real backend gateway if available, but without blocking on OIDC token
      this.connectInternal(true);
      return;
    }
    this.connectInternal(false);
  }

  private connectInternal(guest: boolean) {
    try {
      this.socket = new WebSocket(this.wsUrl);
    } catch {
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
          this.notifyStatus();
          this.resubscribeAll();
        }
      } catch {
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

      if (data.type === 'authenticated') {
        this.connected = true;
        this.attempt = 0;
        this.notifyStatus();
        this.resubscribeAll();
        return;
      }

      if (data.type === 'snapshot' && typeof data.symbol === 'string' && Number.isSafeInteger(data.sequence)) {
        const symbol = data.symbol;
        this.symbolLastSequences.set(symbol, Number(data.sequence));
        const ts = typeof data.ts === 'string' ? Date.parse(data.ts) : Date.now();
        this.symbolLastTickAt.set(symbol, ts);
        return;
      }

      if (data.type === 'tick' && typeof data.symbol === 'string' && typeof data.price === 'string') {
        const incoming = data as Tick;
        const lastSeq = this.symbolLastSequences.get(incoming.symbol) ?? 0;
        const action = tickAction(lastSeq, incoming.sequence);

        if (action === 'duplicate') return;
        if (action === 'gap') {
          // Catch-up request via single connection
          this.sendSubscribe(incoming.symbol, true);
          return;
        }

        this.symbolLastSequences.set(incoming.symbol, incoming.sequence);
        this.symbolLastTickAt.set(incoming.symbol, Date.parse(incoming.ts));

        const callbacks = this.symbolSubscribers.get(incoming.symbol);
        if (callbacks) {
          for (const cb of callbacks) cb(incoming);
        }
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
      if (!this.closed) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.attempt += 1;
    const delay = reconnectDelay(this.attempt);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private resubscribeAll() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    for (const [symbol, callbacks] of this.symbolSubscribers.entries()) {
      if (callbacks.size > 0) {
        this.sendSubscribe(symbol, true);
      }
    }
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

  private sendUnsubscribe(symbol: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'unsubscribe', symbol }));
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
          this.sendUnsubscribe(symbol);
        }
      }
    };
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

  private notifyStatus() {
    for (const cb of this.statusListeners) cb(this.connected, this.stale);
  }

  private startStaleChecker() {
    this.staleInterval = setInterval(() => {
      const now = Date.now();
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
}

// Global shared singleton for the browser window
export const tradingFeedManager = new TradingFeedManager();
