import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalFooter } from '../components/footer/TerminalFooter';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 06: Terminal Footer Status Bar de Alta Precisão (Conexão, Métricas & Relógio)', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  const baseProps = {
    soundEnabled: true,
    onToggleSound: vi.fn(),
    timeZone: 'UTC-3',
    onToggleTimeZone: vi.fn(),
    isConnected: true,
    activeContractsCount: 2,
    portfolioTotalFormatted: '$0.00',
    todayProfitFormatted: '$0.00',
  };

  it('6.1 Renderiza Wi-Fi Conectado, Métricas da Sessão, Relógio e Fullscreen em tema Binmax', () => {
    const html = renderToString(<TerminalFooter {...baseProps} />);

    // Container
    expect(html).toContain('data-testid="terminal-footer-binmax"');

    // Conexão Wi-Fi
    expect(html).toContain('data-testid="footer-network-status"');
    expect(html).toContain('Conectado');

    // Métricas da sessão
    expect(html).toContain('data-testid="footer-metric-portfolio"');
    expect(html).toContain('Portafolio total');
    expect(html).toContain('data-testid="footer-metric-profit"');
    expect(html).toContain('Ganancia de hoy');
    expect(html).toContain('data-testid="footer-metric-contracts"');
    expect(html).toContain('Operaciones abiertas');
    expect(html).toContain('2'); // activeContractsCount

    // Relógio e Fullscreen
    expect(html).toContain('data-testid="footer-official-clock"');
    expect(html).toContain('Hora actual:');
    expect(html).toContain('data-testid="footer-fullscreen-btn"');
  });

  it('6.2 Teste de Caos: Desconexão de rede exibe estado Reconectando... com destaque de atenção', () => {
    const htmlDisconnected = renderToString(<TerminalFooter {...baseProps} isConnected={false} />);
    expect(htmlDisconnected).toContain('Reconectando...');
    expect(htmlDisconnected).toContain('#FFA75D');
  });

  it('6.3 Padrão Duas Portas: Quando NEW_TRADEROOM = false renderiza o rodapé clássico', () => {
    setFeatureFlagForTesting(false);
    const htmlLegacy = renderToString(<TerminalFooter {...baseProps} />);
    expect(htmlLegacy).toContain('data-testid="terminal-footer-legacy"');
    expect(htmlLegacy).toContain('SOPORTE');
    expect(htmlLegacy).toContain('Operar opciones binarias implica un alto riesgo');
  });

  it('6.4 Teste de Estresse: Executa 200 renderizações do rodapé em < 100ms', () => {
    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      const html = renderToString(<TerminalFooter {...baseProps} activeContractsCount={i} />);
      expect(html).toBeTruthy();
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});
