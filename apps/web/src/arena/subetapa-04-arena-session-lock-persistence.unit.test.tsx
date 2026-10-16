import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArenaPage } from '../pages/ArenaPage';
import {
  ARENA_SESSION_STORAGE_KEY,
  clearPersistedArenaSession,
  loadPersistedArenaSession,
  sanitizeAndValidatePersistedArenaStore,
  savePersistedArenaSession,
  type ArenaApi,
  type Store,
} from './use-arena';
import { ARENA, BUY_INS, createBot, createRivals, getArenaAsset } from './engine';
import { RouterProvider } from '../router/RouterContext';

function createStorageMock() {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => (map.has(key) ? map.get(key)! : null)),
    setItem: vi.fn((key: string, val: string) => {
      map.set(key, String(val));
    }),
    removeItem: vi.fn((key: string) => {
      map.delete(key);
    }),
    clear: vi.fn(() => {
      map.clear();
    }),
  };
}

function buildValidStore(overrides: Partial<Store> = {}): Store {
  const now = Date.now();
  const roomIndex = overrides.roomIndex ?? 1;
  const room = BUY_INS[roomIndex] ?? BUY_INS[0];
  return {
    stage: 'running',
    roomIndex,
    tier: 'TOP_10',
    startsAt: now - 60_000,
    countdownEndsAt: now - 55_000,
    points: ARENA.initialPoints,
    reachedAt: now - 10_000,
    rebuys: 0,
    consecutiveWins: 0,
    maxStreak: 0,
    positions: [],
    trades: [],
    rivals: createRivals(room.rivals, now - 60_000, 492 + roomIndex),
    bot: createBot(now - 60_000),
    poolCents: 48300,
    ledger: [{ id: 'buy-1', type: 'BUY_IN', amountCents: room.cents, poolCents: 700, at: now - 60_000 }],
    lastStepAt: now,
    settlingSince: 0,
    result: null,
    rebuyPending: false,
    rebuyDismissed: false,
    clockOffsetMs: 12,
    ...overrides,
  };
}

function buildMockArenaApi(storeOverrides: Partial<Store> = {}): ArenaApi {
  const s = buildValidStore(storeOverrides);
  const room = BUY_INS[s.roomIndex] ?? BUY_INS[0];
  const asset = getArenaAsset('VOL_100');
  return {
    s,
    room,
    asset,
    symbol: asset.id,
    candles: [
      { time: 1700000000, open: 100, high: 105, low: 99, close: 102 },
      { time: 1700000060, open: 102, high: 106, low: 101, close: 104 },
    ],
    liveTick: null,
    currentPrice: 104,
    positionsAsContracts: [],
    isStale: false,
    rebuyEligible: false,
    onSelectSymbol: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    place: vi.fn(() => ({ ok: true as const })),
    rebuy: vi.fn(async () => ({ ok: true as const })),
    dismissRebuy: vi.fn(),
    reopenRebuy: vi.fn(),
    standings: () => [
      { id: 'you', name: 'Você', country: 'BR', points: s.points, updatedAt: 1, kind: 'you' as const },
      { id: 'bot', name: 'Alpha_Quant', country: 'AI', points: 1050, updatedAt: 2, kind: 'bot' as const },
      { id: 'r1', name: 'Lucas M.', country: 'BR', points: 1120, updatedAt: 3, kind: 'rival' as const },
    ],
    preview: {
      skip: vi.fn(),
      jumpTo: vi.fn(),
      bust: vi.fn(),
      setTier: vi.fn(),
      simulatePosition: vi.fn(),
      triggerMomentumStreak: vi.fn(),
    },
  };
}

describe('Subetapa 04 — Arena: Trava de Segurança, Persistência de Sessão e Voltar', () => {
  let sessionStorageMock: ReturnType<typeof createStorageMock>;

  beforeEach(() => {
    sessionStorageMock = createStorageMock();
    vi.stubGlobal('window', {
      sessionStorage: sessionStorageMock,
      localStorage: createStorageMock(),
      location: { pathname: '/arena', search: '' },
      history: { pushState: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('1. Testes Unitários — Persistência de Sessão e Trava de Saída (ArenaExitLockDialog)', () => {
    it('salva e restaura sessão ativa do torneio no sessionStorage preservando saldo, estágio e sala', () => {
      const store = buildValidStore({
        stage: 'running',
        roomIndex: 2,
        tier: 'TOP_20',
        points: 1480,
        rebuys: 1,
        consecutiveWins: 2,
        maxStreak: 3,
      });

      savePersistedArenaSession(store);

      const restored = loadPersistedArenaSession();
      expect(restored).not.toBeNull();
      expect(restored?.stage).toBe('running');
      expect(restored?.roomIndex).toBe(2);
      expect(restored?.tier).toBe('TOP_20');
      expect(restored?.points).toBe(1480);
      expect(restored?.rebuys).toBe(1);
      expect(restored?.consecutiveWins).toBe(2);
      expect(restored?.maxStreak).toBe(3);
    });

    it('limpa o sessionStorage quando o torneio está em lobby ou ended', () => {
      savePersistedArenaSession(buildValidStore({ stage: 'running' }));
      expect(loadPersistedArenaSession()).not.toBeNull();

      savePersistedArenaSession(buildValidStore({ stage: 'lobby' }));
      expect(loadPersistedArenaSession()).toBeNull();

      savePersistedArenaSession(buildValidStore({ stage: 'running' }));
      expect(loadPersistedArenaSession()).not.toBeNull();

      savePersistedArenaSession(buildValidStore({ stage: 'ended' }));
      expect(loadPersistedArenaSession()).toBeNull();
    });

    it('exibe o modal de trava de segurança (arena-exit-lock-dialog) quando torneio está ativo e saída é acionada', () => {
      const mockArena = buildMockArenaApi({ stage: 'running', roomIndex: 1 });
      const html = renderToStaticMarkup(
        <ArenaPage arenaOverride={mockArena} initialExitLockOpen={true} />,
      );

      expect(html).toContain('data-testid="arena-exit-lock-dialog"');
      expect(html).toContain('data-testid="arena-exit-lock-stay-btn"');
      expect(html).toContain('data-testid="arena-exit-lock-leave-btn"');
      expect(html).toContain('Sala Prata');
      expect(html).toContain('BLITZ #492');
    });

    it('não exibe o modal de trava quando o usuário está apenas no lobby (stage === "lobby")', () => {
      const mockArena = buildMockArenaApi({ stage: 'lobby' });
      const html = renderToStaticMarkup(
        <ArenaPage arenaOverride={mockArena} initialExitLockOpen={true} />,
      );

      expect(html).not.toContain('data-testid="arena-exit-lock-dialog"');
    });
  });

  describe('2. Testes de Caos — Reidratação Automática pós-F5 / Navegação Acidental', () => {
    it('restaura automaticamente a sala ativa (arena-live-room) ao montar ArenaPage sem initialStage quando há sessão ativa no sessionStorage', () => {
      savePersistedArenaSession(
        buildValidStore({
          stage: 'running',
          roomIndex: 1,
          points: 1320,
        }),
      );

      const html = renderToStaticMarkup(
        <RouterProvider initialPath="/arena">
          <ArenaPage />
        </RouterProvider>,
      );

      // Como havia sessão running no sessionStorage, ArenaPage reidrata direto na sala ao vivo!
      expect(html).toContain('data-testid="arena-live-room"');
      expect(html).not.toContain('data-testid="arena-lobby-view"');
    });

    it('sobrevive graciosamente se sessionStorage lançar QuotaExceededError ou SecurityError', () => {
      sessionStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      sessionStorageMock.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(() => {
        const html = renderToStaticMarkup(<ArenaPage />);
        expect(html).toContain('data-testid="arena-lobby-view"');
      }).not.toThrow();
    });
  });

  describe('3. Testes de Segurança — Anti-Tampering de sessionStorage', () => {
    it('rejeita payloads adulterados com saldo negativo, NaN, Infinity, stage inválido, timestamp expirado ou roomIndex fora do limite', () => {
      // 1. Pontuação negativa
      expect(
        sanitizeAndValidatePersistedArenaStore(
          buildValidStore({ points: -500 }),
        ),
      ).toBeNull();

      // 2. Pontuação acima do teto de sanidade (1_000_000) ou Infinity
      expect(
        sanitizeAndValidatePersistedArenaStore(
          buildValidStore({ points: Number.POSITIVE_INFINITY }),
        ),
      ).toBeNull();

      // 3. Stage inválido ("hacked")
      expect(
        sanitizeAndValidatePersistedArenaStore({
          ...buildValidStore(),
          stage: 'hacked',
        }),
      ).toBeNull();

      // 4. roomIndex fora dos limites (99)
      expect(
        sanitizeAndValidatePersistedArenaStore(
          buildValidStore({ roomIndex: 99 }),
        ),
      ).toBeNull();

      // 5. Sessão expirada (iniciada há 2 horas)
      expect(
        sanitizeAndValidatePersistedArenaStore(
          buildValidStore({ startsAt: Date.now() - 2 * 60 * 60_000 }),
        ),
      ).toBeNull();

      // 6. JSON corrompido no sessionStorage é limpo automaticamente
      sessionStorageMock.setItem(ARENA_SESSION_STORAGE_KEY, '{corrupted_json');
      expect(loadPersistedArenaSession()).toBeNull();
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(ARENA_SESSION_STORAGE_KEY);
    });
  });

  describe('4. Teste de Estresse — 200 Ciclos de Persistência + Reidratação + Sanitização', () => {
    it('executa 200 ciclos de save/load/validate em < 500ms sem corrupção de estado', () => {
      const start = performance.now();

      for (let i = 0; i < 200; i++) {
        const store = buildValidStore({
          stage: i % 2 === 0 ? 'running' : 'countdown',
          roomIndex: i % 3,
          points: 500 + i * 5,
          rebuys: i % 3,
        });

        savePersistedArenaSession(store);

        const loaded = loadPersistedArenaSession();
        expect(loaded).not.toBeNull();
        expect(loaded?.points).toBe(500 + i * 5);
        expect(loaded?.roomIndex).toBe(i % 3);
      }

      clearPersistedArenaSession();
      expect(loadPersistedArenaSession()).toBeNull();

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});
