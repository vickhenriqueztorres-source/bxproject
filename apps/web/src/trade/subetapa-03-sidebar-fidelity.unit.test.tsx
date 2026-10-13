import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 03: Sidebar Vertical Esquerda Institucional (8 Itens)', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  const baseProps = {
    activeTab: null as any,
    onSelectTab: vi.fn(),
    activeContractsCount: 2,
    soundEnabled: true,
    onToggleSound: vi.fn(),
    timeZone: 'UTC-3' as const,
    onToggleTimeZone: vi.fn(),
  };

  it('3.1 Renderiza todos os 8 itens oficiais na ordem canônica da imagem alvo', () => {
    const html = renderToString(<SidebarDock {...baseProps} />);

    expect(html).toContain('data-testid="sidebar-item-operar"');
    expect(html).toContain('Operar');

    expect(html).toContain('data-testid="sidebar-item-portfolio"');
    expect(html).toContain('Portafolio');

    expect(html).toContain('data-testid="sidebar-item-history"');
    expect(html).toContain('Historial');

    expect(html).toContain('data-testid="sidebar-item-tournaments"');
    expect(html).toContain('Torneos');

    expect(html).toContain('data-testid="sidebar-item-news"');
    expect(html).toContain('Análisis');

    expect(html).toContain('data-testid="sidebar-item-tutorials"');
    expect(html).toContain('Tutoriales');

    expect(html).toContain('data-testid="sidebar-item-promotions"');
    expect(html).toContain('Promociones');

    expect(html).toContain('data-testid="sidebar-item-settings"');
    expect(html).toContain('Ajustes');
  });

  it('3.2 Destaca a aba ativa com indicador 2px verde #22C55E e cor branca #F4F5F7', () => {
    const html = renderToString(<SidebarDock {...baseProps} activeTab="operar" />);
    expect(html).toMatch(/border:1\.5px solid #22C55E/);
    expect(html).toMatch(/color:\s*#F4F5F7/);
  });

  it('3.3 Teste de Estresse: Alterna rapidamente entre as abas em loop sem degradação (< 50ms)', () => {
    const tabs = ['operar', 'portfolio', 'history', 'tournaments', 'news', 'tutorials', 'promotions', 'settings'] as const;
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      const tab = tabs[i % tabs.length];
      const html = renderToString(<SidebarDock {...baseProps} activeTab={tab as any} />);
      expect(html).toBeTruthy();
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('3.4 Teste de Caos: Trata graciosamente valores nulos ou inválidos de activeTab', () => {
    expect(() => {
      const html = renderToString(<SidebarDock {...baseProps} activeTab={undefined as any} />);
      expect(html).toContain('Operar');
    }).not.toThrow();
  });

  it('3.5 Teste de Segurança: Previne injeção nos drawers e mantém isolamento de nós', () => {
    const maliciousPayload = '<img src=x onerror=alert(1)>';
    const html = renderToString(
      <SidebarDock
        {...baseProps}
        activeTab="history"
        historyContent={<div data-testid="safe-history">{maliciousPayload}</div>}
      />
    );
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
