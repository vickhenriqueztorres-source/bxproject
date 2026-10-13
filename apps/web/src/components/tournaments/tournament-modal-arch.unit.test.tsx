import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TournamentModal } from './TournamentModal';

describe('SUBETAPA 02: Arquitetura e Modelagem do TournamentModal', () => {
  describe('2.1 Montagem e Acessibilidade do Modal', () => {
    it('Não renderiza nada quando isOpen={false}', () => {
      const html = renderToString(<TournamentModal isOpen={false} onClose={vi.fn()} />);
      expect(html).toBe('');
    });

    it('Renderiza backdrop e diálogo modal quando isOpen={true}', () => {
      const html = renderToString(<TournamentModal isOpen={true} onClose={vi.fn()} />);

      expect(html).toContain('data-testid="tournament-modal"');
      expect(html).toContain('data-testid="tournament-modal-backdrop"');
      expect(html).toContain('data-testid="tournament-modal-dialog"');
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Torneios');
    });

    it('Renderiza visão de lista por padrão com os dados dos torneios', () => {
      const html = renderToString(<TournamentModal isOpen={true} onClose={vi.fn()} initialView="list" />);

      expect(html).toContain('data-testid="tournament-list-view"');
      expect(html).toContain('Copa BINMAX');
      expect(html).toContain('Desafio da Semana');
      expect(html).toContain('Mestres dos Sintéticos');
    });

    it('Renderiza visão detalhada quando initialView="details"', () => {
      const html = renderToString(
        <TournamentModal
          isOpen={true}
          onClose={vi.fn()}
          initialView="details"
          initialTournamentId="copa-binmax"
        />
      );

      expect(html).toContain('data-testid="tournament-detail-view"');
      expect(html).toContain('data-testid="tournament-column-rules"');
      expect(html).toContain('data-testid="tournament-column-ranking"');
      expect(html).toContain('data-testid="tournament-column-prizes"');
      expect(html).toContain('btn-back-to-tournaments');
    });
  });

  describe('2.2 Testes de Estresse e Desempenho', () => {
    it('Executa 100 ciclos de renderização do modal em menos de 500ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToString(
          <TournamentModal
            isOpen={i % 2 === 0}
            onClose={vi.fn()}
            initialView={i % 4 === 0 ? 'details' : 'list'}
          />
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('2.3 Testes de Caos e Resiliência', () => {
    it('Resiste a ID de torneio inexistente usando fallback seguro para o primeiro torneio', () => {
      const html = renderToString(
        <TournamentModal
          isOpen={true}
          onClose={vi.fn()}
          initialView="details"
          initialTournamentId="torneio-fantasma-inexistente-xyz"
        />
      );

      expect(html).toContain('data-testid="tournament-detail-view"');
      expect(html).toContain('Copa BINMAX');
    });
  });

  describe('2.4 Testes de Segurança', () => {
    it('Garante isolamento: modal não possui campos de input financeiro ou alteração de saldo', () => {
      const html = renderToString(<TournamentModal isOpen={true} onClose={vi.fn()} initialView="details" />);

      // Verifica ausência de manipulação financeira
      expect(html).not.toContain('input type="number"');
      expect(html).not.toContain('name="amount"');
      expect(html).not.toContain('name="balance"');
    });
  });
});
