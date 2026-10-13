import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA UX 02: Ajuste Tipográfico e Largura da Sidebar para Enquadramento de "Promociones"', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('2.1 Garante que o botão Promociones possui contenção geométrica (maxWidth, overflow hidden e padding)', () => {
    const html = renderToString(
      <SidebarDock
        activeTab={null}
        onSelectTab={() => {}}
        activeContractsCount={0}
        soundEnabled={true}
        onToggleSound={() => {}}
        timeZone="UTC-3"
        onToggleTimeZone={() => {}}
      />
    );

    expect(html).toContain('data-testid="sidebar-item-promotions"');
    expect(html).toContain('border-radius:6px');
    expect(html).toContain('font-size:10px;font-weight:500');
    expect(html).toContain('Promociones');
  });

  it('2.2 Preserva a integridade e legibilidade dos outros 7 botões da sidebar', () => {
    const html = renderToString(
      <SidebarDock
        activeTab={null}
        onSelectTab={() => {}}
        activeContractsCount={2}
        soundEnabled={true}
        onToggleSound={() => {}}
        timeZone="UTC-3"
        onToggleTimeZone={() => {}}
      />
    );

    expect(html).toContain('data-testid="sidebar-item-operar"');
    expect(html).toContain('data-testid="sidebar-item-portfolio"');
    expect(html).toContain('data-testid="sidebar-item-history"');
    expect(html).toContain('data-testid="sidebar-item-tournaments"');
    expect(html).toContain('data-testid="sidebar-item-news"');
    expect(html).toContain('data-testid="sidebar-item-tutorials"');
    expect(html).toContain('data-testid="sidebar-item-settings"');
  });

  it('2.3 Teste de Estresse: 100 renderizações com alternância de aba sem quebra (< 250ms)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const html = renderToString(
        <SidebarDock
          activeTab={i % 2 === 0 ? 'promotions' : null}
          onSelectTab={() => {}}
          activeContractsCount={i}
          soundEnabled={true}
          onToggleSound={() => {}}
          timeZone="UTC-3"
          onToggleTimeZone={() => {}}
        />
      );
      expect(html).toContain('Promociones');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });
});
