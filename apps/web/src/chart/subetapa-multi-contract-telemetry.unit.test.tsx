/**
 * SUBETAPA 01: Testes de Agregação de Telemetria Multi-Ordens no PriceChart
 *
 * Reproduz o cenário em que o usuário abre 2 ou mais ordens no mesmo ativo:
 * Exemplo: 2 ordens de $100 -> Investimento Total DEVE ser $200.00 (e não $100.00).
 */
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

describe('SUBETAPA 01: Agregação de Telemetria Multi-Ordens no PriceChart', () => {
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

  const now = new Date('2026-10-11T12:00:00.000Z').getTime();

  it('1.1 Duas ordens de $100 no lucro (ITM) devem exibir Investimento Total = $200.00 e Lucro Esperado = +$170.00', () => {
    const contracts: Contract[] = [
      {
        id: 'ord-1',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000, // $100.00
        strike_price: 497.10,
        entry_price: 497.10,
        status: 'OPEN',
        opened_at: new Date(now - 10000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
        payout_minor: 8500, // +$85.00
      },
      {
        id: 'ord-2',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000, // $100.00
        strike_price: 497.50,
        entry_price: 497.50,
        status: 'OPEN',
        opened_at: new Date(now - 5000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
        payout_minor: 8500, // +$85.00
      },
    ];

    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={contracts}
        tick={{ price: '498.00', ts: '2026-10-11T12:00:00.000Z', sequence: 1001 }} // Acima de ambos -> Ambos ganhando
      />
    );

    expect(html).toContain('data-testid="chart-trade-telemetry-strip"');
    // Deve exibir $200.00 e NUNCA apenas $100.00
    expect(html).toContain('$200.00');
    // Lucro esperado agregado de ambas as ordens: +$85 + +$85 = +$170.00
    expect(html).toContain('+$170.00');
    expect(html).toContain('data-telemetry-status="winning"');
  });

  it('1.2 Duas ordens de $100 no prejuízo (OTM) devem exibir Investimento Total = $200.00 e Perda = -$200.00', () => {
    const contracts: Contract[] = [
      {
        id: 'ord-1',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000, // $100.00
        strike_price: 501.00,
        entry_price: 501.00,
        status: 'OPEN',
        opened_at: new Date(now - 10000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
        payout_minor: 8500,
      },
      {
        id: 'ord-2',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000, // $100.00
        strike_price: 502.00,
        entry_price: 502.00,
        status: 'OPEN',
        opened_at: new Date(now - 5000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
        payout_minor: 8500,
      },
    ];

    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={contracts}
        tick={{ price: '498.00', ts: '2026-10-11T12:00:00.000Z', sequence: 1002 }} // Abaixo de ambos -> Ambos perdendo
      />
    );

    expect(html).toContain('$200.00');
    expect(html).toContain('-$200.00');
    expect(html).toContain('data-telemetry-status="losing"');
  });

  it('1.3 Posições mistas (1 Ganhando e 1 Perdendo) calculam o P&L líquido corretamente', () => {
    const contracts: Contract[] = [
      {
        id: 'ord-win',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000, // $100.00
        strike_price: 490.00, // Preço atual 495.00 -> GANHANDO (+$85.00)
        entry_price: 490.00,
        status: 'OPEN',
        opened_at: new Date(now - 10000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
        payout_minor: 8500,
      },
      {
        id: 'ord-loss',
        symbol: 'SYNTH_VOL_50',
        direction: 'DOWN',
        stake_minor: 10000, // $100.00
        strike_price: 490.00, // Preço atual 495.00 -> PERDENDO (-$100.00)
        entry_price: 490.00,
        status: 'OPEN',
        opened_at: new Date(now - 5000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
        payout_minor: 8500,
      },
    ];

    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={contracts}
        tick={{ price: '495.00', ts: '2026-10-11T12:00:00.000Z', sequence: 1003 }}
      />
    );

    expect(html).toContain('$200.00');
    // Saldo líquido: +$85.00 - $100.00 = -$15.00
    expect(html).toContain('-$15.00');
    expect(html).toContain('data-telemetry-status="losing"');
  });

  it('1.4 Isolamento de Ativos: contratos de outro símbolo NÃO somam na telemetria deste gráfico', () => {
    const contracts: Contract[] = [
      {
        id: 'ord-this-symbol',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000, // $100.00
        strike_price: 497.00,
        entry_price: 497.00,
        status: 'OPEN',
        opened_at: new Date(now - 10000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
      },
      {
        id: 'ord-other-symbol',
        symbol: 'EURUSD_OTC',
        direction: 'UP',
        stake_minor: 50000, // $500.00 em outro par
        strike_price: 1.0850,
        entry_price: 1.0850,
        status: 'OPEN',
        opened_at: new Date(now - 5000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
      },
    ];

    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={contracts}
        tick={{ price: '498.00', ts: '2026-10-11T12:00:00.000Z', sequence: 1004 }}
      />
    );

    // Deve exibir estritamente $100.00 e NUNCA $600.00
    expect(html).toContain('$100.00');
    expect(html).not.toContain('$600.00');
  });

  it('1.5 ESTRESSE: Agrega 10 ordens simultâneas de valores variados em menos de 100ms', () => {
    const tenContracts: Contract[] = Array.from({ length: 10 }, (_, i) => ({
      id: `ord-stress-${i}`,
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 5000, // $50 cada -> Total 10 * 50 = $500.00
      strike_price: 490.00 + i,
      entry_price: 490.00 + i,
      status: 'OPEN',
      opened_at: new Date(now - 10000).toISOString(),
      expires_at: new Date(now + 50000).toISOString(),
      payout_minor: 4250, // +$42.50 cada
    }));

    const start = performance.now();
    const html = renderToString(
      <PriceChart
        {...baseProps}
        contracts={tenContracts}
        tick={{ price: '505.00', ts: '2026-10-11T12:00:00.000Z', sequence: 1005 }}
      />
    );
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(html).toContain('$500.00');
    expect(html).toContain('+$425.00'); // 10 * 42.50 = +$425.00
  });

  it('1.6 SEGURANÇA: Resiste a contratos com campos nulos, NaN ou stake zerada sem crash', () => {
    const corruptedContracts: Contract[] = [
      {
        id: 'ord-corrupt-1',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: NaN as unknown as number,
        strike_price: undefined,
        entry_price: undefined,
        status: 'OPEN',
        opened_at: new Date(now - 10000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
      },
      {
        id: 'ord-corrupt-2',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000,
        strike_price: 495.0,
        entry_price: 495.0,
        status: 'OPEN',
        opened_at: new Date(now - 5000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
      },
    ];

    expect(() => {
      const html = renderToString(
        <PriceChart
          {...baseProps}
          contracts={corruptedContracts}
          tick={{ price: '500.00', ts: '2026-10-11T12:00:00.000Z', sequence: 1006 }}
        />
      );
      expect(html).toContain('data-testid="chart-trade-telemetry-strip"');
    }).not.toThrow();
  });
});
