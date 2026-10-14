import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider, type Locale } from '../i18n';
import { RouterProvider } from '../router/RouterContext';
import { TournamentModal } from '../components/tournaments/TournamentModal';
import { TournamentsDrawer } from '../components/drawer/TournamentsDrawer';
import { TournamentsPage } from '../pages/TournamentsPage';
import { ArenaPage } from '../pages/ArenaPage';
import { ArenaLobby } from './ArenaLobby';
import { ArenaRoom } from './ArenaRoom';
import { RebuyDialog, ResultDialog } from './ArenaDialogs';
import { ARENA, createBot, getArenaAsset } from './engine';
import type { ArenaApi, Store } from './use-arena';

function renderWithLocale(locale: Locale, node: React.ReactNode): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <RouterProvider initialPath="/arena">{node}</RouterProvider>
    </I18nProvider>
  );
}

function buildMockArenaApi(overrides?: Partial<Store>): ArenaApi {
  const now = 1_700_000_000_000;
  const s: Store = {
    stage: 'running',
    roomIndex: 0,
    tier: 'TOP_3',
    startsAt: now,
    countdownEndsAt: now,
    points: ARENA.initialPoints,
    reachedAt: now,
    rebuys: 0,
    consecutiveWins: 0,
    maxStreak: 0,
    positions: [],
    trades: [],
    rivals: [],
    bot: createBot(now),
    poolCents: 10500,
    ledger: [
      { id: 'buy-1', type: 'BUY_IN', amountCents: 500, poolCents: 350, at: now },
    ],
    lastStepAt: now,
    settlingSince: 0,
    result: null,
    rebuyPending: false,
    rebuyDismissed: false,
    clockOffsetMs: 12,
    ...overrides,
  };
  const asset = getArenaAsset('VOL_100');
  return {
    s,
    room: { id: 'bronze', label: 'Arena Bronze', cents: 500, rivals: 28 },
    asset,
    symbol: asset.id,
    candles: [
      { time: 1700000000, open: 100, high: 105, low: 99, close: 102 },
      { time: 1700000060, open: 102, high: 106, low: 101, close: 104 },
    ],
    liveTick: null,
    currentPrice: 104,
    positionsAsContracts: [],
    isStale: false,
    rebuyEligible: s.points < 10 && s.positions.length === 0 && s.rebuys < 3,
    onSelectSymbol: () => {},
    join: () => {},
    leave: () => {},
    place: () => ({ ok: true }),
    rebuy: async () => ({ ok: true }),
    dismissRebuy: () => {},
    reopenRebuy: () => {},
    standings: () => [
      { id: 'you', name: 'Você', country: 'BR', points: s.points, updatedAt: 1, kind: 'you' },
      { id: 'bot', name: 'Alpha_Quant', country: 'AI', points: 1050, updatedAt: 2, kind: 'bot' },
      { id: 'r1', name: 'Lucas M.', country: 'BR', points: 1120, updatedAt: 3, kind: 'rival' },
    ],
    preview: {
      skip: () => {},
      jumpTo: () => {},
      bust: () => {},
      setTier: () => {},
      simulatePosition: () => {},
    },
  };
}

describe('Subetapa 04 — Tradução Reativa (PT/ES) de Torneios & Arena Blitz', () => {
  describe('1. TournamentModal (Lista, Cards e Detalhes) em PT vs ES', () => {
    it('renderiza lista e cards em Português (pt-BR) quando initialLocale="pt-BR"', () => {
      const html = renderWithLocale(
        'pt-BR',
        <TournamentModal isOpen={true} onClose={() => {}} />
      );
      expect(html).toContain('Torneios semanais');
      expect(html).toContain('Novos torneios toda segunda-feira.');
      expect(html).toContain('Prêmio total');
      expect(html).toContain('AO VIVO');
      expect(html).toContain('EM BREVE');
      expect(html).toContain('ENCERRADO');
      expect(html).toContain('Ver detalhes');
    });

    it('renderiza lista e cards em Espanhol (es-ES) quando initialLocale="es-ES"', () => {
      const html = renderWithLocale(
        'es-ES',
        <TournamentModal isOpen={true} onClose={() => {}} />
      );
      expect(html).toContain('Torneos semanales');
      expect(html).toContain('Nuevos torneos todos los lunes.');
      expect(html).toContain('Premio total');
      expect(html).toContain('EN VIVO');
      expect(html).toContain('PRÓXIMO');
      expect(html).toContain('FINALIZADO');
      expect(html).toContain('Ver detalles');
    });

    it('renderiza visão de detalhes do torneio em Português (pt-BR) vs Espanhol (es-ES)', () => {
      const ptHtml = renderWithLocale(
        'pt-BR',
        <TournamentModal
          isOpen={true}
          onClose={() => {}}
          initialView="details"
          initialTournamentId="copa-binmax"
        />
      );
      expect(ptHtml).toContain('Voltar para todos os torneios');
      expect(ptHtml).toContain('Regras do torneio');
      expect(ptHtml).toContain('Ranking em tempo real');
      expect(ptHtml).toContain('Rentabilidade');
      expect(ptHtml).toContain('Prêmios por posição');

      const esHtml = renderWithLocale(
        'es-ES',
        <TournamentModal
          isOpen={true}
          onClose={() => {}}
          initialView="details"
          initialTournamentId="copa-binmax"
        />
      );
      expect(esHtml).toContain('Volver a todos los torneos');
      expect(esHtml).toContain('Reglas del torneo');
      expect(esHtml).toContain('Ranking en tiempo real');
      expect(esHtml).toContain('Rentabilidad');
      expect(esHtml).toContain('Premios por posición');
    });
  });

  describe('2. TournamentsDrawer e TournamentsPage em PT vs ES', () => {
    it('alterna TournamentsDrawer entre Português e Espanhol reativamente', () => {
      const ptHtml = renderWithLocale('pt-BR', <TournamentsDrawer />);
      expect(ptHtml).toContain('Abrir Hub de Torneios');
      expect(ptHtml).toContain('AO VIVO');
      expect(ptHtml).toContain('Torneio Turbo Sprint');
      expect(ptHtml).toContain('Prêmio total');
      expect(ptHtml).toContain('EM BREVE');
      expect(ptHtml).toContain('Torneio Semanal');

      const esHtml = renderWithLocale('es-ES', <TournamentsDrawer />);
      expect(esHtml).toContain('Abrir Hub de Torneos');
      expect(esHtml).toContain('EN VIVO');
      expect(esHtml).toContain('Torneo Turbo Sprint');
      expect(esHtml).toContain('Premio total');
      expect(esHtml).toContain('PRÓXIMAMENTE');
      expect(esHtml).toContain('Torneo Semanal');
    });

    it('alterna TournamentsPage (/torneos) entre Português e Espanhol reativamente', () => {
      const ptHtml = renderWithLocale('pt-BR', <TournamentsPage />);
      expect(ptHtml).toContain('Competição Institucional');
      expect(ptHtml).toContain('Torneios de Trading Quantitativo');
      expect(ptHtml).toContain('Todos os torneios');
      expect(ptHtml).toContain('Fundo de prêmios');
      expect(ptHtml).toContain('Regras do Torneio');
      expect(ptHtml).toContain('Ranking ao Vivo');
      expect(ptHtml).toContain('Prêmios Oficiais');

      const esHtml = renderWithLocale('es-ES', <TournamentsPage />);
      expect(esHtml).toContain('Competición Institucional');
      expect(esHtml).toContain('Torneos de Trading Cuantitativo');
      expect(esHtml).toContain('Todos los torneos');
      expect(esHtml).toContain('Fondo de premios');
      expect(esHtml).toContain('Reglas del Torneo');
      expect(esHtml).toContain('Ranking en Vivo');
      expect(esHtml).toContain('Premios Oficiales');
    });
  });

  describe('3. ArenaPage e ArenaLobby em PT vs ES', () => {
    it('renderiza ArenaPage e ArenaLobby em Português (pt-BR) e Espanhol (es-ES)', () => {
      const ptHtml = renderWithLocale('pt-BR', <ArenaPage />);
      expect(ptHtml).toContain('Torneios');
      expect(ptHtml).toContain('15 minutos. T$ 1.000. O pódio leva o pote.');
      expect(ptHtml).toContain('Escolha sua sala');
      expect(ptHtml).toContain('Pote atual');
      expect(ptHtml).toContain('Faixa de premiação (ITM)');
      expect(ptHtml).toContain('Como funciona');
      expect(ptHtml).toContain('Distribuição do pote');
      expect(ptHtml).toContain('Desafio Alpha Quant');

      const esHtml = renderWithLocale('es-ES', <ArenaPage />);
      expect(esHtml).toContain('Torneos');
      expect(esHtml).toContain('15 minutos. T$ 1.000. El podio se lleva el bote.');
      expect(esHtml).toContain('Elige tu sala');
      expect(esHtml).toContain('Bote actual');
      expect(esHtml).toContain('Franja de premiación (ITM)');
      expect(esHtml).toContain('Cómo funciona');
      expect(esHtml).toContain('Distribución del bote');
      expect(esHtml).toContain('Desafío Alpha Quant');
    });
  });

  describe('4. ArenaLive (ArenaBar, ArenaTicket, Leaderboard, GhostAudit, ArenaLedger, Dialogs)', () => {
    it('traduz ArenaBar, ArenaTicket e Leaderboard entre PT e ES', () => {
      const mockArena = buildMockArenaApi();

      const ptHtml = renderWithLocale(
        'pt-BR',
        <ArenaRoom arenaOverride={mockArena} initialTab="ranking" />
      );
      expect(ptHtml).toContain('Tempo restante');
      expect(ptHtml).toContain('Prêmio atual');
      expect(ptHtml).toContain('Conta torneio');
      expect(ptHtml).toContain('Valor da ordem');
      expect(ptHtml).toContain('Expiração');
      expect(ptHtml).toContain('Se acertar');
      expect(ptHtml).toContain('ACIMA');
      expect(ptHtml).toContain('ABAIXO');
      expect(ptHtml).toContain('Robô');
      expect(ptHtml).toContain('Extrato');
      expect(ptHtml).toContain('Pontos');

      const esHtml = renderWithLocale(
        'es-ES',
        <ArenaRoom arenaOverride={mockArena} initialTab="ranking" />
      );
      expect(esHtml).toContain('Tiempo restante');
      expect(esHtml).toContain('Premio actual');
      expect(esHtml).toContain('Cuenta torneo');
      expect(esHtml).toContain('Monto de la orden');
      expect(esHtml).toContain('Expiración');
      expect(esHtml).toContain('Si aciertas');
      expect(esHtml).toContain('SUBE');
      expect(esHtml).toContain('BAJA');
      expect(esHtml).toContain('Bot');
      expect(esHtml).toContain('Extracto');
      expect(esHtml).toContain('Puntos');
    });

    it('traduz GhostAudit (aba Bot) e ArenaLedger (aba Extrato) entre PT e ES', () => {
      const mockArena = buildMockArenaApi();

      const ptBotHtml = renderWithLocale(
        'pt-BR',
        <ArenaRoom arenaOverride={mockArena} initialTab="bot" />
      );
      expect(ptBotHtml).toContain('Histórico de ordens');
      expect(ptBotHtml).toContain('Acertos');

      const esBotHtml = renderWithLocale(
        'es-ES',
        <ArenaRoom arenaOverride={mockArena} initialTab="bot" />
      );
      expect(esBotHtml).toContain('Historial de órdenes');
      expect(esBotHtml).toContain('Aciertos');

      const ptLedgerHtml = renderWithLocale(
        'pt-BR',
        <ArenaRoom arenaOverride={mockArena} initialTab="ledger" />
      );
      expect(ptLedgerHtml).toContain('Seu extrato nesta Arena');
      expect(ptLedgerHtml).toContain('Regras da Arena');

      const esLedgerHtml = renderWithLocale(
        'es-ES',
        <ArenaRoom arenaOverride={mockArena} initialTab="ledger" />
      );
      expect(esLedgerHtml).toContain('Tu extracto en esta Arena');
      expect(esLedgerHtml).toContain('Reglas de la Arena');
    });

    it('traduz RebuyDialog e ResultDialog entre PT e ES', () => {
      const bustedArena = buildMockArenaApi({
        points: 0,
        positions: [],
        rebuys: 0,
        rebuyDismissed: false,
      });

      const ptRebuy = renderWithLocale('pt-BR', <RebuyDialog arena={bustedArena} />);
      expect(ptRebuy).toContain('Volte para a disputa com T$ 1.000');
      expect(ptRebuy).toContain('Custo');
      expect(ptRebuy).toContain('Disponível por');
      expect(ptRebuy).toContain('Agora não');

      const esRebuy = renderWithLocale('es-ES', <RebuyDialog arena={bustedArena} />);
      expect(esRebuy).toContain('Vuelve a la disputa con T$ 1.000');
      expect(esRebuy).toContain('Costo');
      expect(esRebuy).toContain('Disponible por');
      expect(esRebuy).toContain('Ahora no');

      const endedPodiumArena = buildMockArenaApi({
        stage: 'ended',
        result: {
          rank: 1,
          humanRank: 1,
          total: 30,
          points: 1850,
          prizeCents: 5250,
          percentile: 0.99,
          beatBot: true,
          bonusEligible: true,
          botPoints: 1100,
          tier: 'TOP_3',
          cutoffRank: 3,
          tradesCount: 8,
          winsCount: 6,
          winRatePct: 75,
          maxStreak: 4,
        },
      });

      const ptResult = renderWithLocale('pt-BR', <ResultDialog arena={endedPodiumArena} />);
      expect(ptResult).toContain('Você conquistou o pódio!');
      expect(ptResult).toContain('Operar na conta real');
      expect(ptResult).toContain('Solicitar saque');

      const esResult = renderWithLocale('es-ES', <ResultDialog arena={endedPodiumArena} />);
      expect(esResult).toContain('¡Conquistaste el podio!');
      expect(esResult).toContain('Operar en cuenta real');
      expect(esResult).toContain('Solicitar retiro');
    });
  });

  describe('5. Stress & Invariantes Financeiras durante Troca de Idioma', () => {
    it('200 ciclos de alternância PT <-> ES preservam valores financeiros e pontos T$ intactos', () => {
      for (let i = 0; i < 200; i++) {
        const locale: Locale = i % 2 === 0 ? 'pt-BR' : 'es-ES';
        const html = renderWithLocale(locale, <ArenaLobby onJoin={() => {}} />);
        const modalHtml = renderWithLocale(locale, <TournamentModal isOpen={true} onClose={() => {}} />);
        expect(html).toContain('T$ 1.000');
        expect(modalHtml).toContain('R$ 2.500');
        expect(modalHtml).toContain('R$ 5.000');
      }
    });
  });
});
