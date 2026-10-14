import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OrderFlagsOverlay } from './OrderFlagsOverlay';
import type { Contract } from '../api/client';
import { setTraderoomPolishEnabled } from '../lib/traderoom-polish';

// Este arquivo cobre o overlay anterior (uma etiqueta por contrato). Ver chart/subetapa-polish-04-positions.
setTraderoomPolishEnabled(false);

describe('SUBETAPA 7.3 — Sincronismo Geométrico no Zoom/Pan (OrderFlagsOverlay)', () => {
  const mockOpenContract: Contract = {
    id: 'contract-sync-test',
    symbol: 'VOL_50',
    direction: 'UP',
    stake_minor: 1000,
    status: 'OPEN',
    result: null,
    payout_minor: null,
    expires_at: new Date(Date.now() + 45000).toISOString(),
    created_at: new Date().toISOString(),
    entry_price: 1250.0,
    strike_price: 1250.0,
  };

  const createMockChartInstance = () => {
    let subscriber: (() => void) | null = null;
    const subscribeMock = vi.fn((cb: () => void) => {
      subscriber = cb;
    });
    const unsubscribeMock = vi.fn(() => {
      subscriber = null;
    });

    const timeScaleMock = {
      subscribeVisibleTimeRangeChange: subscribeMock,
      unsubscribeVisibleTimeRangeChange: unsubscribeMock,
    };

    const chartInstance = {
      timeScale: vi.fn(() => timeScaleMock),
      triggerRangeChange: () => {
        if (subscriber) subscriber();
      },
      subscribeMock,
      unsubscribeMock,
    };

    return chartInstance;
  };

  it('T7.3-01: Aceita chartInstance e renderiza sem erros no servidor', () => {
    const mockChart = createMockChartInstance();

    const html = renderToString(
      <OrderFlagsOverlay
        contracts={[mockOpenContract]}
        currentPrice={1250}
        containerWidth={800}
        containerHeight={500}
        activeSeries={null}
        chartInstance={mockChart as any}
      />
    );

    expect(html).toContain('order-flags-overlay');
    expect(html).toContain('contract-sync-test');
  });

  it('T7.3-02: Executa triggerRangeChange no mock sem quebrar', () => {
    const mockChart = createMockChartInstance();

    renderToString(
      <OrderFlagsOverlay
        contracts={[mockOpenContract]}
        currentPrice={1250}
        containerWidth={800}
        containerHeight={500}
        activeSeries={null}
        chartInstance={mockChart as any}
      />
    );

    expect(() => {
      mockChart.triggerRangeChange();
    }).not.toThrow();
  });

  it('T7.3-03 (Estresse): Suporta 5.000 alterações de escala sucessivas no mock em menos de 100ms', () => {
    const mockChart = createMockChartInstance();

    renderToString(
      <OrderFlagsOverlay
        contracts={[mockOpenContract]}
        currentPrice={1250}
        containerWidth={800}
        containerHeight={500}
        activeSeries={null}
        chartInstance={mockChart as any}
      />
    );

    const start = performance.now();
    for (let i = 0; i < 5000; i++) {
      mockChart.triggerRangeChange();
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('T7.3-04 (Caos & Resiliência): Captura exceção em chartInstance corrompido sem derrubar a tela', () => {
    const brokenChart = {
      timeScale: () => {
        throw new Error('CORRUPTED_CANVAS_CONTEXT');
      },
    };

    expect(() => {
      renderToString(
        <OrderFlagsOverlay
          contracts={[mockOpenContract]}
          currentPrice={1250}
          containerWidth={800}
          containerHeight={500}
          activeSeries={null}
          chartInstance={brokenChart as any}
        />
      );
    }).not.toThrow();
  });
});
