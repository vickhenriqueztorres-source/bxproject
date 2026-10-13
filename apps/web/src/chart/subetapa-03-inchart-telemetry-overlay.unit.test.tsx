import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PriceChart } from './PriceChart';
import type { Contract } from '../api/client';

vi.mock('../lib/feature-flags', () => ({
  isNewTraderoomEnabled: () => true,
}));

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    applyOptions: vi.fn(),
    addCandlestickSeries: vi.fn(() => ({
      setData: vi.fn(),
      update: vi.fn(),
      priceToCoordinate: vi.fn(() => 100),
      coordinateToPrice: vi.fn(() => 100),
    })),
    addAreaSeries: vi.fn(() => ({
      setData: vi.fn(),
      update: vi.fn(),
      priceToCoordinate: vi.fn(() => 100),
      coordinateToPrice: vi.fn(() => 100),
    })),
    remove: vi.fn(),
    timeScale: vi.fn(() => ({
      fitContent: vi.fn(),
      scrollToPosition: vi.fn(),
      coordinateToTime: vi.fn(),
      timeToCoordinate: vi.fn(() => 200),
      coordinateToLogical: vi.fn(() => 50),
      logicalToCoordinate: vi.fn(() => 60),
    })),
  })),
}));

describe('SUBETAPA 03: Barra de Telemetria In-Chart (4 Métricas em Tempo Real)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps = {
    candles: [],
    symbol: 'EURUSD_OTC',
  };

  it('3.1 Gráfico sem contratos ativos NÃO renderiza a barra de telemetria', () => {
    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={[]}
        tick={{ price: '1.0850', ts: '2026-10-11T12:00:00.000Z', sequence: 100 }}
      />
    );

    expect(html).not.toContain('data-testid="chart-trade-telemetry-strip"');
    expect(html).not.toContain('HORA DE COMPRA');
  });

  it('3.2 Gráfico com contrato em lucro (ITM) exibe as 4 métricas e valores verdes', () => {
    const now = Date.now();
    const activeContract: Contract = {
      id: 'ctr-active-1',
      symbol: 'EURUSD_OTC',
      direction: 'UP',
      stake_minor: 1000, // $10.00
      strike_price: 1.0800,
      entry_price: 1.0800,
      status: 'OPEN',
      opened_at: new Date(now - 20000).toISOString(),
      expires_at: new Date(now + 26000).toISOString(),
      payout_minor: 861, // +$8.61
    };

    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={[activeContract]}
        tick={{ price: '1.0850', ts: '2026-10-11T12:00:00.000Z', sequence: 101 }} // Preço acima do strike -> ITM
      />
    );

    expect(html).toContain('data-testid="chart-trade-telemetry-strip"');
    // Rótulos oficiais das 3 colunas (sem venda antecipada)
    expect(html).toContain('HORA DE COMPRA');
    expect(html).toContain('INVERSIÓN TOTAL');
    expect(html).toContain('GANANCIA ESPERADA');
    expect(html).not.toContain('LUCRO APÓS A VENDA');
    // Valores
    expect(html).toContain('$10.00');
    expect(html).toContain('data-telemetry-status="winning"');
  });

  it('3.3 Gráfico com contrato em prejuízo (OTM) exibe as 4 métricas e valores vermelhos', () => {
    const now = Date.now();
    const activeContract: Contract = {
      id: 'ctr-active-2',
      symbol: 'EURUSD_OTC',
      direction: 'UP',
      stake_minor: 1000, // $10.00
      strike_price: 1.0850,
      entry_price: 1.0850,
      status: 'OPEN',
      opened_at: new Date(now - 30000).toISOString(),
      expires_at: new Date(now + 4000).toISOString(),
    };

    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={[activeContract]}
        tick={{ price: '1.0800', ts: '2026-10-11T12:00:00.000Z', sequence: 102 }} // Preço abaixo do strike -> OTM
      />
    );

    expect(html).toContain('data-testid="chart-trade-telemetry-strip"');
    expect(html).toContain('$10.00');
    expect(html).toContain('-$10.00');
    expect(html).toContain('data-telemetry-status="losing"');
  });
});
