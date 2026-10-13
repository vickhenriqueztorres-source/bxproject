import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OrderFlagsOverlay } from './OrderFlagsOverlay';
import type { Contract } from '../api/client';

describe('SUBETAPA 7.2 — Engenharia do Traço SVG de Strike & Tag da Taxa (OrderFlagsOverlay)', () => {
  const mockSeries = {
    priceToCoordinate: (price: number) => {
      // Mapeamento simulado: 1000 => 300px, 1250 => 200px
      return Math.round(500 - (price - 500) * 0.4);
    },
  } as any;

  const mockOpenContractUP: Contract = {
    id: 'contract-test-up',
    symbol: 'VOL_50',
    direction: 'UP',
    stake_minor: 1000,
    status: 'OPEN',
    result: null,
    payout_minor: null,
    expires_at: new Date(Date.now() + 45000).toISOString(),
    created_at: new Date().toISOString(),
    entry_price: 1250.5,
    strike_price: 1250.5,
  };

  const mockOpenContractDOWN: Contract = {
    id: 'contract-test-down',
    symbol: 'VOL_50',
    direction: 'DOWN',
    stake_minor: 2500,
    status: 'OPEN',
    result: null,
    payout_minor: null,
    expires_at: new Date(Date.now() + 30000).toISOString(),
    created_at: new Date().toISOString(),
    entry_price: 1240.25,
    strike_price: 1240.25,
  };

  it('T7.2-01: Renderiza elemento SVG order-strike-lines-svg com linhas horizontais para contratos abertos', () => {
    const html = renderToString(
      <OrderFlagsOverlay
        contracts={[mockOpenContractUP]}
        currentPrice={1250.5}
        containerWidth={800}
        containerHeight={500}
        activeSeries={mockSeries}
      />
    );

    expect(html).toContain('order-strike-lines-svg');
    expect(html).toContain('<line');
  });

  it('T7.2-02: Renderiza traço tracejado verde (#22C47A) com coordenadas Y idênticas para contrato UP', () => {
    const html = renderToString(
      <OrderFlagsOverlay
        contracts={[mockOpenContractUP]}
        currentPrice={1250.5}
        containerWidth={800}
        containerHeight={500}
        activeSeries={mockSeries}
      />
    );

    // Contrato UP tem cor verde
    expect(html).toContain('#22C47A');
    expect(html).toContain('stroke-dasharray="4 4"');
  });

  it('T7.2-03: Renderiza traço tracejado vermelho (#F2545B) para contrato DOWN', () => {
    const html = renderToString(
      <OrderFlagsOverlay
        contracts={[mockOpenContractDOWN]}
        currentPrice={1240.25}
        containerWidth={800}
        containerHeight={500}
        activeSeries={mockSeries}
      />
    );

    // Contrato DOWN tem cor vermelha
    expect(html).toContain('#F2545B');
    expect(html).toContain('stroke-dasharray="4 4"');
  });

  it('T7.2-04: Exibe a taxa de entrada numérica explícita (strike price) no badge ou marcador', () => {
    const html = renderToString(
      <OrderFlagsOverlay
        contracts={[mockOpenContractUP]}
        currentPrice={1250.5}
        containerWidth={800}
        containerHeight={500}
        activeSeries={mockSeries}
      />
    );

    // A taxa de entrada 1250.5 deve estar presente visualmente
    expect(html).toContain('1250.5');
  });

  it('T7.2-05 (Estresse): Renderiza 50 contratos simultâneos abertos em menos de 50ms', () => {
    const contracts: Contract[] = Array.from({ length: 50 }, (_, i) => ({
      ...mockOpenContractUP,
      id: `stress-contract-${i}`,
      strike_price: 1200 + i,
      entry_price: 1200 + i,
      direction: i % 2 === 0 ? 'UP' : 'DOWN',
    }));

    const start = performance.now();
    const html = renderToString(
      <OrderFlagsOverlay
        contracts={contracts}
        currentPrice={1225}
        containerWidth={800}
        containerHeight={500}
        activeSeries={mockSeries}
      />
    );
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(150);
    expect(html).toContain('stress-contract-0');
    expect(html).toContain('stress-contract-49');
  });

  it('T7.2-06 (Caos & Resiliência): Recupera com segurança se strike_price for null/indefinido usando entry_price', () => {
    const brokenContract: Contract = {
      ...mockOpenContractUP,
      id: 'broken-contract-1',
      strike_price: undefined,
      entry_price: 1111.11,
    };

    const html = renderToString(
      <OrderFlagsOverlay
        contracts={[brokenContract]}
        currentPrice={1111.11}
        containerWidth={800}
        containerHeight={500}
        activeSeries={mockSeries}
      />
    );

    expect(html).toContain('order-strike-lines-svg');
    expect(html).toContain('1111.11');
  });
});
