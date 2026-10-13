import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 01: Escala Espacial, Tipografia e Hierarquia do Card de Ativo no Header', () => {
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
  });

  it('1.1 Altura e proporção ampliada: card da aba possui altura de 38px no modo BINMAX', () => {
    const html = renderToString(<TerminalHeader {...defaultProps} />);
    
    // Verifica que a aba ativa possui altura estrutural de 38px para equilíbrio no header de 56px
    expect(html).toContain('data-testid="tab-SYNTH_VOL_50"');
    expect(html).toContain('height:38px');
  });

  it('1.2 Tipografia hierárquica ampliada: nome do ativo (13.5px) e subtítulo Digital (10px)', () => {
    const html = renderToString(<TerminalHeader {...defaultProps} />);

    // Nome do ativo em destaque ergonômico
    expect(html).toContain('font-size:13.5px');
    expect(html).toContain('Vol 50');

    // Subtítulo técnico Digital
    expect(html).toContain('font-size:10px');
    expect(html).toContain('Digital');
  });

  it('1.3 Ícone do ativo ampliado: AssetFlagBadge recebe size 22px para nitidez de alta resolução', () => {
    const html = renderToString(<TerminalHeader {...defaultProps} />);

    // Verifica que o SVG de bandeira / sintético renderiza com tamanho ampliado (size 22)
    expect(html).toContain('width="22"');
    expect(html).toContain('height="22"');
  });

  it('1.4 Payout badge ampliado: renderiza em 11px Geist Mono com contraste esmeralda equilibrado', () => {
    const html = renderToString(<TerminalHeader {...defaultProps} />);

    // Badge com tipografia tabular mono 11px
    expect(html).toContain('+85%');
    expect(html).toContain('font-size:11px');
    expect(html).toContain('Geist Mono');
  });

  it('1.5 Padrão Duas Portas: quando NEW_TRADEROOM = false, preserva cabeçalho clássico sem regressão', () => {
    setFeatureFlagForTesting(false);
    const html = renderToString(<TerminalHeader {...defaultProps} />);

    expect(html).toContain('BROKER');
    expect(html).not.toContain('font-size:13.5px');
    expect(html).not.toContain('width="22"');
  });

  it('1.6 Teste de Estresse: Executa 50 ciclos de renderização de múltiplas abas em menos de 1500ms', () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      renderToString(
        <TerminalHeader
          {...defaultProps}
          openTabs={['SYNTH_VOL_50', 'EURUSD_OTC', 'BTCUSD_OTC', 'XAUUSD_OTC']}
          activeSymbol="EURUSD_OTC"
        />
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });

  it('1.7 Teste de Segurança: Símbolo com tentativa de injeção XSS é sanitizado com segurança', () => {
    const malicious = '<script>alert("xss")</script>';
    const html = renderToString(
      <TerminalHeader
        {...defaultProps}
        openTabs={[malicious]}
        activeSymbol={malicious}
      />
    );

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});
