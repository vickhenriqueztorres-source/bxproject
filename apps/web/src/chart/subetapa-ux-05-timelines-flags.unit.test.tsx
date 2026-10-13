import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TimeLinesOverlay } from './TimeLinesOverlay';
import { OrderFlagsOverlay } from './OrderFlagsOverlay';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import type { Contract } from '../api/client';

describe('SUBETAPA UX 05: Sofisticação de Hora de Compra, Expiração e Flags de Ordens', () => {
  const mockContracts: Contract[] = [
    {
      id: 'contract-sube-1',
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 10000,
      payout_minor: 18500,
      result: null,
      status: 'OPEN',
      entry_price: 152.721,
      strike_price: 152.721,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 55000).toISOString(),
    },
    {
      id: 'contract-baja-2',
      symbol: 'SYNTH_VOL_50',
      direction: 'DOWN',
      stake_minor: 25000,
      payout_minor: 46250,
      result: null,
      status: 'OPEN',
      entry_price: 152.85,
      strike_price: 152.85,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 42000).toISOString(),
    },
  ];

  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  describe('5.1 TimeLinesOverlay (Régua Temporal de Compra e Expiração)', () => {
    it('Renderiza HORA DE COMPRA e EXPIRACIÓN com design institucional escuro e Geist Mono', () => {
      const html = renderToString(
        <TimeLinesOverlay
          containerWidth={1000}
          containerHeight={600}
          chartInstance={null}
          latestCandleTime={null}
          timeframe="1m"
        />
      );

      // Linha de compra e tag
      expect(html).toContain('data-testid="purchase-time-line"');
      expect(html).toContain('data-testid="time-tag-purchase"');
      expect(html).toContain('HORA DE COMPRA');
      expect(html).toContain('Geist Mono');

      // Linha de expiração e tag
      expect(html).toContain('data-testid="expiration-time-line"');
      expect(html).toContain('data-testid="time-tag-expiration"');
      expect(html).toContain('EXPIRACIÓN');
      expect(html).toContain('background:rgba(15, 20, 28, 0.92)');

      // Não deve conter emoji de relógio no modo Binmax
      expect(html).not.toContain('⏱️');
    });

    it('Padrão Duas Portas: Modo Legado preserva emojis ⏱️, 🔴 e 🚩', () => {
      setFeatureFlagForTesting(false);
      const htmlLegacy = renderToString(
        <TimeLinesOverlay
          containerWidth={1000}
          containerHeight={600}
          chartInstance={null}
          latestCandleTime={null}
          timeframe="1m"
        />
      );

      expect(htmlLegacy).toContain('⏱️');
      expect(htmlLegacy).toContain('🔴');
      expect(htmlLegacy).toContain('background:#ff3d71');
    });
  });

  describe('5.2 OrderFlagsOverlay (Cápsulas de Strike de Ordens Abertas)', () => {
    it('Renderiza cápsula institucional translúcida, ícone circular e stake formatado em $', () => {
      const html = renderToString(
        <OrderFlagsOverlay
          contracts={mockContracts}
          currentPrice={152.75}
          containerWidth={1000}
          containerHeight={600}
          activeSeries={null}
        />
      );

      // Flag UP ($100)
      expect(html).toContain('data-testid="order-flag-contract-sube-1"');
      expect(html).toContain('data-testid="flag-stake-contract-sube-1"');
      expect(html).toContain('$100');
      expect(html).toContain('▲');

      // Flag DOWN ($250)
      expect(html).toContain('data-testid="order-flag-contract-baja-2"');
      expect(html).toContain('data-testid="flag-stake-contract-baja-2"');
      expect(html).toContain('$250');
      expect(html).toContain('▼');

      // Fundo translúcido institucional sem halo difuso saturado
      expect(html).toContain('background:rgba(18, 24, 38, 0.94)');
      expect(html).toContain('backdrop-filter:blur(8px)');
      expect(html).toContain('right:76px');
    });

    it('Padrão Duas Portas: Modo Legado preserva gradientes saturados e right 80px', () => {
      setFeatureFlagForTesting(false);
      const htmlLegacy = renderToString(
        <OrderFlagsOverlay
          contracts={mockContracts}
          currentPrice={152.75}
          containerWidth={1000}
          containerHeight={600}
          activeSeries={null}
        />
      );

      expect(htmlLegacy).toContain('linear-gradient(135deg');
      expect(htmlLegacy).toContain('right:80px');
    });

    it('Teste de Estresse: Renderiza 50 ordens simultâneas em < 200ms', () => {
      const manyContracts: Contract[] = Array.from({ length: 50 }).map((_, idx) => ({
        id: `stress-contract-${idx}`,
        symbol: 'SYNTH_VOL_50',
        direction: idx % 2 === 0 ? 'UP' : 'DOWN',
        stake_minor: (idx + 1) * 1000,
        payout_minor: Math.round((idx + 1) * 1000 * 1.85),
        result: null,
        status: 'OPEN',
        entry_price: 150 + idx * 0.1,
        strike_price: 150 + idx * 0.1,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (idx + 10) * 1000).toISOString(),
      }));

      const start = performance.now();
      const html = renderToString(
        <OrderFlagsOverlay
          contracts={manyContracts}
          currentPrice={152.5}
          containerWidth={1000}
          containerHeight={600}
          activeSeries={null}
        />
      );
      const elapsed = performance.now() - start;

      expect(html).toContain('data-testid="order-flag-stress-contract-0"');
      expect(html).toContain('data-testid="order-flag-stress-contract-49"');
      expect(elapsed).toBeLessThan(200);
    });
  });
});
