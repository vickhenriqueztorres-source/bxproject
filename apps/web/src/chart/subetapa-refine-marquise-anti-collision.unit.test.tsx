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

describe('SUBETAPA 02: Marquise Superior Protegida & Desobstrução Óptica no PriceChart', () => {
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

  const activeContract: Contract = {
    id: 'ctr-active-marquise',
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

  it('2.1 A marquise superior possui vidro óptico acetinado (backdrop-filter) para blindar leitura contra linhas e pavios', () => {
    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={[activeContract]}
        tick={{ price: '505.00', ts: '2026-10-11T12:00:00.000Z', sequence: 301 }}
      />
    );

    expect(html).toContain('data-testid="chart-trade-telemetry-strip"');

    // Superfície de vidro óptico fosco / acetinado
    expect(html).toContain('backdrop-filter:blur(16px)');
    expect(html).toContain('background:rgba(11, 14, 20, 0.78)');
    expect(html).toContain('border:1px solid rgba(244, 245, 247, 0.08)');
    expect(html).toContain('border-radius:6px');

    // Não deve possuir bordas de cassino com glow verde/vermelho
    expect(html).not.toContain('border:1px solid rgba(34, 196, 122, 0.3)');
    expect(html).not.toContain('border:1px solid rgba(229, 72, 77, 0.3)');
  });

  it('2.2 ESTRESSE: Renderiza 100 atualizações consecutivas de telemetria em menos de 500ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      renderToString(
        <PriceChart
          {...baseProps}
          contracts={[activeContract]}
          tick={{ price: (500 + (i % 10)).toString(), ts: '2026-10-11T12:00:00.000Z', sequence: 400 + i }}
        />
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
