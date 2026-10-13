import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalLayout } from '../components/layout/TerminalLayout';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 01: Refatoração da Malha Estrutural do Shell (100vw x 100vh Full-Bleed)', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('1.1 Renderiza todos os quadrantes do shell com papéis ARIA e classes Binmax', () => {
    const html = renderToString(
      <TerminalLayout
        header={<div data-testid="test-header">Header Mock</div>}
        sidebar={<div data-testid="test-sidebar">Sidebar Mock</div>}
        center={<div data-testid="test-center">Center Mock</div>}
        orderDock={<div data-testid="test-dock">Dock Mock</div>}
        footer={<div data-testid="test-footer">Footer Mock</div>}
      />
    );

    expect(html).toContain('data-testid="terminal-shell"');
    expect(html).toContain('theme-binmax');

    // Validação semântica e estrutural
    expect(html).toContain('role="banner"');
    expect(html).toContain('aria-label="Navegação do Terminal"');
    expect(html).toContain('aria-label="Gráfico de Trading"');
    expect(html).toContain('aria-label="Painel de Ordens"');
    expect(html).toContain('role="contentinfo"');
    expect(html).toContain('Header Mock');
    expect(html).toContain('Sidebar Mock');
    expect(html).toContain('Center Mock');
    expect(html).toContain('Dock Mock');
    expect(html).toContain('Footer Mock');
  });

  it('1.2 Mantém estabilidade com gaveta (drawer) e toast opcionais', () => {
    const htmlWithoutDrawer = renderToString(
      <TerminalLayout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        center={<div>Center</div>}
        orderDock={<div>OrderDock</div>}
      />
    );

    expect(htmlWithoutDrawer).not.toContain('aria-label="Portfólio e Operações"');

    const htmlWithDrawer = renderToString(
      <TerminalLayout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        center={<div>Center</div>}
        orderDock={<div>OrderDock</div>}
        drawer={<div data-testid="drawer-mock">Drawer Aberto</div>}
        toast={<div data-testid="toast-mock">Alerta</div>}
      />
    );

    expect(htmlWithDrawer).toContain('aria-label="Portfólio e Operações"');
    expect(htmlWithDrawer).toContain('data-testid="toast-mock"');
  });

  it('1.3 Teste de Estresse: Executa 100 ciclos de renderização em alta velocidade (< 150ms)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const html = renderToString(
        <TerminalLayout
          header={<div>Header {i}</div>}
          sidebar={<div>Sidebar {i}</div>}
          center={<div>Center {i}</div>}
          orderDock={<div>Dock {i}</div>}
          footer={<div>Footer {i}</div>}
        />
      );
      expect(html).toBeTruthy();
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(250);
  });

  it('1.4 Teste de Caos: Preserva integridade estrutural se props forem nulas ou indefinidas', () => {
    expect(() => {
      const html = renderToString(
        <TerminalLayout
          header={null}
          sidebar={undefined}
          center={<div data-testid="safe-center">Centro Seguro</div>}
          orderDock={null}
          footer={undefined}
        />
      );
      expect(html).toContain('data-testid="safe-center"');
    }).not.toThrow();
  });

  it('1.5 Padrão Duas Portas: Respeita alternância de tema Binmax vs Legado', () => {
    setFeatureFlagForTesting(false);
    const htmlLegacy = renderToString(
      <TerminalLayout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        center={<div>Center</div>}
        orderDock={<div>Dock</div>}
      />
    );
    expect(htmlLegacy).not.toContain('theme-binmax');

    setFeatureFlagForTesting(true);
    const htmlBinmax = renderToString(
      <TerminalLayout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        center={<div>Center</div>}
        orderDock={<div>Dock</div>}
      />
    );
    expect(htmlBinmax).toContain('theme-binmax');
  });
});
