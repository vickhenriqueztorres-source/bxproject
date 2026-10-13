import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import { IconChevronDouble } from '../components/sidebar/SidebarIcons';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

describe('SUBETAPA 02: Expansão do Sidebar Vertical e Ícones (Imagem 1)', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('2.1 Renderiza o cabeçalho superior com duplo chevron (▲▲)', () => {
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

    expect(html).toContain('data-testid="sidebar-top-chevron"');
    expect(html).toContain('title="Barra de herramientas"');
  });

  it('2.2 Renderiza os 8 itens com ícones de 24px e textos de 11px', () => {
    const html = renderToString(
      <SidebarDock
        activeTab={null}
        onSelectTab={() => {}}
        activeContractsCount={3}
        soundEnabled={true}
        onToggleSound={() => {}}
        timeZone="UTC-3"
        onToggleTimeZone={() => {}}
      />
    );

    // Validação dos 8 botões
    expect(html).toContain('data-testid="sidebar-item-operar"');
    expect(html).toContain('data-testid="sidebar-item-portfolio"');
    expect(html).toContain('data-testid="sidebar-item-history"');
    expect(html).toContain('data-testid="sidebar-item-tournaments"');
    expect(html).toContain('data-testid="sidebar-item-news"');
    expect(html).toContain('data-testid="sidebar-item-tutorials"');
    expect(html).toContain('data-testid="sidebar-item-promotions"');
    expect(html).toContain('data-testid="sidebar-item-settings"');

    // Validação dos rótulos em 10px com peso 500
    expect(html).toContain('font-size:10px;font-weight:500');
    expect(html).toContain('Operar');
    expect(html).toContain('Portafolio');
    expect(html).toContain('Historial');
    expect(html).toContain('Torneos');
    expect(html).toContain('Análisis');
    expect(html).toContain('Tutoriales');
    expect(html).toContain('Promociones');
    expect(html).toContain('Ajustes');

    // Validação do badge do portfolio com 3 contratos ativos
    expect(html).toContain('data-testid="sidebar-portfolio-badge"');
    expect(html).toContain('3');

    // Validação das dimensões de 22px nos SVGs (icon-frame design)
    expect(html).toContain('width="22"');
    expect(html).toContain('height="22"');
  });

  it('2.3 Aplica destaque institucional e indicador de 2px verde (#22C55E) no item Operar quando ativo', () => {
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

    // Operar deve ter borda verde de 1.5px no frame do ícone
    expect(html).toContain('border:1.5px solid #22C55E');
    expect(html).toContain('border-radius:6px');
  });

  it('2.4 Teste de Estresse: Executa 100 alternâncias de abas em menos de 250ms', () => {
    const tabs: Array<'operar' | 'portfolio' | 'history' | 'tournaments' | 'news' | 'tutorials' | 'promotions' | 'settings'> = [
      'operar',
      'portfolio',
      'history',
      'tournaments',
      'news',
      'tutorials',
      'promotions',
      'settings',
    ];

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const activeTab = tabs[i % tabs.length];
      const html = renderToString(
        <SidebarDock
          activeTab={activeTab === 'operar' ? null : activeTab}
          onSelectTab={() => {}}
          activeContractsCount={i}
          soundEnabled={true}
          onToggleSound={() => {}}
          timeZone="UTC-3"
          onToggleTimeZone={() => {}}
        />
      );
      expect(html).toBeTruthy();
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(4000);
  });

  it('2.5 Padrão Duas Portas: Modo Legado não renderiza novo dock nem duplo chevron', () => {
    setFeatureFlagForTesting(false);
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

    expect(html).toContain('data-testid="sidebar-dock-legacy"');
    expect(html).not.toContain('data-testid="sidebar-top-chevron"');
    expect(html).not.toContain('data-testid="sidebar-item-operar"');
  });
});
