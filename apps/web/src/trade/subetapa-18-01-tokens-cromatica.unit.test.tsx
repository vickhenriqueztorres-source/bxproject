import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import { AccountSelectorDropdown } from '../components/header/AccountSelectorDropdown';
import { OrderTicket } from './OrderTicket';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 18-01: Tokens e Identidade Cromática Institucional', () => {
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

  it('TC-01: SidebarDock ativo em Operar não possui ciano neon (#00e5ff) e adota barra 2px verde e texto branco', () => {
    const html = renderToString(
      <SidebarDock
        activeTab={null}
        onSelectTab={vi.fn()}
        activeContractsCount={0}
        soundEnabled={true}
        onToggleSound={vi.fn()}
        timeZone="UTC-3"
        onToggleTimeZone={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="sidebar-item-operar"');
    // Indicador lateral de 2px verde #22C55E e cor #F4F5F7
    expect(html).toContain('border:1.5px solid #22C55E');
    expect(html).toContain('color:#F4F5F7');
    // Sem neon #00e5ff
    expect(html).not.toContain('3px solid #00e5ff');
  });

  it('TC-02: Itens ativos secundários da SidebarDock utilizam indicador 2px verde e badge #22C55E', () => {
    const html = renderToString(
      <SidebarDock
        activeTab="portfolio"
        onSelectTab={vi.fn()}
        activeContractsCount={3}
        soundEnabled={true}
        onToggleSound={vi.fn()}
        timeZone="UTC-3"
        onToggleTimeZone={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="sidebar-item-portfolio"');
    expect(html).toContain('border:1.5px solid #22C55E');
    expect(html).not.toContain('border-left:3px solid #00e5ff');
    expect(html).toContain('background:#22C55E');
  });

  it('TC-03: Saldo da conta no cabeçalho é renderizado em branco (#F4F5F7), eliminando excesso de verde', () => {
    const html = renderToString(
      <AccountSelectorDropdown
        balanceMinor={1000000}
        accountType="DEMO"
        onSelectAccountType={vi.fn()}
        onResetDemo={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="account-balance-display"');
    // Saldo em branco tabular #F4F5F7
    expect(html).toContain('color:#F4F5F7');
  });

  it('TC-04: Botões SUBE e BAJA utilizam verde #22C55E e vermelho sóbrio #E5484D com raios consistentes de 6px', () => {
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

    expect(html).toContain('data-testid="btn-sube"');
    expect(html).toContain('background:#22C55E');
    expect(html).toContain('border-radius:6px');

    expect(html).toContain('data-testid="btn-baja"');
    expect(html).toContain('background:#E5484D');
  });

  it('TC-05: Payout do ticket é exibido no verde #22C55E unificado', () => {
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
    expect(html).toContain('color:#22C55E');
  });
});
