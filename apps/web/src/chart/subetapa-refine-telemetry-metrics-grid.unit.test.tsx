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

describe('SUBETAPA 03: Microtipografia Suíça, Rótulos Bicolunares & Divisores de Grade no PriceChart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps = {
    candles: [],
    symbol: 'SYNTH_VOL_50',
  };

  const sampleContract: Contract = {
    id: 'ctr-active-grid-1',
    symbol: 'SYNTH_VOL_50',
    direction: 'UP',
    stake_minor: 10000, // $100.00
    strike_price: 500.0,
    entry_price: 500.0,
    status: 'OPEN',
    opened_at: new Date('2026-10-11T11:59:30.000Z').toISOString(),
    expires_at: new Date('2026-10-11T12:00:02.000Z').toISOString(),
    payout_minor: 8500, // +$85.00
  };

  it('3.1 Renderiza os rótulos harmônicos das 3 métricas oficiais', () => {
    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={[sampleContract]}
        tick={{ price: '505.00', ts: '2026-10-11T12:00:00.000Z', sequence: 501 }}
      />
    );

    // Rótulos oficiais das 3 métricas
    expect(html).toContain('HORA DE COMPRA');
    expect(html).toContain('INVERSIÓN TOTAL');
    expect(html).toContain('GANANCIA ESPERADA');
    expect(html).not.toContain('LUCRO APÓS A VENDA');
  });

  it('3.2 Renderiza tipografia precisa em Geist Mono e divisores de 32px', () => {
    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={[sampleContract]}
        tick={{ price: '505.00', ts: '2026-10-11T12:00:00.000Z', sequence: 502 }}
      />
    );

    // Tipografia Geist Mono
    expect(html).toContain('Geist Mono');

    // Divisores de grade técnica
    expect(html).toContain('height:32px');
    expect(html).toContain('background:rgba(255, 255, 255, 0.12)');

    // 3 Colunas com valores esperados
    expect(html).toContain('$100.00');
    expect(html).toContain('+$85.00');
  });

  it('3.3 ESTRESSE: Renderiza 50 ciclos sob alta frequência em menos de 300ms', () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      renderToString(
        <PriceChart
          {...baseProps}
          contracts={[sampleContract]}
          tick={{ price: (500 + i).toString(), ts: '2026-10-11T12:00:00.000Z', sequence: 600 + i }}
        />
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(300);
  });
});
