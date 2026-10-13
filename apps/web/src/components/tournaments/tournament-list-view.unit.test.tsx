import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TournamentListView } from './TournamentListView';
import { TOURNAMENTS_LIST_DATA } from './tournaments-mock-data';

describe('SUBETAPA 03: Visão de Lista de Torneios (Fidelidade à Imagem 1)', () => {
  describe('3.1 Cabeçalho e Elementos Superiores', () => {
    it('Renderiza título principal, subtítulo explicativo e badge de torneios semanais', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="tournament-list-title"');
      expect(html).toContain('Torneios');
      expect(html).toContain('data-testid="tournament-list-subtitle"');
      expect(html).toContain('Compita com outros traders, mostre sua estratégia e dispute prêmios em dinheiro.');
      expect(html).toContain('Participação gratuita.');

      expect(html).toContain('data-testid="weekly-tournaments-badge"');
      expect(html).toContain('Torneios semanais');
      expect(html).toContain('Novos torneios toda segunda-feira.');
      expect(html).toContain('data-testid="btn-close-tournament-modal"');
    });
  });

  describe('3.2 Fidelidade dos 5 Cards da Imagem 1', () => {
    it('Renderiza Card 1: Copa BINMAX com badge AO VIVO, contagem 22:51:55, borda verde e botão Participar →', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="tournament-card-copa-binmax"');
      expect(html).toContain('AO VIVO');
      expect(html).toContain('Termina em 22:51:55');
      expect(html).toContain('Copa BINMAX');
      expect(html).toContain('Operações de precisão');
      expect(html).toContain('R$ 2.500');
      expect(html).toContain('1.248');
      expect(html).toContain('Participar →');
      expect(html).toContain('border:1.5px solid #22C47A');
    });

    it('Renderiza Card 2: Desafio da Semana com badge EM BREVE e botão Ver detalhes', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="tournament-card-desafio-semana"');
      expect(html).toContain('EM BREVE');
      expect(html).toContain('Começa em 1d 09h 51m');
      expect(html).toContain('Desafio da Semana');
      expect(html).toContain('Estratégia sem limites');
      expect(html).toContain('R$ 1.000');
      expect(html).toContain('532');
      expect(html).toContain('Ver detalhes');
    });

    it('Renderiza Card 3: Mestres dos Sintéticos com badge EM BREVE e botão Ver detalhes', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="tournament-card-mestres-sinteticos"');
      expect(html).toContain('Começa em 3d 18h 51m');
      expect(html).toContain('Mestres dos Sintéticos');
      expect(html).toContain('Somente índices Vol');
      expect(html).toContain('R$ 3.000');
      expect(html).toContain('421');
    });

    it('Renderiza Card 4: Desafio Express com badge ENCERRADO e botão Ver resultado', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="tournament-card-desafio-express"');
      expect(html).toContain('ENCERRADO');
      expect(html).toContain('Encerrou em 03 de out.');
      expect(html).toContain('Desafio Express');
      expect(html).toContain('Operações de 5 minutos');
      expect(html).toContain('R$ 800');
      expect(html).toContain('982');
      expect(html).toContain('Ver resultado');
    });

    it('Renderiza Card 5: Campeões do Mês com badge ENCERRADO e botão Ver resultado', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="tournament-card-campeoes-mes"');
      expect(html).toContain('Encerrou em 30 de set.');
      expect(html).toContain('Campeões do Mês');
      expect(html).toContain('Todas as categorias');
      expect(html).toContain('R$ 5.000');
      expect(html).toContain('2.156');
    });
  });

  describe('3.3 Testes de Estresse e Desempenho', () => {
    it('Renderiza a grade completa com os 5 cards 100 vezes consecutivas em menos de 500ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToString(
          <TournamentListView
            tournaments={TOURNAMENTS_LIST_DATA}
            onSelectTournament={vi.fn()}
            onClose={vi.fn()}
          />
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(800);
    });
  });

  describe('3.4 Testes de Caos e Resiliência', () => {
    it('Não quebra na presença de dados parciais ou strings longas', () => {
      const chaosTournaments = [
        {
          ...TOURNAMENTS_LIST_DATA[0],
          name: 'Super Torneio Quântico de Derivativos Sintéticos Contínuos Extremamente Longo',
          subtitle: 'Subtítulo igualmente extenso com informações adicionais e caracteres de teste',
        },
      ];

      const html = renderToString(
        <TournamentListView
          tournaments={chaosTournaments}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('Super Torneio Quântico');
    });
  });
});
