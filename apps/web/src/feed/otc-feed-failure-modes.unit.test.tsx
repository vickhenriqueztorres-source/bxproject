import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/oidc', () => ({
  isGuestMode: () => false,
  accessToken: async () => 'test-jwt-token',
}));

vi.mock('./staggered-startup', () => ({
  getStaggeredDelay: () => 0,
}));

import {
  TradingFeedManager,
  type SymbolFeedState,
} from './TradingFeedManager';
import { StalenessOverlay } from '../chart/StalenessOverlay';
import { setNewTraderoomEnabled } from '../lib/feature-flags';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen?: () => Promise<void> | void;
  onclose?: () => void;
  onerror?: () => void;
  onmessage?: (event: { data: string }) => void;
  send = vi.fn();

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  async openAndAuthenticate() {
    this.readyState = MockWebSocket.OPEN;
    await this.onopen?.();
    this.emitServerMessage({ type: 'auth_ok' });
  }

  emitServerMessage(payload: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('OTC Feed Resilience — 6 Modos de Falha & Máquina de Estados (LIVE → DEGRADED → STALE → DEAD)', () => {
  let manager: TradingFeedManager;
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T12:00:00.000Z'));
    vi.stubGlobal('WebSocket', MockWebSocket);
    MockWebSocket.instances = [];
    vi.stubEnv('VITE_DEMO_OFFLINE_FEED', '0');
    setNewTraderoomEnabled(true);
    manager = new TradingFeedManager('ws://otc-unit.invalid/ws');
  });

  afterEach(() => {
    manager.disconnect();
    globalThis.fetch = origFetch;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('Cenário Canônico de 6 Passos: WS aberto sem ticks por 30s → UI mostra "STALE" → Tick fora de ordem rejeitado → Fallback REST recupera preço', async () => {
    const symbol = 'EURUSD_OTC';
    const receivedPrices: string[] = [];
    let uiStale = false;
    let uiAgeMs = 0;
    let uiState: SymbolFeedState = 'LIVE';

    manager.subscribeSymbol(symbol, (tick) => {
      receivedPrices.push(tick.price);
    });
    manager.onSymbolStaleness(symbol, (stale, age) => {
      uiStale = stale;
      uiAgeMs = age;
    });
    manager.onSymbolStateChange(symbol, (state) => {
      uiState = state;
    });

    manager.connect(true);
    await flushMicrotasks();
    const ws = MockWebSocket.instances[0];
    await ws.openAndAuthenticate();

    // Tick inicial válido e fresco em t = 0s (sequence = 1)
    const t0Iso = new Date(Date.now()).toISOString();
    ws.emitServerMessage({
      type: 'tick',
      symbol,
      sequence: 1,
      price: '1.08500',
      ts: t0Iso,
    });

    expect(manager.getLastPrice(symbol)).toBe('1.08500');
    expect(manager.getSymbolState(symbol)).toBe('LIVE');
    expect(uiStale).toBe(false);

    // 1. Simula WebSocket aberto (readyState === OPEN), mas sem ticks por 30 segundos (Silent Feed Freeze)
    await vi.advanceTimersByTimeAsync(30_000);

    expect(ws.readyState).toBe(MockWebSocket.OPEN);
    expect(manager.getSymbolState(symbol)).toBe('STALE');
    expect(manager.isSymbolStale(symbol)).toBe(true);
    expect(uiStale).toBe(true);
    expect(uiState).toBe('STALE');

    // 2. Verifica se a UI mostra "STALE" (e não preço velho como live)
    const staleHtml = renderToString(
      <StalenessOverlay
        isStale={uiStale}
        symbol={symbol}
        tickAgeMs={uiAgeMs}
        feedState={uiState}
      />
    );
    expect(staleHtml).toContain('data-testid="staleness-state-badge"');
    expect(staleHtml).toContain('>STALE<');
    expect(staleHtml).toContain('data-feed-state="STALE"');

    // 3. Simula tick fora de ordem (timestamp anterior ao último aceito t0Iso, mesmo com sequence = 2)
    const olderTsIso = new Date(Date.parse(t0Iso) - 5_000).toISOString();
    ws.emitServerMessage({
      type: 'tick',
      symbol,
      sequence: 2,
      price: '1.01000', // Preço velho/falso que tentaria sobrescrever 1.08500
      ts: olderTsIso,
    });

    // Também testa sequence <= último aceito (sequence = 1 <= 1)
    ws.emitServerMessage({
      type: 'tick',
      symbol,
      sequence: 1,
      price: '1.02000',
      ts: new Date(Date.now()).toISOString(),
    });

    // 4. Verifica se os ticks fora de ordem foram rejeitados e não sobrescreveram o preço
    expect(manager.getLastPrice(symbol)).toBe('1.08500');
    expect(receivedPrices).toEqual(['1.08500']);
    expect(manager.getSymbolOutOfOrderCount(symbol)).toBe(2);
    expect(manager.getSymbolState(symbol)).toBe('STALE');

    // 5. Simula fallback REST (/api/v1/snapshot) retornando cotação fresca
    const recoveryTsIso = new Date(Date.now()).toISOString();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol,
        sequence: 105,
        price: '1.08950',
        ts: recoveryTsIso,
      }),
    }) as any;

    const recovered = await manager.fetchRestFallback(symbol);

    // 6. Verifica se o preço volta e o estado retorna para LIVE
    expect(recovered).toBe(true);
    expect(manager.getLastPrice(symbol)).toBe('1.08950');
    expect(receivedPrices).toEqual(['1.08500', '1.08950']);
    expect(manager.getSymbolState(symbol)).toBe('LIVE');
    expect(manager.isSymbolStale(symbol)).toBe(false);
    expect(uiStale).toBe(false);
    expect(uiState).toBe('LIVE');

    const recoveredHtml = renderToString(
      <StalenessOverlay
        isStale={uiStale}
        symbol={symbol}
        tickAgeMs={uiAgeMs}
        feedState={uiState}
      />
    );
    expect(recoveredHtml).toBe('');
  });

  it('Máquina de Estados por Símbolo: transita progressivamente LIVE → DEGRADED → STALE → DEAD (quando fallback REST falha)', async () => {
    const symbol = 'BTCUSD_OTC'; // Threshold de BTC = 4500ms (DEGRADED > 2250ms, STALE > 4500ms)
    const observedStates: SymbolFeedState[] = [];

    manager.subscribeSymbol(symbol, vi.fn());
    manager.connect(true);
    await flushMicrotasks();
    const ws = MockWebSocket.instances[0];
    await ws.openAndAuthenticate();

    ws.emitServerMessage({
      type: 'tick',
      symbol,
      sequence: 1,
      price: '65000.00',
      ts: new Date(Date.now()).toISOString(),
    });

    manager.onSymbolStateChange(symbol, (state) => {
      observedStates.push(state);
    });
    expect(manager.getSymbolState(symbol)).toBe('LIVE');

    // Avança 3 segundos (2250ms < 3000ms <= 4500ms) -> DEGRADED
    await vi.advanceTimersByTimeAsync(3_000);
    expect(manager.getSymbolState(symbol)).toBe('DEGRADED');
    expect(manager.isSymbolStale(symbol)).toBe(false);

    // Avança mais 2 segundos (total 5000ms > 4500ms) -> STALE
    await vi.advanceTimersByTimeAsync(2_000);
    expect(manager.getSymbolState(symbol)).toBe('STALE');
    expect(manager.isSymbolStale(symbol)).toBe(true);

    // Simula falha no fallback REST (HTTP 503 Service Unavailable) -> DEAD
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as any;

    const ok = await manager.fetchRestFallback(symbol);
    expect(ok).toBe(false);
    expect(manager.getSymbolState(symbol)).toBe('DEAD');
    expect(manager.isSymbolStale(symbol)).toBe(true);
    expect(observedStates).toEqual(['LIVE', 'DEGRADED', 'STALE', 'DEAD']);

    // Verifica renderização do estado DEAD na UI
    const deadHtml = renderToString(
      <StalenessOverlay
        isStale={true}
        symbol={symbol}
        tickAgeMs={5000}
        feedState={manager.getSymbolState(symbol)}
      />
    );
    expect(deadHtml).toContain('DEAD · STALE');
    expect(deadHtml).toContain('data-feed-state="DEAD"');

    // Garante que falha do fallback REST não travou symbolResyncing: novo tick WS fresco recupera para LIVE
    ws.emitServerMessage({
      type: 'tick',
      symbol,
      sequence: 2,
      price: '65120.00',
      ts: new Date(Date.now()).toISOString(),
    });
    expect(manager.getSymbolState(symbol)).toBe('LIVE');
    expect(manager.getLastPrice(symbol)).toBe('65120.00');
  });

  it('Partial Symbol Starvation: health check por símbolo detecta ativo congelado enquanto outro ativo na mesma conexão WS continua LIVE', async () => {
    const aliveSymbol = 'EURUSD_OTC';
    const starvedSymbol = 'GBPUSD_OTC';

    manager.subscribeSymbol(aliveSymbol, vi.fn());
    manager.subscribeSymbol(starvedSymbol, vi.fn());
    manager.connect(true);
    await flushMicrotasks();
    const ws = MockWebSocket.instances[0];
    await ws.openAndAuthenticate();

    // Ambos recebem tick inicial em t = 0
    const initialIso = new Date(Date.now()).toISOString();
    ws.emitServerMessage({ type: 'tick', symbol: aliveSymbol, sequence: 1, price: '1.08000', ts: initialIso });
    ws.emitServerMessage({ type: 'tick', symbol: starvedSymbol, sequence: 1, price: '1.26000', ts: initialIso });

    // Durante 10 segundos, apenas EURUSD_OTC recebe ticks a cada 1s; GBPUSD_OTC congela silenciosamente
    for (let s = 1; s <= 10; s++) {
      await vi.advanceTimersByTimeAsync(1_000);
      ws.emitServerMessage({
        type: 'tick',
        symbol: aliveSymbol,
        sequence: 1 + s,
        price: (1.08 + s * 0.0001).toFixed(5),
        ts: new Date(Date.now()).toISOString(),
      });
    }

    expect(manager.getSymbolState(aliveSymbol)).toBe('LIVE');
    expect(manager.isSymbolStale(aliveSymbol)).toBe(false);

    expect(manager.getSymbolState(starvedSymbol)).toBe('STALE');
    expect(manager.isSymbolStale(starvedSymbol)).toBe(true);
  });

  it('Delayed Ticks: rejeita tick que chega pelo WebSocket já com idade maior que o threshold (parece novo mas é velho)', async () => {
    const symbol = 'EURUSD_OTC'; // Threshold = 4000ms
    const delivered: string[] = [];

    manager.subscribeSymbol(symbol, (t) => delivered.push(t.price));
    manager.connect(true);
    await flushMicrotasks();
    const ws = MockWebSocket.instances[0];
    await ws.openAndAuthenticate();

    // Tick com timestamp de 8 segundos atrás (atrasado na fila/rede)
    const delayedTs = new Date(Date.now() - 8_000).toISOString();
    ws.emitServerMessage({
      type: 'tick',
      symbol,
      sequence: 1,
      price: '1.07500',
      ts: delayedTs,
    });

    expect(delivered).toHaveLength(0);
    expect(manager.getSymbolDelayedCount(symbol)).toBe(1);
    expect(manager.getSymbolState(symbol)).toBe('STALE');
    expect(manager.isSymbolStale(symbol)).toBe(true);
  });
});
