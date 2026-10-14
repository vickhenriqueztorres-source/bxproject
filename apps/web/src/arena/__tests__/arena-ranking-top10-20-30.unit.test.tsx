import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyMomentumBonus,
  createBot,
  createRivals,
  largestRemainder,
  prizePlaces,
  rankStandings,
  splitEntry,
  tierPrizes,
  zsetScore,
  type PayoutTier,
} from '../engine';
import { Leaderboard } from '../Leaderboard';
import { useArena, type ArenaApi } from '../use-arena';

describe('Suite 04 — Engine & Leaderboard: Top 3 / Top 10 / Top 20 / Top 30, Hare-Niemeyer, ZSET e Radar de Bolha', () => {
  it('4.1 Hare-Niemeyer (largestRemainder & tierPrizes) fecha 100% dos centavos sem criar nem perder 1 centavo em Top 3, 10, 20 e 30', () => {
    const testPools = [350, 700, 1750, 43750, 99999, 123456];
    const tiers: PayoutTier[] = ['TOP_3', 'TOP_10', 'TOP_20', 'TOP_30'];

    for (const pool of testPools) {
      const { rake, pool: netPool } = splitEntry(pool);
      expect(rake + netPool).toBe(pool);

      for (const tier of tiers) {
        const { prizes, residual, cutoffRank } = tierPrizes(pool, tier);
        const sum = prizes.reduce((a, b) => a + b, 0);
        expect(sum).toBe(pool);
        expect(residual).toBe(0);
        expect(prizes.length).toBe(cutoffRank);
        // Garante ordem não-crescente (1º >= 2º >= ... >= último premiado)
        for (let i = 1; i < prizes.length; i++) {
          expect(prizes[i - 1]).toBeGreaterThanOrEqual(prizes[i]);
        }
      }
    }

    const oddSplit = largestRemainder(100, [1 / 3, 1 / 3, 1 / 3]);
    expect(oddSplit.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('4.2 Desempate cronológico zsetScore: com pontuação idêntica, quem atingiu primeiro fica à frente', () => {
    const earlier = zsetScore(1500, 1_000_000);
    const later = zsetScore(1500, 2_000_000);
    expect(earlier).toBeGreaterThan(later);

    const higherPoints = zsetScore(1501, 9_000_000);
    expect(higherPoints).toBeGreaterThan(earlier);
  });

  it('4.3 O robô Alpha_Quant nunca ocupa posição premiada em dinheiro (prizePlaces ignora kind === "bot")', () => {
    const now = 1_700_000_000_000;
    const rivals = createRivals(5, now, 492);
    rivals[0].points = 2000;
    rivals[1].points = 1800;
    rivals[2].points = 1600;

    const bot = createBot(now);
    bot.points = 2500; // Robô em 1º geral!

    const standings = rankStandings(rivals, bot, {
      name: 'Você',
      points: 1700,
      reachedAt: now,
    });

    expect(standings[0].kind).toBe('bot');
    const places = prizePlaces(standings);
    expect(places.has('bot')).toBe(false);
    // r0 (2000) -> 0 (1º prêmio), r1 (1800) -> 1 (2º prêmio), Você (1700) -> 2 (3º prêmio)
    expect(places.get(rivals[0].id)).toBe(0);
    expect(places.get(rivals[1].id)).toBe(1);
    expect(places.get('you')).toBe(2);
  });

  it('4.4 Leaderboard renderiza Top 10, Top 20 e Top 30, Radar de Bolha ITM e meta +50% bônus contra Alpha_Quant', () => {
    let arena: ArenaApi | null = null;
    function Harness() {
      arena = useArena({ initialStage: 'running', initialRoomIndex: 0, initialTier: 'TOP_10' });
      return null;
    }
    renderToStaticMarkup(<Harness />);

    // Simula jogador na posição #11 (Fora da Bolha do Top 10)
    arena!.preview.setTier('TOP_10');
    arena!.preview.simulatePosition(11);
    const htmlOutBubble = renderToStaticMarkup(<Leaderboard arena={arena!} initialLimit={10} />);
    expect(htmlOutBubble).toContain('data-testid="leaderboard-bubble-radar"');
    expect(htmlOutBubble).toContain('Alvo de corte (#10');
    expect(htmlOutBubble).toContain('data-testid="leaderboard-bot-challenge"');

    // Simula jogador na posição #20 dentro do Top 20 (Na Bolha ITM)
    arena!.preview.setTier('TOP_20');
    arena!.preview.simulatePosition(20);
    const htmlInBubble20 = renderToStaticMarkup(<Leaderboard arena={arena!} initialLimit={20} />);
    expect(htmlInBubble20).toContain('Você: #20');
    expect(htmlInBubble20).toContain('Na zona de premiação');

    // Simula jogador na posição #30 dentro do Top 30 (Na Bolha ITM)
    arena!.preview.setTier('TOP_30');
    arena!.preview.simulatePosition(30);
    const htmlInBubble30 = renderToStaticMarkup(<Leaderboard arena={arena!} initialLimit={30} />);
    expect(htmlInBubble30).toContain('Você: #30');
    expect(htmlInBubble30).toContain('Na zona de premiação');
  });

  it('4.5 Momentum Streak 3x concede +15% de bônus em T$ a partir da 3ª vitória consecutiva', () => {
    expect(applyMomentumBonus(100, 1)).toEqual({ totalProfit: 100, bonus: 0, boostActive: false });
    expect(applyMomentumBonus(100, 2)).toEqual({ totalProfit: 100, bonus: 0, boostActive: false });
    expect(applyMomentumBonus(100, 3)).toEqual({ totalProfit: 115, bonus: 15, boostActive: true });
    expect(applyMomentumBonus(88, 4)).toEqual({ totalProfit: 101.2, bonus: 13.2, boostActive: true });
  });
});
