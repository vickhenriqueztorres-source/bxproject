import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../i18n';
import { RouterProvider } from '../router/RouterContext';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { ArenaPage } from '../pages/ArenaPage';
import { ArenaLive } from './ArenaRoom';
import { Leaderboard } from './Leaderboard';
import { ARENA, createBot, getArenaAsset, type Standing } from './engine';
import type { ArenaApi, Store } from './use-arena';

function buildStandings(count = 35): Standing[] {
  const now = 1_700_000_000_000;
  const list: Standing[] = [
    { id: 'bot', name: 'Alpha_Quant', country: 'BOT', points: 1380, reachedAt: now, kind: 'bot' },
  ];
  for (let i = 1; i <= count; i++) {
    list.push({
      id: `r-${i}`,
      name: `Trader_${i}_LongNameTest`,
      country: 'BR',
      points: 2000 - i * 15,
      reachedAt: now + i,
      kind: 'rival',
    });
  }
  list.push({
    id: 'you',
    name: 'Você',
    country: 'BR',
    points: 1000,
    reachedAt: now + 999,
    kind: 'you',
  });
  return list.sort((a, b) => b.points - a.points);
}

function createMockArena(
  tier: 'TOP_3' | 'TOP_10' | 'TOP_20' | 'TOP_30' = 'TOP_3'
): ArenaApi {
  const now = 1_700_000_000_000;
  const standingsList = buildStandings(35);
  const s: Store = {
    stage: 'running',
    roomIndex: 0,
    tier,
    startsAt: now,
    countdownEndsAt: now + 3000,
    points: ARENA.initialPoints,
    reachedAt: now,
    rebuys: 0,
    consecutiveWins: 0,
    maxStreak: 0,
    positions: [],
    trades: [],
    rivals: [],
    bot: createBot(now),
    poolCents: 43750,
    ledger: [{ id: 'buy-1', type: 'BUY_IN', amountCents: 500, poolCents: 350, at: now }],
    lastStepAt: now,
    settlingSince: 0,
    result: null,
    rebuyPending: false,
    rebuyDismissed: false,
    clockOffsetMs: 12,
  };
  const asset = getArenaAsset('VOL_100');

  return {
    s,
    room: { id: 'bronze', label: 'Sala Bronze', cents: 500, rivals: 124 },
    asset,
    symbol: asset.id,
    currentPrice: 1002.45,
    candles: [
      { open: 1000, high: 1005, low: 998, close: 1001, start_time: '2026-10-14T12:00:00Z' },
      { open: 1001, high: 1004, low: 1000, close: 1002.45, start_time: '2026-10-14T12:01:00Z' },
    ],
    liveTick: null,
    isStale: false,
    positionsAsContracts: [],
    rebuyEligible: false,
    onSelectSymbol: () => {},
    join: () => {},
    leave: () => {},
    place: () => ({ ok: true as const }),
    rebuy: async () => ({ ok: true as const }),
    standings: () => standingsList,
    preview: {
      skip: () => {},
      jumpTo: () => {},
      bust: () => {},
      setTier: (t) => {
        s.tier = t;
      },
      simulatePosition: () => {},
    },
  };
}

describe('Subetapa 10 — Trava de Viewport e Scroll Isolado no Ranking (Top 5 / 10 / 20 / 30)', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  it('1. Unitário CSS: arena.css aplica regras diretas em .arena-root.flex/.h-full/.overflow-hidden e possui .lg:shrink-0', () => {
    const cssPath = path.resolve(__dirname, 'arena.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('.arena-root.flex, .arena-root .flex');
    expect(css).toContain('.arena-root.h-full, .arena-root .h-full');
    expect(css).toContain('.arena-root.max-h-full, .arena-root .max-h-full');
    expect(css).toContain('.arena-root.min-h-0, .arena-root .min-h-0');
    expect(css).toContain('.arena-root.overflow-hidden, .arena-root .overflow-hidden');
    expect(css).toContain('.arena-root .lg\\:shrink-0');
  });

  it('2. Unitário Layout: ArenaPage main e arena-live-room têm overflow:hidden e height:100% travados inline', () => {
    const arena = createMockArena('TOP_20');
    const html = renderToStaticMarkup(
      <RouterProvider initialPath="/arena">
        <I18nProvider initialLanguage="es">
          <ArenaPage arenaOverride={arena} />
        </I18nProvider>
      </RouterProvider>
    );

    expect(html).toContain('data-testid="arena-page-container"');
    expect(html).toContain('data-testid="arena-live-room"');
    expect(html).toContain('max-height:100%;overflow:hidden');
    expect(html).toContain('data-testid="arena-mirrored-chart-wrapper"');
    expect(html).toContain('data-testid="leaderboard-table-scroll"');
    expect(html).toContain('max-height:235px;overflow-y:auto;overflow-x:hidden');
  });

  it('3. Funcional & Caos: Leaderboard em Top 5, Top 10, Top 20 e Top 30 renderiza todas as linhas dentro de leaderboard-table-scroll com thead sticky', () => {
    const limits = [
      { limit: 5 as const, tier: 'TOP_3' as const },
      { limit: 10 as const, tier: 'TOP_10' as const },
      { limit: 20 as const, tier: 'TOP_20' as const },
      { limit: 30 as const, tier: 'TOP_30' as const },
    ];

    for (const { limit, tier } of limits) {
      const arena = createMockArena(tier);
      const html = renderToStaticMarkup(
        <I18nProvider initialLanguage="pt">
          <Leaderboard arena={arena} initialLimit={limit} />
        </I18nProvider>
      );

      expect(html).toContain('data-testid="leaderboard-table-scroll"');
      expect(html).toContain('max-height:235px;overflow-y:auto;overflow-x:hidden');
      expect(html).toContain('position:sticky;top:0;z-index:2');
      expect(html).toContain('data-testid="leaderboard-bubble-radar"');
      expect(html).toContain('data-testid="leaderboard-bot-challenge"');
      expect(html).toContain(`data-testid="leaderboard-row-r-${limit - 1}"`);
    }
  });

  it('4. Stress Test: 200 renderizações alternadas entre Top 5, Top 10, Top 20 e Top 30 mantêm trava de viewport sem vazamento', () => {
    const tiers: ('TOP_3' | 'TOP_10' | 'TOP_20' | 'TOP_30')[] = [
      'TOP_3',
      'TOP_10',
      'TOP_20',
      'TOP_30',
    ];
    const limits: (5 | 10 | 20 | 30)[] = [5, 10, 20, 30];

    for (let i = 0; i < 200; i++) {
      const idx = i % 4;
      const arena = createMockArena(tiers[idx]);
      const html = renderToStaticMarkup(
        <I18nProvider initialLanguage={i % 2 === 0 ? 'pt' : 'es'}>
          <Leaderboard arena={arena} initialLimit={limits[idx]} />
        </I18nProvider>
      );
      expect(html).toContain('max-height:235px;overflow-y:auto');
      expect(html).toContain('data-testid="leaderboard-bubble-radar"');
    }
  });
});
