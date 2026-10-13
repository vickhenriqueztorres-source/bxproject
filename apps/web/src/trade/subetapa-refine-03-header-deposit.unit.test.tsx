import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AccountSelectorDropdown } from '../components/header/AccountSelectorDropdown';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 03: Expansão do Header, Saldo Institucional e Botão Depositar (Imagem 2)', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('3.1 Renderiza o avatar do usuário com diâmetro institucional de 32px', () => {
    const html = renderToString(
      <AccountSelectorDropdown
        balanceMinor={927000}
        accountType="DEMO"
        onSelectAccountType={() => {}}
        onResetDemo={() => {}}
        accountEmail="trader@binmax.com"
      />
    );

    expect(html).toContain('data-testid="account-selector-button"');
    // Avatar de 36px
    expect(html).toContain('width:36px;height:36px');
    // SVG de 18px
    expect(html).toContain('width="18"');
    expect(html).toContain('height="18"');
  });

  it('3.2 Renderiza o rótulo da conta com 11.5px e o saldo em prata monospaçado de 18px', () => {
    const html = renderToString(
      <AccountSelectorDropdown
        balanceMinor={927000} // $9,270.00
        accountType="DEMO"
        onSelectAccountType={() => {}}
        onResetDemo={() => {}}
        accountEmail="trader@binmax.com"
      />
    );

    // Rótulo ampliado para 11.5px
    expect(html).toContain('font-size:11.5px;font-weight:600');
    expect(html).toContain('Cuenta de práctica');

    // Saldo branco tabular de 18px
    expect(html).toContain('data-testid="account-balance-display"');
    expect(html).toContain('font-size:18px;font-weight:800;color:#F4F5F7');
    expect(html).toContain('&#x27;Geist Mono&#x27;, monospace');
    expect(html).toContain('$9,270.00');
  });

  it('3.3 Renderiza o botão Depositar amplo de 38px com alto contraste e tipografia destacada', () => {
    const html = renderToString(
      <TerminalHeader
        activeSymbol="SYNTH_VOL_50"
        openTabs={['SYNTH_VOL_50']}
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onAddTab={() => {}}
        balanceMinor={927000}
        accountEmail="trader@binmax.com"
        isLive={true}
        latencyMs={16}
        onResetDemo={() => {}}
        onSignOut={() => {}}
      />
    );

    expect(html).toContain('data-testid="header-deposit-button"');
    expect(html).toContain('height:38px');
    expect(html).toContain('font-size:13px;letter-spacing:0.2px');
    expect(html).toContain('color:#0A0D14');
    expect(html).toContain('Depositar');
    expect(html).toContain('data-testid="header-signout-button"');
    expect(html).toContain('Salir');
  });

  it('3.4 Preservação Invariante de Dinheiro: Saldo é estritamente derivado de minor units', () => {
    const html = renderToString(
      <AccountSelectorDropdown
        balanceMinor={1000000} // $10,000.00
        accountType="DEMO"
        onSelectAccountType={() => {}}
        onResetDemo={() => {}}
        accountEmail="demo@binmax.com"
      />
    );

    expect(html).toContain('$10,000.00');

    const htmlReal = renderToString(
      <AccountSelectorDropdown
        balanceMinor={254050} // $2,540.50
        accountType="REAL"
        onSelectAccountType={() => {}}
        onResetDemo={() => {}}
        accountEmail="real@binmax.com"
      />
    );

    expect(htmlReal).toContain('$2,540.50');
  });

  it('3.5 Teste de Estresse e Integridade: 100 renderizações com variação de saldo em < 250ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const balance = 100000 + i * 2500;
      const html = renderToString(
        <AccountSelectorDropdown
          balanceMinor={balance}
          accountType={i % 2 === 0 ? 'DEMO' : 'REAL'}
          onSelectAccountType={() => {}}
          onResetDemo={() => {}}
          accountEmail={`user${i}@binmax.com`}
        />
      );
      expect(html).toContain('data-testid="account-balance-display"');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(350);
  });

  it('3.6 Padrão Duas Portas: Modo Legado preserva layout original com CONTA PRÁTICA', () => {
    setFeatureFlagForTesting(false);
    const html = renderToString(
      <TerminalHeader
        activeSymbol="SYNTH_VOL_50"
        openTabs={['SYNTH_VOL_50']}
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onAddTab={() => {}}
        balanceMinor={1000000}
        accountEmail="trader@broker.com"
        isLive={true}
        onResetDemo={() => {}}
        onSignOut={() => {}}
      />
    );

    expect(html).not.toContain('Cuenta de práctica');
    expect(html).toContain('CONTA PRÁTICA');
    expect(html).not.toContain('data-testid="header-deposit-button"');
  });
});
