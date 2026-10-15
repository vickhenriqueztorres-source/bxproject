import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ARENA,
  BOT,
  BUY_INS,
  botSignal,
  botStake,
  createBot,
  createRivals,
  getArenaAsset,
  maxStake,
  mulberry32,
  nextGap,
  podiumPrizes,
  prizePlaces,
  rankStandings,
  round2,
  settle,
  splitEntry,
  stepRivals,
  tierCutoffCount,
  tierPrizes,
  type ArenaCandle,
  type BotState,
  type ClosedTrade,
  type Direction,
  type PayoutTier,
  type Position,
  type Rival,
  type Standing,
} from './engine';
import {
  generateSeedCandles,
  getCandles,
  type Candle as ApiCandle,
  type Contract,
} from '../api/client';
import { tradingFeedManager } from '../feed/TradingFeedManager';
import type { Tick } from '../feed/protocol';
import { AuthService } from '../auth/auth-service';

export type Stage = 'lobby' | 'countdown' | 'running' | 'settling' | 'ended';

export type LedgerEvent = {
  id: string;
  type: 'BUY_IN' | 'REBUY' | 'PRIZE_PAYOUT' | 'BONUS_PAYOUT';
  amountCents: number;
  poolCents: number;
  at: number;
};

export type FinalResult = {
  rank: number;
  humanRank: number;
  total: number;
  prizeCents: number;
  percentile: number;
  points: number;
  botPoints: number;
  beatBot: boolean;
  bonusEligible: boolean;
  tier: PayoutTier;
  cutoffRank: number;
  tradesCount: number;
  winsCount: number;
  winRatePct: number;
  maxStreak: number;
};

export type Store = {
  stage: Stage;
  roomIndex: number;
  tier: PayoutTier;
  startsAt: number;
  countdownEndsAt: number;
  points: number;
  reachedAt: number;
  rebuys: number;
  consecutiveWins: number;
  maxStreak: number;
  positions: Position[];
  trades: ClosedTrade[];
  rivals: Rival[];
  bot: BotState;
  poolCents: number;
  ledger: LedgerEvent[];
  lastStepAt: number;
  settlingSince: number;
  result: FinalResult | null;
  rebuyPending: boolean;
  rebuyDismissed: boolean;
  clockOffsetMs: number;
};

export interface UseArenaOptions {
  initialStage?: Stage;
  initialRoomIndex?: number;
  initialTier?: PayoutTier;
  initialPoints?: number;
}

const COUNTDOWN_MS = 5_000;
const SETTLE_MS = 2_500;
const BATCH_MS = 250;
const ROOM_TOURNAMENT_IDS = ['tour_blitz_500', 'tour_blitz_1000', 'tour_blitz_2500'] as const;

async function arenaApiFetch<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit
): Promise<T | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const baseUrl =
      (typeof import.meta !== 'undefined' &&
        (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL) ||
      '';
    const session = AuthService.getSession();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...((init?.headers as Record<string, string>) || {}),
    };
    if (session?.token) {
      headers['authorization'] = `Bearer ${session.token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function mapArenaPositionsToContracts(positions: Position[], symbol: string): Contract[] {
  return positions.map((p) => ({
    id: p.id,
    symbol: symbol || p.symbol,
    direction: p.direction === 'up' ? 'UP' : 'DOWN',
    stake_minor: Math.round(p.amount * 100),
    status: 'OPEN',
    result: null,
    payout_minor: Math.round(p.amount * p.payout * 100),
    created_at: new Date(p.openedAt).toISOString(),
    expires_at: new Date(p.expiresAt).toISOString(),
    entry_price: p.openPrice,
    strike_price: p.openPrice,
  }));
}

function emptyStore(options?: UseArenaOptions): Store {
  const now = Date.now();
  const roomIdx = options?.initialRoomIndex ?? 0;
  const room = BUY_INS[roomIdx] ?? BUY_INS[0];
  const tier = options?.initialTier ?? 'TOP_3';
  const stage = options?.initialStage ?? 'lobby';
  const rivals = stage !== 'lobby' ? createRivals(room.rivals, now, 492 + roomIdx) : [];
  const poolCents = stage !== 'lobby' ? (room.rivals + 1) * splitEntry(room.cents).pool : 0;

  return {
    stage,
    roomIndex: roomIdx,
    tier,
    startsAt: now,
    countdownEndsAt: stage === 'countdown' ? now + COUNTDOWN_MS : now,
    points: options?.initialPoints ?? ARENA.initialPoints,
    reachedAt: now,
    rebuys: 0,
    consecutiveWins: 0,
    maxStreak: 0,
    positions: [],
    trades: [],
    rivals,
    bot: createBot(now),
    poolCents,
    ledger:
      stage !== 'lobby'
        ? [
            {
              id: `buy-${now}`,
              type: 'BUY_IN',
              amountCents: room.cents,
              poolCents: splitEntry(room.cents).pool,
              at: now,
            },
          ]
        : [],
    lastStepAt: now,
    settlingSince: stage === 'settling' ? now : 0,
    result: null,
    rebuyPending: false,
    rebuyDismissed: false,
    clockOffsetMs: 12,
  };
}

const settledBalance = (t: ClosedTrade) =>
  t.result === 'win' ? t.amount + t.profit : t.result === 'tie' ? t.amount : 0;

export function useArena(options?: UseArenaOptions) {
  const [symbol, setSymbol] = useState<string>('VOL_100');
  const asset = useMemo(() => getArenaAsset(symbol), [symbol]);

  const store = useRef<Store>(null as unknown as Store);
  if (store.current === null) {
    store.current = emptyStore(options);
  }

  const rand = useRef(mulberry32(7_492));
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Feed real do tradingFeedManager + fallback determinístico de candles
  const [candles, setCandles] = useState<ApiCandle[]>(() => generateSeedCandles('VOL_100', 120));
  const [liveTick, setLiveTick] = useState<Tick | null>(null);
  const liveTickRef = useRef<Tick | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const priceRef = useRef<number>(asset.basePrice);
  const candlesRef = useRef<ApiCandle[]>(candles);
  candlesRef.current = candles;

  useEffect(() => {
    const seed = generateSeedCandles(symbol, 120);
    setCandles(seed);
    candlesRef.current = seed;
    const lastClose = Number(seed[seed.length - 1]?.close);
    if (Number.isFinite(lastClose) && lastClose > 0) {
      priceRef.current = lastClose;
    } else {
      priceRef.current = getArenaAsset(symbol).basePrice;
    }

    let active = true;
    getCandles(symbol, '1m', 240)
      .then((loaded) => {
        if (!active || !Array.isArray(loaded) || loaded.length === 0) return;
        setCandles(loaded);
        candlesRef.current = loaded;
        const close = Number(loaded[loaded.length - 1]?.close);
        if (Number.isFinite(close) && close > 0) {
          priceRef.current = close;
        }
      })
      .catch(() => {
        // Mantém seed determinístico em modo offline/teste
      });

    tradingFeedManager.connect();
    const unsubStale = tradingFeedManager.onSymbolStaleness(symbol, (staleState) => {
      if (active) setIsStale(staleState);
    });
    const unsubTick = tradingFeedManager.subscribeSymbol(symbol, (incoming) => {
      if (!active) return;
      const p = Number(incoming.price);
      if (Number.isFinite(p) && p > 0) {
        priceRef.current = p;
      }
      liveTickRef.current = incoming;
      setLiveTick(incoming);
    });

    return () => {
      active = false;
      unsubTick();
      unsubStale();
    };
  }, [symbol]);

  const getCurrentPrice = useCallback((): number => {
    if (liveTick) {
      const p = Number(liveTick.price);
      if (Number.isFinite(p) && p > 0) return p;
    }
    return priceRef.current || asset.basePrice;
  }, [asset.basePrice, liveTick]);

  const getArenaCandles = useCallback((): ArenaCandle[] => {
    return candlesRef.current.map((c) => ({
      time: c.time * 1000,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));
  }, []);

  const userName = useMemo(() => {
    const session = AuthService.getSession();
    return session?.user?.name || 'Você';
  }, []);

  const standings = useCallback((): Standing[] => {
    const s = store.current;
    return rankStandings(s.rivals, s.bot, {
      name: userName,
      points: s.points,
      reachedAt: s.reachedAt,
    });
  }, [userName]);

  const finalize = useCallback(
    (now: number) => {
      const s = store.current;
      const list = standings();
      const places = prizePlaces(list);
      const rank = list.findIndex((x) => x.kind === 'you') + 1;
      const humanRank = (places.get('you') ?? list.length) + 1;
      const cutoffRank = tierCutoffCount(s.tier);
      const { prizes } =
        s.tier === 'TOP_3' ? podiumPrizes(s.poolCents) : tierPrizes(s.poolCents, s.tier);
      const prizeCents = humanRank <= cutoffRank ? (prizes[humanRank - 1] ?? 0) : 0;
      const beatBot = s.points > s.bot.points;
      const bonusEligible = beatBot && s.points > ARENA.initialPoints;
      const winsCount = s.trades.filter((t) => t.result === 'win').length;
      const tradesCount = s.trades.length;
      const winRatePct = tradesCount > 0 ? Math.round((winsCount / tradesCount) * 1000) / 10 : 0;

      s.result = {
        rank,
        humanRank,
        total: list.length,
        prizeCents,
        percentile: list.length > 1 ? (list.length - rank) / (list.length - 1) : 1,
        points: s.points,
        botPoints: s.bot.points,
        beatBot,
        bonusEligible,
        tier: s.tier,
        cutoffRank,
        tradesCount,
        winsCount,
        winRatePct,
        maxStreak: s.maxStreak,
      };
      if (prizeCents > 0) {
        s.ledger.unshift({
          id: `pay-${now}`,
          type: 'PRIZE_PAYOUT',
          amountCents: prizeCents,
          poolCents: -prizeCents,
          at: now,
        });
      }
      if (bonusEligible) {
        const spent = s.ledger
          .filter((e) => e.type === 'BUY_IN' || e.type === 'REBUY')
          .reduce((acc, e) => acc + e.amountCents, 0);
        const bonusCents = Math.round(spent * ARENA.bonusPct);
        if (bonusCents > 0) {
          s.ledger.unshift({
            id: `bonus-${now}`,
            type: 'BONUS_PAYOUT',
            amountCents: bonusCents,
            poolCents: 0,
            at: now,
          });
        }
      }
      s.stage = 'ended';
    },
    [standings]
  );

  const settleBot = useCallback(
    (now: number, force: boolean) => {
      const bot = store.current.bot;
      const open = bot.trades.find((t) => !t.result);
      if (!open || (!force && now < open.expiresAt)) return;
      const closePrice = getCurrentPrice();
      const moved = closePrice - open.openPrice;
      open.closePrice = closePrice;
      open.result =
        moved === 0 ? 'tie' : (moved > 0) === (open.direction === 'up') ? 'win' : 'loss';
      open.profit =
        open.result === 'win'
          ? round2(open.stake * BOT.payout)
          : open.result === 'loss'
          ? -open.stake
          : 0;
      bot.points = round2(bot.points + open.stake + open.profit);
      bot.streak = open.result === 'win' ? (bot.streak >= 2 ? 1 : bot.streak + 1) : 0;
      bot.reachedAt = now;
    },
    [getCurrentPrice]
  );

  const settleUser = useCallback(
    (now: number, force: boolean) => {
      const s = store.current;
      const price = getCurrentPrice();
      const due = s.positions.filter((p) => force || now >= p.expiresAt);
      if (due.length === 0) return;
      s.positions = s.positions.filter((p) => !due.includes(p));
      for (const p of due) {
        const moved = price - p.openPrice;
        const isWin = moved !== 0 && (moved > 0) === (p.direction === 'up');
        const isLoss = moved !== 0 && !isWin;
        if (isWin) {
          s.consecutiveWins += 1;
          if (s.consecutiveWins > s.maxStreak) s.maxStreak = s.consecutiveWins;
        } else if (isLoss) {
          s.consecutiveWins = 0;
        }
        const closed = settle(p, price, now, s.consecutiveWins);
        s.trades.unshift(closed);
        s.points = round2(s.points + settledBalance(closed));
      }
      s.reachedAt = now;
      if (s.points >= ARENA.minStake) s.rebuyDismissed = false;
    },
    [getCurrentPrice]
  );

  useEffect(() => {
    const id = setInterval(() => {
      const s = store.current;
      if (s.stage === 'lobby' || s.stage === 'ended') return;
      const now = Date.now();

      // Caso não haja WebSocket ativo enviando ticks, avança micro-variação determinística para liquidação ao vivo
      if (!liveTickRef.current) {
        const deltaReturn = (rand.current() - 0.498) * asset.volatility * 0.35;
        priceRef.current = Math.max(
          asset.basePrice * 0.2,
          Number((priceRef.current * (1 + deltaReturn)).toFixed(asset.digits))
        );
      }

      if (s.stage === 'countdown') {
        if (now >= s.countdownEndsAt) {
          s.stage = 'running';
          s.startsAt = now;
          s.lastStepAt = now;
          s.reachedAt = now;
          s.bot = createBot(now);
          s.rivals.forEach((r, i) => (r.reachedAt = now - 1_000 - i));
        }
        bump();
        return;
      }

      settleUser(now, s.stage === 'settling');
      settleBot(now, s.stage === 'settling');

      if (s.stage === 'running') {
        const elapsed = now - s.startsAt;
        const rebuysOpen = elapsed < ARENA.rebuyFreezeMs;
        while (now - s.lastStepAt >= 1_000) {
          s.lastStepAt += 1_000;
          const added = stepRivals(s.rivals, rand.current, s.lastStepAt, rebuysOpen);
          s.poolCents += added * splitEntry(ARENA.rebuyPriceCents).pool;
        }

        const botOpen = s.bot.trades.some((t) => !t.result);
        const botCanTrade = elapsed < ARENA.tradeFreezeMs - BOT.expirySec * 1_000;
        if (!botOpen && botCanTrade && now >= s.bot.nextCheckAt) {
          const signal = botSignal(getArenaCandles());
          if (signal) {
            const { stake, level } = botStake(s.bot);
            s.bot.points = round2(s.bot.points - stake);
            s.bot.reachedAt = now;
            s.bot.trades.unshift({
              id: `b${now}`,
              direction: signal.direction,
              stake,
              openPrice: getCurrentPrice(),
              openedAt: now,
              expiresAt: now + BOT.expirySec * 1_000,
              ema9: signal.ema9,
              ema21: signal.ema21,
              sorosLevel: level,
            });
            s.bot.nextCheckAt = now + nextGap(rand.current);
          } else {
            s.bot.skipped++;
            s.bot.nextCheckAt = now + 10_000;
          }
        }

        if (elapsed >= ARENA.durationMs) {
          s.stage = 'settling';
          s.settlingSince = now;
        }
      } else if (s.stage === 'settling' && now - s.settlingSince >= SETTLE_MS) {
        finalize(now);
      }
      bump();
    }, BATCH_MS);
    return () => clearInterval(id);
  }, [asset.basePrice, asset.digits, asset.volatility, bump, finalize, getArenaCandles, getCurrentPrice, settleBot, settleUser]);

  const join = useCallback(
    (roomIndex: number, tierOverride?: PayoutTier) => {
      const safeIndex = Math.max(0, Math.min(BUY_INS.length - 1, roomIndex));
      const room = BUY_INS[safeIndex];
      const now = Date.now();
      const fresh = emptyStore();
      fresh.stage = 'countdown';
      fresh.roomIndex = safeIndex;
      fresh.tier = tierOverride ?? 'TOP_3';
      fresh.countdownEndsAt = now + COUNTDOWN_MS;
      fresh.rivals = createRivals(room.rivals, now, 492 + safeIndex);
      fresh.poolCents = (room.rivals + 1) * splitEntry(room.cents).pool;
      fresh.clockOffsetMs = Math.round((rand.current() - 0.5) * 30);
      fresh.ledger = [
        {
          id: `buy-${now}`,
          type: 'BUY_IN',
          amountCents: room.cents,
          poolCents: splitEntry(room.cents).pool,
          at: now,
        },
      ];
      store.current = fresh;
      bump();

      const tournamentId = ROOM_TOURNAMENT_IDS[safeIndex] ?? ROOM_TOURNAMENT_IDS[0];
      void arenaApiFetch<{
        participant?: { current_t_balance_minor?: number };
        tournament?: { prize_pool_minor?: number };
      }>(`/api/v1/arena/tournaments/${tournamentId}/join`, {
        method: 'POST',
        headers: { 'idempotency-key': `join_${tournamentId}_${now}` },
        body: JSON.stringify({ display_name: userName }),
      }).then((res) => {
        if (!res || store.current !== fresh) return;
        if (typeof res.tournament?.prize_pool_minor === 'number' && res.tournament.prize_pool_minor > 0) {
          fresh.poolCents = res.tournament.prize_pool_minor;
        }
        bump();
      });
    },
    [bump, userName]
  );

  const place = useCallback(
    (
      direction: Direction,
      stake: number,
      expirySec: number
    ): { ok: true } | { ok: false; error: string } => {
      const s = store.current;
      const now = Date.now();
      if (s.stage !== 'running') {
        return { ok: false, error: 'O torneio não está aberto para ordens.' };
      }
      if (now - s.startsAt >= ARENA.tradeFreezeMs) {
        return { ok: false, error: 'Ordens bloqueadas no último minuto do torneio.' };
      }
      const cap = maxStake(s.points);
      if (stake < ARENA.minStake) {
        return { ok: false, error: `O valor mínimo por ordem é T$ ${ARENA.minStake}.` };
      }
      if (stake > cap) {
        return {
          ok: false,
          error: `Cada ordem pode usar no máximo 20% do saldo (T$ ${cap}).`,
        };
      }
      if (now + expirySec * 1_000 > s.startsAt + ARENA.durationMs) {
        return {
          ok: false,
          error: 'Essa expiração passa do fim do torneio. Escolha um tempo menor.',
        };
      }
      s.points = round2(s.points - stake);
      s.reachedAt = now;
      const position: Position = {
        id: `t${now}-${s.positions.length}`,
        assetId: asset.id,
        symbol: asset.symbol,
        direction,
        amount: stake,
        payout: asset.payout,
        openPrice: getCurrentPrice(),
        openedAt: now,
        expiresAt: now + expirySec * 1_000,
        account: 'practice',
      };
      s.positions.push(position);
      bump();

      const tournamentId = ROOM_TOURNAMENT_IDS[s.roomIndex] ?? ROOM_TOURNAMENT_IDS[0];
      void arenaApiFetch<{
        order?: { id?: string; entry_price?: number };
      }>(`/api/v1/arena/tournaments/${tournamentId}/trades`, {
        method: 'POST',
        body: JSON.stringify({
          symbol: asset.symbol,
          direction: direction === 'up' ? 'UP' : 'DOWN',
          stake_t_minor: Math.round(stake * 100),
          duration_seconds: expirySec,
        }),
      }).then((res) => {
        if (!res?.order) return;
        const officialEntry = Number(res.order.entry_price);
        if (Number.isFinite(officialEntry) && officialEntry > 0) {
          position.openPrice = officialEntry;
          bump();
        }
      });

      return { ok: true };
    },
    [asset, bump, getCurrentPrice]
  );

  const rebuyEligible = () => {
    const s = store.current;
    return (
      s.stage === 'running' &&
      s.points < ARENA.minStake &&
      s.positions.length === 0 &&
      s.rebuys < ARENA.maxRebuys &&
      Date.now() - s.startsAt < ARENA.rebuyFreezeMs
    );
  };

  const rebuy = useCallback(
    async (delayMs = 900): Promise<{ ok: true } | { ok: false; error: string }> => {
      const s = store.current;
      if (s.rebuyPending) {
        return { ok: false, error: 'Seu rebuy já está sendo processado.' };
      }
      s.rebuyPending = true;
      bump();
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      try {
        if (!rebuyEligible()) {
          return { ok: false, error: 'O rebuy não está mais disponível para esta Arena.' };
        }
        const now = Date.now();
        s.points = ARENA.initialPoints;
        s.consecutiveWins = 0;
        s.reachedAt = now;
        s.rebuys++;
        s.poolCents += splitEntry(ARENA.rebuyPriceCents).pool;
        s.ledger.unshift({
          id: `rebuy-${now}`,
          type: 'REBUY',
          amountCents: ARENA.rebuyPriceCents,
          poolCents: splitEntry(ARENA.rebuyPriceCents).pool,
          at: now,
        });
        const tournamentId = ROOM_TOURNAMENT_IDS[s.roomIndex] ?? ROOM_TOURNAMENT_IDS[0];
        void arenaApiFetch(`/api/v1/arena/tournaments/${tournamentId}/rebuy`, {
          method: 'POST',
          headers: { 'idempotency-key': `rebuy_${tournamentId}_${now}` },
          body: JSON.stringify({}),
        });
        return { ok: true };
      } finally {
        s.rebuyPending = false;
        bump();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bump]
  );

  const preview = {
    skip: (ms: number) => {
      const s = store.current;
      if (s.stage !== 'running') return;
      s.startsAt -= ms;
      s.lastStepAt -= ms;
      s.bot.nextCheckAt -= ms;
      bump();
    },
    jumpTo: (elapsedMs: number) => {
      const s = store.current;
      if (s.stage !== 'running') return;
      const now = Date.now();
      const currentElapsed = now - s.startsAt;
      const delta = elapsedMs - currentElapsed;
      if (delta !== 0) {
        s.startsAt -= delta;
        s.lastStepAt -= delta;
        s.bot.nextCheckAt -= delta;
      }
      if (elapsedMs >= ARENA.durationMs) {
        settleUser(now, true);
        settleBot(now, true);
        finalize(now);
      }
      bump();
    },
    bust: () => {
      const s = store.current;
      if (s.stage !== 'running') return;
      s.positions = [];
      s.points = 0;
      s.consecutiveWins = 0;
      s.reachedAt = Date.now();
      s.rebuyDismissed = false;
      bump();
    },
    setTier: (tier: PayoutTier) => {
      const s = store.current;
      s.tier = tier;
      if (s.stage === 'ended') {
        finalize(Date.now());
      }
      bump();
    },
    simulatePosition: (targetRank: number) => {
      const s = store.current;
      const now = Date.now();
      if (s.rivals.length === 0) {
        const room = BUY_INS[s.roomIndex] ?? BUY_INS[0];
        s.rivals = createRivals(room.rivals, now, 492 + s.roomIndex);
      }
      // Distribui pontuações decrescentes determinísticas nos rivais para garantir posições exatas (#1 .. #35+)
      for (let i = 0; i < s.rivals.length; i++) {
        s.rivals[i].points = Math.max(120, round2(2800 - i * 40));
        s.rivals[i].reachedAt = now - 10_000 - i;
      }
      const clampedRank = Math.max(1, Math.min(s.rivals.length + 1, Math.floor(targetRank)));
      if (clampedRank === 1) {
        s.points = round2(s.rivals[0].points + 160);
        s.reachedAt = now - 25_000;
        s.bot.points = round2(s.points - 340);
      } else {
        const above = s.rivals[clampedRank - 2]?.points ?? 2800;
        const below = s.rivals[clampedRank - 1]?.points ?? Math.max(100, above - 40);
        s.points = round2((above + below) / 2);
        s.reachedAt = now - 15_000;
        // Mantém o bot abaixo dos rivais acima para que rank humano e geral coincidam com clareza
        s.bot.points = round2(Math.max(950, s.points - 80));
      }
      if (s.stage === 'ended') {
        finalize(now);
      }
      bump();
    },
    triggerMomentumStreak: () => {
      const s = store.current;
      s.consecutiveWins = 3;
      if (s.maxStreak < 3) s.maxStreak = 3;
      bump();
    },
  };

  return {
    get s() {
      return store.current;
    },
    asset,
    symbol,
    onSelectSymbol: setSymbol,
    candles,
    liveTick,
    isStale,
    get positionsAsContracts() {
      return mapArenaPositionsToContracts(store.current.positions, symbol);
    },
    currentPrice: getCurrentPrice(),
    get room() {
      return BUY_INS[store.current.roomIndex] ?? BUY_INS[0];
    },
    standings,
    join,
    place,
    rebuy,
    get rebuyEligible() {
      return rebuyEligible();
    },
    dismissRebuy: () => {
      store.current.rebuyDismissed = true;
      bump();
    },
    reopenRebuy: () => {
      store.current.rebuyDismissed = false;
      bump();
    },
    leave: () => {
      store.current = emptyStore();
      bump();
    },
    preview,
  };
}

export type ArenaApi = ReturnType<typeof useArena>;
