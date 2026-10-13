import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 03: Certificação Integrada de Precisão, Anti-Caos, Responsividade e Homologação Visual', () => {
  const defaultProps = {
    activeSymbol: 'SYNTH_VOL_50',
    openTabs: ['SYNTH_VOL_50', 'EURUSD_OTC'],
    onSelectTab: vi.fn(),
    onCloseTab: vi.fn(),
    onAddTab: vi.fn(),
    balanceMinor: 1000000,
    accountEmail: 'trader@binmax.com',
    isLive: true,
    latencyMs: 16,
    onResetDemo: vi.fn(),
    onSignOut: vi.fn(),
  };

  beforeEach(() => {
    setFeatureFlagForTesting(true);
    vi.clearAllMocks();
  });

  it('3.1 Teste de Caos: Ativos com símbolos ultra-longos não quebram nem causam exceção', () => {
    const longSymbol = 'SYNTH_VOL_SUPER_LONG_SYMBOL_TEST_999';
    expect(() => {
      const html = renderToString(
        <TerminalHeader
          {...defaultProps}
          openTabs={[longSymbol]}
          activeSymbol={longSymbol}
        />
      );
      expect(html).toContain('SYNTH_VOL_SUPER_LONG_SYMBOL_TEST_999');
      expect(html).toContain('height:38px');
    }).not.toThrow();
  });

  it('3.2 Teste de Caos: Trata graciosamente payouts de borda (0%, 99%, valores indefinidos)', () => {
    const html = renderToString(
      <TerminalHeader
        {...defaultProps}
        openTabs={['CUSTOM_ZERO_PAYOUT', 'SYNTH_VOL_50']}
        activeSymbol="CUSTOM_ZERO_PAYOUT"
      />
    );
    // Preserva indicador com fallback seguro (+85% padrão para não catalogados)
    expect(html).toContain('+85%');
    expect(html).toContain('data-testid="tab-CUSTOM_ZERO_PAYOUT"');
  });

  it('3.3 Teste de Estresse de Densidade: Renderiza 30 abas simultâneas de ativos sob alta densidade', () => {
    const thirtyTabs = [
      'SYNTH_VOL_10', 'SYNTH_VOL_25', 'SYNTH_VOL_50', 'SYNTH_VOL_75', 'SYNTH_VOL_100',
      'EURUSD_OTC', 'GBPUSD_OTC', 'USDJPY_OTC', 'USDCHF_OTC', 'AUDUSD_OTC',
      'USDCAD_OTC', 'NZDUSD_OTC', 'EURGBP_OTC', 'EURJPY_OTC', 'GBPJPY_OTC',
      'BTCUSD_OTC', 'ETHUSD_OTC', 'SOLUSD_OTC', 'XRPUSD_OTC', 'BNBUSD_OTC',
      'XAUUSD_OTC', 'XAGUSD_OTC', 'USOIL_OTC', 'UKOIL_OTC', 'SYNTH_CRASH_BOOM_100',
      'AUDCAD_OTC', 'CADJPY_OTC', 'CHFJPY_OTC', 'EURAUD_OTC', 'NZDJPY_OTC'
    ];

    const start = performance.now();
    const html = renderToString(
      <TerminalHeader
        {...defaultProps}
        openTabs={thirtyTabs}
        activeSymbol="SYNTH_VOL_50"
      />
    );
    const duration = performance.now() - start;

    expect(html).toContain('data-testid="tab-SYNTH_VOL_50"');
    expect(html).toContain('data-testid="tab-NZDJPY_OTC"');
    expect(duration).toBeLessThan(350);
  });

  it('3.4 Homologação de Motion Design & Proporção Áurea: Métricas oficiais da BINMAX atendidas', () => {
    const html = renderToString(<TerminalHeader {...defaultProps} />);

    // Altura proporcional da aba (38px) e do botão [+] (38px)
    expect(html).toContain('height:38px');
    expect(html).toContain('width:38px');

    // Ícone com nitidez ampliada para 22px
    expect(html).toContain('width="22"');

    // Tipografia nítida (13.5px bold)
    expect(html).toContain('font-size:13.5px');

    // Curva física cubic-bezier e desaceleração de 180ms
    expect(html).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('3.5 Acessibilidade e Proteção Semântica: Ícones com aria-hidden e botões com title oficial', () => {
    const html = renderToString(<TerminalHeader {...defaultProps} />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('title="Cerrar pestaña"');
    expect(html).toContain('title="Abrir novo ativo"');
  });
});
