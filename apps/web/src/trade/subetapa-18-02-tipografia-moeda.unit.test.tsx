import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OrderTicket } from './OrderTicket';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import { formatCurrencyBinmax } from '../lib/money';

describe('SUBETAPA 18-02: Tipografia, Hierarquia Visual e Unificação Monetária ($185.00)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    setFeatureFlagForTesting(true);
  });

  afterEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('TC-01: formatCurrencyBinmax formata valores com $ e 2 casas decimais sem prefixo US$', () => {
    expect(formatCurrencyBinmax(18500)).toBe('$185.00');
    expect(formatCurrencyBinmax(1000)).toBe('$10.00');
    expect(formatCurrencyBinmax(1000000)).toBe('$10,000.00');
    expect(formatCurrencyBinmax(0)).toBe('$0.00');
  });

  it('TC-02: Rótulos "Monto", "Expiración" e "Ganancia" no ticket utilizam 12px cinza sans-serif com peso 500', () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <OrderTicket
          symbol="SYNTH_VOL_50"
          paused={false}
          stale={false}
          availableMinor={1000000}
          soundEnabled={true}
          onChanged={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Rótulo Monto
    expect(html).toContain('font-size:12px;color:#8A92A1;font-weight:500;font-family:&#x27;Inter&#x27;, sans-serif');
    expect(html).toContain('Monto');

    // Rótulo Expiración
    expect(html).toContain('Expiración');

    // Rótulo Ganancia
    expect(html).toContain('Ganancia');
  });

  it('TC-03: Payout no ticket é apresentado em destaque com 22px bold e cor #22C55E', () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <OrderTicket
          symbol="SYNTH_VOL_50"
          paused={false}
          stale={false}
          availableMinor={1000000}
          soundEnabled={true}
          onChanged={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(html).toContain('data-testid="ganancia-pct"');
    expect(html).toContain('font-size:22px');
    expect(html).toContain('font-weight:800');
    expect(html).toContain('color:#22C55E');
  });

  it('TC-04: PortfolioDrawer formata ganho potencial e stakes em formato $185.00 sem US$', () => {
    const mockContracts = [
      {
        id: 'c-test-01',
        user_id: 'u-1',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP' as const,
        stake_minor: 10000, // $100.00
        payout_minor: 18500, // $185.00
        strike_price: 500.00,
        status: 'OPEN' as const,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30000).toISOString(),
      },
    ];

    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={mockContracts as any}
        currentPrice={502.00}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    // Retorno potencial no header: +$85.00
    expect(html).toContain('+$85.00');
    expect(html).not.toContain('US$ 85,00');

    // Investimento na tabela: $100.00
    expect(html).toContain('$100.00');
    expect(html).not.toContain('US$ 100,00');
  });
});
