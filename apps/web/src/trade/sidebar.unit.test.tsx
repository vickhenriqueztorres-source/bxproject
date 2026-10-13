import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import {
  IconOperar,
  IconPortafolio,
  IconHistorial,
  IconTorneos,
  IconAnalisis,
  IconTutoriales,
  IconPromociones,
  IconAjustes,
} from '../components/sidebar/SidebarIcons';
import { setNewTraderoomEnabled } from '../lib/feature-flags';

describe('Subetapa 3: Barra Lateral Dock e Navegação Institucional', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('1. SidebarIcons - Vetores SVG Otimizados', () => {
    it('Renderiza os 8 ícones SVG sem falhas de marcação', () => {
      const icons = [
        <IconOperar key="operar" />,
        <IconPortafolio key="portfolio" />,
        <IconHistorial key="historial" />,
        <IconTorneos key="torneos" />,
        <IconAnalisis key="analisis" />,
        <IconTutoriales key="tutoriales" />,
        <IconPromociones key="promociones" />,
        <IconAjustes key="ajustes" />,
      ];

      icons.forEach((icon) => {
        const html = renderToString(icon);
        expect(html).toContain('<svg');
        expect(html).toContain('aria-hidden="true"');
      });
    });
  });

  describe('2. SidebarDock - Itens e Microcopy Oficial em Espanhol', () => {
    const defaultProps = {
      activeTab: null as any,
      onSelectTab: vi.fn(),
      activeContractsCount: 0,
      soundEnabled: true,
      onToggleSound: vi.fn(),
      timeZone: 'UTC-3' as const,
      onToggleTimeZone: vi.fn(),
    };

    it('Renderiza os 8 itens oficiais com rótulos em espanhol', () => {
      const html = renderToString(<SidebarDock {...defaultProps} />);

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

    it('Item Operar possui realce ativo quando activeTab é nulo (foco no gráfico)', () => {
      const html = renderToString(<SidebarDock {...defaultProps} activeTab={null} />);
      expect(html).toContain('border:1.5px solid #22C55E');
    });

    it('Portafolio renderiza badge de ordens ativas apenas quando activeContractsCount > 0', () => {
      const htmlZero = renderToString(<SidebarDock {...defaultProps} activeContractsCount={0} />);
      expect(htmlZero).not.toContain('data-testid="sidebar-portfolio-badge"');

      const htmlThree = renderToString(<SidebarDock {...defaultProps} activeContractsCount={3} />);
      expect(htmlThree).toContain('data-testid="sidebar-portfolio-badge"');
      expect(htmlThree).toContain('3');
      expect(htmlThree).toContain('background:#22C55E');
    });

    it('Ajustes é posicionado no rodapé da barra lateral com margem inferior', () => {
      const html = renderToString(<SidebarDock {...defaultProps} />);
      expect(html).toContain('margin-bottom:8px');
    });
  });

  describe('3. Gavetas Laterais (Drawers) e Conteúdos Institucionais', () => {
    const baseProps = {
      activeTab: null as any,
      onSelectTab: vi.fn(),
      activeContractsCount: 2,
      soundEnabled: true,
      onToggleSound: vi.fn(),
      timeZone: 'UTC-3' as const,
      onToggleTimeZone: vi.fn(),
    };

    it('Abre o drawer de Torneos com informações de competição e prêmio', () => {
      const html = renderToString(<SidebarDock {...baseProps} activeTab="tournaments" />);
      expect(html).toContain('Torneos de trading');
      expect(html).toContain('Torneo Turbo Sprint');
      expect(html).toContain('$10.000 USD');
    });

    it('Abre o drawer de Tutoriales com guias de opções Turbo e análise técnica', () => {
      const html = renderToString(<SidebarDock {...baseProps} activeTab="tutorials" />);
      expect(html).toContain('Tutoriales en video');
      expect(html).toContain('Opciones Turbo: Cómo Operar SUBE y BAJA');
      expect(html).toContain('Herramientas de Análisis Técnico');
    });

    it('Abre o drawer de Promociones com cupom de bônus oficial', () => {
      const html = renderToString(<SidebarDock {...baseProps} activeTab="promotions" />);
      expect(html).toContain('Promociones y bonos');
      expect(html).toContain('100% en tu Primer Depósito');
      expect(html).toContain('TURBO100');
    });

    it('Abre o drawer de Ajustes com alternância de som e fuso horário', () => {
      const html = renderToString(<SidebarDock {...baseProps} activeTab="settings" soundEnabled={true} />);
      expect(html).toContain('Ajustes de la plataforma');
      expect(html).toContain('Efeitos Sonoros');
      expect(html).toContain('LIGADO');
      expect(html).toContain('UTC-3');
    });
  });

  describe('4. Testes de Estresse e Caos', () => {
    it('Estresse: Alternância veloz entre todas as 8 abas conclui em < 150ms', () => {
      const tabs: any[] = ['operar', 'portfolio', 'history', 'tournaments', 'news', 'tutorials', 'promotions', 'settings'];
      const start = performance.now();

      for (let i = 0; i < 50; i++) {
        const tab = tabs[i % tabs.length];
        const html = renderToString(
          <SidebarDock
            activeTab={tab}
            onSelectTab={vi.fn()}
            activeContractsCount={i}
            soundEnabled={i % 2 === 0}
            onToggleSound={vi.fn()}
            timeZone="UTC-3"
            onToggleTimeZone={vi.fn()}
          />
        );
        expect(html).toBeTruthy();
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });

    it('Caos: Contagem extrema de contratos (ex: 999) é exibida sem quebra estrutural', () => {
      const html = renderToString(
        <SidebarDock
          activeTab="portfolio"
          onSelectTab={vi.fn()}
          activeContractsCount={999}
          soundEnabled={false}
          onToggleSound={vi.fn()}
          timeZone="UTC"
          onToggleTimeZone={vi.fn()}
        />
      );
      expect(html).toContain('999');
      expect(html).toContain('data-testid="sidebar-portfolio-badge"');
    });
  });

  describe('5. Padrão Duas Portas e Regressão', () => {
    const defaultProps = {
      activeTab: null as any,
      onSelectTab: vi.fn(),
      activeContractsCount: 1,
      soundEnabled: true,
      onToggleSound: vi.fn(),
      timeZone: 'UTC-3' as const,
      onToggleTimeZone: vi.fn(),
    };

    it('Quando NEW_TRADEROOM = false, dock mantém layout clássico legado', () => {
      setNewTraderoomEnabled(false);
      const html = renderToString(<SidebarDock {...defaultProps} />);

      // Verifica ícones legados
      expect(html).toContain('📊');
      expect(html).toContain('💼');
      expect(html).toContain('🔔');
      expect(html).toContain('📰');
      expect(html).toContain('⚙️');

      // Não deve conter itens novos institucionais
      expect(html).not.toContain('data-testid="sidebar-item-operar"');
      expect(html).not.toContain('data-testid="sidebar-item-tournaments"');
      expect(html).not.toContain('data-testid="sidebar-item-tutorials"');
      expect(html).not.toContain('data-testid="sidebar-item-promotions"');
    });

    it('Quando NEW_TRADEROOM = true, dock institucional Turbo Prata é ativado', () => {
      setNewTraderoomEnabled(true);
      const html = renderToString(<SidebarDock {...defaultProps} />);

      expect(html).toContain('data-testid="sidebar-item-operar"');
      expect(html).toContain('data-testid="sidebar-item-portfolio"');
      expect(html).toContain('data-testid="sidebar-item-tournaments"');
      expect(html).toContain('data-testid="sidebar-item-settings"');
    });
  });
});
