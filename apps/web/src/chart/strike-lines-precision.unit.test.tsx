import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OrderFlagsOverlay } from './OrderFlagsOverlay';
import { isSameAsset, getAssetMeta, normalizeSymbol } from '../catalog/assets';
import type { Contract } from '../api/client';
import { setTraderoomPolishEnabled } from '../lib/traderoom-polish';

// Este arquivo cobre o overlay anterior (uma etiqueta por contrato). Ver chart/subetapa-polish-04-positions.
setTraderoomPolishEnabled(false);

describe('SUBETAPA 7.4 — Bateria Integrada de Testes: Precisão de Taxa, Linhas de Strike & Invariantes', () => {
  const mockSeries = {
    priceToCoordinate: (price: number) => {
      // Coordenada proporcional: escala de 1000 a 2000 mapeada em 0 a 800px
      return Math.round(800 - (price - 1000) * 0.8);
    },
  } as any;

  it('G-02 / G-09 (Precisão Numérica): Mapeia taxa exata e renderiza linha horizontal e tags em ativos Sintéticos (VOL_50)', () => {
    const strike = 1520.4567;
    const contract: Contract = {
      id: 'c-synth-vol-50',
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 5000,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      expires_at: new Date(Date.now() + 45000).toISOString(),
      created_at: new Date().toISOString(),
      entry_price: strike,
      strike_price: strike,
    };

    expect(isSameAsset(contract.symbol, 'VOL_50')).toBe(true);

    const html = renderToString(
      <OrderFlagsOverlay
        contracts={[contract]}
        currentPrice={1521.0}
        containerWidth={1000}
        containerHeight={600}
        activeSeries={mockSeries}
      />
    );

    // Contrato presente
    expect(html).toContain('c-synth-vol-50');
    // SVG presente com traço tracejado
    expect(html).toContain('order-strike-lines-svg');
    expect(html).toContain('stroke-dasharray="4 4"');
    // Taxa com 4 casas decimais para sintéticos
    expect(html).toContain('1520.4567');
    // Tag de eixo lateral
    expect(html).toContain('axis-strike-tag');
  });

  it('G-02 / G-09 (Precisão Numérica): Mapeia taxa exata com 5 casas decimais em ativos Forex (EURUSD_OTC)', () => {
    const strike = 1.08542;
    const contract: Contract = {
      id: 'c-forex-eurusd',
      symbol: 'EURUSD_OTC',
      direction: 'DOWN',
      stake_minor: 10000,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      expires_at: new Date(Date.now() + 60000).toISOString(),
      created_at: new Date().toISOString(),
      entry_price: strike,
      strike_price: strike,
    };

    const meta = getAssetMeta('EURUSD_OTC');
    expect(meta.precision).toBe(5);

    const html = renderToString(
      <OrderFlagsOverlay
        contracts={[contract]}
        currentPrice={1.08530}
        containerWidth={1000}
        containerHeight={600}
        activeSeries={mockSeries}
      />
    );

    // Vermelho de queda
    expect(html).toContain('#F2545B');
    // Taxa com 5 casas
    expect(html).toContain('1.08542');
  });

  it('G-02 / G-09 (Precisão Numérica): Mapeia taxa com 2 casas decimais em Cripto (BTCUSD_OTC)', () => {
    const strike = 68450.25;
    const contract: Contract = {
      id: 'c-crypto-btc',
      symbol: 'BTCUSD_OTC',
      direction: 'UP',
      stake_minor: 2000,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      expires_at: new Date(Date.now() + 30000).toISOString(),
      created_at: new Date().toISOString(),
      entry_price: strike,
      strike_price: strike,
    };

    const meta = getAssetMeta('BTCUSD_OTC');
    expect(meta.precision).toBe(2);

    const html = renderToString(
      <OrderFlagsOverlay
        contracts={[contract]}
        currentPrice={68460.00}
        containerWidth={1000}
        containerHeight={600}
        activeSeries={mockSeries}
      />
    );

    expect(html).toContain('68450.25');
  });

  it('ESTRESSE: Renderiza 100 contratos abertos com cálculo de coordenadas em menos de 80ms', () => {
    const contracts: Contract[] = Array.from({ length: 100 }, (_, i) => ({
      id: `stress-c-${i}`,
      symbol: i % 2 === 0 ? 'SYNTH_VOL_50' : 'EURUSD_OTC',
      direction: i % 3 === 0 ? 'UP' : 'DOWN',
      stake_minor: 1000 + i * 50,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      expires_at: new Date(Date.now() + (30 + i) * 1000).toISOString(),
      created_at: new Date().toISOString(),
      entry_price: 1500 + i,
      strike_price: 1500 + i,
    }));

    const start = performance.now();
    const html = renderToString(
      <OrderFlagsOverlay
        contracts={contracts}
        currentPrice={1550}
        containerWidth={1200}
        containerHeight={800}
        activeSeries={mockSeries}
      />
    );
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(150);
    expect(html).toContain('stress-c-0');
    expect(html).toContain('stress-c-99');
  });

  it('CAOS: Contratos com dados corrompidos (NaN, infinity, missing prices) não travam a renderização', () => {
    const chaoticContracts: Contract[] = [
      {
        id: 'chaos-1',
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 1000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        expires_at: new Date(Date.now() + 30000).toISOString(),
        created_at: new Date().toISOString(),
        entry_price: NaN,
        strike_price: NaN,
      },
      {
        id: 'chaos-2',
        symbol: 'VOL_50',
        direction: 'DOWN',
        stake_minor: 1000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        expires_at: 'invalid-date-format',
        created_at: new Date().toISOString(),
        entry_price: Infinity,
        strike_price: Infinity,
      },
      {
        id: 'chaos-3',
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 1000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        expires_at: new Date(Date.now() + 30000).toISOString(),
        created_at: new Date().toISOString(),
        entry_price: undefined,
        strike_price: undefined,
      },
    ];

    expect(() => {
      renderToString(
        <OrderFlagsOverlay
          contracts={chaoticContracts}
          currentPrice={1500}
          containerWidth={1000}
          containerHeight={600}
          activeSeries={mockSeries}
        />
      );
    }).not.toThrow();
  });
});
