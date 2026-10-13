import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalHeader } from '../components/header/TerminalHeader';
import type { Contract } from '../api/client';

vi.mock('../lib/feature-flags', () => ({
  isNewTraderoomEnabled: () => true,
}));

describe('SUBETAPA 02: Anel Temporizador, PnL ao Vivo e Cor Dinâmica nas Abas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps = {
    activeSymbol: 'EURUSD_OTC',
    openTabs: ['EURUSD_OTC', 'USOUSD_OTC'],
    onSelectTab: vi.fn(),
    onCloseTab: vi.fn(),
    onAddTab: vi.fn(),
    balanceMinor: 1000000,
    accountEmail: 'demo@binmax.pro',
    isLive: true,
    latencyMs: 16,
    onResetDemo: vi.fn(),
    onSignOut: vi.fn(),
  };

  it('2.1 Aba neutra sem ordens ativas exibe payout padrão (+85%)', () => {
    const html = renderToString(<TerminalHeader {...baseProps} contracts={[]} />);
    expect(html).toContain('data-testid="tab-EURUSD_OTC"');
    expect(html).toContain('+85%');
  });

  it('2.2 Aba com ordem em lucro (ITM) exibe anel de tempo, PnL verde e fundo esmeralda', () => {
    const now = Date.now();
    const winningContract: Contract = {
      id: 'ctr-win-1',
      symbol: 'USOUSD_OTC',
      direction: 'UP',
      stake_minor: 1000, // $10.00
      strike_price: 100.0,
      entry_price: 100.0,
      status: 'OPEN',
      opened_at: new Date(now - 10000).toISOString(),
      expires_at: new Date(now + 34000).toISOString(), // ~34s restantes
      payout_minor: 861, // +$8.61
    };

    const html = renderToString(
      <TerminalHeader
        {...baseProps}
        activeSymbol="USOUSD_OTC"
        contracts={[winningContract]}
        currentPrices={{ USOUSD_OTC: 101.5 }} // Preço acima do strike -> WIN
      />
    );

    // Deve conter identificador de status da aba
    expect(html).toContain('data-testid="tab-USOUSD_OTC"');
    expect(html).toContain('data-trade-status="winning"');
    // Deve conter anel com segundos restantes
    expect(html).toContain('data-testid="tab-countdown-ring-USOUSD_OTC"');
    expect(html).toContain(':34');
    // Deve exibir o lucro verde em tempo real
    expect(html).toContain('+$8.61');
    expect(html).toContain('#22C47A');
  });

  it('2.3 Aba com ordem em prejuízo (OTM) exibe anel de tempo, PnL vermelho e fundo carmesim', () => {
    const now = Date.now();
    const losingContract: Contract = {
      id: 'ctr-loss-1',
      symbol: 'USOUSD_OTC',
      direction: 'UP',
      stake_minor: 1000, // $10.00
      strike_price: 100.0,
      entry_price: 100.0,
      status: 'OPEN',
      opened_at: new Date(now - 20000).toISOString(),
      expires_at: new Date(now + 34000).toISOString(), // ~34s restantes
    };

    const html = renderToString(
      <TerminalHeader
        {...baseProps}
        activeSymbol="USOUSD_OTC"
        contracts={[losingContract]}
        currentPrices={{ USOUSD_OTC: 99.2 }} // Preço abaixo do strike -> LOSS
      />
    );

    expect(html).toContain('data-testid="tab-USOUSD_OTC"');
    expect(html).toContain('data-trade-status="losing"');
    expect(html).toContain('data-testid="tab-countdown-ring-USOUSD_OTC"');
    expect(html).toContain(':34');
    // Deve exibir o valor negativo em vermelho
    expect(html).toContain('-$10.00');
    expect(html).toContain('#E5484D');
  });

  it('2.4 Contrato liquidado recentemente exibe bandeira de conclusão e resultado apurado', () => {
    const now = Date.now();
    const settledContract: Contract = {
      id: 'ctr-settled-1',
      symbol: 'USOUSD_OTC',
      direction: 'UP',
      stake_minor: 1000,
      strike_price: 100.0,
      entry_price: 100.0,
      status: 'SETTLED',
      result: 'WIN',
      opened_at: new Date(now - 60000).toISOString(),
      expires_at: new Date(now - 1000).toISOString(),
      payout_minor: 902, // +$9.02
    };

    const html = renderToString(
      <TerminalHeader
        {...baseProps}
        contracts={[settledContract]}
      />
    );

    expect(html).toContain('data-testid="tab-USOUSD_OTC"');
    expect(html).toContain('data-trade-status="settled"');
    expect(html).toContain('+$9.02');
  });
});
