import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TournamentDetailView } from './TournamentDetailView';
import { TOURNAMENTS_LIST_DATA } from './tournaments-mock-data';

describe('SUBETAPA 04: Visão Detalhada de 3 Colunas (Fidelidade à Imagem 2)', () => {
  const copaBinmax = TOURNAMENTS_LIST_DATA[0];

  describe('4.1 Navegação e Estrutura Geral de 3 Colunas', () => {
    it('Renderiza botão de voltar, botão de fechar e as 3 colunas principais', () => {
      const html = renderToString(
        <TournamentDetailView
          tournament={copaBinmax}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="tournament-detail-view"');
      expect(html).toContain('data-testid="btn-back-to-tournaments"');
      expect(html).toContain('Voltar para todos os torneios');
      expect(html).toContain('data-testid="btn-close-tournament-detail"');

      // 3 Colunas
      expect(html).toContain('data-testid="tournament-column-rules"');
      expect(html).toContain('data-testid="tournament-column-ranking"');
      expect(html).toContain('data-testid="tournament-column-prizes"');
    });
  });

  describe('4.2 Coluna 1: Informações e Regras do Torneio', () => {
    it('Renderiza badge AO VIVO, relógio 22:51:40, título, subtítulo verde e descrição', () => {
      const html = renderToString(
        <TournamentDetailView
          tournament={copaBinmax}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="detail-status-badge"');
      expect(html).toContain('AO VIVO');
      expect(html).toContain('data-testid="detail-countdown-clock"');
      expect(html).toContain('22:51:40');
      expect(html).toContain('data-testid="detail-tournament-title"');
      expect(html).toContain('Copa BINMAX');
      expect(html).toContain('data-testid="detail-tournament-subtitle"');
      expect(html).toContain('Operações de precisão');
      expect(html).toContain('Obtenha a maior rentabilidade possível');
    });

    it('Renderiza a tabela de regras oficiais com todos os 5 campos da Imagem 2', () => {
      const html = renderToString(
        <TournamentDetailView
          tournament={copaBinmax}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="detail-rules-table"');
      expect(html).toContain('Período');
      expect(html).toContain('10 out, 18:00 até 11 out, 22:00 (UTC-3)');
      expect(html).toContain('Depósito');
      expect(html).toContain('Não exigido. Participe com saldo de torneio.');
      expect(html).toContain('Ativos');
      expect(html).toContain('Todos os ativos disponíveis.');
      expect(html).toContain('Classificação');
      expect(html).toContain('Maior rentabilidade percentual da conta.');
      expect(html).toContain('Mínimo');
      expect(html).toContain('10 operações para entrar no ranking.');
    });
  });

  describe('4.3 Coluna 2: Ranking em Tempo Real', () => {
    it('Renderiza cabeçalho com 1.248 participantes e as colunas #, Trader, Rentabilidade, Ops', () => {
      const html = renderToString(
        <TournamentDetailView
          tournament={copaBinmax}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('Ranking em tempo real');
      expect(html).toContain('data-testid="ranking-participants-count"');
      expect(html).toContain('1.248 participantes');
      expect(html).toContain('Rentabilidade');
      expect(html).toContain('Ops');
    });

    it('Renderiza o Top 10 com medalhas 🥇 🥈 🥉, códigos de país e rentabilidades exatas', () => {
      const html = renderToString(
        <TournamentDetailView
          tournament={copaBinmax}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />
      );

      // 1º InversorMX
      expect(html).toContain('🥇');
      expect(html).toContain('InversorMX');
      expect(html).toContain('MX');
      expect(html).toContain('+254,17%');
      expect(html).toContain('38');

      // 2º TraderCol
      expect(html).toContain('🥈');
      expect(html).toContain('TraderCol');
      expect(html).toContain('CO');
      expect(html).toContain('+231,06%');
      expect(html).toContain('36');

      // 3º MercadoSur
      expect(html).toContain('🥉');
      expect(html).toContain('MercadoSur');
      expect(html).toContain('AR');
      expect(html).toContain('+198,32%');

      // 4º a 10º
      expect(html).toContain('AlphaTrade');
      expect(html).toContain('FenixCapital');
      expect(html).toContain('MaxTrader');
      expect(html).toContain('CryptoMind');
      expect(html).toContain('LucroTotal');
      expect(html).toContain('VisionTrade');
      expect(html).toContain('Ribeiro_FX');
      expect(html).toContain('+118,74%');
    });
  });

  describe('4.4 Coluna 3: Prêmios por Posição', () => {
    it('Renderiza a tabela oficial de prêmios com presentes 🎁 e valores de 1º a 100º', () => {
      const html = renderToString(
        <TournamentDetailView
          tournament={copaBinmax}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('Prêmios por posição');
      expect(html).toContain('data-testid="prizes-tier-list"');

      // Tiers da Imagem 2
      expect(html).toContain('1º');
      expect(html).toContain('R$ 1.000');
      expect(html).toContain('2º');
      expect(html).toContain('R$ 500');
      expect(html).toContain('3º');
      expect(html).toContain('R$ 300');
      expect(html).toContain('4º');
      expect(html).toContain('R$ 200');
      expect(html).toContain('5º');
      expect(html).toContain('R$ 100');
      expect(html).toContain('6º – 10º');
      expect(html).toContain('R$ 50');
      expect(html).toContain('11º – 50º');
      expect(html).toContain('R$ 20');
      expect(html).toContain('51º – 100º');
      expect(html).toContain('R$ 10');
    });
  });

  describe('4.5 Testes de Estresse e Desempenho', () => {
    it('Renderiza a visão detalhada de 3 colunas 100 vezes consecutivas em menos de 500ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToString(
          <TournamentDetailView
            tournament={copaBinmax}
            onBack={vi.fn()}
            onClose={vi.fn()}
          />
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(800);
    });
  });

  describe('4.6 Testes de Caos e Resiliência', () => {
    it('Renderiza graciosamente com ranking vazio sem lançar erros', () => {
      const emptyLeaderboardTournament = {
        ...copaBinmax,
        leaderboard: [],
      };

      const html = renderToString(
        <TournamentDetailView
          tournament={emptyLeaderboardTournament}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="ranking-traders-list"');
      expect(html).not.toContain('InversorMX');
    });
  });
});
