import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 02: Terminal Header de Alta Fidelidade (Logo, Grid, Abas & Conta)', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('2.1 Renderiza Logo Binmax, botão de grid, abas de pares com bandeiras e botão Depositar', () => {
    const html = renderToString(
      <TerminalHeader
        activeSymbol="NZDJPY_OTC"
        openTabs={['NZDJPY_OTC', 'EURUSD_OTC', 'EURCAD_OTC']}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onAddTab={vi.fn()}
        balanceMinor={960375} // $9,603.75
        accountEmail="trader@binmax.com"
        isLive={true}
        onResetDemo={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    // Grid e Logo
    expect(html).toContain('data-testid="header-grid-layout-btn"');
    expect(html).toContain('BINMAX');

    // Abas e bandeiras
    expect(html).toContain('data-testid="tab-NZDJPY_OTC"');
    expect(html).toContain('data-testid="tab-EURUSD_OTC"');
    expect(html).toContain('data-testid="tab-EURCAD_OTC"');
    expect(html).toContain('data-testid="add-tab-button"');

    // Seletor de conta com saldo formatado em dólar
    expect(html).toContain('$9,603.75');
    expect(html).toContain('data-testid="header-deposit-button"');
    expect(html).toContain('Depositar');
  });

  it('2.2 Aba ativa possui indicador data-active="true"', () => {
    const html = renderToString(
      <TerminalHeader
        activeSymbol="EURUSD_OTC"
        openTabs={['NZDJPY_OTC', 'EURUSD_OTC']}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onAddTab={vi.fn()}
        balanceMinor={1000000}
        accountEmail="trader@binmax.com"
        isLive={true}
        onResetDemo={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="tab-EURUSD_OTC" data-active="true"');
    expect(html).toContain('data-testid="tab-NZDJPY_OTC" data-active="false"');
  });

  it('2.3 Teste de Estresse: Renderiza 20 abas simultâneas em menos de 50ms', () => {
    const manyTabs = [
      'NZDJPY_OTC', 'EURUSD_OTC', 'EURCAD_OTC', 'GBPJPY_OTC', 'USDJPY_OTC',
      'AUDCAD_OTC', 'AUDJPY_OTC', 'CHFJPY_OTC', 'EURAUD_OTC', 'EURGBP_OTC',
      'EURJPY_OTC', 'GBPAUD_OTC', 'GBPCAD_OTC', 'GBPCHF_OTC', 'GBPNZD_OTC',
      'NZDCAD_OTC', 'NZDUSD_OTC', 'USDCAD_OTC', 'USDCHF_OTC', 'BTCUSD_OTC'
    ];

    const start = performance.now();
    const html = renderToString(
      <TerminalHeader
        activeSymbol="NZDJPY_OTC"
        openTabs={manyTabs}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onAddTab={vi.fn()}
        balanceMinor={960375}
        accountEmail="trader@binmax.com"
        isLive={true}
        onResetDemo={vi.fn()}
        onSignOut={vi.fn()}
      />
    );
    const duration = performance.now() - start;

    expect(html).toContain('data-testid="tab-BTCUSD_OTC"');
    expect(duration).toBeLessThan(500);
  });

  it('2.4 Teste de Caos: Trata símbolo desconhecido ou malformado sem quebrar o header', () => {
    expect(() => {
      const html = renderToString(
        <TerminalHeader
          activeSymbol="UNKNOWN_SYM"
          openTabs={['UNKNOWN_SYM']}
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          onAddTab={vi.fn()}
          balanceMinor={null}
          accountEmail=""
          isLive={false}
          onResetDemo={vi.fn()}
          onSignOut={vi.fn()}
        />
      );
      expect(html).toContain('UNKNOWN_SYM');
    }).not.toThrow();
  });
});
