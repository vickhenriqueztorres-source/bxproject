import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../i18n';
import { RouterProvider } from '../router/RouterContext';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { ArenaPage } from '../pages/ArenaPage';
import { ArenaRoom } from './ArenaRoom';
import { ARENA, createBot, getArenaAsset } from './engine';
import type { ArenaApi, Store } from './use-arena';

function createMockArena(stage: 'lobby' | 'countdown' | 'running' = 'running'): ArenaApi {
  const now = 1_700_000_000_000;
  const s: Store = {
    stage,
    roomIndex: 0,
    tier: 'TOP_3',
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
    dismissRebuy: () => {},
    reopenRebuy: () => {},
    standings: () => [
      { id: 'bot', name: 'Alpha_Quant', country: 'BOT', points: 1000, reachedAt: 1, kind: 'bot' as const },
      { id: 'r1', name: 'Enzo.P', country: 'EC', points: 1000, reachedAt: 2, kind: 'rival' as const },
      { id: 'r2', name: 'JavierPips', country: 'EC', points: 1000, reachedAt: 3, kind: 'rival' as const },
      { id: 'r3', name: 'MateusMax', country: 'PT', points: 1000, reachedAt: 4, kind: 'rival' as const },
      { id: 'you', name: 'Você', country: 'BR', points: 1000, reachedAt: 5, kind: 'you' as const },
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

describe('Subetapas 06 & 07 — Correção Visual da Arena (CSS, Botões/Inputs, Tabela, 100vh e Sincronia Unificada PT/ES)', () => {
  const cssPath = path.resolve(__dirname, './arena.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  it('1. [CSS Reset] garante que arena.css reseta button e input para background-color: transparent e define .bg-transparent', () => {
    expect(cssContent).toContain('.arena-root button');
    expect(cssContent).toContain('.arena-root input');
    expect(cssContent).toContain('background-color: transparent');
    expect(cssContent).toContain('.arena-root .bg-transparent');
    expect(cssContent).toContain('.arena-root .whitespace-nowrap');
    expect(cssContent).toContain('.arena-root .ring-1');
    expect(cssContent).toContain('.arena-root .hover\\:bg-raised:hover');
    expect(cssContent).toContain('.arena-root .chart-host');
  });

  it('2. [Boleta & Abas] garante superfícies escuras explícitas (classes + inline style fallback) em ArenaTicket, Simular e abas Ranking/Robô/Extrato', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="pt-BR">
        <RouterProvider initialPath="/arena">
          <ArenaRoom arenaOverride={createMockArena('running')} />
        </RouterProvider>
      </I18nProvider>
    );

    expect(html).toContain('data-testid="arena-simular-btn"');
    expect(html).toContain('data-testid="arena-tab-ranking"');
    expect(html).toContain('data-testid="arena-tab-bot"');
    expect(html).toContain('data-testid="arena-tab-ledger"');
    expect(html).toContain('bg-surface px-2');
    expect(html).toContain('background-color:transparent');
    expect(html).toContain('background-color:var(--surface, #0f1318)');

    expect(html).toContain('data-testid="arena-stake-minus"');
    expect(html).toContain('data-testid="arena-stake-input"');
    expect(html).toContain('data-testid="arena-stake-plus"');
    expect(html).toContain('text-foreground tabular-nums');
  });

  it('3. [Tabela de Ranking] garante whitespace-nowrap (classe + inline style) e espaçamento horizontal entre PONTOS e PRÊMIO e nos filtros Top 5/10/20/30', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="pt-BR">
        <RouterProvider initialPath="/arena">
          <ArenaRoom arenaOverride={createMockArena('running')} />
        </RouterProvider>
      </I18nProvider>
    );

    expect(html).toContain('px-2.5 text-right font-mono font-semibold whitespace-nowrap tabular-nums');
    expect(html).toContain('pl-2.5 pr-3 text-right font-mono text-muted-foreground whitespace-nowrap tabular-nums');
    expect(html).toContain('white-space:nowrap');
    expect(html).toContain('data-testid="leaderboard-filter-top-10"');
  });

  it('4. [Subetapa 07 — Sincronia Unificada de Idioma & Header da Arena] garante zero mistura de PT+ES entre SidebarDock e ArenaPage', () => {
    // Em Português (pt-BR): Sidebar E Arena devem estar 100% em Português
    const pagePt = renderToStaticMarkup(
      <I18nProvider initialLocale="pt-BR">
        <RouterProvider initialPath="/arena">
          <ArenaPage />
        </RouterProvider>
      </I18nProvider>
    );
    expect(pagePt).toContain('data-testid="header-language-selector"');
    expect(pagePt).toContain('Torneios');
    expect(pagePt).toContain('Histórico');
    expect(pagePt).toContain('Portfólio');
    expect(pagePt).toContain('Sala Bronze');
    expect(pagePt).toContain('Sala Prata');
    expect(pagePt).toContain('Sala Ouro');
    expect(pagePt).not.toContain('Portafolio');
    expect(pagePt).not.toContain('Sala Bronce');

    // Em Espanhol (es-ES): Sidebar E Arena devem estar 100% em Espanhol
    const pageEs = renderToStaticMarkup(
      <I18nProvider initialLocale="es-ES">
        <RouterProvider initialPath="/arena">
          <ArenaPage />
        </RouterProvider>
      </I18nProvider>
    );
    expect(pageEs).toContain('data-testid="header-language-selector"');
    expect(pageEs).toContain('Torneos');
    expect(pageEs).toContain('Historial');
    expect(pageEs).toContain('Portafolio');
    expect(pageEs).toContain('Sala Bronce');
    expect(pageEs).toContain('Sala Plata');
    expect(pageEs).toContain('Sala Oro');
    expect(pageEs).not.toContain('Sala Bronze');
  });

  it('5. [Estresse] executa 200 renderizações completas da ArenaLive e ArenaLobby sem degradação', () => {
    const mockRunning = createMockArena('running');
    const mockLobby = createMockArena('lobby');
    for (let i = 0; i < 200; i++) {
      const html = renderToStaticMarkup(
        <I18nProvider initialLocale={i % 2 === 0 ? 'pt-BR' : 'es-ES'}>
          <RouterProvider initialPath="/arena">
            <ArenaRoom arenaOverride={i % 3 === 0 ? mockLobby : mockRunning} />
          </RouterProvider>
        </I18nProvider>
      );
      expect(html.length).toBeGreaterThan(500);
    }
  });
});
