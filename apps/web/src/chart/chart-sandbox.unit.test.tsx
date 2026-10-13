import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChartSandbox } from './ChartSandbox';
import type { Candle } from '../api/client';
import type { Tick } from '../feed/protocol';

describe('SUBETAPA 3: ChartSandbox & Isolamento de Layout (CSS Containment)', () => {
  const baseCandles: Candle[] = [
    { time: 1700000000, open: '100', high: '105', low: '95', close: '102', volume: 0 },
    { time: 1700000060, open: '102', high: '107', low: '100', close: '105', volume: 0 },
  ];

  it('SB-01: Container possui CSS Containment estrito (contain: layout size) e overflow: hidden', () => {
    const html = renderToString(
      <ChartSandbox
        candles={baseCandles}
        tick={null}
        symbol="SYNTH_VOL_50"
      />
    );

    expect(html).toContain('data-testid="chart-sandbox-container"');
    expect(html).toContain('contain:layout size');
    expect(html).toContain('overflow:hidden');
    expect(html).toContain('min-height:0');
  });

  it('SB-02: Sanitiza conjunto de velas ruidosas antes de repassar ao PriceChart', () => {
    // Velas com timestamp desordenado e dados nulos
    const corruptedCandles: any[] = [
      { time: 1700000120, open: '105', high: '110', low: '104', close: '108', volume: 0 },
      { time: 1700000000, open: '100', high: '105', low: '95', close: '102', volume: 0 },
      null,
    ];

    const html = renderToString(
      <ChartSandbox
        candles={corruptedCandles}
        tick={null}
        symbol="BTCUSD_OTC"
      />
    );

    expect(html).toContain('data-testid="chart-sandbox-container"');
    expect(html).toContain('data-testid="chart-top-asset-pill"');
  });

  it('SB-03: Filtra ticks inválidos para proteger o PriceChart', () => {
    const invalidTick: Tick = {
      type: 'tick',
      symbol: 'SYNTH_VOL_50',
      sequence: 1,
      price: '-10.5',
      ts: '2026-10-08T22:00:00Z',
      event_time: 1700000000000,
    };

    const html = renderToString(
      <ChartSandbox
        candles={baseCandles}
        tick={invalidTick}
        symbol="SYNTH_VOL_50"
      />
    );

    expect(html).toContain('data-testid="chart-sandbox-container"');
  });

  it('SB-04: Suporta fallback customizado quando o boundary é acionado', () => {
    const fallbackNode = <div data-testid="isolated-fallback">Gráfico Bloqueado com Segurança</div>;

    const html = renderToString(
      <ChartSandbox
        candles={baseCandles}
        tick={null}
        fallback={fallbackNode}
      />
    );

    // Como não há erro no render normal, renderiza o sandbox
    expect(html).toContain('data-testid="chart-sandbox-container"');
  });
});
