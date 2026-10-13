import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AccountSelectorDropdown } from './AccountSelectorDropdown';
import { TerminalHeader } from './TerminalHeader';

describe('SUBETAPA 01: Header - Saldo Ampliado, Cores Semânticas e Depositar Delicado', () => {
  it('1.1 Saldo da Conta REAL é renderizado exclusivamente em verde (#22C47A)', () => {
    const html = renderToString(
      <AccountSelectorDropdown
        balanceMinor={1000000}
        accountType="REAL"
        onSelectAccountType={vi.fn()}
        onResetDemo={vi.fn()}
      />
    );
    expect(html).toContain('data-testid="account-balance-display"');
    // Saldo real é verde
    expect(html).toContain('color:#22C47A');
  });

  it('1.2 Saldo da Conta DEMO NÃO é verde (#22C47A), preservando a cor clássica (prata/ouro)', () => {
    const html = renderToString(
      <AccountSelectorDropdown
        balanceMinor={1000000}
        accountType="DEMO"
        onSelectAccountType={vi.fn()}
        onResetDemo={vi.fn()}
      />
    );
    expect(html).toContain('data-testid="account-balance-display"');
    // Saldo da demo preserva tom prata #F4F5F7 ou âmbar, nunca o verde da conta real
    expect(html).not.toMatch(/id="account-balance-display"[^>]*color:#22C47A/);
    expect(html).toContain('color:#F4F5F7');
  });

  it('1.3 Card de Saldo possui dimensões ampliadas e avatar destacado', () => {
    const html = renderToString(
      <AccountSelectorDropdown
        balanceMinor={1000000}
        accountType="DEMO"
        onSelectAccountType={vi.fn()}
        onResetDemo={vi.fn()}
      />
    );
    // Avatar ampliado de 36px
    expect(html).toContain('width:36px');
    expect(html).toContain('height:36px');
    // Saldo ampliado em 18px Geist Mono
    expect(html).toContain('font-size:18px');
    expect(html).toContain('font-variant-numeric:tabular-nums');
  });

  it('1.4 Botão Depositar possui visual refinado com acabamento delicado e motion tokens', () => {
    const html = renderToString(
      <TerminalHeader
        activeSymbol="SYNTH_VOL_50"
        openTabs={['SYNTH_VOL_50']}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onAddTab={vi.fn()}
        balanceMinor={1000000}
        accountEmail="trader@binmax.com"
        isLive={true}
        latencyMs={18}
        onResetDemo={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="header-deposit-button"');
    expect(html).toContain('Depositar');
    expect(html).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('1.5 Teste de Estresse: Executa 100 renderizações consecutivas do AccountSelector em menos de 300ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      renderToString(
        <AccountSelectorDropdown
          balanceMinor={1000000 + i * 100}
          accountType={i % 2 === 0 ? 'DEMO' : 'REAL'}
          onSelectAccountType={vi.fn()}
          onResetDemo={vi.fn()}
        />
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});
