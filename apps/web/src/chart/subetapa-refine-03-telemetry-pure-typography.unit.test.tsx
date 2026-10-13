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

describe('SUBETAPA REFINE 03: Telemetria In-Chart Pura Sem Card (Tipografia Flutuante & 4 Colunas)', () => {
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

  const sampleContract: Contract = {
    id: 'ctr-active-1',
    symbol: 'EURUSD_OTC',
    direction: 'UP',
    stake_minor: 10000, // $100.00
    strike_price: 1.0800,
    entry_price: 1.0800,
    status: 'OPEN',
    opened_at: new Date('2026-10-11T11:59:40.000Z').toISOString(),
    expires_at: new Date('2026-10-11T12:00:38.000Z').toISOString(),
    payout_minor: 8500, // +$85.00
  };

  it('3.1 A barra de telemetria NÃO possui borda opaca de card nem background pesado', () => {
    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={[sampleContract]}
        tick={{ price: '1.0850', ts: '2026-10-11T12:00:00.000Z', sequence: 201 }}
      />
    );

    expect(html).toContain('data-testid="chart-trade-telemetry-strip"');
    // Não deve possuir bordas de card colorido com glow
    expect(html).not.toContain('border:1px solid rgba(34, 196, 122, 0.3)');
    expect(html).not.toContain('border:1px solid rgba(229, 72, 77, 0.3)');
    // Deve possuir background transparente flutuante diretamente no gráfico
    expect(html).toContain('background:transparent');
    expect(html).toContain('border:none');
  });

  it('3.2 Renderiza valores numéricos tabulares em 18px Geist Mono e rótulos oficiais', () => {
    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={[sampleContract]}
        tick={{ price: '1.0850', ts: '2026-10-11T12:00:00.000Z', sequence: 202 }}
      />
    );

    // Tipografia ampliada de precisão (18px)
    expect(html).toContain('font-size:18px');
    expect(html).toContain('Geist Mono');

    // As 3 métricas oficiais (sem venda antecipada)
    expect(html).toContain('HORA DE COMPRA');
    expect(html).toContain('INVERSIÓN TOTAL');
    expect(html).toContain('GANANCIA ESPERADA');
    expect(html).not.toContain('LUCRO APÓS A VENDA');

    // Divisores de coluna sutis de 32px
    expect(html).toContain('height:32px');
    expect(html).toContain('background:rgba(255, 255, 255, 0.12)');
  });
});
