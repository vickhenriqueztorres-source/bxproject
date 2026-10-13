import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalHeader } from '../components/header/TerminalHeader';
import type { Contract } from '../api/client';

vi.mock('../lib/feature-flags', () => ({
  isNewTraderoomEnabled: () => true,
}));

describe('SUBETAPA REFINE 01: Ergonomia da Aba de Ativo no Cabeçalho', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps = {
    activeSymbol: 'USOUSD_OTC',
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

  const winningContract: Contract = {
    id: 'ctr-win-ergonomics',
    symbol: 'USOUSD_OTC',
    direction: 'UP',
    stake_minor: 1000, // $10.00
    strike_price: 100.0,
    entry_price: 100.0,
    status: 'OPEN',
    opened_at: new Date('2026-10-11T11:59:30.000Z').toISOString(),
    expires_at: new Date('2026-10-11T12:00:38.000Z').toISOString(), // 38s
    payout_minor: 850, // +$8.50
  };

  it('1.1 O anel temporizador da aba possui escala ampliada (>= 34px) com texto nítido (>= 11px)', () => {
    const html = renderToString(
      <TerminalHeader
        {...baseProps}
        contracts={[winningContract]}
        currentPrices={{ USOUSD_OTC: 102.0 }}
      />
    );

    // Anel deve ter dimensões de pelo menos 34px
    expect(html).toContain('data-testid="tab-countdown-ring-USOUSD_OTC"');
    expect(html).toContain('width:34px');
    expect(html).toContain('height:34px');
    // Texto de contagem regressiva legível com 11px+
    expect(html).toContain(':38');
    expect(html).toContain('font-size:11px');
  });

  it('1.2 O botão de fechar (×) fica posicionado no canto superior esquerdo da aba', () => {
    const html = renderToString(
      <TerminalHeader
        {...baseProps}
        contracts={[winningContract]}
      />
    );

    expect(html).toContain('data-testid="close-tab-USOUSD_OTC"');
    // Posicionamento no canto superior esquerdo
    expect(html).toContain('position:absolute');
    expect(html).toContain('top:3px');
    expect(html).toContain('left:5px');
  });

  it('1.3 A aba possui altura ergonômica (44px) e elimina borda colorida genérica tipo glow', () => {
    const html = renderToString(
      <TerminalHeader
        {...baseProps}
        contracts={[winningContract]}
        currentPrices={{ USOUSD_OTC: 102.0 }}
      />
    );

    // Altura ergonômica
    expect(html).toContain('height:44px');
    // Não deve conter a antiga borda verde envolvendo toda a caixa
    expect(html).not.toContain('border:1px solid rgba(34, 196, 122, 0.4)');
    // Deve manter a linha indicadora inferior limpa
    expect(html).toContain('border-bottom:2px solid #22C47A');
  });
});
