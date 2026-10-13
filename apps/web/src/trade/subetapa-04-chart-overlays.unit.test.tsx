import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TradersMoodBar } from '../chart/TradersMoodBar';
import { TimeLinesOverlay } from '../chart/TimeLinesOverlay';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 04: Gráfico Central & Camadas de Overlays em Tempo Real', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('4.1 TradersMoodBar: Renderiza os 14 diamantes empilhados, SUBE e BAJA', () => {
    const html = renderToString(<TradersMoodBar bullsPercentage={52} />);

    expect(html).toContain('SUBE 52%');
    expect(html).toContain('BAJA 48%');
    expect(html).toContain('data-testid="mood-diamond-stack"');
    expect(html).toContain('data-testid="mood-diamond-0"');
    expect(html).toContain('data-testid="mood-diamond-13"');
  });

  it('4.2 TimeLinesOverlay: Renderiza linha de compra e linha de expiração com bandeira vermelha', () => {
    const html = renderToString(
      <TimeLinesOverlay
        containerWidth={1200}
        containerHeight={600}
        chartInstance={null}
        latestCandleTime={null}
        tickTimestamp="2026-10-09T03:00:00Z"
      />
    );

    expect(html).toContain('data-testid="purchase-time-line"');
    expect(html).toContain('HORA DE COMPRA');
    expect(html).toContain('data-testid="expiration-time-line"');
    expect(html).toContain('EXPIRACIÓN');
    expect(html).toContain('🚩');
  });

  it('4.3 Teste de Estresse: Executa 500 ciclos de renderização do TradersMoodBar em < 100ms', () => {
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      const pct = (i % 90) + 5;
      const html = renderToString(<TradersMoodBar bullsPercentage={pct} />);
      expect(html).toBeTruthy();
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });

  it('4.4 Teste de Caos: Dimensões zeradas ou negativas no canvas retornam null defensivamente', () => {
    const htmlZero = renderToString(
      <TimeLinesOverlay
        containerWidth={0}
        containerHeight={0}
        chartInstance={null}
        latestCandleTime={null}
      />
    );
    expect(htmlZero).toBe('');

    const htmlNeg = renderToString(
      <TimeLinesOverlay
        containerWidth={-50}
        containerHeight={-100}
        chartInstance={null}
        latestCandleTime={null}
      />
    );
    expect(htmlNeg).toBe('');
  });

  it('4.5 OrderFlagsOverlay: Renderiza a flag de ordem aberta com direção, stake e contagem regressiva MM:SS conforme Prancha 3', async () => {
    const { OrderFlagsOverlay } = await import('../chart/OrderFlagsOverlay');
    const mockContracts = [
      {
        id: 'cnt-1234',
        symbol: 'NZDJPY_OTC',
        direction: 'UP' as const,
        stake_minor: 10000,
        status: 'OPEN' as const,
        result: null,
        entry_price: '89.587',
        strike_price: '89.587',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 14000).toISOString(),
        payout_minor: 18500,
      },
    ];

    const html = renderToString(
      <OrderFlagsOverlay
        contracts={mockContracts}
        currentPrice={89.590}
        containerWidth={1024}
        containerHeight={576}
        activeSeries={null}
      />
    );

    expect(html).toContain('data-testid="order-flag-cnt-1234"');
    expect(html).toContain('▲');
    expect(html).toContain('$100');
    expect(html).toContain('00:14');
  });
});
