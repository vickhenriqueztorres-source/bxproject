import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {
  BlnkClient,
  calculateExactPrizeDistribution,
  type BlnkTransactionPayload
} from "@broker/wallet-adapter";
import {
  TournamentArenaService,
  calculateArenaZsetScore,
  extractTBalanceFromScore,
  extractTieBreakerSeqFromScore,
  GhostBenchmarkEngine
} from "../src/services/tournament-arena-service.js";
import { arenaRoutes } from "../src/routes/arena.js";

class MockLedgerBlnkClient extends BlnkClient {
  public recordedTransactions: BlnkTransactionPayload[] = [];
  public accountBalances = new Map<string, number>();

  override async recordTransaction(payload: BlnkTransactionPayload): Promise<any> {
    // Executa todas as validações financeiras estritas da classe base (I-01, I-02, I-03, USD, precision 100)
    if (!payload || typeof payload !== "object") {
      throw new Error("INVALID_PAYLOAD: Transaction payload is required");
    }
    if ("rate" in (payload as any) || "exchange_rate" in (payload as any)) {
      throw new Error("SILENT_CONVERSION_FORBIDDEN: Implicit currency conversion is forbidden");
    }
    if (payload.currency !== "USD") {
      throw new Error("SILENT_CONVERSION_FORBIDDEN: Currency must be strictly ISO-4217 'USD'");
    }
    if (payload.precision !== 100) {
      throw new Error("INVALID_PRECISION: Precision must be strictly 100");
    }
    if (typeof payload.amount !== "number" || !Number.isSafeInteger(payload.amount) || payload.amount <= 0) {
      throw new Error("INVALID_MINOR_AMOUNT: Amount must be a positive safe integer in minor units (cents)");
    }
    if (
      typeof payload.source !== "string" ||
      payload.source.trim().length === 0 ||
      typeof payload.destination !== "string" ||
      payload.destination.trim().length === 0 ||
      payload.source.trim() === payload.destination.trim()
    ) {
      throw new Error("DOUBLE_ENTRY_VIOLATION: Source and destination must be distinct valid accounts");
    }
    if (typeof payload.reference !== "string" || payload.reference.trim().length === 0) {
      throw new Error("IDEMPOTENCY_VIOLATION: Reference is required for idempotent ledger transactions");
    }

    const srcBal = this.accountBalances.get(payload.source) ?? 0;
    if (!payload.allow_overdraft && srcBal < payload.amount) {
      throw new Error(`BLNK_INSUFFICIENT_FUNDS: Account ${payload.source} has ${srcBal}, required ${payload.amount}`);
    }

    this.accountBalances.set(payload.source, srcBal - payload.amount);
    const dstBal = this.accountBalances.get(payload.destination) ?? 0;
    this.accountBalances.set(payload.destination, dstBal + payload.amount);

    this.recordedTransactions.push({ ...payload });
    return { transaction_id: `tx_${this.recordedTransactions.length}`, status: "APPLIED" };
  }

  public getAccountBalance(account: string): number {
    return this.accountBalances.get(account) ?? 0;
  }

  public getTotalAlgebraicSum(): number {
    let sum = 0;
    for (const val of this.accountBalances.values()) {
      sum += val;
    }
    return sum;
  }
}

describe("Fase 01 & Fase 02 — Binmax Arena Blitz, Escrow Double-Entry, Hare-Niemeyer Top 10/20/30 & Motor ZSET 53-bit", () => {
  let mockBlnk: MockLedgerBlnkClient;
  let arenaService: TournamentArenaService;

  beforeEach(() => {
    TournamentArenaService.resetStateForTesting();
    mockBlnk = new MockLedgerBlnkClient("http://localhost:5001");
    arenaService = new TournamentArenaService(undefined, undefined, mockBlnk);
  });

  it("[AC-F1-01] Depósito Real, Saque em 2 Etapas (Hold -> Settle / Reversal) e Soma Zero no Blnk", async () => {
    const userId = "usr_trader_real_1";

    // 1. Solicita e confirma Depósito PIX de $50.00 (5000 cents)
    const depReq = await arenaService.requestRealDeposit({
      userId,
      amountMinor: 5000,
      method: "PIX",
      idempotencyKey: "dep-pix-001"
    });
    assert.equal(depReq.isDuplicate, false);
    assert.equal(depReq.transaction.status, "PENDING");

    await arenaService.confirmRealDeposit({ txId: depReq.transaction.id });
    assert.equal(mockBlnk.getAccountBalance(`@user_${userId}:real:available`), 5000);
    assert.equal(mockBlnk.getAccountBalance("@broker_float"), -5000);
    assert.equal(mockBlnk.getTotalAlgebraicSum(), 0);

    // 2. Solicita Saque PIX de $20.00 (2000 cents) -> Move para @user_{id}:real:reserved (Hold)
    const wdrReq = await arenaService.requestRealWithdrawal({
      userId,
      amountMinor: 2000,
      method: "PIX",
      destinationAccount: "pix-key-123",
      idempotencyKey: "wdr-pix-001"
    });
    assert.equal(wdrReq.transaction.status, "PENDING");
    assert.equal(mockBlnk.getAccountBalance(`@user_${userId}:real:available`), 3000);
    assert.equal(mockBlnk.getAccountBalance(`@user_${userId}:real:reserved`), 2000);

    // 3. Liquida o saque (Settle) -> Zera reserved e devolve para @broker_float
    await arenaService.completeRealWithdrawal(wdrReq.transaction.id);
    assert.equal(mockBlnk.getAccountBalance(`@user_${userId}:real:available`), 3000);
    assert.equal(mockBlnk.getAccountBalance(`@user_${userId}:real:reserved`), 0);
    assert.equal(mockBlnk.getAccountBalance("@broker_float"), -3000);
    assert.equal(mockBlnk.getTotalAlgebraicSum(), 0);

    // 4. Solicita segundo saque de $15.00 (1500 cents) e Cancela (Reversal I-06)
    const wdrCancel = await arenaService.requestRealWithdrawal({
      userId,
      amountMinor: 1500,
      method: "PIX",
      destinationAccount: "pix-key-123",
      idempotencyKey: "wdr-pix-002"
    });
    assert.equal(mockBlnk.getAccountBalance(`@user_${userId}:real:available`), 1500);
    assert.equal(mockBlnk.getAccountBalance(`@user_${userId}:real:reserved`), 1500);

    await arenaService.cancelRealWithdrawal(wdrCancel.transaction.id);
    assert.equal(mockBlnk.getAccountBalance(`@user_${userId}:real:available`), 3000);
    assert.equal(mockBlnk.getAccountBalance(`@user_${userId}:real:reserved`), 0);
    assert.equal(mockBlnk.getTotalAlgebraicSum(), 0);
  });

  it("[AC-F1-02 & AC-F1-03] Algoritmo Hare-Niemeyer distribui 100% do pote nos Tiers TOP_3, TOP_10, TOP_20 e TOP_30 (mesmo com centavos primos)", () => {
    const primePools = [100, 350, 999, 10_001, 35_777, 123_456];
    const tiers = ["TOP_3", "TOP_10", "TOP_20", "TOP_30"] as const;

    for (const tier of tiers) {
      for (const pool of primePools) {
        const prizes = calculateExactPrizeDistribution(pool, tier, 50);
        const sum = prizes.reduce((acc, v) => acc + v, 0);
        assert.equal(
          sum,
          pool,
          `Soma dos prêmios no tier ${tier} para pote ${pool} deve ser exatamente ${pool} (recebido ${sum})`
        );
        // Verifica monotonicidade não-crescente (1º >= 2º >= 3º ... >= Nº)
        for (let i = 0; i < prizes.length - 1; i++) {
          assert.ok(
            prizes[i] >= prizes[i + 1],
            `Rank #${i + 1} (${prizes[i]}) nunca pode receber menos que Rank #${i + 2} (${prizes[i + 1]})`
          );
        }
      }
    }
  });

  it("[FASE 02 — ZSET 53-BIT] Calcula score composto sem overflow IEEE-754 e desempata por sequência temporal", () => {
    // Dois traders com exatamente T$ 2.500,00 (250_000 cents), Trader A chegou na seq 42 e Trader B na seq 43
    const scoreA = calculateArenaZsetScore(250_000, 42);
    const scoreB = calculateArenaZsetScore(250_000, 43);

    assert.equal(scoreA, 25_000_099_957);
    assert.equal(scoreB, 25_000_099_956);
    assert.ok(scoreA > scoreB, "Quem atingiu a pontuação primeiro deve ter score estritamente maior");
    assert.equal(extractTBalanceFromScore(scoreA), 250_000);
    assert.equal(extractTBalanceFromScore(scoreB), 250_000);
    assert.equal(extractTieBreakerSeqFromScore(scoreA), 42);
    assert.equal(extractTieBreakerSeqFromScore(scoreB), 43);
  });

  it("[FASE 02 — ANTI-PÓDIO FANTASMA, STREAK 3X E REBUY] Bloqueia expiração após ends_at, aplica +15% no 3º WIN consecutivo e valida Rebuy quádruplo", async () => {
    const userId = "usr_pro_1";
    const dep = await arenaService.requestRealDeposit({
      userId,
      amountMinor: 2000, // $20.00 USD
      method: "PIX",
      idempotencyKey: "dep-pro-1"
    });
    await arenaService.confirmRealDeposit({ txId: dep.transaction.id });

    const nowMs = Date.now();
    const tournament = await arenaService.createTournament({
      title: "Blitz 15m Test",
      symbol: "SYNTH_VOL_50",
      payoutTier: "TOP_10",
      buyInMinor: 500,     // $5.00 -> $1.50 rake / $3.50 escrow
      rebuyPriceMinor: 300, // $3.00 -> $0.90 rake / $2.10 escrow
      durationSeconds: 900,
      startsAt: new Date(nowMs)
    });

    const joinRes = await arenaService.joinTournament({
      tournamentId: tournament.id,
      userId,
      displayName: "Brenda_Trader",
      countryCode: "BR",
      deviceFingerprint: "fp_brenda_01",
      idempotencyKey: "join-01"
    });

    assert.equal(joinRes.rakeMinor, 150);
    assert.equal(joinRes.escrowMinor, 350);
    assert.equal(mockBlnk.getAccountBalance("@house:tournament_rake"), 150);
    assert.equal(mockBlnk.getAccountBalance(`@tournament_${tournament.id}:escrow`), 350);

    // 1. Tenta apostar > 20% da banca (T$ 250.00 = 25000 > 20000) -> bloqueado!
    await assert.rejects(
      arenaService.openArenaTrade({
        tournamentId: tournament.id,
        userId,
        symbol: "SYNTH_VOL_50",
        direction: "UP",
        stakeTMinor: 25_000,
        nowMs: nowMs + 1000
      }),
      /STAKE_EXCEEDS_20PCT_CAP/
    );

    // 2. Executa 3 vitórias consecutivas de T$ 100,00 (10_000 minor units) para acionar Momentum Streak 3x (+15% bônus no lucro)
    let tradeClock = nowMs + 10_000;
    for (let step = 1; step <= 3; step++) {
      const order = await arenaService.openArenaTrade({
        tournamentId: tournament.id,
        userId,
        symbol: "SYNTH_VOL_50",
        direction: "UP",
        stakeTMinor: 10_000,
        durationSeconds: 60,
        nowMs: tradeClock
      });
      const settled = await arenaService.settleArenaTrade({
        tournamentId: tournament.id,
        tradeId: order.id,
        result: "WIN"
      });

      if (step < 3) {
        assert.equal(settled.baseProfitMinor, 8_500);
        assert.equal(settled.streakBonusMinor, 0);
      } else {
        // 3º WIN consecutivo: +8500 base + 15% de 8500 (1275) = 9775 de ganho líquido!
        assert.equal(settled.baseProfitMinor, 8_500);
        assert.equal(settled.streakBonusMinor, 1_275);
        assert.equal(settled.participant.consecutive_wins, 3);
      }
      tradeClock += 6_000; // Respeita cooldown de 5s
    }

    // 3. Regra Anti-Pódio Fantasma: Faltando 90s para o fim (antes do TRADING_FREEZE de 60s), tentar abrir ordem de 120s é bloqueado!
    const ninetySecBeforeEnd = tournament.ends_at.getTime() - 90_000;
    await assert.rejects(
      arenaService.openArenaTrade({
        tournamentId: tournament.id,
        userId,
        symbol: "SYNTH_VOL_50",
        direction: "UP",
        stakeTMinor: 10_000,
        durationSeconds: 120, // Ultrapassaria ends_at em 30s!
        nowMs: ninetySecBeforeEnd
      }),
      /TOURNAMENT_EXPIRY_EXCEEDS_END/
    );

    // 4. Nos últimos 45s (após freeze_trades_at), qualquer ordem é bloqueada com TOURNAMENT_TRADING_FROZEN
    const fortyFiveSecBeforeEnd = tournament.ends_at.getTime() - 45_000;
    await assert.rejects(
      arenaService.openArenaTrade({
        tournamentId: tournament.id,
        userId,
        symbol: "SYNTH_VOL_50",
        direction: "UP",
        stakeTMinor: 10_000,
        durationSeconds: 30,
        nowMs: fortyFiveSecBeforeEnd
      }),
      /TOURNAMENT_TRADING_FROZEN/
    );
  });

  it("[FASE 02 — SEEDER 45 BOTS + LIQUIDAÇÃO TOP_10 / TOP_20 / TOP_30 + ROLLOVER 25X] Popula 45 competidores, liquida Top 30 zerando Escrow e bloqueia saque de bônus sem rollover", async () => {
    const app = Fastify();
    (app as any).decorate("authenticate", async (req: any) => {
      req.user = { id: "usr_champion_1", name: "Champion_BR" };
    });
    (app as any).decorate("blnkClient", mockBlnk);
    await app.register(arenaRoutes);

    // 1. Faz depósito real de $50.00 para o jogador humano
    const depRes = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/real/deposit",
      headers: { "idempotency-key": "dep-champ-1" },
      payload: { amount_minor: 5000, method: "PIX" }
    });
    assert.equal(depRes.statusCode, 201);
    const depTxId = depRes.json().transaction.id;

    await app.inject({
      method: "POST",
      url: "/api/v1/wallet/real/deposit/confirm",
      payload: { tx_id: depTxId }
    });

    // 2. Spawna torneio TOP_30 com 45 competidores sintéticos (10 SCALPER, 25 TREND_FOLLOWER, 10 SNIPER)
    const spawnRes = await app.inject({
      method: "POST",
      url: "/api/v1/tournaments/dev/spawn",
      payload: {
        title: "Copa Binmax Top 30",
        symbol: "SYNTH_VOL_50",
        payout_tier: "TOP_30",
        buy_in_minor: 500,
        seed_count: 45
      }
    });
    assert.equal(spawnRes.statusCode, 201);
    const spawned = spawnRes.json();
    const tournamentId = spawned.tournament.id;
    assert.equal(spawned.seed.seededCount, 45);
    assert.equal(spawned.seed.archetypeBreakdown.SCALPER, 10);
    assert.equal(spawned.seed.archetypeBreakdown.TREND_FOLLOWER, 25);
    assert.equal(spawned.seed.archetypeBreakdown.SNIPER, 10);

    // 3. Jogador humano entra no torneio e supera o @Alpha_Quant
    const joinRes = await app.inject({
      method: "POST",
      url: `/api/v1/arena/tournaments/${tournamentId}/join`,
      headers: { "idempotency-key": "join-champ-1" },
      payload: { display_name: "Champion_BR", country_code: "BR", device_fingerprint: "fp_champ_unique" }
    });
    assert.equal(joinRes.statusCode, 201);

    // Executa 3 vitórias de 20% da banca para superar o @Alpha_Quant (142.500)
    for (let i = 0; i < 3; i++) {
      // Ajusta last_trade_at no passado para não esperar 5s reais no teste
      const lbBefore = await app.inject({
        method: "GET",
        url: `/api/v1/arena/tournaments/${tournamentId}/leaderboard`
      });
      assert.equal(lbBefore.statusCode, 200);

      const tradeRes = await arenaService.openArenaTrade({
        tournamentId,
        userId: "usr_champion_1",
        symbol: "SYNTH_VOL_50",
        direction: "UP",
        stakeTMinor: 20_000,
        durationSeconds: 60,
        nowMs: Date.now() - (3 - i) * 10_000
      });
      await arenaService.settleArenaTrade({
        tournamentId,
        tradeId: tradeRes.id,
        result: "WIN"
      });
    }

    // 4. Consulta Leaderboard TOP_30 com Radar de Bolha e Benchmark @Alpha_Quant
    const lbRes = await app.inject({
      method: "GET",
      url: `/api/v1/arena/tournaments/${tournamentId}/leaderboard`
    });
    assert.equal(lbRes.statusCode, 200);
    const lb = lbRes.json();
    assert.equal(lb.payout_tier, "TOP_30");
    assert.equal(lb.top_entries.length, 30);
    assert.equal(lb.cutoff_target.rank, 30);
    assert.equal(lb.ghost_benchmark.name, "@Alpha_Quant");
    // Confirma que @Alpha_Quant NUNCA ocupa posição no Top 30 humano
    assert.ok(lb.top_entries.every((e: any) => e.display_name !== "Alpha_Quant" && e.display_name !== "@Alpha_Quant"));

    // 5. Liquida o torneio no Blnk Ledger -> Escrow deve terminar EXATAMENTE em 0 centavos!
    const settleRes = await app.inject({
      method: "POST",
      url: `/api/v1/arena/tournaments/${tournamentId}/settle`
    });
    assert.equal(settleRes.statusCode, 200);
    const settleBody = settleRes.json();
    assert.equal(settleBody.remainingEscrowMinor, 0);
    assert.equal(settleBody.totalDistributedMinor, settleBody.totalPoolMinor);
    assert.equal(mockBlnk.getAccountBalance(`@tournament_${tournamentId}:escrow`), 0);
    assert.equal(mockBlnk.getTotalAlgebraicSum(), 0);
    assert.equal(settleBody.distributions.length, 30);
    assert.equal(settleBody.bonusGrants.length, 1, "Jogador humano que superou @Alpha_Quant recebe bônus de margem");

    // 6. Tenta sacar o bônus antes de cumprir o Rollover de 25x -> 403 BONUS_ROLLOVER_INCOMPLETE (AC-F1-04)
    const wdrBonusAttempt = await app.inject({
      method: "POST",
      url: "/api/v1/wallet/real/withdraw",
      headers: { "idempotency-key": "wdr-bonus-blocked" },
      payload: {
        amount_minor: 250,
        method: "PIX",
        destination_account: "pix-champ",
        attempt_from_bonus: true
      }
    });
    assert.equal(wdrBonusAttempt.statusCode, 403);
    assert.equal(wdrBonusAttempt.json().error, "BONUS_ROLLOVER_INCOMPLETE");

    await app.close();
  });
});
