import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MultiChartGrid, type GridLayout } from './MultiChartGrid';
import { normalizeSeedWithTick, safeCandleFromTick, detectPriceScaleAnomaly } from './chart-scale-normalizer';
import type { Candle } from '../api/client';
import type { Tick } from '../feed/protocol';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('[SUBETAPA 03] Testes de Caos, Estresse e Isolamento Multi-Gráficos', () => {
  const dummyContracts: any[] = [];
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it('CHAOS-01: MultiChartGrid renderiza layouts 1x1, 2x1, 2x2 e 3x2 sem exceptions no SSR/DOM', () => {
    const layouts: GridLayout[] = ['1x1', '2x1', '2x2', '3x2'];

    for (const layout of layouts) {
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MultiChartGrid
            activeSymbol="EURUSD_OTC"
            onActiveSymbolChange={vi.fn()}
            allContracts={dummyContracts}
            layout={layout}
          />
        </QueryClientProvider>
      );
      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(50);
    }
  });

  it('CHAOS-02: Isolamento Estrito: 6 gráficos com símbolos heterogêneos recebem rajadas sem contaminação cruzada', () => {
    const symbols = [
      'EURUSD_OTC',
      'BTCUSD_OTC',
      'XAUUSD_OTC',
      'SYNTH_VOL_50',
      'ETHUSD_OTC',
      'SOLUSD_OTC',
    ];

    const symbolPrices: Record<string, number> = {
      EURUSD_OTC: 1.0854,
      BTCUSD_OTC: 64850.0,
      XAUUSD_OTC: 2652.8,
      SYNTH_VOL_50: 1250.0,
      ETHUSD_OTC: 3450.0,
      SOLUSD_OTC: 152.4,
    };

    // Gera 1.000 rajadas de ticks distribuídas aleatoriamente entre os símbolos
    for (let i = 0; i < 1000; i++) {
      const sym = symbols[i % symbols.length];
      const base = symbolPrices[sym];
      const tickPrice = (base * (1 + (Math.sin(i) * 0.001))).toFixed(4);

      const tick: Tick = {
        type: 'tick',
        sequence: i + 1,
        symbol: sym,
        price: tickPrice,
        ts: new Date((1700000000 + i) * 1000).toISOString(),
      };

      const seed: Candle[] = [
        {
          time: 1700000000,
          open: String(base),
          high: String(base * 1.001),
          low: String(base * 0.999),
          close: String(base),
          volume: 10,
        },
      ];

      const normalized = normalizeSeedWithTick(seed, tick);
      expect(normalized.length).toBe(1);

      // Garante que o candle do EURUSD nunca assuma preço de BTCUSD ou vice-versa
      const closeNum = Number(normalized[0].close);
      if (sym === 'EURUSD_OTC') {
        expect(closeNum).toBeLessThan(2.0);
      } else if (sym === 'BTCUSD_OTC') {
        expect(closeNum).toBeGreaterThan(50000.0);
      }
    }
  });

  it('CHAOS-03: Resiliência contra Ticks Tóxicos (NaN, negativos, timestamps corrompidos)', () => {
    const prev = {
      time: 1700000000 as any,
      open: 1.0854,
      high: 1.0860,
      low: 1.0850,
      close: 1.0855,
    };

    const toxicTicks: any[] = [
      { symbol: 'EURUSD_OTC', price: null, ts: '2026-01-01' },
      { symbol: 'EURUSD_OTC', price: undefined, ts: '2026-01-01' },
      { symbol: 'EURUSD_OTC', price: 'Infinity', ts: '2026-01-01' },
      { symbol: 'EURUSD_OTC', price: '-999.0', ts: '2026-01-01' },
      { symbol: 'EURUSD_OTC', price: '0', ts: '2026-01-01' },
      { symbol: 'EURUSD_OTC', price: '1.0856', ts: 'invalid_date' },
      null,
      undefined,
    ];

    for (const toxic of toxicTicks) {
      const res = safeCandleFromTick(toxic, prev, '1m');
      // Deve descartar silenciosamente sem jogar exception nem corromper
      expect(res).toBeNull();
    }
  });

  it('CHAOS-04: Transição rápida entre escalas ordinais opostas é detectada com sucesso', () => {
    // BTC para EURUSD
    expect(detectPriceScaleAnomaly(64850.0, 1.0854)).toBe(true);
    // EURUSD para BTC
    expect(detectPriceScaleAnomaly(1.0854, 64850.0)).toBe(true);
    // Preços próximos
    expect(detectPriceScaleAnomaly(100.0, 100.5)).toBe(false);
  });
});
