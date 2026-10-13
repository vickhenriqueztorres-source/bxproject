import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PriceChart } from './PriceChart';
import { setNewTraderoomEnabled } from '../lib/feature-flags';

describe('[SUBETAPA 03] Desacoplamento de UI e Overlays no PriceChart', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  const baseProps = {
    candles: [],
    tick: {
      type: 'tick' as const,
      symbol: 'SYNTH_VOL_50',
      sequence: 1,
      price: '123.45',
      ts: new Date().toISOString(),
      event_time: Date.now(),
      latency_ms: 10,
    },
    symbol: 'SYNTH_VOL_50',
    activeContracts: [],
    isStale: false,
    isVisible: true,
    onSelectSymbol: vi.fn(),
  };

  it('PCD-01: PriceChart integra o IsolatedChartHost na árvore de renderização', () => {
    const html = renderToString(<PriceChart {...baseProps} />);
    expect(html).toContain('isolated-chart-host');
    expect(html).toContain('aria-label="Canvas Gráfico Isolado de Trading"');
  });

  it('PCD-02: Preserva geometria e min-height contra colapsos de flexbox (Causa 3)', () => {
    const html = renderToString(<PriceChart {...baseProps} />);
    expect(html).toContain('min-height:350px');
  });

  it('PCD-03: Suporta contratos ativos dinâmicos sem estourar erros de renderização', () => {
    const contractsMock: any[] = [
      {
        id: 'c-1',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        status: 'OPEN',
        strike_price: 120.0,
        stake_minor: 1000,
      },
    ];

    const html = renderToString(
      <PriceChart {...baseProps} activeContracts={contractsMock} />
    );
    expect(html).toContain('isolated-chart-host');
  });

  it('PCD-04: Respeita tema Binmax Turbo Prata no container e toolbars', () => {
    const html = renderToString(<PriceChart {...baseProps} />);
    expect(html).toContain('SYNTH_VOL_50');
    expect(html).toContain('data-testid="chart-top-asset-pill"');
  });
});
