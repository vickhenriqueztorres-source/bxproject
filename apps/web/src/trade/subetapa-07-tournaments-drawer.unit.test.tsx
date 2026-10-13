import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TournamentsDrawer } from '../components/drawer/TournamentsDrawer';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import { setNewTraderoomEnabled } from '../lib/feature-flags';

describe('SUBETAPA 07: Gaveta de Torneios (Sessão 7)', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('7.1 TournamentsDrawer: Fidelidade Visual à Sessão 7', () => {
    it('Renderiza o Torneio Ao Vivo (Turbo Sprint) com badge, prazo, prêmio e botão Participar', () => {
      const html = renderToString(<TournamentsDrawer initialJoined={false} />);

      expect(html).toContain('data-testid="tournaments-drawer"');

      // Card Ao Vivo
      expect(html).toContain('data-testid="tournament-card-live"');
      expect(html).toContain('data-testid="live-tournament-badge"');
      expect(html).toContain('EN VIVO');
      expect(html).toContain('data-testid="live-tournament-countdown"');
      expect(html).toContain('Termina en 14h 22m');

      // Título e Descrição
      expect(html).toContain('data-testid="live-tournament-title"');
      expect(html).toContain('Torneo Turbo Sprint');
      expect(html).toContain('Compite con saldo de práctica por premios en efectivo.');

      // Premiação
      expect(html).toContain('data-testid="live-tournament-prize"');
      expect(html).toContain('$10.000 USD');

      // Botão Participar
      expect(html).toContain('data-testid="btn-participate-tournament"');
      expect(html).toContain('Participar');
    });

    it('Renderiza o Torneio Futuro (Torneo Semanal) com badge PRÓXIMAMENTE e prazo de início', () => {
      const html = renderToString(<TournamentsDrawer />);

      expect(html).toContain('data-testid="tournament-card-upcoming"');
      expect(html).toContain('data-testid="upcoming-tournament-badge"');
      expect(html).toContain('PRÓXIMAMENTE');
      expect(html).toContain('data-testid="upcoming-tournament-title"');
      expect(html).toContain('Torneo Semanal');
      expect(html).toContain('data-testid="upcoming-tournament-start"');
      expect(html).toContain('Inicia en 3d 14h');
    });

    it('Exibe estado Inscrito quando initialJoined é verdadeiro', () => {
      const html = renderToString(<TournamentsDrawer initialJoined={true} />);

      expect(html).toContain('data-testid="btn-participate-tournament"');
      expect(html).toContain('Inscrito');
      expect(html).toContain('✓');
    });
  });

  describe('7.2 Integração no SidebarDock', () => {
    it('Renderiza a gaveta de torneios quando activeTab === "tournaments"', () => {
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
      expect(html).toContain('Torneo Turbo Sprint');
      expect(html).toContain('Torneo Semanal');
    });

    it('Não renderiza gaveta de torneios quando activeTab é outro (ex: portfolio)', () => {
      const html = renderToString(
        <SidebarDock
          activeTab="portfolio"
          onSelectTab={vi.fn()}
          activeContractsCount={0}
          soundEnabled={true}
          onToggleSound={vi.fn()}
          timeZone="UTC-3"
          onToggleTimeZone={vi.fn()}
          tournamentsContent={<TournamentsDrawer />}
        />
      );

      expect(html).not.toContain('data-testid="tournaments-drawer"');
      expect(html).not.toContain('Torneo Turbo Sprint');
    });
  });

  describe('7.3 Teste de Estresse e Desempenho', () => {
    it('Executa 100 renderizações completas da gaveta de torneios em menos de 800ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToString(<TournamentsDrawer initialJoined={i % 2 === 0} />);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(800);
    });
  });
});
