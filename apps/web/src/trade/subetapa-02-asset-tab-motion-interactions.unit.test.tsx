import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 02: Microinterações, Motion Design e Ergonomia de Controles no Header', () => {
  const defaultProps = {
    activeSymbol: 'SYNTH_VOL_50',
    openTabs: ['SYNTH_VOL_50', 'EURUSD_OTC', 'BTCUSD_OTC'],
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

  it('2.1 Botão [+] Adicionar Ativo: dimensões ampliadas de 38px x 38px alinhadas às abas', () => {
    const html = renderToString(<TerminalHeader {...defaultProps} />);

    expect(html).toContain('data-testid="add-tab-button"');
    expect(html).toContain('width:38px');
    expect(html).toContain('height:38px');
    expect(html).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('2.2 Botão [×] Fechar Aba: hitbox ergonômica de 18px x 18px com alinhamento grid centralizado', () => {
    const html = renderToString(<TerminalHeader {...defaultProps} />);

    expect(html).toContain('data-testid="close-tab-EURUSD_OTC"');
    expect(html).toContain('width:18px');
    expect(html).toContain('height:18px');
    expect(html).toContain('display:grid');
    expect(html).toContain('place-items:center');
  });

  it('2.3 Motion Tokens de Transição: presença de física de movimento cubic-bezier institucional', () => {
    const html = renderToString(<TerminalHeader {...defaultProps} />);

    // Verifica que os motion tokens estão presentes nas abas e botões
    expect(html).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('2.4 Padrão Duas Portas: Modo clássico mantém botão [+] clássico de 26px x 26px', () => {
    setFeatureFlagForTesting(false);
    const html = renderToString(<TerminalHeader {...defaultProps} />);

    expect(html).toContain('data-testid="add-tab-button"');
    expect(html).toContain('width:26px');
    expect(html).toContain('height:26px');
    expect(html).not.toContain('width:38px');
  });

  it('2.5 Teste de Estresse de Interações: Renderiza ciclo de 50 alterações de estado de abas sob 1200ms', () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      const active = i % 2 === 0 ? 'SYNTH_VOL_50' : 'BTCUSD_OTC';
      renderToString(
        <TerminalHeader
          {...defaultProps}
          activeSymbol={active}
        />
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1200);
  });
});
