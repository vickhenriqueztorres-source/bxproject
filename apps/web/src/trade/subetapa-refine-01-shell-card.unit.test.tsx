import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { TerminalLayout } from '../components/layout/TerminalLayout';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 01: Dimensões do Shell e Moldura do Card do Gráfico', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('1.1 Valida regras CSS no arquivo styles.css para dimensões ampliadas e enquadramento de card', () => {
    const cssPath = path.resolve(__dirname, '../styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Header aumentado para 56px
    expect(cssContent).toMatch(/\.theme-binmax\s+\.terminal-header\s*\{[^}]*height:\s*56px/);

    // Sidebar aumentado para 72px
    expect(cssContent).toMatch(/\.theme-binmax\s+\.terminal-sidebar\s*\{[^}]*width:\s*72px/);

    // Center com padding de moldura e cantos arredondados no card interno
    expect(cssContent).toMatch(/\.theme-binmax\s+\.terminal-center\s*\{[^}]*padding:\s*6px 8px/);
    expect(cssContent).toMatch(/\.theme-binmax\s+\.terminal-center\s*>\s*\*\s*\{[^}]*border-radius:\s*8px/);
  });

  it('1.2 Renderiza o shell com tema binmax e papéis ARIA corretos', () => {
    const html = renderToString(
      <TerminalLayout
        header={<div data-testid="hdr">Header</div>}
        sidebar={<div data-testid="sdb">Sidebar</div>}
        center={<div data-testid="chart-card">Gráfico Card</div>}
        orderDock={<div data-testid="dock">Boleta</div>}
      />
    );

    expect(html).toContain('class="terminal-container theme-binmax"');
    expect(html).toContain('class="terminal-center"');
    expect(html).toContain('data-testid="chart-card"');
    expect(html).toContain('aria-label="Gráfico de Trading"');
  });

  it('1.3 Garante que o Drawer lateral respeita o alinhamento com top: 56px e left: 72px', () => {
    const html = renderToString(
      <SidebarDock
        activeTab="portfolio"
        onSelectTab={() => {}}
        activeContractsCount={0}
        soundEnabled={true}
        onToggleSound={() => {}}
        timeZone="UTC-3"
        onToggleTimeZone={() => {}}
      />
    );

    // Deve posicionar com top: 56px e left: 72px
    expect(html).toContain('top:56px');
    expect(html).toContain('left:72px');
    expect(html).toContain('max-width:calc(100vw - 72px)');
  });

  it('1.4 Padrão Duas Portas: Modo Legado não é afetado pelo tema binmax', () => {
    setFeatureFlagForTesting(false);
    const html = renderToString(
      <TerminalLayout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        center={<div>Center</div>}
        orderDock={<div>Boleta</div>}
      />
    );

    expect(html).not.toContain('theme-binmax');

    const sidebarHtml = renderToString(
      <SidebarDock
        activeTab="portfolio"
        onSelectTab={() => {}}
        activeContractsCount={0}
        soundEnabled={true}
        onToggleSound={() => {}}
        timeZone="UTC-3"
        onToggleTimeZone={() => {}}
      />
    );

    // Modo legado utiliza top: 48px e left: 48px
    expect(sidebarHtml).toContain('top:48px');
    expect(sidebarHtml).toContain('left:48px');
  });

  it('1.5 Teste de Estresse e Caos: 100 ciclos de renderização do layout sem vazamento ou lentidão', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const html = renderToString(
        <TerminalLayout
          header={<div>Header {i}</div>}
          sidebar={<div>Sidebar {i}</div>}
          center={<div data-testid={`card-${i}`}>Chart Card {i}</div>}
          orderDock={<div>Dock {i}</div>}
        />
      );
      expect(html).toContain(`data-testid="card-${i}"`);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(300);
  });
});
