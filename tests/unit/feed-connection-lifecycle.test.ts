import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../apps/web/src/auth/oidc', () => ({ isGuestMode: () => true, accessToken: async () => 'unit-token' }));
vi.mock('../../apps/web/src/feed/staggered-startup', () => ({ getStaggeredDelay: () => 0 }));
import { TradingFeedManager, tradingFeedManager } from '../../apps/web/src/feed/TradingFeedManager';

class Socket {
  static OPEN = 1; static CONNECTING = 0; static instances: Socket[] = [];
  readyState = 0;
  onopen?: () => Promise<void>;
  onclose?: () => void;
  onerror?: () => void;
  onmessage?: (event: { data: string }) => void;
  send = vi.fn();
  constructor() { Socket.instances.push(this); }
  close() { this.readyState = 3; }
  async open() { this.readyState = 1; await this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}
const symbol = 'NZDUSD_OTC';
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
let manager: TradingFeedManager;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-09T16:00:00Z'));
  vi.stubGlobal('WebSocket', Socket); Socket.instances = [];
  vi.stubEnv('VITE_DEMO_OFFLINE_FEED', '0');
  manager = new TradingFeedManager('ws://unit.invalid');
});
afterEach(() => { manager.disconnect(); tradingFeedManager.disconnect(); vi.clearAllTimers();
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('[G-07] feed boot connection regressions', () => {
  it('opens one socket when three callers connect before the token bucket resolves', async () => {
    manager.connect(true); manager.connect(true); manager.connect(true);
    await flush();
    expect(Socket.instances).toHaveLength(1);
  });
  it('rejects close, error and tick callbacks from a superseded socket', async () => {
    const status = vi.fn(); const ticks = vi.fn();
    manager.onStatusChange(status); manager.subscribeSymbol(symbol, ticks);
    manager.connect(true); await flush();
    const old = Socket.instances[0]; old.readyState = 3;
    manager.connect(true); await flush();
    await Socket.instances[1].open();
    const deliveries = ticks.mock.calls.length;
    old.onclose?.(); old.onerror?.();
    old.message({ type: 'snapshot', symbol, sequence: 40, price: '0.90000', ts: new Date().toISOString() });
    expect(status.mock.calls.at(-1)?.[0]).toBe(true);
    expect(ticks.mock.calls).toHaveLength(deliveries);
  });
  it('notifies every chart that quotes resumed after overlapping subscriptions', async () => {
    const grid = vi.fn(); const dash = vi.fn();
    manager.subscribeSymbol(symbol, vi.fn()); manager.onSymbolStaleness(symbol, grid);
    manager.onSymbolStaleness(symbol, dash); manager.subscribeSymbol(symbol, vi.fn());
    manager.connect(true); await flush(); await Socket.instances[0].open();
    Socket.instances[0].message({ type: 'snapshot', symbol, sequence: 40, price: '0.59820', ts: new Date().toISOString() });
    expect(grid.mock.calls.at(-1)?.[0]).toBe(false);
    expect(dash.mock.calls.at(-1)?.[0]).toBe(false);
  });
  it('emits only server prices at boot even if the server sequence starts below 1000', async () => {
    const ticks = vi.fn(); manager.subscribeSymbol(symbol, ticks);
    await vi.advanceTimersByTimeAsync(600);
    expect(ticks).not.toHaveBeenCalled();
    manager.connect(true); await flush(); await Socket.instances[0].open();
    Socket.instances[0].message({ type: 'snapshot', symbol, sequence: 40, price: '0.59820', ts: new Date().toISOString() });
    expect(ticks.mock.calls.map(([tick]) => [tick.sequence, tick.price])).toEqual([[40, '0.59820']]);
  });
});
