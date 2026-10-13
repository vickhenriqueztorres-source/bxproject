import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalHeader } from '../components/header/TerminalHeader';
import type { Contract } from '../api/client';

vi.mock('../lib/feature-flags', () => ({
  isNewTraderoomEnabled: () => true,
}));

describe('SUBETAPA 01: Erradicação do Card Neon na Aba de Ativo do Header', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps = {
    activeSymbol: 'SYNTH_VOL_50',
    openTabs: ['SYNTH_VOL_50'],
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
    id: 'ctr-win-anti-neon',
    symbol: 'SYNTH_VOL_50',
    direction: 'UP',
    stake_minor: 10000, // $100.00
    strike_price: 500.0,
    entry_price: 500.0,
    status: 'OPEN',
    opened_at: new Date('2026-10-11T11:59:30.000Z').toISOString(),
    expires_at: new Date('2026-10-11T12:00:02.000Z').toISOString(), // :02s
    payout_minor: 8500, // +$85.00
  };

  it('1.1 A aba ativa com trade vencedor NÃO renderiza fundo verde fluorescente (#14251e)', () => {
    const html = renderToString(
      <TerminalHeader
        {...baseProps}
        contracts={[winningContract]}
        currentPrices={{ SYNTH_VOL_50: 505.0 }}
      />
    );

    // Não deve possuir fundo de card verde fluorescente / cassino
    expect(html).not.toContain('background:#14251e');
    expect(html).not.toContain('background:rgba(20, 60, 40, 0.4)');

    // Deve possuir o fundo institucional escuro refinado da BINMAX
    expect(html).toContain('background:#151922');

    // Feedback de vitória preservado estritamente na linha inferior e no PnL
    expect(html).toContain('border-bottom:2px solid #22C47A');
    expect(html).toContain('+$85.00');
  });

  it('1.2 A aba ativa com trade em perda NÃO renderiza fundo vermelho fluorescente (#261418)', () => {
    const losingContract: Contract = {
      ...winningContract,
      id: 'ctr-loss-anti-neon',
    };

    const html = renderToString(
      <TerminalHeader
        {...baseProps}
        contracts={[losingContract]}
        currentPrices={{ SYNTH_VOL_50: 495.0 }} // Abaixo do strike -> losing
      />
    );

    // Não deve possuir fundo avermelhado de cassino
    expect(html).not.toContain('background:#261418');
    expect(html).not.toContain('background:rgba(75, 20, 24, 0.4)');

    // Deve manter o fundo institucional escuro sóbrio
    expect(html).toContain('background:#151922');
    expect(html).toContain('border-bottom:2px solid #E5484D');
  });

  it('1.3 ESTRESSE: Renderiza 50 ciclos de abas sob alta frequência em menos de 800ms', () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      renderToString(
        <TerminalHeader
          {...baseProps}
          contracts={i % 2 === 0 ? [winningContract] : []}
          currentPrices={{ SYNTH_VOL_50: 500 + i }}
        />
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(800);
  });
});
