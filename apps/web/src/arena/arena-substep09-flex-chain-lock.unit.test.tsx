import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../i18n';
import { RouterProvider } from '../router/RouterContext';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { ArenaPage, sanitizeArenaRoomParam } from '../pages/ArenaPage';
import { ArenaRoom } from './ArenaRoom';
import { ARENA, createBot, getArenaAsset } from './engine';
import type { ArenaApi, Store } from './use-arena';

function createMockArena(stage: 'lobby' | 'countdown' | 'running' = 'running', rivalCount = 40): ArenaApi {
  const now = 1_700_000_000_000;
  const s: Store = {
    stage,
    roomIndex: 0,
    tier: 'TOP_20',
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
  const standingsList = [
    { id: 'bot', name: 'Alpha_Quant', country: 'BOT', points: 1500, reachedAt: 1, kind: 'bot' as const },
    ...Array.from({ length: rivalCount }, (_, idx) => ({
      id: `r-${idx + 1}`,
      name: `Trader_${idx + 1}`,
      country: 'BR',
      points: 1490 - idx * 5,
      reachedAt: idx + 2,
      kind: 'rival' as const,
    })),
    { id: 'you', name: 'Você', country: 'BR', points: 1000, reachedAt: rivalCount + 5, kind: 'you' as const },
  ];

  return {
    s,
    room: { id: 'bronze', label: 'Sala Bronze', cents: 500, rivals: rivalCount },
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
    dismissRebuy: () => {},
    reopenRebuy: () => {},
    standings: () => standingsList,
    preview: {
      skip: () => {},
      jumpTo: () => {},
      bust: () => {},
      setTier: () => {},
      simulatePosition: () => {},
    },
  };
}

describe('Subetapa 09 — Blindagem CSS .arena-root e Cadeia Flex 100vh em ArenaPage e ArenaRoom', () => {
  const cssPath = path.resolve(__dirname, './arena.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  it('1. [Unit — CSS Root Compound Selectors] garante que arena.css define seletores compostos para .arena-root (.flex, .flex-col, .flex-1, .h-full, .max-h-full, .min-h-0, .overflow-hidden)', () => {
    expect(cssContent).toContain('.arena-root.flex');
    expect(cssContent).toContain('.arena-root.flex-col');
    expect(cssContent).toContain('.arena-root.flex-1');
    expect(cssContent).toContain('.arena-root.h-full');
    expect(cssContent).toContain('.arena-root.max-h-full');
    expect(cssContent).toContain('.arena-root.min-h-0');
    expect(cssContent).toContain('.arena-root.overflow-hidden');
    expect(cssContent).toContain('.arena-root.overflow-y-auto');
  });

  it('2. [Unit — Cadeia Flex 100vh ArenaLive] trava a cadeia de altura (height:100%, max-height:100%, min-height:0, overflow:hidden) em arena-live-room, arena-live-body, arena-chart-column e arena-sidebar-panel', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="es-ES">
        <RouterProvider initialPath="/arena">
          <ArenaPage arenaOverride={createMockArena('running', 45)} />
        </RouterProvider>
      </I18nProvider>
    );

    expect(html).toContain('data-testid="arena-page-container"');
    expect(html).toContain('height:100vh;max-height:100vh;width:100vw;overflow:hidden');
    expect(html).toContain('data-testid="arena-page-main"');
    expect(html).toContain('data-testid="arena-live-room"');
    expect(html).toContain('data-testid="arena-live-body"');
    expect(html).toContain('data-testid="arena-chart-column"');
    expect(html).toContain('data-testid="arena-mirrored-chart-wrapper"');
    expect(html).toContain('data-testid="arena-sidebar-panel"');
    expect(html).toContain('data-testid="arena-sidebar-tabpanel"');
    expect(html).toContain('flex:1 1 0%;min-height:0;max-height:100%;overflow-y:auto;overflow-x:hidden');
  });

  it('3. [Unit — Isolamento de Scroll no Lobby] permite overflow-y:auto exclusivamente em arena-lobby-view mantendo arena-page-main com overflow:hidden', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="es-ES">
        <RouterProvider initialPath="/arena">
          <ArenaPage arenaOverride={createMockArena('lobby', 20)} />
        </RouterProvider>
      </I18nProvider>
    );

    expect(html).toContain('data-testid="arena-page-main"');
    expect(html).toContain('data-testid="arena-lobby-view"');
    expect(html).toContain('flex:1 1 0%;height:100%;max-height:100%;min-height:0;overflow-y:auto;overflow-x:hidden');
  });

  it('4. [Stress] 150 renderizações alternando abas Ranking, Bot e Extracto com 80 participantes sem perda de travas de overflow', () => {
    const arena = createMockArena('running', 80);
    const tabs = ['ranking', 'bot', 'ledger'] as const;

    for (let i = 0; i < 150; i++) {
      const tab = tabs[i % tabs.length];
      const html = renderToStaticMarkup(
        <I18nProvider initialLocale={i % 2 === 0 ? 'es-ES' : 'pt-BR'}>
          <RouterProvider initialPath="/arena">
            <ArenaRoom arenaOverride={arena} initialTab={tab} />
          </RouterProvider>
        </I18nProvider>
      );
      expect(html).toContain('data-testid="arena-chart-column"');
      expect(html).toContain('data-testid="arena-sidebar-tabpanel"');
      expect(html).toContain('overflow:hidden');
    }
  });

  it('5. [Security & Chaos] entradas malformadas de room param e listas gigantes de participantes não corrompem o layout', () => {
    expect(sanitizeArenaRoomParam('<script>alert(1)</script>')).toBeUndefined();
    expect(sanitizeArenaRoomParam('../../etc/passwd')).toBeUndefined();
    expect(sanitizeArenaRoomParam('GOLD')).toBe('gold');

    const chaosArena = createMockArena('running', 250);
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="es-ES">
        <RouterProvider initialPath="/arena">
          <ArenaPage arenaOverride={chaosArena} />
        </RouterProvider>
      </I18nProvider>
    );
    expect(html).toContain('data-testid="arena-chart-column"');
    expect(html).toContain('data-testid="arena-ticket"');
  });
});
