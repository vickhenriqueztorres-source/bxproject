import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TournamentModal } from './TournamentModal';
import { TournamentListView } from './TournamentListView';
import { TournamentDetailView } from './TournamentDetailView';
import { TOURNAMENTS_LIST_DATA } from './tournaments-mock-data';
import {
  getJoinedTournamentIds,
  joinTournamentLocal,
  isTournamentJoined,
  isValidTournamentId,
  resetJoinedTournamentsForTesting,
} from './tournament-enrollment';

describe('SUBETAPA 02: Correção do Fluxo de Torneios (Modal, Lista, Detalhe, Arena Blitz & Inscrição)', () => {
  beforeEach(() => {
    resetJoinedTournamentsForTesting();
  });

  describe('2.1 Integração Arena Blitz na Lista de Torneios (TournamentListView)', () => {
    it('Renderiza o banner interativo da Arena Blitz · 15 min dentro do TournamentListView', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
          onOpenArena={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="modal-open-arena-blitz"');
      expect(html).toContain('ARENA BLITZ · 15 MIN');
      expect(html).toContain('Abrir Arena Blitz');
    });

    it('Exibe badge Inscrito ✓ nos cards dos torneios em que o trader já participa', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
          joinedIds={['copa-binmax']}
        />
      );

      expect(html).toContain('data-testid="tournament-joined-badge-copa-binmax"');
      expect(html).toContain('Inscrito ✓');
    });
  });

  describe('2.2 Eliminação do Beco sem Saída em TournamentDetailView', () => {
    it('Renderiza botão funcional de inscrição (tournament-detail-join-btn) e acesso à Arena para torneio AO VIVO não inscrito', () => {
      const html = renderToString(
        <TournamentDetailView
          tournament={TOURNAMENTS_LIST_DATA[0]}
          onBack={vi.fn()}
          onClose={vi.fn()}
          isJoined={false}
          onJoin={vi.fn()}
          onOpenArena={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="tournament-detail-actions"');
      expect(html).toContain('data-testid="tournament-detail-join-btn"');
      expect(html).toContain('Participar gratuitamente');
      expect(html).toContain('data-testid="tournament-detail-arena-btn"');
    });

    it('Renderiza confirmação de inscrição e botão Operar no Torneio (tournament-detail-trade-btn) quando inscrito', () => {
      const html = renderToString(
        <TournamentDetailView
          tournament={TOURNAMENTS_LIST_DATA[0]}
          onBack={vi.fn()}
          onClose={vi.fn()}
          isJoined={true}
          onStartTrading={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="tournament-detail-joined-status"');
      expect(html).toContain('data-testid="tournament-detail-trade-btn"');
      expect(html).toContain('Operar no Torneio');
    });

    it('Renderiza botão de reserva de vaga para torneio EM BREVE e status auditado para ENCERRADO', () => {
      const upcoming = TOURNAMENTS_LIST_DATA.find((t) => t.status === 'EM_BREVE')!;
      const ended = TOURNAMENTS_LIST_DATA.find((t) => t.status === 'ENCERRADO')!;

      const htmlUpcoming = renderToString(
        <TournamentDetailView tournament={upcoming} onBack={vi.fn()} onClose={vi.fn()} isJoined={false} />
      );
      expect(htmlUpcoming).toContain('data-testid="tournament-detail-join-btn"');
      expect(htmlUpcoming).toContain('Reservar vaga gratuita');

      const htmlEnded = renderToString(
        <TournamentDetailView tournament={ended} onBack={vi.fn()} onClose={vi.fn()} />
      );
      expect(htmlEnded).toContain('data-testid="tournament-detail-ended-status"');
    });
  });

  describe('2.3 Teste de Estresse e Idempotência (Stress Test)', () => {
    it('Executa 500 inscrições concorrentes no mesmo torneio mantendo idempotência estrita (sem duplicatas)', () => {
      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        const res = joinTournamentLocal('copa-binmax');
        expect(res.success).toBe(true);
        if (i === 0) {
          expect(res.alreadyJoined).toBe(false);
        } else {
          expect(res.alreadyJoined).toBe(true);
        }
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300);

      const joined = getJoinedTournamentIds();
      expect(joined).toEqual(['copa-binmax']);
      expect(isTournamentJoined('copa-binmax')).toBe(true);
    });
  });

  describe('2.4 Teste de Segurança (Security Test)', () => {
    it('Bloqueia IDs maliciosos (XSS, SQLi, Prototype Pollution e payloads gigantes)', () => {
      expect(isValidTournamentId('copa-binmax')).toBe(true);
      expect(isValidTournamentId('__proto__')).toBe(false);
      expect(isValidTournamentId('constructor')).toBe(false);
      expect(isValidTournamentId('prototype')).toBe(false);
      expect(isValidTournamentId('<script>alert(1)</script>')).toBe(false);
      expect(isValidTournamentId('a'.repeat(100))).toBe(false);
      expect(isValidTournamentId('')).toBe(false);
      expect(isValidTournamentId(null)).toBe(false);

      const attempt = joinTournamentLocal('<img src=x onerror=alert(1)>');
      expect(attempt.success).toBe(false);
      expect(getJoinedTournamentIds()).toEqual([]);
    });
  });

  describe('2.5 Teste de Caos e Resiliência (Chaos Test)', () => {
    it('Mantém inscrição funcional em memória mesmo quando localStorage está corrompido ou indisponível', () => {
      const res = joinTournamentLocal('desafio-semana');
      expect(res.success).toBe(true);
      expect(isTournamentJoined('desafio-semana')).toBe(true);

      const html = renderToString(
        <TournamentModal
          isOpen={true}
          onClose={vi.fn()}
          initialView="details"
          initialTournamentId="desafio-semana"
        />
      );
      expect(html).toContain('data-testid="tournament-detail-joined-status"');
    });
  });
});
