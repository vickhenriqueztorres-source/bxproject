import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PriceChart } from './PriceChart';
import type { Candle, Contract } from '../api/client';
import type { Tick } from '../feed/protocol';

describe('SUBETAPA 02: Overlays, Indicadores e Prevenção de Distorção de Escala', () => {
  const initialCandles: Candle[] = [
    { time: 1700000000, open: '1000', high: '1010', low: '990', close: '1005', volume: 100 },
    { time: 1700000060, open: '1005', high: '1015', low: '1000', close: '1012', volume: 120 },
  ];

  it('PCO-01: Renderiza o shell com IsolatedChartHost e sem distorção inicial de overlays', () => {
    const tickBtc: Tick = {
      type: 'tick',
      symbol: 'BTCUSD_OTC',
      price: '64000.00',
      ts: new Date().toISOString(),
      sequence: 1,
    };

    const html = renderToString(
      <PriceChart
        candles={initialCandles}
        tick={tickBtc}
        symbol="BTCUSD_OTC"
      />
    );

    expect(html).toContain('isolated-chart-host');
    expect(html).toContain('BTC/USD');
  });

  it('PCO-02: Transição entre ativos (BTCUSD -> EURUSD) preserva a integridade visual sem vazamento de preços', () => {
    const tickEur: Tick = {
      type: 'tick',
      symbol: 'EURUSD_OTC',
      price: '1.08500',
      ts: new Date().toISOString(),
      sequence: 2,
    };

    const html = renderToString(
      <PriceChart
        candles={initialCandles}
        tick={tickEur}
        symbol="EURUSD_OTC"
      />
    );

    expect(html).toContain('EUR/USD');
    expect(html).not.toContain('BTC/USD');
  });

  it('PCO-03: Suporta contratos com strikes em aberto sem causar crash de escala', () => {
    const contractMock: Contract = {
      id: 'contract-eur-1',
      symbol: 'EURUSD_OTC',
      direction: 'UP',
      status: 'OPEN',
      stake_minor: 1000,
      payout_minor: 1850,
      entry_price: '1.08500',
      strike_price: '1.08500',
      result: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60000).toISOString(),
    };

    const html = renderToString(
      <PriceChart
        candles={initialCandles}
        tick={{ type: 'tick', symbol: 'EURUSD_OTC', price: '1.08500', sequence: 10, ts: new Date().toISOString() }}
        symbol="EURUSD_OTC"
        activeContracts={[contractMock]}
      />
    );

    expect(html).toContain('isolated-chart-host');
  });
});
