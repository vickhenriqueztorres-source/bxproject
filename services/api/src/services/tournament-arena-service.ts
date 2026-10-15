import crypto from "node:crypto";
import type pg from "pg";
import type { Redis } from "ioredis";
import {
  BlnkClient,
  calculateExactPrizeDistribution,
  TIER_WEIGHTS_BPS,
  type PayoutTier
} from "@broker/wallet-adapter";

export type TournamentStatus =
  | "SCHEDULED"
  | "REGISTRATION_OPEN"
  | "RUNNING"
  | "REBUY_FREEZE"
  | "TRADING_FREEZE"
  | "SETTLING"
  | "SETTLED"
  | "CANCELLED";

export type SeedArchetype = "SCALPER" | "TREND_FOLLOWER" | "SNIPER";

export interface ArenaTournament {
  id: string;
  code: string;
  title: string;
  symbol: string;
  payout_tier: PayoutTier;
  status: TournamentStatus;
  buy_in_minor: number;
  rebuy_price_minor: number;
  max_rebuys_per_user: number;
  max_stake_pct: number;
  initial_t_balance_minor: number;
  house_rake_bps: number;
  prize_pool_bps: number;
  guaranteed_pool_minor: number;
  current_pool_minor: number;
  ghost_bot_enabled: boolean;
  ghost_bot_name: string;
  ghost_bot_score_minor: number;
  starts_at: Date;
  freeze_rebuys_at: Date;
  freeze_trades_at: Date;
  ends_at: Date;
  settled_at?: Date | null;
  created_at: Date;
}

export interface ArenaParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  display_name: string;
  country_code: string;
  is_synthetic_seed: boolean;
  is_ghost_bot?: boolean;
  seed_archetype?: SeedArchetype | null;
  device_fingerprint: string;
  ip_address?: string;
  current_t_balance_minor: number;
  reserved_t_stake_minor: number;
  rebuy_count: number;
  consecutive_wins: number;
  streak_bonus_earned_minor: number;
  total_trades: number;
  winning_trades: number;
  tie_breaker_seq: number;
  final_rank?: number | null;
  prize_won_minor: number;
  bonus_won_minor: number;
  beat_ghost_bot: boolean;
  collusion_flagged: boolean;
  status: "ACTIVE" | "BUSTED" | "SETTLED" | "DISQUALIFIED";
  last_trade_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ArenaTradeOrder {
  id: string;
  tournament_id: string;
  participant_id: string;
  user_id: string;
  symbol: string;
  direction: "UP" | "DOWN";
  stake_t_minor: number;
  entry_price?: number | null;
  entry_tick_sequence?: number | null;
  exit_price?: number | null;
  exit_tick_sequence?: number | null;
  opened_at: Date;
  expires_at: Date;
  settled_at?: Date | null;
  status: "OPEN" | "SETTLED";
  result?: "WIN" | "LOSS" | "DRAW";
  base_profit_t_minor?: number;
  streak_bonus_t_minor?: number;
  ip_address?: string;
  device_fingerprint?: string;
}

export interface RealWalletTransaction {
  id: string;
  user_id: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  method: "PIX" | "CARD" | "CRYPTO" | "BANK";
  amount_minor: number;
  fee_minor: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "REJECTED";
  destination_account?: string;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface UserBonusGrant {
  id: string;
  user_id: string;
  source_type: "BEAT_GHOST_BOT" | "POST_TOURNAMENT_FTD_100" | "PROMO";
  tournament_id?: string;
  bonus_amount_minor: number;
  required_rollover_minor: number;
  completed_volume_minor: number;
  status: "LOCKED" | "UNLOCKED" | "EXPIRED" | "FORFEITED";
  blnk_grant_ref: string;
  blnk_release_ref?: string;
  expires_at: Date;
  created_at: Date;
}

/**
 * Calcula o Score Composto de 53 bits seguro para o Redis ZSET (Perigo 3 — Fase 2 Seção 3.1).
 * ZSET_SCORE = current_t_balance_minor * 100_000 + (99_999 - min(99_999, tie_breaker_seq))
 */
export function calculateArenaZsetScore(tBalanceMinor: number, seq: number): number {
  if (!Number.isSafeInteger(tBalanceMinor) || tBalanceMinor < 0) {
    throw new Error("INVALID_T_BALANCE: tBalanceMinor must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(seq) || seq < 0) {
    throw new Error("INVALID_SEQUENCE: seq must be a non-negative safe integer");
  }
  const clampedSeq = Math.min(99_999, Math.max(0, Math.trunc(seq)));
  const score = tBalanceMinor * 100_000 + (99_999 - clampedSeq);
  if (!Number.isSafeInteger(score)) {
    throw new Error("ZSET_SCORE_OVERFLOW: Score exceeds IEEE-754 53-bit safe integer limit");
  }
  return score;
}

/**
 * Decodifica o saldo T$ (em centavos fictícios) a partir do ZSET_SCORE composto.
 */
export function extractTBalanceFromScore(score: number): number {
  return Math.floor(score / 100_000);
}

/**
 * Decodifica a sequência de desempate (tie_breaker_seq) a partir do ZSET_SCORE composto.
 */
export function extractTieBreakerSeqFromScore(score: number): number {
  return 99_999 - (Math.trunc(score) % 100_000);
}

/**
 * Máquina de Estados Finitos (FSM) determinística do Torneio Blitz
 */
export function computeTournamentStateAt(
  tournament: Pick<
    ArenaTournament,
    "status" | "starts_at" | "freeze_rebuys_at" | "freeze_trades_at" | "ends_at"
  >,
  nowMs: number = Date.now()
): TournamentStatus {
  if (tournament.status === "SETTLED" || tournament.status === "CANCELLED") {
    return tournament.status;
  }
  if (nowMs >= tournament.ends_at.getTime()) {
    return "SETTLING";
  }
  if (nowMs >= tournament.freeze_trades_at.getTime()) {
    return "TRADING_FREEZE";
  }
  if (nowMs >= tournament.freeze_rebuys_at.getTime()) {
    return "REBUY_FREEZE";
  }
  if (nowMs >= tournament.starts_at.getTime()) {
    return "RUNNING";
  }
  if (nowMs >= tournament.starts_at.getTime() - 10 * 60 * 1000) {
    return "REGISTRATION_OPEN";
  }
  return "SCHEDULED";
}

/**
 * Motor Quantitativo Auditável do @Alpha_Quant (Ghost Benchmark — Fase 2 Seção 4)
 * Opera cruzamento EMA 9 / EMA 21 + Soros Nível 2 e jamais ocupa posição premiada humana.
 */
export class GhostBenchmarkEngine {
  static calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  static evaluateSignal(
    prices: number[],
    currentScoreMinor: number,
    sorosStep: 0 | 1 = 0,
    lastProfitMinor: number = 0
  ): {
    signal: "UP" | "DOWN" | "HOLD";
    stakeMinor: number;
    ema9: number;
    ema21: number;
  } {
    if (prices.length < 21 || currentScoreMinor < 1000) {
      return { signal: "HOLD", stakeMinor: 0, ema9: 0, ema21: 0 };
    }
    const ema9 = GhostBenchmarkEngine.calculateEMA(prices.slice(-25), 9);
    const ema21 = GhostBenchmarkEngine.calculateEMA(prices.slice(-35), 21);
    const diff = ema9 - ema21;

    const baseStake = Math.max(1000, Math.floor(currentScoreMinor * 0.03));
    const stakeMinor =
      sorosStep === 1 && lastProfitMinor > 0
        ? Math.min(Math.floor(currentScoreMinor * 0.2), baseStake + lastProfitMinor)
        : baseStake;

    if (Math.abs(diff) < 1e-6) {
      return { signal: "HOLD", stakeMinor: 0, ema9, ema21 };
    }

    return {
      signal: diff > 0 ? "UP" : "DOWN",
      stakeMinor,
      ema9,
      ema21
    };
  }

  /**
   * Filtra participantes elegíveis ao prêmio em dinheiro, garantindo que @Alpha_Quant
   * e contas desqualificadas/em conluio NUNCA ocupem posição no Top 3 / Top 10 / Top 20 / Top 30.
   */
  static filterEligibleWinners(participants: ArenaParticipant[]): ArenaParticipant[] {
    return participants.filter(
      (p) =>
        !p.is_ghost_bot &&
        p.user_id !== "GHOST_ALPHA_QUANT" &&
        p.display_name !== "Alpha_Quant" &&
        p.display_name !== "@Alpha_Quant" &&
        p.status !== "DISQUALIFIED" &&
        !p.collusion_flagged
    );
  }

  static didBeatGhostBenchmark(
    participantScoreMinor: number,
    initialBalanceMinor: number,
    ghostScoreMinor: number
  ): boolean {
    return participantScoreMinor > ghostScoreMinor && participantScoreMinor > initialBalanceMinor;
  }
}

const SYNTHETIC_COMPETITOR_POOL: { name: string; country: string; archetype: SeedArchetype }[] = [
  // 10 SCALPER (Agressivos — Top 1 a Top 5 ou quebram e fazem Rebuy)
  { name: "Mateo_Scalp", country: "MX", archetype: "SCALPER" },
  { name: "LucasFX_BR", country: "BR", archetype: "SCALPER" },
  { name: "Santi_Vol", country: "CO", archetype: "SCALPER" },
  { name: "Thiago_Blitz", country: "BR", archetype: "SCALPER" },
  { name: "Diego_Quant", country: "AR", archetype: "SCALPER" },
  { name: "Valeria_Pro", country: "CL", archetype: "SCALPER" },
  { name: "Rafael_HighFreq", country: "BR", archetype: "SCALPER" },
  { name: "Andres_Turbo", country: "CO", archetype: "SCALPER" },
  { name: "Rodrigo_M1", country: "MX", archetype: "SCALPER" },
  { name: "Camila_V75", country: "PE", archetype: "SCALPER" },

  // 25 TREND_FOLLOWER (Pelotão Tático — Posições #6 a #30, disputa na Linha da Bolha)
  { name: "Carlos_Trend", country: "CO", archetype: "TREND_FOLLOWER" },
  { name: "Fernanda_SP", country: "BR", archetype: "TREND_FOLLOWER" },
  { name: "Javier_CDMX", country: "MX", archetype: "TREND_FOLLOWER" },
  { name: "Mariana_FX", country: "BR", archetype: "TREND_FOLLOWER" },
  { name: "Nicolas_BA", country: "AR", archetype: "TREND_FOLLOWER" },
  { name: "Sebastian_SCL", country: "CL", archetype: "TREND_FOLLOWER" },
  { name: "Gabriel_Rio", country: "BR", archetype: "TREND_FOLLOWER" },
  { name: "Alejandro_MDE", country: "CO", archetype: "TREND_FOLLOWER" },
  { name: "Luis_LIM", country: "PE", archetype: "TREND_FOLLOWER" },
  { name: "Beatriz_BH", country: "BR", archetype: "TREND_FOLLOWER" },
  { name: "Daniel_MTY", country: "MX", archetype: "TREND_FOLLOWER" },
  { name: "Sofia_BOG", country: "CO", archetype: "TREND_FOLLOWER" },
  { name: "Matheus_CWB", country: "BR", archetype: "TREND_FOLLOWER" },
  { name: "Facundo_COR", country: "AR", archetype: "TREND_FOLLOWER" },
  { name: "Tomas_VAL", country: "CL", archetype: "TREND_FOLLOWER" },
  { name: "Larissa_POA", country: "BR", archetype: "TREND_FOLLOWER" },
  { name: "Eduardo_GDL", country: "MX", archetype: "TREND_FOLLOWER" },
  { name: "Natalia_CLO", country: "CO", archetype: "TREND_FOLLOWER" },
  { name: "Bruno_BSB", country: "BR", archetype: "TREND_FOLLOWER" },
  { name: "Agustin_ROS", country: "AR", archetype: "TREND_FOLLOWER" },
  { name: "Cristian_CCP", country: "CL", archetype: "TREND_FOLLOWER" },
  { name: "Jorge_AQP", country: "PE", archetype: "TREND_FOLLOWER" },
  { name: "Amanda_FOR", country: "BR", archetype: "TREND_FOLLOWER" },
  { name: "Ricardo_PUE", country: "MX", archetype: "TREND_FOLLOWER" },
  { name: "Paula_CTG", country: "CO", archetype: "TREND_FOLLOWER" },

  // 10 SNIPER (Conservadores — Base do Ranking)
  { name: "Henrique_Sniper", country: "BR", archetype: "SNIPER" },
  { name: "Elena_Patience", country: "MX", archetype: "SNIPER" },
  { name: "Gustavo_Safe", country: "CO", archetype: "SNIPER" },
  { name: "Victoria_Precision", country: "AR", archetype: "SNIPER" },
  { name: "Felipe_Steady", country: "CL", archetype: "SNIPER" },
  { name: "Renata_Alpha", country: "BR", archetype: "SNIPER" },
  { name: "Oscar_Swing", country: "PE", archetype: "SNIPER" },
  { name: "Leonardo_Ice", country: "BR", archetype: "SNIPER" },
  { name: "embajador_MX", country: "MX", archetype: "SNIPER" },
  { name: "Claudia_OTC", country: "CO", archetype: "SNIPER" }
];

export class TournamentArenaService {
  private pool?: pg.Pool;
  private redis?: Redis;
  private blnkClient: BlnkClient;

  // Locks e estado atômico em memória (garante determinismo em testes e proteção de concorrência)
  private static userLocks = new Map<string, Promise<void>>();
  private static tournaments = new Map<string, ArenaTournament>();
  private static participantsByTournament = new Map<string, Map<string, ArenaParticipant>>();
  private static openTradesByTournament = new Map<string, Map<string, ArenaTradeOrder>>();
  private static realBalances = new Map<
    string,
    { available_minor: number; reserved_minor: number; bonus_margin_minor: number }
  >();
  private static walletTransactions = new Map<string, RealWalletTransaction>();
  private static bonusGrantsByUser = new Map<string, UserBonusGrant[]>();
  private static idempotencyMap = new Map<string, any>();

  constructor(pool?: pg.Pool, redis?: Redis, blnkClient?: BlnkClient) {
    this.pool = pool;
    this.redis = redis;
    this.blnkClient = blnkClient || new BlnkClient(process.env.BLNK_URL || "http://localhost:5001");
  }

  public static resetStateForTesting(): void {
    TournamentArenaService.userLocks.clear();
    TournamentArenaService.tournaments.clear();
    TournamentArenaService.participantsByTournament.clear();
    TournamentArenaService.openTradesByTournament.clear();
    TournamentArenaService.realBalances.clear();
    TournamentArenaService.walletTransactions.clear();
    TournamentArenaService.bonusGrantsByUser.clear();
    TournamentArenaService.idempotencyMap.clear();
  }

  private async withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prevLock = TournamentArenaService.userLocks.get(userId) ?? Promise.resolve();
    let releaseLock!: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const chainedLock = prevLock.then(() => currentLock, () => currentLock);
    TournamentArenaService.userLocks.set(userId, chainedLock);

    await prevLock.catch(() => {});
    try {
      return await fn();
    } finally {
      releaseLock();
      if (TournamentArenaService.userLocks.get(userId) === chainedLock) {
        TournamentArenaService.userLocks.delete(userId);
      }
    }
  }

  private ensureUserRealBalanceState(userId: string): {
    available_minor: number;
    reserved_minor: number;
    bonus_margin_minor: number;
  } {
    let bal = TournamentArenaService.realBalances.get(userId);
    if (!bal) {
      bal = { available_minor: 0, reserved_minor: 0, bonus_margin_minor: 0 };
      TournamentArenaService.realBalances.set(userId, bal);
    }
    return bal;
  }

  public getRealBalanceSnapshot(userId: string): {
    user_id: string;
    currency: "USD";
    precision: 100;
    available_minor: number;
    reserved_minor: number;
    bonus_margin_minor: number;
    total_real_equity_minor: number;
  } {
    const bal = this.ensureUserRealBalanceState(userId);
    return {
      user_id: userId,
      currency: "USD",
      precision: 100,
      available_minor: bal.available_minor,
      reserved_minor: bal.reserved_minor,
      bonus_margin_minor: bal.bonus_margin_minor,
      total_real_equity_minor: bal.available_minor + bal.reserved_minor
    };
  }

  public hasDatabasePool(): boolean {
    return Boolean(this.pool);
  }

  private async persistRealBalanceToDb(userId: string): Promise<void> {
    if (!this.pool) return;
    const bal = this.ensureUserRealBalanceState(userId);
    await this.pool.query(
      `INSERT INTO arena_real_balances (
         user_id, available_minor, reserved_minor, bonus_margin_minor, updated_at
       ) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         available_minor = EXCLUDED.available_minor,
         reserved_minor = EXCLUDED.reserved_minor,
         bonus_margin_minor = EXCLUDED.bonus_margin_minor,
         updated_at = NOW()`,
      [userId, bal.available_minor, bal.reserved_minor, bal.bonus_margin_minor]
    );
  }

  private async persistWalletTransactionToDb(tx: RealWalletTransaction): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO arena_wallet_transactions (
         id, user_id, type, method, amount_minor, fee_minor, status,
         destination_account, idempotency_key, metadata, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        tx.id,
        tx.user_id,
        tx.type,
        tx.method,
        tx.amount_minor,
        tx.fee_minor,
        tx.status,
        tx.destination_account ?? null,
        tx.idempotency_key,
        JSON.stringify(tx.metadata ?? {}),
        tx.created_at,
        tx.updated_at
      ]
    );
  }

  private async persistTournamentToDb(t: ArenaTournament): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO arena_tournaments (
         id, code, title, symbol, payout_tier, status,
         buy_in_minor, rebuy_price_minor, max_rebuys_per_user, max_stake_pct,
         initial_t_balance_minor, house_rake_bps, prize_pool_bps,
         guaranteed_pool_minor, current_pool_minor,
         ghost_bot_enabled, ghost_bot_name, ghost_bot_score_minor,
         starts_at, freeze_rebuys_at, freeze_trades_at, ends_at, settled_at, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13,
         $14, $15,
         $16, $17, $18,
         $19, $20, $21, $22, $23, $24
       )
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         current_pool_minor = EXCLUDED.current_pool_minor,
         ghost_bot_score_minor = EXCLUDED.ghost_bot_score_minor,
         starts_at = EXCLUDED.starts_at,
         freeze_rebuys_at = EXCLUDED.freeze_rebuys_at,
         freeze_trades_at = EXCLUDED.freeze_trades_at,
         ends_at = EXCLUDED.ends_at,
         settled_at = EXCLUDED.settled_at`,
      [
        t.id,
        t.code,
        t.title,
        t.symbol,
        t.payout_tier,
        t.status,
        t.buy_in_minor,
        t.rebuy_price_minor,
        t.max_rebuys_per_user,
        t.max_stake_pct,
        t.initial_t_balance_minor,
        t.house_rake_bps,
        t.prize_pool_bps,
        t.guaranteed_pool_minor,
        t.current_pool_minor,
        t.ghost_bot_enabled,
        t.ghost_bot_name,
        t.ghost_bot_score_minor,
        t.starts_at,
        t.freeze_rebuys_at,
        t.freeze_trades_at,
        t.ends_at,
        t.settled_at ?? null,
        t.created_at
      ]
    );
  }

  private async persistParticipantToDb(p: ArenaParticipant): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO arena_participants (
         id, tournament_id, user_id, display_name, country_code,
         is_synthetic_seed, seed_archetype, device_fingerprint, ip_address,
         current_t_balance_minor, reserved_t_stake_minor, rebuy_count,
         consecutive_wins, streak_bonus_earned_minor, total_trades, winning_trades,
         tie_breaker_seq, final_rank, prize_won_minor, bonus_won_minor,
         beat_ghost_bot, collusion_flagged, status, last_trade_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12,
         $13, $14, $15, $16,
         $17, $18, $19, $20,
         $21, $22, $23, $24, $25, $26
       )
       ON CONFLICT (tournament_id, user_id) DO UPDATE SET
         current_t_balance_minor = EXCLUDED.current_t_balance_minor,
         reserved_t_stake_minor = EXCLUDED.reserved_t_stake_minor,
         rebuy_count = EXCLUDED.rebuy_count,
         consecutive_wins = EXCLUDED.consecutive_wins,
         streak_bonus_earned_minor = EXCLUDED.streak_bonus_earned_minor,
         total_trades = EXCLUDED.total_trades,
         winning_trades = EXCLUDED.winning_trades,
         tie_breaker_seq = EXCLUDED.tie_breaker_seq,
         final_rank = EXCLUDED.final_rank,
         prize_won_minor = EXCLUDED.prize_won_minor,
         bonus_won_minor = EXCLUDED.bonus_won_minor,
         beat_ghost_bot = EXCLUDED.beat_ghost_bot,
         collusion_flagged = EXCLUDED.collusion_flagged,
         status = EXCLUDED.status,
         last_trade_at = EXCLUDED.last_trade_at,
         updated_at = EXCLUDED.updated_at`,
      [
        p.id,
        p.tournament_id,
        p.user_id,
        p.display_name,
        p.country_code,
        p.is_synthetic_seed,
        p.seed_archetype ?? null,
        p.device_fingerprint,
        p.ip_address ?? null,
        p.current_t_balance_minor,
        p.reserved_t_stake_minor,
        p.rebuy_count,
        p.consecutive_wins,
        p.streak_bonus_earned_minor,
        p.total_trades,
        p.winning_trades,
        p.tie_breaker_seq,
        p.final_rank ?? null,
        p.prize_won_minor,
        p.bonus_won_minor,
        p.beat_ghost_bot,
        p.collusion_flagged,
        p.status,
        p.last_trade_at ?? null,
        p.created_at,
        p.updated_at
      ]
    );
  }

  private async persistLedgerEventToDb(params: {
    tournamentId: string;
    userId: string;
    eventType: "BUY_IN" | "REBUY" | "OVERLAY_INJECTION" | "PRIZE_PAYOUT" | "BONUS_GRANT";
    grossAmountMinor: number;
    rakeAmountMinor?: number;
    escrowAmountMinor?: number;
    blnkRakeRef?: string | null;
    blnkEscrowRef?: string | null;
    idempotencyKey: string;
  }): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO arena_ledger_events (
         id, tournament_id, user_id, event_type,
         gross_amount_minor, rake_amount_minor, escrow_amount_minor,
         currency, blnk_rake_ref, blnk_escrow_ref, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'USD', $8, $9, $10)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        crypto.randomUUID(),
        params.tournamentId,
        params.userId,
        params.eventType,
        params.grossAmountMinor,
        params.rakeAmountMinor ?? 0,
        params.escrowAmountMinor ?? 0,
        params.blnkRakeRef ?? null,
        params.blnkEscrowRef ?? null,
        params.idempotencyKey
      ]
    );
  }

  private async persistTradeOrderToDb(order: ArenaTradeOrder): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO arena_trade_orders (
         id, tournament_id, participant_id, user_id, symbol, direction,
         stake_t_minor, entry_price, entry_tick_sequence, exit_price, exit_tick_sequence,
         opened_at, expires_at, settled_at, status, result,
         base_profit_t_minor, streak_bonus_t_minor, ip_address, device_fingerprint
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16,
         $17, $18, $19, $20
       )
       ON CONFLICT (id) DO UPDATE SET
         exit_price = EXCLUDED.exit_price,
         exit_tick_sequence = EXCLUDED.exit_tick_sequence,
         settled_at = EXCLUDED.settled_at,
         status = EXCLUDED.status,
         result = EXCLUDED.result,
         base_profit_t_minor = EXCLUDED.base_profit_t_minor,
         streak_bonus_t_minor = EXCLUDED.streak_bonus_t_minor`,
      [
        order.id,
        order.tournament_id,
        order.participant_id,
        order.user_id,
        order.symbol,
        order.direction,
        order.stake_t_minor,
        order.entry_price ?? null,
        order.entry_tick_sequence ?? null,
        order.exit_price ?? null,
        order.exit_tick_sequence ?? null,
        order.opened_at,
        order.expires_at,
        order.settled_at ?? null,
        order.status,
        order.result ?? null,
        order.base_profit_t_minor ?? 0,
        order.streak_bonus_t_minor ?? 0,
        order.ip_address ?? null,
        order.device_fingerprint ?? null
      ]
    );
  }

  private async persistBonusGrantToDb(grant: UserBonusGrant): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO user_bonus_grants (
         id, user_id, source_type, tournament_id,
         bonus_amount_minor, required_rollover_minor, completed_volume_minor,
         status, blnk_grant_ref, blnk_release_ref, expires_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         completed_volume_minor = EXCLUDED.completed_volume_minor,
         status = EXCLUDED.status,
         blnk_release_ref = EXCLUDED.blnk_release_ref`,
      [
        grant.id,
        grant.user_id,
        grant.source_type,
        grant.tournament_id ?? null,
        grant.bonus_amount_minor,
        grant.required_rollover_minor,
        grant.completed_volume_minor,
        grant.status,
        grant.blnk_grant_ref,
        grant.blnk_release_ref ?? null,
        grant.expires_at,
        grant.created_at
      ]
    );
  }

  /**
   * Hidrata o estado de torneios, participantes, saldos reais, transações, bônus e ordens
   * a partir do PostgreSQL após inicialização/restart do servidor.
   */
  public async hydrateFromDatabase(): Promise<void> {
    if (!this.pool) return;

    const balRes = await this.pool.query(
      `SELECT user_id, available_minor, reserved_minor, bonus_margin_minor FROM arena_real_balances`
    );
    for (const row of balRes.rows) {
      TournamentArenaService.realBalances.set(String(row.user_id), {
        available_minor: Number(row.available_minor),
        reserved_minor: Number(row.reserved_minor),
        bonus_margin_minor: Number(row.bonus_margin_minor)
      });
    }

    const txRes = await this.pool.query(`SELECT * FROM arena_wallet_transactions ORDER BY created_at ASC`);
    for (const row of txRes.rows) {
      const tx: RealWalletTransaction = {
        id: String(row.id),
        user_id: String(row.user_id),
        type: row.type,
        method: row.method,
        amount_minor: Number(row.amount_minor),
        fee_minor: Number(row.fee_minor),
        status: row.status,
        destination_account: row.destination_account ?? undefined,
        idempotency_key: String(row.idempotency_key),
        metadata: typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {},
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at)
      };
      TournamentArenaService.walletTransactions.set(tx.id, tx);
      const prefix = tx.type === "DEPOSIT" ? "dep_req" : "wdr_req";
      TournamentArenaService.idempotencyMap.set(`${prefix}:${tx.user_id}:${tx.idempotency_key}`, tx);
    }

    const bonusRes = await this.pool.query(`SELECT * FROM user_bonus_grants ORDER BY created_at ASC`);
    for (const row of bonusRes.rows) {
      const grant: UserBonusGrant = {
        id: String(row.id),
        user_id: String(row.user_id),
        source_type: row.source_type,
        tournament_id: row.tournament_id ? String(row.tournament_id) : undefined,
        bonus_amount_minor: Number(row.bonus_amount_minor),
        required_rollover_minor: Number(row.required_rollover_minor),
        completed_volume_minor: Number(row.completed_volume_minor),
        status: row.status,
        blnk_grant_ref: String(row.blnk_grant_ref),
        blnk_release_ref: row.blnk_release_ref ? String(row.blnk_release_ref) : undefined,
        expires_at: new Date(row.expires_at),
        created_at: new Date(row.created_at)
      };
      const list = TournamentArenaService.bonusGrantsByUser.get(grant.user_id) ?? [];
      if (!list.some((g) => g.id === grant.id)) {
        list.push(grant);
      }
      TournamentArenaService.bonusGrantsByUser.set(grant.user_id, list);
    }

    const tourRes = await this.pool.query(`SELECT * FROM arena_tournaments ORDER BY created_at ASC`);
    for (const row of tourRes.rows) {
      const t: ArenaTournament = {
        id: String(row.id),
        code: String(row.code),
        title: String(row.title),
        symbol: String(row.symbol),
        payout_tier: row.payout_tier as PayoutTier,
        status: row.status as TournamentStatus,
        buy_in_minor: Number(row.buy_in_minor),
        rebuy_price_minor: Number(row.rebuy_price_minor),
        max_rebuys_per_user: Number(row.max_rebuys_per_user),
        max_stake_pct: Number(row.max_stake_pct),
        initial_t_balance_minor: Number(row.initial_t_balance_minor),
        house_rake_bps: Number(row.house_rake_bps),
        prize_pool_bps: Number(row.prize_pool_bps),
        guaranteed_pool_minor: Number(row.guaranteed_pool_minor),
        current_pool_minor: Number(row.current_pool_minor),
        ghost_bot_enabled: Boolean(row.ghost_bot_enabled),
        ghost_bot_name: String(row.ghost_bot_name),
        ghost_bot_score_minor: Number(row.ghost_bot_score_minor),
        starts_at: new Date(row.starts_at),
        freeze_rebuys_at: new Date(row.freeze_rebuys_at),
        freeze_trades_at: new Date(row.freeze_trades_at),
        ends_at: new Date(row.ends_at),
        settled_at: row.settled_at ? new Date(row.settled_at) : null,
        created_at: new Date(row.created_at)
      };
      TournamentArenaService.tournaments.set(t.id, t);
      if (!TournamentArenaService.participantsByTournament.has(t.id)) {
        TournamentArenaService.participantsByTournament.set(t.id, new Map());
      }
      if (!TournamentArenaService.openTradesByTournament.has(t.id)) {
        TournamentArenaService.openTradesByTournament.set(t.id, new Map());
      }
    }

    const partRes = await this.pool.query(`SELECT * FROM arena_participants ORDER BY tie_breaker_seq ASC`);
    for (const row of partRes.rows) {
      const p: ArenaParticipant = {
        id: String(row.id),
        tournament_id: String(row.tournament_id),
        user_id: String(row.user_id),
        display_name: String(row.display_name),
        country_code: String(row.country_code),
        is_synthetic_seed: Boolean(row.is_synthetic_seed),
        seed_archetype: row.seed_archetype ?? null,
        device_fingerprint: String(row.device_fingerprint),
        ip_address: row.ip_address ?? undefined,
        current_t_balance_minor: Number(row.current_t_balance_minor),
        reserved_t_stake_minor: Number(row.reserved_t_stake_minor),
        rebuy_count: Number(row.rebuy_count),
        consecutive_wins: Number(row.consecutive_wins),
        streak_bonus_earned_minor: Number(row.streak_bonus_earned_minor),
        total_trades: Number(row.total_trades),
        winning_trades: Number(row.winning_trades),
        tie_breaker_seq: Number(row.tie_breaker_seq),
        final_rank: row.final_rank !== null ? Number(row.final_rank) : null,
        prize_won_minor: Number(row.prize_won_minor),
        bonus_won_minor: Number(row.bonus_won_minor),
        beat_ghost_bot: Boolean(row.beat_ghost_bot),
        collusion_flagged: Boolean(row.collusion_flagged),
        status: row.status,
        last_trade_at: row.last_trade_at ? new Date(row.last_trade_at) : null,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at)
      };
      let map = TournamentArenaService.participantsByTournament.get(p.tournament_id);
      if (!map) {
        map = new Map();
        TournamentArenaService.participantsByTournament.set(p.tournament_id, map);
      }
      map.set(p.user_id, p);
      await this.syncParticipantToRedisZset(p.tournament_id, p);
    }

    const ordersRes = await this.pool.query(`SELECT * FROM arena_trade_orders ORDER BY opened_at ASC`);
    for (const row of ordersRes.rows) {
      const order: ArenaTradeOrder = {
        id: String(row.id),
        tournament_id: String(row.tournament_id),
        participant_id: String(row.participant_id),
        user_id: String(row.user_id),
        symbol: String(row.symbol),
        direction: row.direction,
        stake_t_minor: Number(row.stake_t_minor),
        entry_price: row.entry_price !== null && row.entry_price !== undefined ? Number(row.entry_price) : null,
        entry_tick_sequence:
          row.entry_tick_sequence !== null && row.entry_tick_sequence !== undefined
            ? Number(row.entry_tick_sequence)
            : null,
        exit_price: row.exit_price !== null && row.exit_price !== undefined ? Number(row.exit_price) : null,
        exit_tick_sequence:
          row.exit_tick_sequence !== null && row.exit_tick_sequence !== undefined
            ? Number(row.exit_tick_sequence)
            : null,
        opened_at: new Date(row.opened_at),
        expires_at: new Date(row.expires_at),
        settled_at: row.settled_at ? new Date(row.settled_at) : null,
        status: row.status,
        result: row.result ?? undefined,
        base_profit_t_minor: Number(row.base_profit_t_minor ?? 0),
        streak_bonus_t_minor: Number(row.streak_bonus_t_minor ?? 0),
        ip_address: row.ip_address ?? undefined,
        device_fingerprint: row.device_fingerprint ?? undefined
      };
      let map = TournamentArenaService.openTradesByTournament.get(order.tournament_id);
      if (!map) {
        map = new Map();
        TournamentArenaService.openTradesByTournament.set(order.tournament_id, map);
      }
      map.set(order.id, order);
    }
  }

  public getWalletTransaction(txId: string): RealWalletTransaction | undefined {
    return TournamentArenaService.walletTransactions.get(txId);
  }

  // =========================================================================
  // 1. OPERAÇÕES DE CAIXA REAL (DEPÓSITO, SAQUE 2-ETAPAS E TRAVA DE ROLLOVER)
  // =========================================================================

  async requestRealDeposit(params: {
    userId: string;
    amountMinor: number;
    method: "PIX" | "CARD" | "CRYPTO" | "BANK";
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ transaction: RealWalletTransaction; isDuplicate: boolean }> {
    const { userId, amountMinor, method, idempotencyKey, metadata = {} } = params;
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new Error("IDEMPOTENCY_VIOLATION: Idempotency-Key is required");
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new Error("INVALID_MINOR_AMOUNT: Deposit amount must be a positive safe integer in cents");
    }

    return this.withUserLock(userId, async () => {
      const idemKey = `dep_req:${userId}:${idempotencyKey}`;
      const existing = TournamentArenaService.idempotencyMap.get(idemKey) as RealWalletTransaction | undefined;
      if (existing) {
        if (existing.amount_minor !== amountMinor || existing.method !== method) {
          throw new Error("IDEMPOTENCY_KEY_CONFLICT: Idempotency-Key reused with different deposit payload");
        }
        return { transaction: existing, isDuplicate: true };
      }

      const tx: RealWalletTransaction = {
        id: crypto.randomUUID(),
        user_id: userId,
        type: "DEPOSIT",
        method,
        amount_minor: amountMinor,
        fee_minor: 0,
        status: "PENDING",
        idempotency_key: idempotencyKey,
        metadata,
        created_at: new Date(),
        updated_at: new Date()
      };

      TournamentArenaService.walletTransactions.set(tx.id, tx);
      TournamentArenaService.idempotencyMap.set(idemKey, tx);
      await this.persistWalletTransactionToDb(tx);
      return { transaction: tx, isDuplicate: false };
    });
  }

  async confirmRealDeposit(params: {
    txId: string;
    idempotencyKey?: string;
  }): Promise<{ transaction: RealWalletTransaction; isDuplicate: boolean }> {
    const tx = TournamentArenaService.walletTransactions.get(params.txId);
    if (!tx || tx.type !== "DEPOSIT") {
      throw new Error("TRANSACTION_NOT_FOUND: Deposit transaction not found");
    }

    return this.withUserLock(tx.user_id, async () => {
      if (tx.status === "COMPLETED") {
        return { transaction: tx, isDuplicate: true };
      }
      if (tx.status !== "PENDING") {
        throw new Error(`INVALID_TRANSACTION_STATE: Cannot confirm deposit in state ${tx.status}`);
      }

      await this.blnkClient.creditRealDeposit(tx.user_id, tx.id, tx.amount_minor);

      const bal = this.ensureUserRealBalanceState(tx.user_id);
      bal.available_minor += tx.amount_minor;
      tx.status = "COMPLETED";
      tx.updated_at = new Date();

      await this.persistRealBalanceToDb(tx.user_id);
      await this.persistWalletTransactionToDb(tx);
      return { transaction: tx, isDuplicate: false };
    });
  }

  async requestRealWithdrawal(params: {
    userId: string;
    amountMinor: number;
    method: "PIX" | "CARD" | "CRYPTO" | "BANK";
    destinationAccount: string;
    idempotencyKey: string;
    attemptFromBonus?: boolean;
  }): Promise<{ transaction: RealWalletTransaction; isDuplicate: boolean }> {
    const { userId, amountMinor, method, destinationAccount, idempotencyKey, attemptFromBonus } = params;
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new Error("IDEMPOTENCY_VIOLATION: Idempotency-Key is required");
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new Error("INVALID_MINOR_AMOUNT: Withdrawal amount must be a positive safe integer in cents");
    }

    return this.withUserLock(userId, async () => {
      const idemKey = `wdr_req:${userId}:${idempotencyKey}`;
      const existing = TournamentArenaService.idempotencyMap.get(idemKey) as RealWalletTransaction | undefined;
      if (existing) {
        if (existing.amount_minor !== amountMinor || existing.method !== method) {
          throw new Error("IDEMPOTENCY_KEY_CONFLICT: Idempotency-Key reused with different withdrawal payload");
        }
        return { transaction: existing, isDuplicate: true };
      }

      const bal = this.ensureUserRealBalanceState(userId);
      const userBonuses = TournamentArenaService.bonusGrantsByUser.get(userId) ?? [];
      const hasLockedBonus = userBonuses.some(
        (b) => b.status === "LOCKED" && b.completed_volume_minor < b.required_rollover_minor
      );

      if (
        attemptFromBonus ||
        (amountMinor > bal.available_minor &&
          bal.bonus_margin_minor > 0 &&
          hasLockedBonus &&
          amountMinor <= bal.available_minor + bal.bonus_margin_minor)
      ) {
        throw new Error(
          "BONUS_ROLLOVER_INCOMPLETE: Promotional bonus_margin cannot be withdrawn before completing 25x rollover"
        );
      }

      if (bal.available_minor < amountMinor) {
        throw new Error("INSUFFICIENT_BALANCE: Available real balance is insufficient for withdrawal");
      }

      const txId = crypto.randomUUID();
      await this.blnkClient.holdRealWithdrawal(userId, txId, amountMinor);

      bal.available_minor -= amountMinor;
      bal.reserved_minor += amountMinor;

      const tx: RealWalletTransaction = {
        id: txId,
        user_id: userId,
        type: "WITHDRAWAL",
        method,
        amount_minor: amountMinor,
        fee_minor: 0,
        status: "PENDING",
        destination_account: destinationAccount,
        idempotency_key: idempotencyKey,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      TournamentArenaService.walletTransactions.set(tx.id, tx);
      TournamentArenaService.idempotencyMap.set(idemKey, tx);
      await this.persistRealBalanceToDb(userId);
      await this.persistWalletTransactionToDb(tx);
      return { transaction: tx, isDuplicate: false };
    });
  }

  async completeRealWithdrawal(txId: string): Promise<RealWalletTransaction> {
    const tx = TournamentArenaService.walletTransactions.get(txId);
    if (!tx || tx.type !== "WITHDRAWAL") {
      throw new Error("TRANSACTION_NOT_FOUND: Withdrawal transaction not found");
    }

    return this.withUserLock(tx.user_id, async () => {
      if (tx.status === "COMPLETED") return tx;
      if (tx.status !== "PENDING") {
        throw new Error(`INVALID_TRANSACTION_STATE: Cannot settle withdrawal in state ${tx.status}`);
      }

      await this.blnkClient.settleRealWithdrawal(tx.user_id, tx.id, tx.amount_minor);

      const bal = this.ensureUserRealBalanceState(tx.user_id);
      bal.reserved_minor -= tx.amount_minor;
      tx.status = "COMPLETED";
      tx.updated_at = new Date();
      await this.persistRealBalanceToDb(tx.user_id);
      await this.persistWalletTransactionToDb(tx);
      return tx;
    });
  }

  async cancelRealWithdrawal(txId: string): Promise<RealWalletTransaction> {
    const tx = TournamentArenaService.walletTransactions.get(txId);
    if (!tx || tx.type !== "WITHDRAWAL") {
      throw new Error("TRANSACTION_NOT_FOUND: Withdrawal transaction not found");
    }

    return this.withUserLock(tx.user_id, async () => {
      if (tx.status === "CANCELLED") return tx;
      if (tx.status !== "PENDING") {
        throw new Error(`INVALID_TRANSACTION_STATE: Cannot reverse withdrawal in state ${tx.status}`);
      }

      await this.blnkClient.reverseRealWithdrawal(tx.user_id, tx.id, tx.amount_minor);

      const bal = this.ensureUserRealBalanceState(tx.user_id);
      bal.reserved_minor -= tx.amount_minor;
      bal.available_minor += tx.amount_minor;
      tx.status = "CANCELLED";
      tx.updated_at = new Date();
      await this.persistRealBalanceToDb(tx.user_id);
      await this.persistWalletTransactionToDb(tx);
      return tx;
    });
  }

  async recordRealTradingVolumeForRollover(userId: string, volumeMinor: number): Promise<UserBonusGrant[]> {
    return this.withUserLock(userId, async () => {
      const grants = TournamentArenaService.bonusGrantsByUser.get(userId) ?? [];
      const bal = this.ensureUserRealBalanceState(userId);

      for (const grant of grants) {
        if (grant.status !== "LOCKED") continue;
        grant.completed_volume_minor += volumeMinor;
        if (grant.completed_volume_minor >= grant.required_rollover_minor) {
          grant.status = "UNLOCKED";
          grant.blnk_release_ref = `bonus_release:${grant.id}`;
          await this.blnkClient.recordTransaction({
            amount: grant.bonus_amount_minor,
            precision: 100,
            currency: "USD",
            source: BlnkClient.getUserRealAccount(userId, "bonus_margin"),
            destination: BlnkClient.getUserRealAccount(userId, "available"),
            reference: grant.blnk_release_ref,
            description: `Unlocked bonus margin after completing 25x rollover (${grant.id})`,
            allow_overdraft: false
          });
          bal.bonus_margin_minor -= grant.bonus_amount_minor;
          bal.available_minor += grant.bonus_amount_minor;
        }
        await this.persistBonusGrantToDb(grant);
      }
      await this.persistRealBalanceToDb(userId);
      return grants;
    });
  }

  // =========================================================================
  // 2. CRIAÇÃO DE TORNEIO, BUY-IN, REBUY E SEEDER DE 45 COMPETIDORES (TOP 10/20/30)
  // =========================================================================

  async createTournament(params: {
    id?: string;
    code?: string;
    title: string;
    symbol: string;
    payoutTier?: PayoutTier;
    buyInMinor?: number;
    rebuyPriceMinor?: number;
    maxRebuysPerUser?: number;
    maxStakePct?: number;
    initialTBalanceMinor?: number;
    guaranteedPoolMinor?: number;
    durationSeconds?: number;
    startsAt?: Date;
  }): Promise<ArenaTournament> {
    const id = params.id || crypto.randomUUID();
    const startsAt = params.startsAt || new Date();
    const durationSec = Math.max(300, params.durationSeconds ?? 900); // Default 15 min (900s)
    const endsAt = new Date(startsAt.getTime() + durationSec * 1000);
    const freezeRebuysAt = new Date(endsAt.getTime() - 180 * 1000); // T - 3 min
    const freezeTradesAt = new Date(endsAt.getTime() - 60 * 1000);  // T - 1 min

    const tournament: ArenaTournament = {
      id,
      code: params.code || `ARENA_BLITZ_${crypto.randomInt(100, 1000)}`,
      title: params.title,
      symbol: params.symbol,
      payout_tier: params.payoutTier || "TOP_10",
      status: computeTournamentStateAt(
        {
          status: "RUNNING",
          starts_at: startsAt,
          freeze_rebuys_at: freezeRebuysAt,
          freeze_trades_at: freezeTradesAt,
          ends_at: endsAt
        },
        Date.now()
      ),
      buy_in_minor: params.buyInMinor ?? 500,       // $5.00 USD
      rebuy_price_minor: params.rebuyPriceMinor ?? 300, // $3.00 USD
      max_rebuys_per_user: params.maxRebuysPerUser ?? 3,
      max_stake_pct: params.maxStakePct ?? 20,
      initial_t_balance_minor: params.initialTBalanceMinor ?? 100_000, // T$ 1.000,00
      house_rake_bps: 3000,
      prize_pool_bps: 7000,
      guaranteed_pool_minor: params.guaranteedPoolMinor ?? 0,
      current_pool_minor: 0,
      ghost_bot_enabled: true,
      ghost_bot_name: "Alpha_Quant",
      ghost_bot_score_minor: 142_500, // T$ 1.425,00 linha de corte inicial
      starts_at: startsAt,
      freeze_rebuys_at: freezeRebuysAt,
      freeze_trades_at: freezeTradesAt,
      ends_at: endsAt,
      settled_at: null,
      created_at: new Date()
    };

    TournamentArenaService.tournaments.set(id, tournament);
    TournamentArenaService.participantsByTournament.set(id, new Map());
    TournamentArenaService.openTradesByTournament.set(id, new Map());
    await this.persistTournamentToDb(tournament);

    return tournament;
  }

  public getTournament(tournamentId: string): ArenaTournament | undefined {
    const t = TournamentArenaService.tournaments.get(tournamentId);
    if (t && t.status !== "SETTLED" && t.status !== "CANCELLED") {
      t.status = computeTournamentStateAt(t, Date.now());
    }
    return t;
  }

  public listTournaments(): ArenaTournament[] {
    const list = Array.from(TournamentArenaService.tournaments.values());
    for (const t of list) {
      if (t.status !== "SETTLED" && t.status !== "CANCELLED") {
        t.status = computeTournamentStateAt(t, Date.now());
      }
    }
    return list;
  }

  /**
   * Inscreve um usuário humano no torneio cobrando Buy-in ($5.00 USD -> $1.50 Rake / $3.50 Escrow)
   */
  async joinTournament(params: {
    tournamentId: string;
    userId: string;
    displayName: string;
    countryCode?: string;
    deviceFingerprint: string;
    ipAddress?: string;
    idempotencyKey: string;
  }): Promise<{
    participant: ArenaParticipant;
    rakeMinor: number;
    escrowMinor: number;
    isDuplicate: boolean;
  }> {
    const {
      tournamentId,
      userId,
      displayName,
      countryCode = "BR",
      deviceFingerprint,
      ipAddress,
      idempotencyKey
    } = params;

    const tournament = TournamentArenaService.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error("TOURNAMENT_NOT_FOUND: Tournament does not exist");
    }

    return this.withUserLock(userId, async () => {
      const participants = TournamentArenaService.participantsByTournament.get(tournamentId)!;
      const existing = participants.get(userId);
      if (existing) {
        const rakeMinor = Math.floor((tournament.buy_in_minor * tournament.house_rake_bps) / 10000);
        return {
          participant: existing,
          rakeMinor,
          escrowMinor: tournament.buy_in_minor - rakeMinor,
          isDuplicate: true
        };
      }

      // Proteção Anti-Sybil: bloqueia dispositivo duplicado no mesmo torneio
      for (const p of participants.values()) {
        if (p.device_fingerprint === deviceFingerprint && p.user_id !== userId) {
          throw new Error(
            "SYBIL_DEVICE_CONFLICT: Device fingerprint already registered by another account in this tournament"
          );
        }
      }

      const bal = this.ensureUserRealBalanceState(userId);
      if (bal.available_minor < tournament.buy_in_minor) {
        throw new Error("INSUFFICIENT_BALANCE: Available real balance is insufficient for tournament buy-in");
      }

      const split = await this.blnkClient.recordTournamentEntryOrRebuy({
        tournamentId,
        userId,
        eventType: "BUY_IN",
        attemptNumber: 1,
        grossAmountMinor: tournament.buy_in_minor,
        rakeBps: tournament.house_rake_bps
      });

      bal.available_minor -= tournament.buy_in_minor;
      tournament.current_pool_minor += split.escrowMinor;

      const seq = participants.size + 1;
      const participant: ArenaParticipant = {
        id: crypto.randomUUID(),
        tournament_id: tournamentId,
        user_id: userId,
        display_name: displayName,
        country_code: countryCode,
        is_synthetic_seed: false,
        device_fingerprint: deviceFingerprint,
        ip_address: ipAddress,
        current_t_balance_minor: tournament.initial_t_balance_minor,
        reserved_t_stake_minor: 0,
        rebuy_count: 0,
        consecutive_wins: 0,
        streak_bonus_earned_minor: 0,
        total_trades: 0,
        winning_trades: 0,
        tie_breaker_seq: seq,
        final_rank: null,
        prize_won_minor: 0,
        bonus_won_minor: 0,
        beat_ghost_bot: false,
        collusion_flagged: false,
        status: "ACTIVE",
        last_trade_at: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      participants.set(userId, participant);
      await this.persistRealBalanceToDb(userId);
      await this.persistTournamentToDb(tournament);
      await this.persistParticipantToDb(participant);
      await this.persistLedgerEventToDb({
        tournamentId,
        userId,
        eventType: "BUY_IN",
        grossAmountMinor: tournament.buy_in_minor,
        rakeAmountMinor: split.rakeMinor,
        escrowAmountMinor: split.escrowMinor,
        blnkRakeRef: split.rakeRef ?? null,
        blnkEscrowRef: split.escrowRef ?? null,
        idempotencyKey: idempotencyKey || `join:${tournamentId}:${userId}`
      });
      await this.syncParticipantToRedisZset(tournamentId, participant);

      return {
        participant,
        rakeMinor: split.rakeMinor,
        escrowMinor: split.escrowMinor,
        isDuplicate: false
      };
    });
  }

  /**
   * Pit Stop Tático (Rebuy): Validação quádrupla + Split 30% Rake / 70% Escrow no Blnk
   */
  async executeArenaRebuy(params: {
    tournamentId: string;
    userId: string;
    idempotencyKey: string;
    nowMs?: number;
  }): Promise<{
    participant: ArenaParticipant;
    rakeMinor: number;
    escrowMinor: number;
    newPoolMinor: number;
  }> {
    const { tournamentId, userId, idempotencyKey, nowMs = Date.now() } = params;
    const tournament = TournamentArenaService.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error("TOURNAMENT_NOT_FOUND: Tournament does not exist");
    }

    return this.withUserLock(userId, async () => {
      const participants = TournamentArenaService.participantsByTournament.get(tournamentId)!;
      const participant = participants.get(userId);
      if (!participant) {
        throw new Error("PARTICIPANT_NOT_FOUND: User is not registered in this tournament");
      }

      // Validação 1: Janela temporal antes do REBUY_FREEZE (T - 3 min)
      if (nowMs >= tournament.freeze_rebuys_at.getTime()) {
        throw new Error("REBUY_WINDOW_CLOSED: Rebuys are frozen in the final 3 minutes of the tournament");
      }

      // Validação 2: Limite máximo de Rebuys (default 3)
      if (participant.rebuy_count >= tournament.max_rebuys_per_user) {
        throw new Error(`MAX_REBUYS_REACHED: Maximum of ${tournament.max_rebuys_per_user} rebuys reached`);
      }

      // Validação 3: Nenhuma operação aberta em voo
      if (participant.reserved_t_stake_minor > 0) {
        throw new Error("REBUY_NOT_ELIGIBLE_ACTIVE_TRADES: Cannot rebuy while tournament trades are open");
      }

      // Validação 4: Saldo T$ insuficiente para o trade mínimo (< T$ 10.00 = 1000 minor units)
      if (participant.current_t_balance_minor >= 1000) {
        throw new Error("REBUY_NOT_ELIGIBLE_HAS_BALANCE: Participant still has operational T$ balance");
      }

      const bal = this.ensureUserRealBalanceState(userId);
      if (bal.available_minor < tournament.rebuy_price_minor) {
        throw new Error("INSUFFICIENT_BALANCE: Available real balance is insufficient for rebuy");
      }

      const nextAttempt = participant.rebuy_count + 1;
      const split = await this.blnkClient.recordTournamentEntryOrRebuy({
        tournamentId,
        userId,
        eventType: "REBUY",
        attemptNumber: nextAttempt,
        grossAmountMinor: tournament.rebuy_price_minor,
        rakeBps: tournament.house_rake_bps
      });

      bal.available_minor -= tournament.rebuy_price_minor;
      tournament.current_pool_minor += split.escrowMinor;

      participant.rebuy_count = nextAttempt;
      participant.current_t_balance_minor = tournament.initial_t_balance_minor;
      participant.consecutive_wins = 0;
      participant.status = "ACTIVE";
      participant.tie_breaker_seq += 1;
      participant.updated_at = new Date();

      await this.persistRealBalanceToDb(userId);
      await this.persistTournamentToDb(tournament);
      await this.persistParticipantToDb(participant);
      await this.persistLedgerEventToDb({
        tournamentId,
        userId,
        eventType: "REBUY",
        grossAmountMinor: tournament.rebuy_price_minor,
        rakeAmountMinor: split.rakeMinor,
        escrowAmountMinor: split.escrowMinor,
        blnkRakeRef: split.rakeRef ?? null,
        blnkEscrowRef: split.escrowRef ?? null,
        idempotencyKey: idempotencyKey || `rebuy:${tournamentId}:${userId}:${nextAttempt}`
      });
      await this.syncParticipantToRedisZset(tournamentId, participant);

      return {
        participant,
        rakeMinor: split.rakeMinor,
        escrowMinor: split.escrowMinor,
        newPoolMinor: tournament.current_pool_minor
      };
    });
  }

  /**
   * TournamentArenaSeeder: Popula 45 competidores sintéticos (10 SCALPER, 25 TREND_FOLLOWER, 10 SNIPER)
   * com buy-ins contabilizados no Escrow para testar Top 3, Top 10, Top 20 e Top 30 imediatamente!
   */
  async seedArenaCompetitors(
    tournamentId: string,
    count: number = 45
  ): Promise<{
    seededCount: number;
    archetypeBreakdown: Record<SeedArchetype, number>;
    totalPoolMinor: number;
    ghostBotScoreMinor: number;
  }> {
    const tournament = TournamentArenaService.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error("TOURNAMENT_NOT_FOUND: Tournament does not exist");
    }

    const participants = TournamentArenaService.participantsByTournament.get(tournamentId)!;
    const totalToSeed = Math.min(count, SYNTHETIC_COMPETITOR_POOL.length);
    const breakdown: Record<SeedArchetype, number> = {
      SCALPER: 0,
      TREND_FOLLOWER: 0,
      SNIPER: 0
    };

    for (let i = 0; i < totalToSeed; i++) {
      const template = SYNTHETIC_COMPETITOR_POOL[i];
      const syntheticUserId = `seed_${tournamentId.slice(0, 8)}_${i + 1}`;
      if (participants.has(syntheticUserId)) continue;

      // Credita saldo real para o bot pagar o Buy-in real no Blnk Ledger (mantendo Escrow 100% lastreado!)
      const bal = this.ensureUserRealBalanceState(syntheticUserId);
      bal.available_minor += tournament.buy_in_minor * 2;
      await this.blnkClient.creditRealDeposit(
        syntheticUserId,
        `seed_dep_${tournamentId}_${i + 1}`,
        tournament.buy_in_minor * 2
      );

      const split = await this.blnkClient.recordTournamentEntryOrRebuy({
        tournamentId,
        userId: syntheticUserId,
        eventType: "BUY_IN",
        attemptNumber: 1,
        grossAmountMinor: tournament.buy_in_minor,
        rakeBps: tournament.house_rake_bps
      });

      bal.available_minor -= tournament.buy_in_minor;
      tournament.current_pool_minor += split.escrowMinor;

      // Distribui saldos T$ realistas por arquétipo para criar disputa orgânica do #1 ao #45
      let seededTBalance = tournament.initial_t_balance_minor;
      if (template.archetype === "SCALPER") {
        // Top 1 a Top 10 (entre T$ 1.650 e T$ 2.850)
        seededTBalance = 285_000 - i * 12_500;
      } else if (template.archetype === "TREND_FOLLOWER") {
        // Posições #11 a #35 (entre T$ 1.050 e T$ 1.620 — Linha da Bolha Top 10/20/30)
        const idx = i - 10;
        seededTBalance = 162_000 - idx * 2_300;
      } else {
        // SNIPER: Posições #36 a #45 (entre T$ 820 e T$ 1.040)
        const idx = i - 35;
        seededTBalance = 104_000 - idx * 2_200;
      }

      const seq = i + 1;
      const participant: ArenaParticipant = {
        id: crypto.randomUUID(),
        tournament_id: tournamentId,
        user_id: syntheticUserId,
        display_name: template.name,
        country_code: template.country,
        is_synthetic_seed: true,
        seed_archetype: template.archetype,
        device_fingerprint: `fp_seed_${tournamentId}_${i + 1}`,
        ip_address: `10.45.0.${i + 1}`,
        current_t_balance_minor: seededTBalance,
        reserved_t_stake_minor: 0,
        rebuy_count: 0,
        consecutive_wins: template.archetype === "SCALPER" ? 3 : i % 3,
        streak_bonus_earned_minor: template.archetype === "SCALPER" ? 4_500 : 0,
        total_trades: 12 + (i % 15),
        winning_trades: 8 + (i % 9),
        tie_breaker_seq: seq,
        final_rank: null,
        prize_won_minor: 0,
        bonus_won_minor: 0,
        beat_ghost_bot: seededTBalance > tournament.ghost_bot_score_minor,
        collusion_flagged: false,
        status: "ACTIVE",
        last_trade_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      participants.set(syntheticUserId, participant);
      breakdown[template.archetype] += 1;
      await this.persistRealBalanceToDb(syntheticUserId);
      await this.persistParticipantToDb(participant);
      await this.persistLedgerEventToDb({
        tournamentId,
        userId: syntheticUserId,
        eventType: "BUY_IN",
        grossAmountMinor: tournament.buy_in_minor,
        rakeAmountMinor: split.rakeMinor,
        escrowAmountMinor: split.escrowMinor,
        blnkRakeRef: split.rakeRef ?? null,
        blnkEscrowRef: split.escrowRef ?? null,
        idempotencyKey: `seed_join:${tournamentId}:${syntheticUserId}`
      });
      await this.syncParticipantToRedisZset(tournamentId, participant);
    }

    await this.persistTournamentToDb(tournament);

    return {
      seededCount: participants.size,
      archetypeBreakdown: breakdown,
      totalPoolMinor: tournament.current_pool_minor,
      ghostBotScoreMinor: tournament.ghost_bot_score_minor
    };
  }

  // =========================================================================
  // 3. ABERTURA E LIQUIDAÇÃO DE ORDENS NA ARENA (ANTI-PÓDIO FANTASMA + STREAK 3X)
  // =========================================================================

  async openArenaTrade(params: {
    tournamentId: string;
    userId: string;
    symbol: string;
    direction: "UP" | "DOWN";
    stakeTMinor: number;
    durationSeconds?: number;
    nowMs?: number;
  }): Promise<ArenaTradeOrder> {
    const {
      tournamentId,
      userId,
      symbol,
      direction,
      stakeTMinor,
      durationSeconds = 60,
      nowMs = Date.now()
    } = params;

    const tournament = TournamentArenaService.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error("TOURNAMENT_NOT_FOUND: Tournament does not exist");
    }

    if (!Number.isSafeInteger(stakeTMinor) || stakeTMinor < 1000) {
      throw new Error("INVALID_MINOR_AMOUNT: Minimum tournament stake is T$ 10.00 (1000 minor units)");
    }

    return this.withUserLock(userId, async () => {
      const participants = TournamentArenaService.participantsByTournament.get(tournamentId)!;
      const participant = participants.get(userId);
      if (!participant) {
        throw new Error("PARTICIPANT_NOT_FOUND: User is not registered in this tournament");
      }

      // 1. Regra Anti-Pódio Fantasma (Parte A): Bloqueia novas ordens após freeze_trades_at (últimos 60s)
      if (nowMs >= tournament.freeze_trades_at.getTime()) {
        throw new Error(
          "TOURNAMENT_TRADING_FROZEN: Trading is frozen in the final 60 seconds of the tournament"
        );
      }

      // 2. Regra Anti-Pódio Fantasma (Parte B): expires_at JAMAIS pode ultrapassar tournament.ends_at
      const expiresAtMs = nowMs + durationSeconds * 1000;
      if (expiresAtMs > tournament.ends_at.getTime()) {
        throw new Error(
          "TOURNAMENT_EXPIRY_EXCEEDS_END: Contract expiration cannot exceed tournament end time"
        );
      }

      // 3. Cooldown Tático de 5 segundos entre aberturas de ordem
      if (participant.last_trade_at && nowMs - participant.last_trade_at.getTime() < 5000) {
        throw new Error("TOURNAMENT_TRADE_COOLDOWN: Minimum 5 seconds required between arena orders");
      }

      // 4. Teto de Stake de 20% da Banca T$ atual (Anti-All-In / Anti-Conluio)
      const maxAllowedStake = Math.max(
        1000,
        Math.floor((participant.current_t_balance_minor * tournament.max_stake_pct) / 100)
      );
      if (stakeTMinor > maxAllowedStake) {
        throw new Error(
          `STAKE_EXCEEDS_20PCT_CAP: Stake (${stakeTMinor}) exceeds maximum ${tournament.max_stake_pct}% cap (${maxAllowedStake})`
        );
      }

      if (participant.current_t_balance_minor < stakeTMinor) {
        throw new Error("INSUFFICIENT_TOURNAMENT_BALANCE: Insufficient T$ balance for stake");
      }

      // 5. Detector Anti-Mirror-Hedging (mesmo IP abrindo direção oposta em janela <= 1000ms)
      const openTrades = TournamentArenaService.openTradesByTournament.get(tournamentId)!;
      if (participant.ip_address) {
        for (const existingOrder of openTrades.values()) {
          if (
            existingOrder.status === "OPEN" &&
            existingOrder.user_id !== userId &&
            existingOrder.ip_address === participant.ip_address &&
            existingOrder.symbol === symbol &&
            existingOrder.direction !== direction &&
            Math.abs(nowMs - existingOrder.opened_at.getTime()) <= 1000
          ) {
            participant.collusion_flagged = true;
            const otherParticipant = participants.get(existingOrder.user_id);
            if (otherParticipant) {
              otherParticipant.collusion_flagged = true;
              await this.persistParticipantToDb(otherParticipant);
            }
            await this.persistParticipantToDb(participant);
            throw new Error(
              "COLLUSION_MIRROR_TRADE_DETECTED: Simultaneous opposite trades from identical IP address blocked"
            );
          }
        }
      }

      let entryPrice: number | null = null;
      let entryTickSequence: number | null = null;
      if (this.pool) {
        const tickRes = await this.pool.query(
          `SELECT sequence, price FROM ticks
           WHERE symbol = $1 AND ts <= $2
           ORDER BY ts DESC, sequence DESC
           LIMIT 1`,
          [symbol, new Date(nowMs)]
        );
        if (tickRes.rows.length > 0) {
          entryPrice = Number(tickRes.rows[0].price);
          entryTickSequence = Number(tickRes.rows[0].sequence);
        } else {
          const fallbackTickRes = await this.pool.query(
            `SELECT sequence, price FROM ticks
             WHERE symbol = $1
             ORDER BY sequence DESC
             LIMIT 1`,
            [symbol]
          );
          if (fallbackTickRes.rows.length > 0) {
            entryPrice = Number(fallbackTickRes.rows[0].price);
            entryTickSequence = Number(fallbackTickRes.rows[0].sequence);
          }
        }
      }

      participant.current_t_balance_minor -= stakeTMinor;
      participant.reserved_t_stake_minor += stakeTMinor;
      participant.last_trade_at = new Date(nowMs);
      participant.updated_at = new Date(nowMs);

      const order: ArenaTradeOrder = {
        id: crypto.randomUUID(),
        tournament_id: tournamentId,
        participant_id: participant.id,
        user_id: userId,
        symbol,
        direction,
        stake_t_minor: stakeTMinor,
        entry_price: entryPrice,
        entry_tick_sequence: entryTickSequence,
        opened_at: new Date(nowMs),
        expires_at: new Date(expiresAtMs),
        status: "OPEN",
        ip_address: participant.ip_address,
        device_fingerprint: participant.device_fingerprint
      };

      openTrades.set(order.id, order);
      await this.persistParticipantToDb(participant);
      await this.persistTradeOrderToDb(order);
      await this.syncParticipantToRedisZset(tournamentId, participant);
      return order;
    });
  }

  public getArenaTradeOrder(tournamentId: string, tradeId: string): ArenaTradeOrder | undefined {
    return TournamentArenaService.openTradesByTournament.get(tournamentId)?.get(tradeId);
  }

  /**
   * Liquida uma ordem de torneio aplicando:
   * - Captura oficial do primeiro tick no PostgreSQL onde ts >= expires_at (quando conectado ao banco)
   * - Regra do Momentum Streak 3x (+15% bônus sobre o lucro)
   */
  async settleArenaTrade(params: {
    tournamentId: string;
    tradeId: string;
    result?: "WIN" | "LOSS" | "DRAW";
    payoutPct?: number;
  }): Promise<{
    order: ArenaTradeOrder;
    participant: ArenaParticipant;
    baseProfitMinor: number;
    streakBonusMinor: number;
    zsetScore: number;
  }> {
    const { tournamentId, tradeId, payoutPct = 85 } = params;
    const tournament = TournamentArenaService.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error("TOURNAMENT_NOT_FOUND: Tournament does not exist");
    }

    const openTrades = TournamentArenaService.openTradesByTournament.get(tournamentId)!;
    const order = openTrades.get(tradeId);
    if (!order) {
      throw new Error("TRADE_NOT_FOUND: Arena trade order not found");
    }

    return this.withUserLock(order.user_id, async () => {
      const participants = TournamentArenaService.participantsByTournament.get(tournamentId)!;
      const participant = participants.get(order.user_id)!;

      if (order.status === "SETTLED") {
        const score = calculateArenaZsetScore(
          participant.current_t_balance_minor,
          participant.tie_breaker_seq
        );
        return {
          order,
          participant,
          baseProfitMinor: order.base_profit_t_minor ?? 0,
          streakBonusMinor: order.streak_bonus_t_minor ?? 0,
          zsetScore: score
        };
      }

      let resolvedResult: "WIN" | "LOSS" | "DRAW" = params.result ?? "LOSS";
      let exitPrice: number | null = null;
      let exitTickSequence: number | null = null;

      if (this.pool) {
        const tickRes = await this.pool.query(
          `SELECT sequence, price FROM ticks
           WHERE symbol = $1 AND ts >= $2
           ORDER BY ts ASC, sequence ASC
           LIMIT 1`,
          [order.symbol, order.expires_at]
        );

        if (tickRes.rows.length > 0) {
          exitPrice = Number(tickRes.rows[0].price);
          exitTickSequence = Number(tickRes.rows[0].sequence);
          const entryPrice =
            order.entry_price !== null && order.entry_price !== undefined
              ? Number(order.entry_price)
              : exitPrice;
          const diff = exitPrice - entryPrice;
          if (Math.abs(diff) < 1e-9) {
            resolvedResult = "DRAW";
          } else if (order.direction === "UP") {
            resolvedResult = diff > 0 ? "WIN" : "LOSS";
          } else {
            resolvedResult = diff < 0 ? "WIN" : "LOSS";
          }
        } else if (order.entry_tick_sequence !== null && order.entry_tick_sequence !== undefined) {
          throw new Error(
            "ARENA_SETTLEMENT_TICK_NOT_AVAILABLE: Official settlement tick (ts >= expires_at) not yet available"
          );
        }
      }

      participant.reserved_t_stake_minor -= order.stake_t_minor;
      participant.total_trades += 1;

      let baseProfitMinor = 0;
      let streakBonusMinor = 0;

      if (resolvedResult === "WIN") {
        participant.consecutive_wins += 1;
        participant.winning_trades += 1;
        baseProfitMinor = Math.floor((order.stake_t_minor * payoutPct) / 100);

        // Momentum Streak 3x: +15% sobre o lucro base a partir da 3ª vitória seguida
        if (participant.consecutive_wins >= 3) {
          streakBonusMinor = Math.floor((baseProfitMinor * 15) / 100);
          participant.streak_bonus_earned_minor += streakBonusMinor;
        }

        participant.current_t_balance_minor +=
          order.stake_t_minor + baseProfitMinor + streakBonusMinor;
      } else if (resolvedResult === "LOSS") {
        participant.consecutive_wins = 0;
        if (
          participant.current_t_balance_minor < 1000 &&
          participant.reserved_t_stake_minor === 0
        ) {
          participant.status = "BUSTED";
        }
      } else if (resolvedResult === "DRAW") {
        // Empate técnico devolve a stake e NÃO quebra o streak de vitórias!
        participant.current_t_balance_minor += order.stake_t_minor;
      }

      participant.tie_breaker_seq += 1;
      participant.beat_ghost_bot = GhostBenchmarkEngine.didBeatGhostBenchmark(
        participant.current_t_balance_minor,
        tournament.initial_t_balance_minor,
        tournament.ghost_bot_score_minor
      );
      participant.updated_at = new Date();

      order.status = "SETTLED";
      order.result = resolvedResult;
      order.exit_price = exitPrice;
      order.exit_tick_sequence = exitTickSequence;
      order.settled_at = new Date();
      order.base_profit_t_minor = baseProfitMinor;
      order.streak_bonus_t_minor = streakBonusMinor;

      await this.persistParticipantToDb(participant);
      await this.persistTradeOrderToDb(order);
      const zsetScore = await this.syncParticipantToRedisZset(tournamentId, participant);

      return {
        order,
        participant,
        baseProfitMinor,
        streakBonusMinor,
        zsetScore
      };
    });
  }

  /**
   * Varre todas as ordens OPEN cujo expires_at <= nowMs e as liquida usando o primeiro tick oficial ts >= expires_at.
   */
  public async sweepExpiredArenaTrades(nowMs: number = Date.now()): Promise<number> {
    let settledCount = 0;
    for (const [tournamentId, tradesMap] of TournamentArenaService.openTradesByTournament.entries()) {
      for (const order of tradesMap.values()) {
        if (order.status !== "OPEN") continue;
        if (order.expires_at.getTime() > nowMs) continue;
        try {
          await this.settleArenaTrade({
            tournamentId,
            tradeId: order.id
          });
          settledCount += 1;
        } catch {
          // Se o tick oficial ts >= expires_at ainda não chegou no banco, aguarda próximo ciclo
        }
      }
    }
    return settledCount;
  }

  private async syncParticipantToRedisZset(
    tournamentId: string,
    participant: ArenaParticipant
  ): Promise<number> {
    const score = calculateArenaZsetScore(
      participant.current_t_balance_minor,
      participant.tie_breaker_seq
    );
    if (this.redis && typeof (this.redis as any).zadd === "function") {
      try {
        await this.redis.zadd(
          `tournament:${tournamentId}:leaderboard`,
          score,
          participant.user_id
        );
      } catch {
        // Ignora falha de cache Redis quando rodando em modo desconectado
      }
    }
    return score;
  }

  // =========================================================================
  // 4. LEADERBOARD TOP 3 / 10 / 20 / 30, RADAR DA BOLHA E LIQUIDAÇÃO FINAL
  // =========================================================================

  public getLeaderboardSnapshot(tournamentId: string, requestingUserId?: string): {
    tournament_id: string;
    code: string;
    status: TournamentStatus;
    payout_tier: PayoutTier;
    prize_pool_minor: number;
    paid_places_count: number;
    top_entries: {
      rank: number;
      user_id: string;
      display_name: string;
      country_code: string;
      is_synthetic_seed: boolean;
      seed_archetype?: SeedArchetype | null;
      t_balance_minor: number;
      consecutive_wins: number;
      zset_score: number;
      projected_prize_minor: number;
      beat_ghost_bot: boolean;
    }[];
    cutoff_target: {
      rank: number;
      display_name: string;
      score_minor: number;
      projected_prize_minor: number;
    } | null;
    ghost_benchmark: {
      name: string;
      score_minor: number;
      win_rate_pct: number;
    };
    my_position: {
      rank: number;
      t_balance_minor: number;
      projected_prize_minor: number;
      distance_to_cutoff_minor: number;
      in_the_money: boolean;
      beat_ghost_bot: boolean;
    } | null;
  } {
    const tournament = TournamentArenaService.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error("TOURNAMENT_NOT_FOUND: Tournament does not exist");
    }

    const participantsMap = TournamentArenaService.participantsByTournament.get(tournamentId)!;
    const eligible = GhostBenchmarkEngine.filterEligibleWinners(
      Array.from(participantsMap.values())
    );

    eligible.sort((a, b) => {
      const scoreA = calculateArenaZsetScore(a.current_t_balance_minor, a.tie_breaker_seq);
      const scoreB = calculateArenaZsetScore(b.current_t_balance_minor, b.tie_breaker_seq);
      return scoreB - scoreA;
    });

    const effectivePoolMinor = Math.max(
      tournament.current_pool_minor,
      tournament.guaranteed_pool_minor
    );
    const tierWeights = TIER_WEIGHTS_BPS[tournament.payout_tier];
    const paidPlacesCount = tierWeights.length;
    const projectedPrizes = calculateExactPrizeDistribution(
      effectivePoolMinor,
      tournament.payout_tier,
      eligible.length
    );

    const rankedEntries = eligible.map((p, idx) => {
      const rank = idx + 1;
      return {
        rank,
        user_id: p.user_id,
        display_name: p.display_name,
        country_code: p.country_code,
        is_synthetic_seed: p.is_synthetic_seed,
        seed_archetype: p.seed_archetype,
        t_balance_minor: p.current_t_balance_minor,
        consecutive_wins: p.consecutive_wins,
        zset_score: calculateArenaZsetScore(p.current_t_balance_minor, p.tie_breaker_seq),
        projected_prize_minor: projectedPrizes[idx] ?? 0,
        beat_ghost_bot: GhostBenchmarkEngine.didBeatGhostBenchmark(
          p.current_t_balance_minor,
          tournament.initial_t_balance_minor,
          tournament.ghost_bot_score_minor
        )
      };
    });

    const topEntries = rankedEntries.slice(0, paidPlacesCount);
    const cutoffIndex = Math.min(paidPlacesCount, rankedEntries.length) - 1;
    const cutoffEntry = cutoffIndex >= 0 ? rankedEntries[cutoffIndex] : null;

    let myPosition = null;
    if (requestingUserId) {
      const found = rankedEntries.find((r) => r.user_id === requestingUserId);
      if (found) {
        const cutoffScore = cutoffEntry ? cutoffEntry.t_balance_minor : 0;
        myPosition = {
          rank: found.rank,
          t_balance_minor: found.t_balance_minor,
          projected_prize_minor: found.projected_prize_minor,
          distance_to_cutoff_minor: found.t_balance_minor - cutoffScore,
          in_the_money: found.rank <= paidPlacesCount,
          beat_ghost_bot: found.beat_ghost_bot
        };
      }
    }

    return {
      tournament_id: tournament.id,
      code: tournament.code,
      status: tournament.status,
      payout_tier: tournament.payout_tier,
      prize_pool_minor: effectivePoolMinor,
      paid_places_count: paidPlacesCount,
      top_entries: topEntries,
      cutoff_target: cutoffEntry
        ? {
            rank: cutoffEntry.rank,
            display_name: cutoffEntry.display_name,
            score_minor: cutoffEntry.t_balance_minor,
            projected_prize_minor: cutoffEntry.projected_prize_minor
          }
        : null,
      ghost_benchmark: {
        name: `@${tournament.ghost_bot_name}`,
        score_minor: tournament.ghost_bot_score_minor,
        win_rate_pct: 68
      },
      my_position: myPosition
    };
  }

  /**
   * Liquidação Final do Torneio no Blnk Ledger (AC-F1-03):
   * - Injeta Overlay se garantido > acumulado
   * - Distribui 100% do Escrow via Hare-Niemeyer para Top 3, Top 10, Top 20 ou Top 30
   * - Zera matematicamente o saldo de @tournament_{id}:escrow (remainingEscrowMinor === 0)
   * - Concede bônus de margem (+50% com Rollover 25x) para quem superou o @Alpha_Quant
   */
  async settleArenaTournament(tournamentId: string): Promise<{
    tournament: ArenaTournament;
    totalPoolMinor: number;
    overlayInjectedMinor: number;
    totalDistributedMinor: number;
    remainingEscrowMinor: number;
    distributions: { userId: string; displayName: string; rank: number; prizeMinor: number; reference: string }[];
    bonusGrants: UserBonusGrant[];
  }> {
    const tournament = TournamentArenaService.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error("TOURNAMENT_NOT_FOUND: Tournament does not exist");
    }

    const participantsMap = TournamentArenaService.participantsByTournament.get(tournamentId)!;
    for (const p of participantsMap.values()) {
      if (p.reserved_t_stake_minor > 0) {
        throw new Error(
          `TOURNAMENT_HAS_OPEN_TRADES: Participant ${p.user_id} still has reserved stake in flight`
        );
      }
    }

    let overlayInjectedMinor = 0;
    if (tournament.guaranteed_pool_minor > tournament.current_pool_minor) {
      overlayInjectedMinor = tournament.guaranteed_pool_minor - tournament.current_pool_minor;
      await this.blnkClient.provisionTournamentOverlay(tournament.id, overlayInjectedMinor);
      tournament.current_pool_minor += overlayInjectedMinor;
      await this.persistLedgerEventToDb({
        tournamentId: tournament.id,
        userId: "SYSTEM_OVERLAY",
        eventType: "OVERLAY_INJECTION",
        grossAmountMinor: overlayInjectedMinor,
        rakeAmountMinor: 0,
        escrowAmountMinor: overlayInjectedMinor,
        blnkEscrowRef: `overlay:${tournament.id}`,
        idempotencyKey: `overlay:${tournament.id}`
      });
    }

    const eligible = GhostBenchmarkEngine.filterEligibleWinners(
      Array.from(participantsMap.values())
    );

    eligible.sort((a, b) => {
      const scoreA = calculateArenaZsetScore(a.current_t_balance_minor, a.tie_breaker_seq);
      const scoreB = calculateArenaZsetScore(b.current_t_balance_minor, b.tie_breaker_seq);
      return scoreB - scoreA;
    });

    const tierCount = TIER_WEIGHTS_BPS[tournament.payout_tier].length;
    const topWinners = eligible.slice(0, tierCount).map((p, idx) => ({
      userId: p.user_id,
      displayName: p.display_name,
      rank: idx + 1
    }));

    const distResult = await this.blnkClient.distributeTournamentPrizes({
      tournamentId: tournament.id,
      totalPoolMinor: tournament.current_pool_minor,
      tier: tournament.payout_tier,
      winners: topWinners
    });

    const enrichedDistributions: {
      userId: string;
      displayName: string;
      rank: number;
      prizeMinor: number;
      reference: string;
    }[] = [];

    for (let i = 0; i < eligible.length; i++) {
      const p = eligible[i];
      p.final_rank = i + 1;
      p.status = "SETTLED";
    }

    for (const d of distResult.distributions) {
      const p = participantsMap.get(d.userId)!;
      p.prize_won_minor = d.prizeMinor;
      const bal = this.ensureUserRealBalanceState(d.userId);
      bal.available_minor += d.prizeMinor;
      await this.persistRealBalanceToDb(d.userId);
      await this.persistLedgerEventToDb({
        tournamentId: tournament.id,
        userId: d.userId,
        eventType: "PRIZE_PAYOUT",
        grossAmountMinor: d.prizeMinor,
        rakeAmountMinor: 0,
        escrowAmountMinor: d.prizeMinor,
        blnkEscrowRef: d.reference,
        idempotencyKey: d.reference
      });
      enrichedDistributions.push({
        userId: d.userId,
        displayName: p.display_name,
        rank: d.rank,
        prizeMinor: d.prizeMinor,
        reference: d.reference
      });
    }

    // Concessão de bônus de margem (+50% sobre o buy-in com Rollover 25x) para quem superou o @Alpha_Quant
    const bonusGrants: UserBonusGrant[] = [];
    const bonusAmountMinor = Math.max(250, Math.floor(tournament.buy_in_minor * 0.5));
    for (const p of eligible) {
      const beatGhost = GhostBenchmarkEngine.didBeatGhostBenchmark(
        p.current_t_balance_minor,
        tournament.initial_t_balance_minor,
        tournament.ghost_bot_score_minor
      );
      p.beat_ghost_bot = beatGhost;
      if (beatGhost && !p.is_synthetic_seed) {
        const bonusId = crypto.randomUUID();
        await this.blnkClient.grantTournamentBonusMargin({
          userId: p.user_id,
          bonusId,
          bonusAmountMinor
        });
        p.bonus_won_minor = bonusAmountMinor;
        const bal = this.ensureUserRealBalanceState(p.user_id);
        bal.bonus_margin_minor += bonusAmountMinor;

        const grant: UserBonusGrant = {
          id: bonusId,
          user_id: p.user_id,
          source_type: "BEAT_GHOST_BOT",
          tournament_id: tournament.id,
          bonus_amount_minor: bonusAmountMinor,
          required_rollover_minor: bonusAmountMinor * 25,
          completed_volume_minor: 0,
          status: "LOCKED",
          blnk_grant_ref: `bonus_grant:${bonusId}`,
          expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          created_at: new Date()
        };

        const list = TournamentArenaService.bonusGrantsByUser.get(p.user_id) ?? [];
        list.push(grant);
        TournamentArenaService.bonusGrantsByUser.set(p.user_id, list);
        bonusGrants.push(grant);
        await this.persistRealBalanceToDb(p.user_id);
        await this.persistBonusGrantToDb(grant);
        await this.persistLedgerEventToDb({
          tournamentId: tournament.id,
          userId: p.user_id,
          eventType: "BONUS_GRANT",
          grossAmountMinor: bonusAmountMinor,
          rakeAmountMinor: 0,
          escrowAmountMinor: 0,
          blnkEscrowRef: grant.blnk_grant_ref,
          idempotencyKey: grant.blnk_grant_ref
        });
      }
      await this.persistParticipantToDb(p);
    }

    tournament.status = "SETTLED";
    tournament.settled_at = new Date();
    await this.persistTournamentToDb(tournament);

    return {
      tournament,
      totalPoolMinor: tournament.current_pool_minor,
      overlayInjectedMinor,
      totalDistributedMinor: distResult.totalDistributedMinor,
      remainingEscrowMinor: distResult.remainingEscrowMinor,
      distributions: enrichedDistributions,
      bonusGrants
    };
  }

  /**
   * Utilitário de Dev/Testes: avança o relógio do torneio para testar REBUY_FREEZE, TRADING_FREEZE ou Fim
   */
  public fastForwardTournamentClock(
    tournamentId: string,
    remainingSeconds: number
  ): ArenaTournament {
    const tournament = TournamentArenaService.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error("TOURNAMENT_NOT_FOUND: Tournament does not exist");
    }

    const nowMs = Date.now();
    const newEndsAt = new Date(nowMs + remainingSeconds * 1000);
    tournament.starts_at = new Date(newEndsAt.getTime() - 900 * 1000);
    tournament.freeze_rebuys_at = new Date(newEndsAt.getTime() - 180 * 1000);
    tournament.freeze_trades_at = new Date(newEndsAt.getTime() - 60 * 1000);
    tournament.ends_at = newEndsAt;
    tournament.status = computeTournamentStateAt(tournament, nowMs);
    void this.persistTournamentToDb(tournament);

    return tournament;
  }
}
