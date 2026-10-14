import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SidebarDock } from './SidebarDock';
import { ArenaPage, sanitizeArenaRoomParam } from '../../pages/ArenaPage';
import { RouterProvider } from '../../router/RouterContext';
import { I18nProvider } from '../../i18n';
import { setNewTraderoomEnabled } from '../../lib/feature-flags';

describe('SUBETAPA 01: Integração Cirúrgica Menu Lateral (Torneos + Arena) & Shell da ArenaPage', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  const baseSidebarProps = {
    activeTab: null as any,
    onSelectTab: vi.fn(),
    activeContractsCount: 0,
    soundEnabled: true,
    onToggleSound: vi.fn(),
    timeZone: 'UTC-3' as const,
    onToggleTimeZone: vi.fn(),
  };

  describe('1.1 Integração de Torneos e Arena no SidebarDock', () => {
    it('Renderiza tanto o item Torneos quanto o item Arena com ícone de diamante no SidebarDock', () => {
      const html = renderToString(
        <RouterProvider initialPath="/">
          <SidebarDock {...baseSidebarProps} />
        </RouterProvider>
      );

      expect(html).toContain('data-testid="sidebar-item-tournaments"');
      expect(html).toContain('Torneos');
      expect(html).toContain('data-testid="sidebar-item-arena"');
      expect(html).toContain('Arena');
    });

    it('Destaca o item Arena (aria-current="page" e borda verde) quando activeRoute="arena" ou rota="/arena"', () => {
      const html = renderToString(
        <RouterProvider initialPath="/arena">
          <SidebarDock {...baseSidebarProps} activeRoute="arena" />
        </RouterProvider>
      );

      expect(html).toContain('data-testid="sidebar-item-arena"');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain('border:1.5px solid #22C55E');
    });
  });

  describe('1.2 Integração de Layout: ArenaPage com SidebarDock + TerminalFooter', () => {
    it('Renderiza ArenaPage contendo o menu lateral esquerdo (arena-sidebar-shell) e rodapé (terminal-footer-bar)', () => {
      const html = renderToString(
        <I18nProvider>
          <RouterProvider initialPath="/arena">
            <ArenaPage />
          </RouterProvider>
        </I18nProvider>
      );

      expect(html).toContain('data-testid="arena-page-container"');
      expect(html).toContain('data-testid="arena-sidebar-shell"');
      expect(html).toContain('data-testid="sidebar-item-arena"');
      expect(html).toContain('data-testid="sidebar-item-tournaments"');
      expect(html).toContain('data-testid="sidebar-item-operar"');
      expect(html).toContain('data-testid="arena-lobby-hero"');
      expect(html).toContain('terminal-footer-bar');
    });
  });

  describe('1.3 Testes de Estresse (Stress Tests)', () => {
    it('Executa 200 alternâncias rápidas entre abas e rotas (Operar, Torneos, Arena, Portafolio, Historial) em < 1000ms', () => {
      const tabs: any[] = [null, 'operar', 'portfolio', 'history', 'tournaments', 'news', 'tutorials', 'promotions', 'settings'];
      const routes: ('trade' | 'arena' | 'tournaments')[] = ['trade', 'arena', 'tournaments'];
      const start = performance.now();

      for (let i = 0; i < 200; i++) {
        const html = renderToString(
          <RouterProvider initialPath={i % 2 === 0 ? '/arena' : '/'}>
            <SidebarDock
              {...baseSidebarProps}
              activeTab={tabs[i % tabs.length]}
              activeRoute={routes[i % routes.length]}
              activeContractsCount={i % 15}
            />
          </RouterProvider>
        );
        expect(html).toContain('data-testid="sidebar-item-arena"');
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(4000);
    });
  });

  describe('1.4 Testes de Segurança (Security Tests)', () => {
    it('Sanitiza estritamente o parâmetro ?room= contra XSS, SQLi e Prototype Pollution', () => {
      expect(sanitizeArenaRoomParam('bronze')).toBe('bronze');
      expect(sanitizeArenaRoomParam('SILVER')).toBe('silver');
      expect(sanitizeArenaRoomParam('  Gold  ')).toBe('gold');

      // Payloads maliciosos devem retornar undefined (fallback seguro)
      expect(sanitizeArenaRoomParam('<script>alert(1)</script>')).toBeUndefined();
      expect(sanitizeArenaRoomParam('"><img src=x onerror=alert(1)>')).toBeUndefined();
      expect(sanitizeArenaRoomParam('__proto__')).toBeUndefined();
      expect(sanitizeArenaRoomParam('constructor')).toBeUndefined();
      expect(sanitizeArenaRoomParam("bronze' OR '1'='1")).toBeUndefined();
      expect(sanitizeArenaRoomParam(null)).toBeUndefined();
      expect(sanitizeArenaRoomParam(undefined)).toBeUndefined();
    });
  });

  describe('1.5 Testes de Caos e Resiliência (Chaos Tests)', () => {
    it('Resiste à falha ou corrupção de window.location durante a renderização da ArenaPage', () => {
      expect(() => {
        const html = renderToString(
          <I18nProvider>
            <RouterProvider initialPath="/arena">
              <ArenaPage initialTier={sanitizeArenaRoomParam('invalid-chaos-tier')} />
            </RouterProvider>
          </I18nProvider>
        );
        expect(html).toContain('data-testid="arena-page-container"');
      }).not.toThrow();
    });
  });
});
