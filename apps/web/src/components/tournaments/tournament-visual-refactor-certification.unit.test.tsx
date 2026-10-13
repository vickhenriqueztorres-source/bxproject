import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TournamentModal } from './TournamentModal';
import { TournamentListView } from './TournamentListView';
import { TournamentCard } from './TournamentCard';
import { TournamentTrophyArt } from './TournamentTrophyArt';
import { TOURNAMENTS_LIST_DATA } from './tournaments-mock-data';
import { TournamentTrophyVariant } from './TournamentTypes';

describe('CERTIFICAÇÃO FINAL: Refatoração Visual dos Torneios', () => {
  // ═══════════════════════════════════════════════════════════════════
  // 1. TESTES DE GRID RESPONSIVO (Scroll Horizontal Eliminado)
  // ═══════════════════════════════════════════════════════════════════
  describe('1. Grid Responsivo — Scroll Horizontal Eliminado', () => {
    it('Grade usa CSS Grid (display:grid) em vez de flex com overflow', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(html).toContain('display:grid');
      expect(html).not.toContain('overflow-x:auto');
      expect(html).not.toContain('overflow-x: auto');
    });

    it('Grid com 0 torneios (estado vazio) não quebra', () => {
      const html = renderToString(
        <TournamentListView tournaments={[]} onSelectTournament={vi.fn()} onClose={vi.fn()} />
      );
      expect(html).toContain('data-testid="tournament-cards-grid"');
    });

    it('Grid com 1 card renderiza sem erro', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={[TOURNAMENTS_LIST_DATA[0]]}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(html).toContain('Copa BINMAX');
    });

    it('Grid com 50 torneios não causa scroll horizontal', () => {
      const manyTournaments = Array.from({ length: 50 }, (_, i) => ({
        ...TOURNAMENTS_LIST_DATA[0],
        id: `tournament-${i}`,
      }));
      const html = renderToString(
        <TournamentListView
          tournaments={manyTournaments}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(html).not.toContain('overflow-x');
      expect((html.match(/tournament-card-/g) || []).length).toBe(50);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. TESTES DE IMAGENS DE TROFÉU
  // ═══════════════════════════════════════════════════════════════════
  describe('2. Imagens de Troféu Cinematográficas', () => {
    it('Renderiza imagem real em vez de SVG para gold-matrix', () => {
      const html = renderToString(<TournamentTrophyArt variant="gold-matrix" />);
      expect(html).toContain('/tournaments/gold.png');
      expect(html).toContain('object-fit:cover');
      expect(html).not.toContain('<svg');
    });

    it('Renderiza imagem silver para EM BREVE', () => {
      const html = renderToString(<TournamentTrophyArt variant="silver" />);
      expect(html).toContain('/tournaments/silver.png');
    });

    it('Renderiza imagem bronze para EM BREVE', () => {
      const html = renderToString(<TournamentTrophyArt variant="bronze" />);
      expect(html).toContain('/tournaments/bronze.png');
    });

    it('Aplica desaturação visual para variante mono-gray (ENCERRADO)', () => {
      const html = renderToString(<TournamentTrophyArt variant="mono-gray" />);
      expect(html).toContain('saturate(0.3)');
      expect(html).toContain('/tournaments/mono-gray.png');
    });

    it('Todas as 4 variantes renderizam sem erro', () => {
      const variants: TournamentTrophyVariant[] = ['gold-matrix', 'silver', 'bronze', 'mono-gray'];
      variants.forEach((v) => {
        const html = renderToString(<TournamentTrophyArt variant={v} />);
        expect(html).toContain(`data-testid="tournament-trophy-${v}"`);
        expect(html).toContain('/tournaments/');
      });
    });

    it('Não quebra se variante é desconhecida (fallback gracioso)', () => {
      const html = renderToString(<TournamentTrophyArt variant={'alien-trophy' as any} />);
      expect(html).toContain('tournament-trophy-');
    });

    it('Imagem é decorativa (aria-hidden, alt vazio)', () => {
      const html = renderToString(<TournamentTrophyArt variant="gold-matrix" />);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('alt=""');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. TESTES DE MOTION DESIGN (Tokens BINMAX)
  // ═══════════════════════════════════════════════════════════════════
  describe('3. Motion Design — Tokens BINMAX', () => {
    it('Card AO VIVO tem shadow elevada verde sutil', () => {
      const html = renderToString(
        <TournamentCard tournament={TOURNAMENTS_LIST_DATA[0]} onSelect={vi.fn()} />
      );
      expect(html).toContain('border:1.5px solid #22C47A');
      expect(html).toContain('rgba(34, 196, 122');
    });

    it('Card ENCERRADO tem opacidade reduzida (hierarquia visual)', () => {
      const encerrado = TOURNAMENTS_LIST_DATA.find((t) => t.status === 'ENCERRADO')!;
      const html = renderToString(
        <TournamentCard tournament={encerrado} onSelect={vi.fn()} />
      );
      expect(html).toContain('opacity:0.65');
    });

    it('Transição usa a curva padrão BINMAX cubic-bezier(0.16, 1, 0.3, 1)', () => {
      const html = renderToString(
        <TournamentCard tournament={TOURNAMENTS_LIST_DATA[0]} onSelect={vi.fn()} />
      );
      expect(html).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
    });

    it('Transição usa durações padrão BINMAX de 100ms e 180ms', () => {
      const html = renderToString(
        <TournamentCard tournament={TOURNAMENTS_LIST_DATA[0]} onSelect={vi.fn()} />
      );
      expect(html).toContain('100ms');
      expect(html).toContain('180ms');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. TESTES DE ESTRESSE EXTREMO
  // ═══════════════════════════════════════════════════════════════════
  describe('4. Estresse Extremo', () => {
    it('200 ciclos completos do modal em menos de 3s', () => {
      const start = performance.now();
      for (let i = 0; i < 200; i++) {
        renderToString(
          <TournamentModal isOpen={true} onClose={vi.fn()} initialView="list" />
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(3000);
    });

    it('200 cards individuais em menos de 800ms', () => {
      const start = performance.now();
      for (let i = 0; i < 200; i++) {
        renderToString(
          <TournamentCard
            tournament={TOURNAMENTS_LIST_DATA[i % 5]}
            onSelect={vi.fn()}
          />
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(800);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. TESTES DE CAOS E RESILIÊNCIA
  // ═══════════════════════════════════════════════════════════════════
  describe('5. Caos e Resiliência', () => {
    it('100 torneios: grid enorme sem scroll horizontal', () => {
      const many = Array.from({ length: 100 }, (_, i) => ({
        ...TOURNAMENTS_LIST_DATA[0],
        id: `t-${i}`,
      }));
      const html = renderToString(
        <TournamentListView
          tournaments={many}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(html).not.toContain('overflow-x');
      expect((html.match(/tournament-card-/g) || []).length).toBe(100);
    });

    it('Torneio com caracteres Unicode e emoji no nome', () => {
      const chaos = [
        {
          ...TOURNAMENTS_LIST_DATA[0],
          id: 'unicode-test',
          name: '🏆 Desafío → «Especial» & "Quotes"',
          subtitle: '¡Operaciones rápidas! ñ ü ö',
        },
      ];
      const html = renderToString(
        <TournamentListView
          tournaments={chaos}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(html).toContain('unicode-test');
    });

    it('Torneio com string de 5000 caracteres não quebra layout', () => {
      const chaos = [
        {
          ...TOURNAMENTS_LIST_DATA[0],
          id: 'long-name',
          name: 'X'.repeat(5000),
        },
      ];
      const html = renderToString(
        <TournamentListView
          tournaments={chaos}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(html).toContain('text-overflow:ellipsis');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. TESTES DE SEGURANÇA E ISOLAMENTO
  // ═══════════════════════════════════════════════════════════════════
  describe('6. Segurança e Isolamento', () => {
    it('Nenhum input financeiro existe nos componentes de torneio', () => {
      const htmlList = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );
      const htmlModal = renderToString(
        <TournamentModal isOpen={true} onClose={vi.fn()} initialView="details" />
      );

      [htmlList, htmlModal].forEach((html) => {
        expect(html).not.toContain('type="number"');
        expect(html).not.toContain('name="amount"');
        expect(html).not.toContain('name="balance"');
        expect(html).not.toContain('name="price"');
        expect(html).not.toContain('contenteditable');
      });
    });

    it('Nenhum script inline ou eval nas imagens de troféu', () => {
      const variants = ['gold-matrix', 'silver', 'bronze', 'mono-gray'] as const;
      variants.forEach((v) => {
        const html = renderToString(<TournamentTrophyArt variant={v} />);
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('onerror=');
        expect(html).not.toContain('eval(');
      });
    });

    it('Todas as imagens de troféu são decorativas (aria-hidden)', () => {
      const variants = ['gold-matrix', 'silver', 'bronze', 'mono-gray'] as const;
      variants.forEach((v) => {
        const html = renderToString(<TournamentTrophyArt variant={v} />);
        expect(html).toContain('aria-hidden="true"');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 7. AUDITORIA DE DESIGN SÊNIOR BINMAX (Anti-Cassino)
  // ═══════════════════════════════════════════════════════════════════
  describe('7. Auditoria de Design Sênior BINMAX — Anti-Cassino', () => {
    it('Cards não contêm elementos de cassino proibidos', () => {
      const html = renderToString(
        <TournamentModal isOpen={true} onClose={vi.fn()} initialView="list" />
      );

      expect(html).not.toContain('confetti');
      expect(html).not.toContain('firework');
      expect(html).not.toContain('celebrate');
      expect(html).not.toContain('slot');
      expect(html).not.toContain('jackpot');
      expect(html).not.toContain('cha-ching');
      expect(html).not.toContain('@keyframes');
      expect(html).not.toContain('animation-iteration-count:infinite');
    });

    it('Nenhum card usa bounce, spring, glow, pulse ou animação contínua', () => {
      TOURNAMENTS_LIST_DATA.forEach((t) => {
        const html = renderToString(
          <TournamentCard tournament={t} onSelect={vi.fn()} />
        );
        expect(html).not.toContain('bounce');
        expect(html).not.toContain('spring');
        expect(html).not.toContain('infinite');
        expect(html).not.toContain('@keyframes');
      });
    });

    it('Superfícies usam camadas tonais do sistema sem glow/neon', () => {
      const html = renderToString(
        <TournamentModal isOpen={true} onClose={vi.fn()} initialView="list" />
      );

      expect(html).toContain('#0E131D');
      expect(html).toContain('#070A0E');
      expect(html).not.toContain('text-shadow');
      expect(html).not.toContain('neon');
    });

    it('Tipografia: Geist Mono presente nos valores financeiros', () => {
      const html = renderToString(
        <TournamentListView
          tournaments={TOURNAMENTS_LIST_DATA}
          onSelectTournament={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(html).toContain('Geist Mono');
    });
  });
});
