import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../i18n';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { Leaderboard } from './Leaderboard';
import { ARENA, createBot, getArenaAsset, type PayoutTier, type Standing } from './engine';
import type { ArenaApi, Store } from './use-arena';

function createLeaderboardArena(
  tier: PayoutTier = 'TOP_3',
  rivalCount = 50,
  customStandings?: Standing[]
): ArenaApi {
  const now = 1_700_000_000_000;
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
    ledger: [],
    lastStepAt: now,
    settlingSince: 0,
    result: null,
    rebuyPending: false,
    rebuyDismissed: false,
    clockOffsetMs: 9,
  };
  const asset = getArenaAsset('VOL_100');
  const standingsList: Standing[] =
    customStandings ?? [
      { id: 'bot', name: 'Alpha_Quant', country: 'BOT', points: 1600, reachedAt: 1, kind: 'bot' },
      ...Array.from({ length: rivalCount }, (_, idx) => ({
        id: `r-${idx + 1}`,
        name: `Trader_${idx + 1}`,
        country: 'MX',
        points: 1550 - idx * 10,
        reachedAt: idx + 2,
        kind: 'rival' as const,
      })),
      { id: 'you', name: 'Você', country: 'BR', points: 1000, reachedAt: rivalCount + 10, kind: 'you' },
    ];

  return {
    s,
    room: { id: 'bronze', label: 'Sala Bronze', cents: 500, rivals: rivalCount },
    asset,
    symbol: asset.id,
    currentPrice: 1000,
    candles: [],
    liveTick: null,
    isStale: false,
    positionsAsContracts: [],
    rebuyEligible: false,
    onSelectSymbol: () => {},
    join: () => {},
    leave: () => {},
    place: () => ({ ok: true as const }),
    rebuy: async () => ({ ok: true as const }),
    dismissRebuy: () => {},
    reopenRebuy: () => {},
    standings: () => standingsList,
    preview: {
      skip: () => {},
      jumpTo: () => {},
      bust: () => {},
      setTier: (nextTier: PayoutTier) => {
        s.tier = nextTier;
      },
      simulatePosition: () => {},
    },
  };
}

describe('Subetapa 10 — Scroll Interno Confinado na Tabela de Ranking (Top 10 / 20 / 30) com Cabeçalho Sticky', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  it('1. [Unit — Top 5 Default] em Top 5 não força maxHeight de scroll desnecessário e exibe 5 linhas + linha Tú/Você', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="es-ES">
        <Leaderboard arena={createLeaderboardArena('TOP_3', 40)} initialLimit={5} />
      </I18nProvider>
    );

    expect(html).toContain('data-testid="leaderboard-table-scroll"');
    expect(html).toContain('max-height:none;overflow-y:visible;overflow-x:hidden');
    expect(html).toContain('position:sticky;top:0;z-index:2');
    expect(html).toContain('data-testid="leaderboard-row-you"');
    expect(html).toContain('data-testid="leaderboard-bubble-radar"');
    expect(html).toContain('data-testid="leaderboard-bot-challenge"');
  });

  it('2. [Unit — Top 10 / Top 20 / Top 30 Scroll Confinado] ativa max-height:300px, overflow-y:auto, thead sticky top:0 e linha Tú sticky bottom:0', () => {
    for (const limit of [10, 20, 30] as const) {
      const tier = limit === 10 ? 'TOP_10' : limit === 20 ? 'TOP_20' : 'TOP_30';
      const html = renderToStaticMarkup(
        <I18nProvider initialLocale="es-ES">
          <Leaderboard arena={createLeaderboardArena(tier, 60)} initialLimit={limit} />
        </I18nProvider>
      );

      expect(html).toContain('data-testid="leaderboard-table-scroll"');
      expect(html).toContain('max-height:300px;overflow-y:auto;overflow-x:hidden');
      expect(html).toContain('position:sticky;top:0;z-index:2;background-color:var(--surface, #0f1318)');
      expect(html).toContain(
        'position:sticky;bottom:0;z-index:2;background-color:var(--tournament-purple-surface, #1a0b2e)'
      );
      expect(html).toContain(`Premiados: <strong class="text-foreground">Top ${limit}</strong>`);
    }
  });

  it('3. [Stress — 200 Alternâncias Top 5 / 10 / 20 / 30 com 120 Participantes] mantém integridade estrutural e Radar de Corte', () => {
    const limits = [5, 10, 20, 30] as const;
    const tiers: PayoutTier[] = ['TOP_3', 'TOP_10', 'TOP_20', 'TOP_30'];
    const arena = createLeaderboardArena('TOP_20', 120);

    for (let i = 0; i < 200; i++) {
      const idx = i % 4;
      arena.preview.setTier(tiers[idx]);
      const html = renderToStaticMarkup(
        <I18nProvider initialLocale={i % 2 === 0 ? 'es-ES' : 'pt-BR'}>
          <Leaderboard arena={arena} initialLimit={limits[idx]} />
        </I18nProvider>
      );

      expect(html).toContain('data-testid="leaderboard-table-card"');
      expect(html).toContain('data-testid="leaderboard-bubble-radar"');
      expect(html).toContain('data-testid="leaderboard-bot-challenge"');
      if (limits[idx] > 5) {
        expect(html).toContain('max-height:300px;overflow-y:auto;overflow-x:hidden');
      }
    }
  });

  it('4. [Security & Chaos — Nomes Extremos, 1 Participante e Empates Massivos] não quebra tabela nem escapa HTML', () => {
    const anomalousStandings: Standing[] = [
      { id: 'bot', name: 'Alpha_Quant', country: 'BOT', points: 1000, reachedAt: 1, kind: 'bot' },
      {
        id: 'xss',
        name: '<img src=x onerror=alert(1)>_VeryLongTraderHandle_9999999999',
        country: 'BR',
        points: 1000,
        reachedAt: 2,
        kind: 'rival',
      },
      { id: 'you', name: 'Você', country: 'BR', points: 1000, reachedAt: 3, kind: 'you' },
    ];

    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="pt-BR">
        <Leaderboard arena={createLeaderboardArena('TOP_30', 1, anomalousStandings)} initialLimit={30} />
      </I18nProvider>
    );

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('max-height:300px;overflow-y:auto;overflow-x:hidden');
  });
});
