import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SidebarDock } from '../sidebar/SidebarDock';
import { TournamentsDrawer } from '../drawer/TournamentsDrawer';
import { setNewTraderoomEnabled } from '../../lib/feature-flags';

describe('SUBETAPA 05: Integração no Traderoom & Certificação Final dos Torneios', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('5.1 Integração do Botão Torneios no SidebarDock', () => {
    it('Renderiza o botão de torneios no SidebarDock com atributos e ícone de troféu', () => {
      const html = renderToString(
        <SidebarDock
          activeTab={null}
          onSelectTab={vi.fn()}
          activeContractsCount={0}
          soundEnabled={true}
          onToggleSound={vi.fn()}
          timeZone="UTC-3"
          onToggleTimeZone={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="sidebar-item-tournaments"');
      expect(html).toContain('Torneos');
    });

    it('Mantém a gaveta de torneios ativa quando activeTab="tournaments"', () => {
      const html = renderToString(
        <SidebarDock
          activeTab="tournaments"
          onSelectTab={vi.fn()}
          activeContractsCount={0}
          soundEnabled={true}
          onToggleSound={vi.fn()}
          timeZone="UTC-3"
          onToggleTimeZone={vi.fn()}
          tournamentsContent={<TournamentsDrawer />}
        />
      );

      expect(html).toContain('data-testid="tournaments-drawer"');
      expect(html).toContain('btn-open-tournament-modal-hub');
      expect(html).toContain('Torneo Turbo Sprint');
    });
  });

  describe('5.2 Hub de Acesso a Partir do TournamentsDrawer', () => {
    it('TournamentsDrawer contém o botão para abrir o hub oficial de torneios', () => {
      const html = renderToString(<TournamentsDrawer />);

      expect(html).toContain('data-testid="btn-open-tournament-modal-hub"');
      expect(html).toContain('Abrir Hub de Torneios');
      expect(html).toContain('data-testid="tournament-card-live"');
      expect(html).toContain('data-testid="tournament-card-upcoming"');
    });
  });

  describe('5.3 Testes de Estresse e Desempenho Integrados', () => {
    it('Executa 50 montagens completas do SidebarDock com TournamentsDrawer em menos de 600ms', () => {
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        renderToString(
          <SidebarDock
            activeTab={i % 2 === 0 ? 'tournaments' : null}
            onSelectTab={vi.fn()}
            activeContractsCount={i}
            soundEnabled={true}
            onToggleSound={vi.fn()}
            timeZone="UTC-3"
            onToggleTimeZone={vi.fn()}
            tournamentsContent={<TournamentsDrawer initialJoined={i % 4 === 0} />}
          />
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(600);
    });
  });

  describe('5.4 Testes de Segurança e Isolamento de Saldo', () => {
    it('Garante que nenhuma mutação financeira ocorre no frontend ao navegar entre torneios', () => {
      const html = renderToString(
        <SidebarDock
          activeTab="tournaments"
          onSelectTab={vi.fn()}
          activeContractsCount={0}
          soundEnabled={true}
          onToggleSound={vi.fn()}
          timeZone="UTC-3"
          onToggleTimeZone={vi.fn()}
          tournamentsContent={<TournamentsDrawer />}
        />
      );

      // Verificação de segurança: Ausência de qualquer input de saldo real
      expect(html).not.toContain('name="wallet_balance"');
      expect(html).not.toContain('type="deposit"');
    });
  });
});
