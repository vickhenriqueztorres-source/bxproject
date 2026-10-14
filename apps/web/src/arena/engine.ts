export type Direction = 'up' | 'down';
export type AccountKind = 'practice' | 'real';
export type PayoutTier = 'TOP_3' | 'TOP_10' | 'TOP_20' | 'TOP_30';
export type RivalArchetype = 'SCALPER' | 'TREND_FOLLOWER' | 'SNIPER';

export type ArenaCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Position = {
  id: string;
  assetId: string;
  symbol: string;
  direction: Direction;
  amount: number;
  payout: number;
  openPrice: number;
  openedAt: number;
  expiresAt: number;
  account: AccountKind;
};

export type ClosedTrade = Position & {
  closePrice: number;
  closedAt: number;
  result: 'win' | 'loss' | 'tie';
  profit: number;
  momentumBonus?: number;
  sample?: boolean;
};

export const round2 = (value: number) => Math.round(value * 100) / 100;

export const MOMENTUM_STREAK_THRESHOLD = 3;
export const MOMENTUM_BONUS_PCT = 0.15;

export function applyMomentumBonus(baseProfit: number, consecutiveWins: number): {
  totalProfit: number;
  bonus: number;
  boostActive: boolean;
} {
  if (baseProfit <= 0 || consecutiveWins < MOMENTUM_STREAK_THRESHOLD) {
    return { totalProfit: round2(baseProfit), bonus: 0, boostActive: false };
  }
  const bonus = round2(baseProfit * MOMENTUM_BONUS_PCT);
  return {
    totalProfit: round2(baseProfit + bonus),
    bonus,
    boostActive: true,
  };
}

export function settle(
  position: Position,
  closePrice: number,
  closedAt: number,
  consecutiveWinsAfterThis = 0
): ClosedTrade {
  const moved = closePrice - position.openPrice;
  const result: ClosedTrade['result'] =
    moved === 0 ? 'tie' : (moved > 0) === (position.direction === 'up') ? 'win' : 'loss';
  const rawProfit =
    result === 'win' ? round2(position.amount * position.payout) : result === 'loss' ? -position.amount : 0;
  if (result === 'win' && consecutiveWinsAfterThis >= MOMENTUM_STREAK_THRESHOLD) {
    const { totalProfit, bonus } = applyMomentumBonus(rawProfit, consecutiveWinsAfterThis);
    return { ...position, closePrice, closedAt, result, profit: totalProfit, momentumBonus: bonus };
  }
  return { ...position, closePrice, closedAt, result, profit: rawProfit, momentumBonus: 0 };
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ArenaAsset = {
  id: string;
  symbol: string;
  short: string;
  name: string;
  mode: 'Turbo' | 'Clássico';
  payout: number;
  basePrice: number;
  volatility: number;
  digits: number;
  seed: number;
};

export const ARENA_ASSETS: ArenaAsset[] = [
  {
    id: 'vol10',
    symbol: 'VOL_10',
    short: 'Vol 10',
    name: 'Índice de Volatilidade 10',
    mode: 'Clássico',
    payout: 0.82,
    basePrice: 12448.2,
    volatility: 0.00022,
    digits: 2,
    seed: 1010,
  },
  {
    id: 'vol25',
    symbol: 'VOL_25',
    short: 'Vol 25',
    name: 'Índice de Volatilidade 25',
    mode: 'Turbo',
    payout: 0.84,
    basePrice: 1252.11,
    volatility: 0.00045,
    digits: 4,
    seed: 2525,
  },
  {
    id: 'vol50',
    symbol: 'VOL_50',
    short: 'Vol 50',
    name: 'Índice de Volatilidade 50',
    mode: 'Turbo',
    payout: 0.85,
    basePrice: 507.9397,
    volatility: 0.0008,
    digits: 4,
    seed: 5050,
  },
  {
    id: 'vol100',
    symbol: 'VOL_100',
    short: 'Vol 100',
    name: 'Índice de Volatilidade 100',
    mode: 'Turbo',
    payout: 0.88,
    basePrice: 2490.512,
    volatility: 0.0014,
    digits: 3,
    seed: 10100,
  },
];

export function getArenaAsset(idOrSymbol: string): ArenaAsset {
  const lower = idOrSymbol.toLowerCase();
  return (
    ARENA_ASSETS.find(
      (a) => a.id.toLowerCase() === lower || a.symbol.toLowerCase() === lower
    ) ?? ARENA_ASSETS[3]
  );
}

export const ARENA = {
  number: 492,
  assetId: 'vol100',
  durationMs: 15 * 60_000,
  rebuyFreezeMs: 12 * 60_000,
  tradeFreezeMs: 14 * 60_000,
  initialPoints: 1_000,
  minStake: 10,
  maxStakePct: 0.2,
  maxRebuys: 3,
  rebuyPriceCents: 300,
  rakeWeight: 0.3,
  poolWeight: 0.7,
  podium: [0.5, 0.3, 0.2],
  expiries: [30, 60, 120],
  bonusPct: 0.5,
  rolloverX: 25,
} as const;

export const BUY_INS = [
  { cents: 500, label: 'Sala Bronze', rivals: 124, defaultTier: 'TOP_10' as PayoutTier, image: '/tournaments/bronze.png' },
  { cents: 1_000, label: 'Sala Prata', rivals: 68, defaultTier: 'TOP_20' as PayoutTier, image: '/tournaments/silver.png' },
  { cents: 2_500, label: 'Sala Ouro', rivals: 45, defaultTier: 'TOP_30' as PayoutTier, image: '/tournaments/gold.png' },
] as const;

/** Basis points (sum = 10_000 = 100.00%) for each PayoutTier. */
export const TIER_WEIGHTS_BPS: Record<PayoutTier, readonly number[]> = {
  TOP_3: [5000, 3000, 2000],
  TOP_10: [2800, 1800, 1200, 900, 800, 700, 600, 500, 400, 300],
  TOP_20: [
    2200, 1400, 1000, 750, 650, 500, 450, 400, 350, 300,
    250, 230, 220, 210, 200, 190, 180, 180, 170, 170,
  ],
  TOP_30: [
    1800, 1200, 850, 650, 550, 450, 400, 350, 300, 250,
    220, 210, 200, 190, 180, 170, 160, 160, 150, 150,
    150, 150, 150, 140, 140, 140, 140, 140, 130, 130,
  ],
};

export function tierCutoffCount(tier: PayoutTier): number {
  return TIER_WEIGHTS_BPS[tier].length;
}

export function tierLabel(tier: PayoutTier): string {
  switch (tier) {
    case 'TOP_3':
      return 'Top 3';
    case 'TOP_10':
      return 'Top 10';
    case 'TOP_20':
      return 'Top 20';
    case 'TOP_30':
      return 'Top 30';
  }
}

/** Hare-Niemeyer: distributes integer cents by weight without creating or losing a cent. */
export function largestRemainder(total: number, weights: readonly number[]) {
  const safeTotal = Math.max(0, Math.floor(total));
  const raw = weights.map((w) => safeTotal * w);
  const parts = raw.map(Math.floor);
  let rest = safeTotal - parts.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; rest > 0; k++, rest--) parts[order[k % order.length].i]++;
  return parts;
}

export function splitEntry(cents: number) {
  const [rake, pool] = largestRemainder(cents, [ARENA.rakeWeight, ARENA.poolWeight]);
  return { rake, pool };
}

/** Winners get truncated cents; the residual goes back to the house so escrow closes at zero. */
export function podiumPrizes(poolCents: number) {
  const prizes = ARENA.podium.map((w) => Math.floor(poolCents * w));
  return { prizes, residual: poolCents - prizes.reduce((a, b) => a + b, 0) };
}

/** Hare-Niemeyer exact cent distribution across Top 3 / Top 10 / Top 20 / Top 30. */
export function tierPrizes(poolCents: number, tier: PayoutTier = 'TOP_3') {
  const bps = TIER_WEIGHTS_BPS[tier];
  const weights = bps.map((b) => b / 10_000);
  const prizes = largestRemainder(poolCents, weights);
  const distributed = prizes.reduce((a, b) => a + b, 0);
  return {
    prizes,
    residual: Math.max(0, Math.floor(poolCents) - distributed),
    cutoffRank: bps.length,
    weightsBps: bps,
  };
}

/** ZSET score: integer points in cents plus a decaying fraction so whoever got there first stays ahead. */
export function zsetScore(points: number, reachedAt: number) {
  return Math.round(points * 100) + (1 - Math.min(Math.max(0, reachedAt), 1e13) / 1e13);
}

export function maxStake(points: number) {
  return Math.floor(points * ARENA.maxStakePct);
}

export type Rival = {
  id: string;
  name: string;
  country: string;
  points: number;
  reachedAt: number;
  rebuys: number;
  archetype: RivalArchetype;
  consecutiveWins: number;
};

const FIRST = [
  'Gabriel', 'Mateus', 'Lucas', 'Ana', 'Rafa', 'Bruno', 'Camila', 'Diego', 'Julia', 'Pedro',
  'Leo', 'Bia', 'Thiago', 'Nina', 'Caio', 'Duda', 'Vini', 'Iago', 'Lara', 'Enzo',
  'Rodrigo', 'Sofia', 'Elena', 'Carlos', 'Andres', 'Valeria', 'Lucia', 'Javier', 'renato', 'Marco',
];
const SUFFIX = ['_Fx', '.P', 'Trader', '_88', 'Pips', '.Quant', '_BR', 'Bull', '.Scalp', '_07', 'Max', '.Opt'];
const COUNTRIES = ['BR', 'BR', 'BR', 'PE', 'MX', 'CO', 'AR', 'CL', 'PT', 'EC'];
const ARCHETYPES: RivalArchetype[] = ['SCALPER', 'TREND_FOLLOWER', 'SNIPER'];

export function createRivals(count: number, now: number, seed = 492): Rival[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: `${FIRST[Math.floor(rand() * FIRST.length)]}${SUFFIX[Math.floor(rand() * SUFFIX.length)]}`,
    country: COUNTRIES[Math.floor(rand() * COUNTRIES.length)],
    points: ARENA.initialPoints,
    reachedAt: now - i,
    rebuys: 0,
    archetype: ARCHETYPES[i % ARCHETYPES.length],
    consecutiveWins: 0,
  }));
}

/** One simulated second for every rival: a few settle a trade, the busted ones may rebuy. */
export function stepRivals(rivals: Rival[], rand: () => number, now: number, rebuysOpen: boolean) {
  let newRebuys = 0;
  for (const r of rivals) {
    if (r.points < ARENA.minStake) {
      if (rebuysOpen && r.rebuys < ARENA.maxRebuys && rand() < 0.04) {
        r.points = ARENA.initialPoints;
        r.rebuys++;
        r.consecutiveWins = 0;
        r.reachedAt = now;
        newRebuys++;
      }
      continue;
    }
    const tradeFreq = r.archetype === 'SCALPER' ? 0.11 : r.archetype === 'TREND_FOLLOWER' ? 0.08 : 0.05;
    if (rand() > tradeFreq) continue;
    const riskFactor = r.archetype === 'SNIPER' ? 0.12 + rand() * 0.08 : 0.05 + rand() * 0.15;
    const stake = Math.max(ARENA.minStake, Math.min(maxStake(r.points), Math.floor(r.points * riskFactor)));
    const winProb = r.archetype === 'SNIPER' ? 0.56 : 0.53;
    const win = rand() < winProb;
    if (win) {
      r.consecutiveWins = (r.consecutiveWins ?? 0) + 1;
      const baseProfit = stake * 0.88;
      const { totalProfit } = applyMomentumBonus(baseProfit, r.consecutiveWins);
      r.points = Math.max(0, Math.round((r.points + totalProfit) * 100) / 100);
    } else {
      r.consecutiveWins = 0;
      r.points = Math.max(0, Math.round((r.points - stake) * 100) / 100);
    }
    r.reachedAt = now;
  }
  return newRebuys;
}

export type BotTrade = {
  id: string;
  direction: Direction;
  stake: number;
  openPrice: number;
  openedAt: number;
  expiresAt: number;
  ema9: number;
  ema21: number;
  sorosLevel: number;
  closePrice?: number;
  profit?: number;
  result?: 'win' | 'loss' | 'tie';
};

export type BotState = {
  points: number;
  reachedAt: number;
  streak: number;
  lastStake: number;
  nextCheckAt: number;
  trades: BotTrade[];
  skipped: number;
};

export const BOT = {
  name: 'Alpha_Quant',
  baseRisk: 0.03,
  expirySec: 60,
  minGapMs: 45_000,
  maxGapMs: 75_000,
  payout: 0.88,
} as const;

export function createBot(now: number): BotState {
  return {
    points: ARENA.initialPoints,
    reachedAt: now - 1_000,
    streak: 0,
    lastStake: 0,
    nextCheckAt: now + 20_000,
    trades: [],
    skipped: 0,
  };
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  let out = values[0];
  for (let i = 1; i < values.length; i++) out = values[i] * k + out * (1 - k);
  return out;
}

/** EMA 9/21 cross confirmed by 3-candle momentum. Returns null when there is no valid signal. */
export function botSignal(candles: ArenaCandle[]) {
  const closes = candles.slice(-42).map((c) => Number(c.close));
  if (closes.length < 22) return null;
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const momentum = closes[closes.length - 1] - closes[closes.length - 4];
  if (e9 > e21 && momentum > 0) return { direction: 'up' as const, ema9: e9, ema21: e21 };
  if (e9 < e21 && momentum < 0) return { direction: 'down' as const, ema9: e9, ema21: e21 };
  return null;
}

/** Fixed 3% risk with Soros level 2: after a win the next stake adds the profit, reset after two wins. */
export function botStake(bot: BotState) {
  const base = Math.max(ARENA.minStake, Math.floor(bot.points * BOT.baseRisk));
  if (bot.streak === 0 || bot.streak >= 2) return { stake: base, level: 0 };
  const last = bot.trades.find((t) => t.result);
  const soros = last && last.result === 'win' ? Math.floor(last.stake + (last.profit ?? 0)) : base;
  return { stake: Math.min(soros, maxStake(bot.points)), level: bot.streak };
}

export function nextGap(rand: () => number) {
  return BOT.minGapMs + rand() * (BOT.maxGapMs - BOT.minGapMs);
}

export type Standing = {
  id: string;
  name: string;
  country: string;
  points: number;
  score: number;
  kind: 'you' | 'bot' | 'rival';
};

export function rankStandings(
  rivals: Rival[],
  bot: BotState,
  you: { name: string; points: number; reachedAt: number }
) {
  const list: Standing[] = [
    ...rivals.map((r) => ({
      id: r.id,
      name: r.name,
      country: r.country,
      points: r.points,
      score: zsetScore(r.points, r.reachedAt),
      kind: 'rival' as const,
    })),
    {
      id: 'bot',
      name: BOT.name,
      country: 'AI',
      points: bot.points,
      score: zsetScore(bot.points, bot.reachedAt),
      kind: 'bot',
    },
    {
      id: 'you',
      name: you.name,
      country: 'BR',
      points: you.points,
      score: zsetScore(you.points, you.reachedAt),
      kind: 'you',
    },
  ];
  list.sort((a, b) => b.score - a.score);
  return list;
}

/** Prize index per standing: the benchmark bot never takes a podium/prize spot. */
export function prizePlaces(standings: Standing[]) {
  const places = new Map<string, number>();
  let human = 0;
  for (const s of standings) {
    if (s.kind === 'bot') continue;
    places.set(s.id, human++);
  }
  return places;
}

const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });
export const formatUsd = (cents: number) => usd.format(cents / 100);

export function formatPoints(value: number, digits = 0) {
  return `T$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatPrice(value: number, digits: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCountdown(totalSeconds: number) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

const clockFmt = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export const formatClock = (ms: number) => clockFmt.format(ms);
