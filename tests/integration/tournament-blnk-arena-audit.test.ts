import assert from "node:assert/strict";
import { describe as nodeDescribe, it as nodeIt } from "node:test";
import Fastify from "../../services/api/node_modules/fastify/fastify.js";
import {
  BlnkClient,
  calculateExactPrizeDistribution,
  TIER_WEIGHTS_BPS,
  type PayoutTier
} from "../../services/wallet-adapter/src/blnk-client.ts";
import {
  TournamentArenaService,
  GhostBenchmarkEngine,
  calculateArenaZsetScore,
  extractTBalanceFromScore,
  extractTieBreakerSeqFromScore
} from "../../services/api/src/services/tournament-arena-service.ts";
import { arenaRoutes } from "../../services/api/src/routes/arena.ts";
import {
  startBlnkTestServer,
  createStatefulDbAndRedis
} from "./blnk-ledger-vulnerabilities-audit.test.ts";

export function registerTournamentBlnkArenaAuditSuite(
  describe: any = nodeDescribe,
  it: any = nodeIt
) {
  describe("FASE 04 — Suíte de Testes de Integração, Caos, Concorrência e Auditoria Contábil da Arena de Torneios (Blnk Ledger)", () => {
    it("[T-ARENA-01][I-01][I-02][I-06] Ciclo completo Depósito PIX ($25) -> Buy-in ($5: $1.50 Rake / $3.50 Escrow) -> Rebuy ($3: $0.90 Rake / $2.10 Escrow) -> Saque 2-Etapas (Hold + Settle + Reversal) com soma algébrica === 0", async () => {
      TournamentArenaService.resetStateForTesting();
      const blnkServer = await startBlnkTestServer();
      process.env.BLNK_URL = blnkServer.baseUrl;

      const blnkClient = new BlnkClient(blnkServer.baseUrl);
      await blnkClient.initializeLedgerAndHouseAccounts();

      const { pool, redis } = createStatefulDbAndRedis();
      const userId = "trader-arena-01";

      const app = Fastify();
      (app as any).decorate("authenticate", async (req: any) => {
        req.user = { id: userId, name: "Lucas_Trader", roles: ["USER"] };
      });
      (app as any).decorate("pg", pool);
      (app as any).decorate("redis", redis);
      (app as any).decorate("blnkClient", blnkClient);
      await app.register(arenaRoutes);

      try {
        // 1. Solicita e confirma Depósito PIX de $25.00 (2500 centavos)
        const depReq = await app.inject({
          method: "POST",
          url: "/api/v1/wallet/real/deposit",
          headers: { "idempotency-key": "dep-pix-2500" },
          payload: { amount_minor: 2500, method: "PIX" }
        });
        assert.equal(depReq.statusCode, 201);
        const depTxId = JSON.parse(depReq.payload).transaction.id;

        const depConfirm = await app.inject({
          method: "POST",
          url: "/api/v1/wallet/real/deposit/confirm",
          payload: { tx_id: depTxId }
        });
        assert.equal(depConfirm.statusCode, 200);

        const realAvailAcc = BlnkClient.getUserRealAccount(userId, "available");
        const realResAcc = BlnkClient.getUserRealAccount(userId, "reserved");
        assert.equal(blnkServer.accounts.get(realAvailAcc)?.balance, 2500);

        // 2. Cria torneio e faz Buy-in de $5.00 (500 centavos -> 150 Rake / 350 Escrow)
        const arenaService = new TournamentArenaService(pool as any, redis as any, blnkClient);
        const tournament = await arenaService.createTournament({
          title: "Sprint Blitz 15M",
          symbol: "SYNTH_VOL_50",
          payoutTier: "TOP_10",
          buyInMinor: 500,
          rebuyPriceMinor: 300,
          durationSeconds: 900
        });

        const joinRes = await app.inject({
          method: "POST",
          url: `/api/v1/arena/tournaments/${tournament.id}/join`,
          headers: { "idempotency-key": "join-arena-01" },
          payload: {
            display_name: "Lucas_Trader",
            country_code: "BR",
            device_fingerprint: "fp-lucas-001"
          }
        });
        assert.equal(joinRes.statusCode, 201);
        const joinBody = JSON.parse(joinRes.payload);
        assert.equal(joinBody.rakeMinor, 150);
        assert.equal(joinBody.escrowMinor, 350);

        const escrowAcc = BlnkClient.getTournamentEscrowAccount(tournament.id);
        assert.equal(blnkServer.accounts.get("@house:tournament_rake")?.balance, 150);
        assert.equal(blnkServer.accounts.get(escrowAcc)?.balance, 350);
        assert.equal(blnkServer.accounts.get(realAvailAcc)?.balance, 2000);

        // 3. Simula perda da banca T$ para habilitar Rebuy ($3.00 = 300 centavos -> 90 Rake / 210 Escrow)
        joinBody.participant.current_t_balance_minor = 0;
        const participantsMap = (TournamentArenaService as any).participantsByTournament.get(tournament.id);
        participantsMap.get(userId).current_t_balance_minor = 0;

        const rebuyRes = await app.inject({
          method: "POST",
          url: `/api/v1/arena/tournaments/${tournament.id}/rebuy`,
          headers: { "idempotency-key": "rebuy-arena-01" }
        });
        assert.equal(rebuyRes.statusCode, 200);
        const rebuyBody = JSON.parse(rebuyRes.payload);
        assert.equal(rebuyBody.rakeMinor, 90);
        assert.equal(rebuyBody.escrowMinor, 210);
        assert.equal(rebuyBody.participant.current_t_balance_minor, 100_000);

        assert.equal(blnkServer.accounts.get("@house:tournament_rake")?.balance, 240); // 150 + 90
        assert.equal(blnkServer.accounts.get(escrowAcc)?.balance, 560); // 350 + 210
        assert.equal(blnkServer.accounts.get(realAvailAcc)?.balance, 1700); // 2500 - 500 - 300

        // 4. Saque 1 ($10.00 = 1000 cents): Hold -> Settle
        const wdr1 = await app.inject({
          method: "POST",
          url: "/api/v1/wallet/real/withdraw",
          headers: { "idempotency-key": "wdr-1000" },
          payload: { amount_minor: 1000, method: "PIX", destination_account: "pix-lucas" }
        });
        assert.equal(wdr1.statusCode, 201);
        const wdr1Id = JSON.parse(wdr1.payload).transaction.id;

        // Durante Hold: available = 700, reserved = 1000
        assert.equal(blnkServer.accounts.get(realAvailAcc)?.balance, 700);
        assert.equal(blnkServer.accounts.get(realResAcc)?.balance, 1000);

        const wdr1Complete = await app.inject({
          method: "POST",
          url: `/api/v1/wallet/real/withdraw/${wdr1Id}/complete`
        });
        assert.equal(wdr1Complete.statusCode, 200);
        assert.equal(blnkServer.accounts.get(realAvailAcc)?.balance, 700);
        assert.equal(blnkServer.accounts.get(realResAcc)?.balance, 0);

        // 5. Saque 2 ($7.00 = 700 cents): Hold -> Cancel/Reversal (Regra I-06)
        const wdr2 = await app.inject({
          method: "POST",
          url: "/api/v1/wallet/real/withdraw",
          headers: { "idempotency-key": "wdr-700-cancel" },
          payload: { amount_minor: 700, method: "PIX", destination_account: "pix-lucas" }
        });
        assert.equal(wdr2.statusCode, 201);
        const wdr2Id = JSON.parse(wdr2.payload).transaction.id;
        assert.equal(blnkServer.accounts.get(realAvailAcc)?.balance, 0);
        assert.equal(blnkServer.accounts.get(realResAcc)?.balance, 700);

        const wdr2Cancel = await app.inject({
          method: "POST",
          url: `/api/v1/wallet/real/withdraw/${wdr2Id}/cancel`
        });
        assert.equal(wdr2Cancel.statusCode, 200);
        assert.equal(blnkServer.accounts.get(realAvailAcc)?.balance, 700);
        assert.equal(blnkServer.accounts.get(realResAcc)?.balance, 0);

        // Invariante I-02: Soma algébrica de todo o Ledger === 0
        assert.equal(blnkServer.getAlgebraicTotalSum(), 0);
      } finally {
        await app.close();
        await blnkServer.close();
      }
    });

    it("[T-ARENA-02][I-03] Rajada concorrente de 50 cliques de Rebuy (aprova exatamente 1 e rejeita 49) e bloqueio total com ordem OPEN em voo", async () => {
      TournamentArenaService.resetStateForTesting();
      const blnkServer = await startBlnkTestServer();
      process.env.BLNK_URL = blnkServer.baseUrl;

      const blnkClient = new BlnkClient(blnkServer.baseUrl);
      await blnkClient.initializeLedgerAndHouseAccounts();

      const { pool, redis } = createStatefulDbAndRedis();
      const userId = "trader-rebuy-storm";

      const app = Fastify();
      (app as any).decorate("authenticate", async (req: any) => {
        req.user = { id: userId, name: "Storm_Trader", roles: ["USER"] };
      });
      (app as any).decorate("pg", pool);
      (app as any).decorate("redis", redis);
      (app as any).decorate("blnkClient", blnkClient);
      await app.register(arenaRoutes);

      try {
        const arenaService = new TournamentArenaService(pool as any, redis as any, blnkClient);

        // Deposita $50.00 (5000 cents)
        const dep = await arenaService.requestRealDeposit({
          userId,
          amountMinor: 5000,
          method: "PIX",
          idempotencyKey: "dep-storm-5000"
        });
        await arenaService.confirmRealDeposit({ txId: dep.transaction.id });

        const tournament = await arenaService.createTournament({
          title: "Rebuy Storm Arena",
          symbol: "SYNTH_VOL_50",
          buyInMinor: 500,
          rebuyPriceMinor: 300,
          maxStakePct: 100, // Permite testar perda total em 1 ordem
          durationSeconds: 900
        });

        await arenaService.joinTournament({
          tournamentId: tournament.id,
          userId,
          displayName: "Storm_Trader",
          deviceFingerprint: "fp-storm-1",
          idempotencyKey: "join-storm-1"
        });

        // 1. Abre ordem de 100% da banca T$ (T$ 1.000,00 em voo -> current = 0, reserved = 100.000)
        const openOrder = await arenaService.openArenaTrade({
          tournamentId: tournament.id,
          userId,
          symbol: "SYNTH_VOL_50",
          direction: "UP",
          stakeTMinor: 100_000,
          durationSeconds: 60
        });

        // Enquanto a ordem está OPEN em voo, 100% das tentativas de Rebuy são bloqueadas!
        const blockedInFlight = await Promise.all(
          Array.from({ length: 10 }, (_, idx) =>
            app.inject({
              method: "POST",
              url: `/api/v1/arena/tournaments/${tournament.id}/rebuy`,
              headers: { "idempotency-key": `in-flight-rebuy-${idx}` }
            })
          )
        );
        for (const res of blockedInFlight) {
          assert.equal(res.statusCode, 422);
          assert.match(JSON.parse(res.payload).error, /REBUY_NOT_ELIGIBLE/);
        }

        // 2. Liquida a ordem como LOSS -> agora current_t_balance_minor === 0 e reserved_t_stake_minor === 0
        await arenaService.settleArenaTrade({
          tournamentId: tournament.id,
          tradeId: openOrder.id,
          result: "LOSS"
        });

        // 3. Dispara 50 cliques simultâneos (Promise.all) no endpoint de Rebuy!
        const burst50 = await Promise.all(
          Array.from({ length: 50 }, (_, idx) =>
            app.inject({
              method: "POST",
              url: `/api/v1/arena/tournaments/${tournament.id}/rebuy`,
              headers: { "idempotency-key": `burst-rebuy-key-${idx + 1}` }
            })
          )
        );

        const approved200 = burst50.filter((r) => r.statusCode === 200);
        const rejected422 = burst50.filter((r) => r.statusCode === 422);

        assert.equal(approved200.length, 1, "Exatamente 1 Rebuy deve ser aprovado na rajada de 50 cliques");
        assert.equal(rejected422.length, 49, "As 49 chamadas concorrentes restantes devem ser rejeitadas");

        // Saldo real disponível: 5000 (depósito) - 500 (buy-in) - 300 (1 único rebuy) = 4200 cents ($42.00)
        const realBal = arenaService.getRealBalanceSnapshot(userId);
        assert.equal(realBal.available_minor, 4200);
        assert.equal(
          blnkServer.accounts.get(BlnkClient.getUserRealAccount(userId, "available"))?.balance,
          4200
        );
        assert.equal(blnkServer.getAlgebraicTotalSum(), 0);
      } finally {
        await app.close();
        await blnkServer.close();
      }
    });

    it("[T-ARENA-03][I-02][D-18] Auditoria Hare-Niemeyer para TOP_3, TOP_10, TOP_20 e TOP_30 com potes ímpares/primos: soma(payouts) === escrowBalance e saldo final do Escrow === 0", async () => {
      TournamentArenaService.resetStateForTesting();
      const blnkServer = await startBlnkTestServer();
      process.env.BLNK_URL = blnkServer.baseUrl;

      const blnkClient = new BlnkClient(blnkServer.baseUrl);
      await blnkClient.initializeLedgerAndHouseAccounts();

      try {
        const oddPools = [35_777, 100_003, 77_773, 1, 29, 999_999];
        const tiers: PayoutTier[] = ["TOP_3", "TOP_10", "TOP_20", "TOP_30"];

        for (const tier of tiers) {
          const maxPlaces = TIER_WEIGHTS_BPS[tier].length;

          for (const poolMinor of oddPools) {
            const payouts = calculateExactPrizeDistribution(poolMinor, tier, maxPlaces);
            assert.equal(payouts.length, maxPlaces);

            // Todos inteiros não-negativos e não-crescentes (rank #1 >= rank #2 >= ...)
            for (let i = 0; i < payouts.length; i++) {
              assert.equal(Number.isSafeInteger(payouts[i]), true);
              assert.ok(payouts[i] >= 0);
              if (i > 0) {
                assert.ok(
                  payouts[i - 1] >= payouts[i],
                  `Tier ${tier} pool ${poolMinor}: rank ${i} (${payouts[i - 1]}) must be >= rank ${i + 1} (${payouts[i]})`
                );
              }
            }

            const sumPayouts = payouts.reduce((a, b) => a + b, 0);
            assert.equal(
              sumPayouts,
              poolMinor,
              `Hare-Niemeyer sum (${sumPayouts}) must strictly equal pool (${poolMinor}) for ${tier}`
            );
          }

          // Executa liquidação real no Blnk para cada tier com pote primo de 35.777 centavos ($357.77)
          const tournamentId = `tour-hn-${tier.toLowerCase()}`;
          const poolPrime = 35_777;
          await blnkClient.provisionTournamentOverlay(tournamentId, poolPrime);

          const escrowAcc = BlnkClient.getTournamentEscrowAccount(tournamentId);
          assert.equal(blnkServer.accounts.get(escrowAcc)?.balance, poolPrime);

          const winners = Array.from({ length: maxPlaces }, (_, idx) => ({
            userId: `winner_${tier}_${idx + 1}`,
            rank: idx + 1
          }));

          const dist = await blnkClient.distributeTournamentPrizes({
            tournamentId,
            totalPoolMinor: poolPrime,
            tier,
            winners
          });

          assert.equal(dist.totalDistributedMinor, poolPrime);
          assert.equal(dist.remainingEscrowMinor, 0);
          assert.equal(
            blnkServer.accounts.get(escrowAcc)?.balance,
            0,
            `Escrow account ${escrowAcc} must terminate with strictly 0 cents`
          );
        }

        assert.equal(blnkServer.getAlgebraicTotalSum(), 0);
      } finally {
        await blnkServer.close();
      }
    });

    it("[T-ARENA-04][I-02] Invariante Anti-Fraude do @Alpha_Quant: robô nunca recebe prêmio do pote (100% vai para humanos) e bônus +50% (rollover 25x) só para quem o superou", async () => {
      TournamentArenaService.resetStateForTesting();
      const blnkServer = await startBlnkTestServer();
      process.env.BLNK_URL = blnkServer.baseUrl;

      const blnkClient = new BlnkClient(blnkServer.baseUrl);
      await blnkClient.initializeLedgerAndHouseAccounts();

      const { pool, redis } = createStatefulDbAndRedis();
      const arenaService = new TournamentArenaService(pool as any, redis as any, blnkClient);

      try {
        const tournament = await arenaService.createTournament({
          title: "Ghost Benchmark Audit Cup",
          symbol: "SYNTH_VOL_50",
          payoutTier: "TOP_3",
          buyInMinor: 500,
          guaranteedPoolMinor: 10_000 // $100.00 garantido
        });

        // Define score do @Alpha_Quant em T$ 4.500,00 (450.000 minor units)
        tournament.ghost_bot_score_minor = 450_000;

        // Inscreve 4 jogadores humanos reais
        const humans = [
          { id: "human-1", name: "BeatGhost_Pro", finalScore: 520_000 }, // T$ 5.200 (> 4.500 -> BATEU O ROBÔ!)
          { id: "human-2", name: "RunnerUp_BR", finalScore: 380_000 },   // T$ 3.800 (< 4.500)
          { id: "human-3", name: "ThirdPlace_MX", finalScore: 210_000 }, // T$ 2.100 (< 4.500)
          { id: "human-4", name: "FourthPlace_CO", finalScore: 95_000 }  // T$ 950 (< 1.000)
        ];

        for (let i = 0; i < humans.length; i++) {
          const h = humans[i];
          const dep = await arenaService.requestRealDeposit({
            userId: h.id,
            amountMinor: 1000,
            method: "PIX",
            idempotencyKey: `dep-${h.id}`
          });
          await arenaService.confirmRealDeposit({ txId: dep.transaction.id });

          const joined = await arenaService.joinTournament({
            tournamentId: tournament.id,
            userId: h.id,
            displayName: h.name,
            deviceFingerprint: `fp-${h.id}`,
            idempotencyKey: `join-${h.id}`
          });
          joined.participant.current_t_balance_minor = h.finalScore;
        }

        // Injeta tentativa maliciosa de registrar @Alpha_Quant na lista de participantes com T$ 4.500 (Top 2)
        const participantsMap = (TournamentArenaService as any).participantsByTournament.get(
          tournament.id
        ) as Map<string, any>;
        participantsMap.set("GHOST_ALPHA_QUANT", {
          id: "ghost-uuid",
          tournament_id: tournament.id,
          user_id: "GHOST_ALPHA_QUANT",
          display_name: "@Alpha_Quant",
          country_code: "US",
          is_synthetic_seed: true,
          is_ghost_bot: true,
          device_fingerprint: "fp-ghost",
          current_t_balance_minor: 450_000,
          reserved_t_stake_minor: 0,
          rebuy_count: 0,
          consecutive_wins: 4,
          streak_bonus_earned_minor: 0,
          total_trades: 18,
          winning_trades: 12,
          tie_breaker_seq: 0,
          prize_won_minor: 0,
          bonus_won_minor: 0,
          beat_ghost_bot: false,
          collusion_flagged: false,
          status: "ACTIVE",
          created_at: new Date(),
          updated_at: new Date()
        });

        const settlement = await arenaService.settleArenaTournament(tournament.id);

        // 1. Pote total de $100.00 (10.000 cents) distribuído 100% entre human-1 (#1: 5000), human-2 (#2: 3000) e human-3 (#3: 2000)
        assert.equal(settlement.totalPoolMinor, 10_000);
        assert.equal(settlement.totalDistributedMinor, 10_000);
        assert.equal(settlement.remainingEscrowMinor, 0);
        assert.equal(settlement.distributions.length, 3);

        assert.deepEqual(
          settlement.distributions.map((d) => ({
            userId: d.userId,
            rank: d.rank,
            prizeMinor: d.prizeMinor
          })),
          [
            { userId: "human-1", rank: 1, prizeMinor: 5000 },
            { userId: "human-2", rank: 2, prizeMinor: 3000 },
            { userId: "human-3", rank: 3, prizeMinor: 2000 }
          ]
        );

        // 2. @Alpha_Quant jamais recebeu nenhum centavo
        assert.equal(
          blnkServer.accounts.get(BlnkClient.getUserRealAccount("GHOST_ALPHA_QUANT", "available")),
          undefined
        );

        // 3. Apenas human-1 (que superou T$ 4.500 do @Alpha_Quant) recebeu o bônus de margem (+50% do buy-in = 250 cents)
        assert.equal(settlement.bonusGrants.length, 1);
        assert.equal(settlement.bonusGrants[0].user_id, "human-1");
        assert.equal(settlement.bonusGrants[0].bonus_amount_minor, 250);
        assert.equal(settlement.bonusGrants[0].required_rollover_minor, 250 * 25);
        assert.equal(settlement.bonusGrants[0].status, "LOCKED");

        const human1BonusAcc = BlnkClient.getUserRealAccount("human-1", "bonus_margin");
        assert.equal(blnkServer.accounts.get(human1BonusAcc)?.balance, 250);
        assert.equal(blnkServer.getAlgebraicTotalSum(), 0);
      } finally {
        await blnkServer.close();
      }
    });

    it("[T-ARENA-05] Precisão exata de 53-bits no Redis ZSET e desempate determinístico (10 jogadores com T$ 8.500,00 em seq 1..10)", () => {
      const targetTBalanceMinor = 850_000; // T$ 8.500,00
      const scores: number[] = [];

      for (let seq = 1; seq <= 10; seq++) {
        const score = calculateArenaZsetScore(targetTBalanceMinor, seq);
        assert.equal(Number.isSafeInteger(score), true, `Score for seq ${seq} must be a 53-bit safe integer`);
        assert.ok(score <= Number.MAX_SAFE_INTEGER);
        assert.equal(
          extractTBalanceFromScore(score),
          targetTBalanceMinor,
          `Decoded T$ balance for seq ${seq} must be strictly ${targetTBalanceMinor}`
        );
        assert.equal(
          extractTieBreakerSeqFromScore(score),
          seq,
          `Decoded tie-breaker sequence for seq ${seq} must be strictly ${seq}`
        );
        scores.push(score);
      }

      // Verifica ordenação estrita: seq 1 > seq 2 > ... > seq 10
      for (let i = 0; i < scores.length - 1; i++) {
        assert.ok(
          scores[i] > scores[i + 1],
          `Player with seq ${i + 1} (score ${scores[i]}) must rank higher than seq ${i + 2} (score ${scores[i + 1]})`
        );
      }
    });

    it("[T-ARENA-06] Bloqueio Anti-'Pódio Fantasma' (expires_at <= ends_at) e bloqueio total no TRADING_FREEZE (últimos 60s)", async () => {
      TournamentArenaService.resetStateForTesting();
      const blnkServer = await startBlnkTestServer();
      process.env.BLNK_URL = blnkServer.baseUrl;

      const blnkClient = new BlnkClient(blnkServer.baseUrl);
      await blnkClient.initializeLedgerAndHouseAccounts();

      const { pool, redis } = createStatefulDbAndRedis();
      const userId = "trader-freeze-guard";

      const app = Fastify();
      (app as any).decorate("authenticate", async (req: any) => {
        req.user = { id: userId, name: "Freeze_Tester", roles: ["USER"] };
      });
      (app as any).decorate("pg", pool);
      (app as any).decorate("redis", redis);
      (app as any).decorate("blnkClient", blnkClient);
      await app.register(arenaRoutes);

      try {
        const arenaService = new TournamentArenaService(pool as any, redis as any, blnkClient);
        const dep = await arenaService.requestRealDeposit({
          userId,
          amountMinor: 2000,
          method: "PIX",
          idempotencyKey: "dep-freeze"
        });
        await arenaService.confirmRealDeposit({ txId: dep.transaction.id });

        const tournament = await arenaService.createTournament({
          title: "Anti-Ghost Podium Arena",
          symbol: "SYNTH_VOL_50",
          durationSeconds: 900
        });

        await arenaService.joinTournament({
          tournamentId: tournament.id,
          userId,
          displayName: "Freeze_Tester",
          deviceFingerprint: "fp-freeze-1",
          idempotencyKey: "join-freeze-1"
        });

        // 1. Avança o relógio para faltar exatamente 2 minutos (120s) para o fim do torneio
        arenaService.fastForwardTournamentClock(tournament.id, 120);

        // Ordem de 180s ultrapassa ends_at (180s > 120s) -> bloqueada com 422 TOURNAMENT_EXPIRY_EXCEEDS_END
        const exceedRes = await app.inject({
          method: "POST",
          url: `/api/v1/arena/tournaments/${tournament.id}/trades`,
          payload: {
            symbol: "SYNTH_VOL_50",
            direction: "UP",
            stake_t_minor: 5_000,
            duration_seconds: 180
          }
        });
        assert.equal(exceedRes.statusCode, 422);
        assert.equal(JSON.parse(exceedRes.payload).error, "TOURNAMENT_EXPIRY_EXCEEDS_END");

        // Ordem de 60s cabe antes de ends_at (60s <= 120s) -> aceita com 201 Created!
        const validRes = await app.inject({
          method: "POST",
          url: `/api/v1/arena/tournaments/${tournament.id}/trades`,
          payload: {
            symbol: "SYNTH_VOL_50",
            direction: "UP",
            stake_t_minor: 5_000,
            duration_seconds: 60
          }
        });
        assert.equal(validRes.statusCode, 201);

        // 2. Avança o relógio para os últimos 45 segundos (dentro do TRADING_FREEZE < 60s)
        const frozenTournament = arenaService.fastForwardTournamentClock(tournament.id, 45);
        assert.equal(frozenTournament.status, "TRADING_FREEZE");

        const frozenRes = await app.inject({
          method: "POST",
          url: `/api/v1/arena/tournaments/${tournament.id}/trades`,
          payload: {
            symbol: "SYNTH_VOL_50",
            direction: "DOWN",
            stake_t_minor: 5_000,
            duration_seconds: 30
          }
        });
        assert.equal(frozenRes.statusCode, 422);
        assert.equal(JSON.parse(frozenRes.payload).error, "TOURNAMENT_TRADING_FROZEN");
      } finally {
        await app.close();
        await blnkServer.close();
      }
    });

    it("[T-ARENA-07] Simulação completa com TournamentArenaSeeder (45 competidores: 10 SCALPER, 25 TREND_FOLLOWER, 10 SNIPER + Momentum Streak 3x +15% + Leaderboard Top 10/20/30 e Radar de Bolha)", async () => {
      TournamentArenaService.resetStateForTesting();
      const blnkServer = await startBlnkTestServer();
      process.env.BLNK_URL = blnkServer.baseUrl;

      const blnkClient = new BlnkClient(blnkServer.baseUrl);
      await blnkClient.initializeLedgerAndHouseAccounts();

      const { pool, redis } = createStatefulDbAndRedis();
      const userId = "trader-hero-07";

      const app = Fastify();
      const mockUser = { id: userId, name: "Hero_Trader", roles: ["USER"] };
      app.addHook("onRequest", async (req: any) => {
        req.user = mockUser;
      });
      (app as any).decorate("authenticate", async (req: any) => {
        req.user = mockUser;
      });
      (app as any).decorate("pg", pool);
      (app as any).decorate("redis", redis);
      (app as any).decorate("blnkClient", blnkClient);
      await app.register(arenaRoutes);

      try {
        // 1. Dispara endpoint Dev Spawn para criar torneio TOP_20 já populado com 45 competidores
        const spawnRes = await app.inject({
          method: "POST",
          url: "/api/v1/arena/tournaments/dev/spawn",
          payload: {
            title: "Grand LatAm Blitz Top 20",
            symbol: "SYNTH_VOL_50",
            payout_tier: "TOP_20",
            buy_in_minor: 500,
            seed_count: 45
          }
        });
        assert.equal(spawnRes.statusCode, 201);
        const spawnBody = JSON.parse(spawnRes.payload);
        const tournamentId = spawnBody.tournament.id;

        assert.equal(spawnBody.seed.seededCount, 45);
        assert.deepEqual(spawnBody.seed.archetypeBreakdown, {
          SCALPER: 10,
          TREND_FOLLOWER: 25,
          SNIPER: 10
        });

        // 2. Usuário humano deposita e entra no torneio (46º participante)
        const arenaService = new TournamentArenaService(pool as any, redis as any, blnkClient);
        const dep = await arenaService.requestRealDeposit({
          userId,
          amountMinor: 2000,
          method: "PIX",
          idempotencyKey: "dep-hero-07"
        });
        await arenaService.confirmRealDeposit({ txId: dep.transaction.id });

        await arenaService.joinTournament({
          tournamentId,
          userId,
          displayName: "Hero_Trader",
          deviceFingerprint: "fp-hero-07",
          idempotencyKey: "join-hero-07"
        });

        // 3. Executa 3 vitórias consecutivas para acionar o Momentum Streak 3x (+15% sobre o lucro base)
        let baseNow = Date.now() - 60_000;
        const runTradeCycle = async (stakeTMinor: number, outcome: "WIN" | "LOSS" | "DRAW") => {
          baseNow += 10_000; // Respeita cooldown de 5s
          const order = await arenaService.openArenaTrade({
            tournamentId,
            userId,
            symbol: "SYNTH_VOL_50",
            direction: "UP",
            stakeTMinor,
            durationSeconds: 60,
            nowMs: baseNow
          });
          return arenaService.settleArenaTrade({
            tournamentId,
            tradeId: order.id,
            result: outcome
          });
        };

        const win1 = await runTradeCycle(20_000, "WIN"); // Lucro base = 17.000, streak = 1 (bônus 0)
        assert.equal(win1.baseProfitMinor, 17_000);
        assert.equal(win1.streakBonusMinor, 0);
        assert.equal(win1.participant.consecutive_wins, 1);

        const win2 = await runTradeCycle(20_000, "WIN"); // Lucro base = 17.000, streak = 2 (bônus 0)
        assert.equal(win2.baseProfitMinor, 17_000);
        assert.equal(win2.streakBonusMinor, 0);
        assert.equal(win2.participant.consecutive_wins, 2);

        // DRAW no meio NÃO quebra o streak de vitórias!
        const drawMid = await runTradeCycle(10_000, "DRAW");
        assert.equal(drawMid.participant.consecutive_wins, 2);

        // 3ª vitória consecutiva: aciona Momentum Streak 3x (+15% sobre 17.000 = +2.550)
        const win3 = await runTradeCycle(20_000, "WIN");
        assert.equal(win3.participant.consecutive_wins, 3);
        assert.equal(win3.baseProfitMinor, 17_000);
        assert.equal(win3.streakBonusMinor, 2_550);
        // Saldo T$: 100.000 + 17.000 + 17.000 + 17.000 + 2.550 = 153.550 (T$ 1.535,50 -> superou @Alpha_Quant T$ 1.425,00!)
        assert.equal(win3.participant.current_t_balance_minor, 153_550);
        assert.equal(win3.participant.beat_ghost_bot, true);

        // 4. Consulta Leaderboard via HTTP GET /api/v1/arena/tournaments/:id/leaderboard (TOP_20, TOP_10 e TOP_30)
        const lbRes = await app.inject({
          method: "GET",
          url: `/api/v1/arena/tournaments/${tournamentId}/leaderboard`
        });
        assert.equal(lbRes.statusCode, 200);
        const lb = JSON.parse(lbRes.payload);

        assert.equal(lb.payout_tier, "TOP_20");
        assert.equal(lb.paid_places_count, 20);
        assert.equal(lb.top_entries.length, 20);
        assert.ok(lb.cutoff_target !== null);
        assert.equal(lb.cutoff_target.rank, 20);
        assert.equal(lb.ghost_benchmark.name, "@Alpha_Quant");
        assert.ok(lb.my_position !== null);
        assert.equal(lb.my_position.t_balance_minor, 153_550);
        assert.equal(lb.my_position.in_the_money, true);
        assert.equal(lb.my_position.beat_ghost_bot, true);

        // Valida também modos TOP_10 e TOP_30 com os 45 competidores
        const tourObj = arenaService.getTournament(tournamentId)!;
        tourObj.payout_tier = "TOP_10";
        const lb10 = arenaService.getLeaderboardSnapshot(tournamentId, userId);
        assert.equal(lb10.paid_places_count, 10);
        assert.equal(lb10.top_entries.length, 10);
        assert.equal(lb10.cutoff_target?.rank, 10);

        tourObj.payout_tier = "TOP_30";
        const lb30 = arenaService.getLeaderboardSnapshot(tournamentId, userId);
        assert.equal(lb30.paid_places_count, 30);
        assert.equal(lb30.top_entries.length, 30);
        assert.equal(lb30.cutoff_target?.rank, 30);

        assert.equal(blnkServer.getAlgebraicTotalSum(), 0);
      } finally {
        await app.close();
        await blnkServer.close();
      }
    });

    it("[T-ARENA-08][I-01][I-02][I-03] Barreira de Rollover 25x contra saque indevido de bônus (403 BONUS_ROLLOVER_INCOMPLETE) + 20 pedidos de saque simultâneos ($100 vs saldo $100: aprova 1 e rejeita 19 sem negativar)", async () => {
      TournamentArenaService.resetStateForTesting();
      const blnkServer = await startBlnkTestServer();
      process.env.BLNK_URL = blnkServer.baseUrl;

      const blnkClient = new BlnkClient(blnkServer.baseUrl);
      await blnkClient.initializeLedgerAndHouseAccounts();

      const { pool, redis } = createStatefulDbAndRedis();
      const userId = "trader-rollover-08";

      const app = Fastify();
      (app as any).decorate("authenticate", async (req: any) => {
        req.user = { id: userId, name: "Rollover_Tester", roles: ["USER"] };
      });
      (app as any).decorate("pg", pool);
      (app as any).decorate("redis", redis);
      (app as any).decorate("blnkClient", blnkClient);
      await app.register(arenaRoutes);

      try {
        const arenaService = new TournamentArenaService(pool as any, redis as any, blnkClient);

        // 1. Deposita $105.00 (10.500 cents) e entra num torneio ($5.00 buy-in -> sobram $100.00 = 10.000 cents na conta real)
        const dep = await arenaService.requestRealDeposit({
          userId,
          amountMinor: 10_500,
          method: "PIX",
          idempotencyKey: "dep-roll-10500"
        });
        await arenaService.confirmRealDeposit({ txId: dep.transaction.id });

        const tournament = await arenaService.createTournament({
          title: "Rollover & Withdrawal Stress Cup",
          symbol: "SYNTH_VOL_50",
          payoutTier: "TOP_3",
          buyInMinor: 500
        });
        const joined = await arenaService.joinTournament({
          tournamentId: tournament.id,
          userId,
          displayName: "Rollover_Tester",
          deviceFingerprint: "fp-roll-08",
          idempotencyKey: "join-roll-08"
        });

        // Faz o usuário superar o @Alpha_Quant mas ficar em 4º lugar (fora do Top 3 pago em dinheiro, mas ganhando bônus de $2.50 = 250 cents)
        await arenaService.seedArenaCompetitors(tournament.id, 5);
        joined.participant.current_t_balance_minor = 180_000; // Superou @Alpha_Quant (142.500), mas atrás dos 3 primeiros SCALPERs
        await arenaService.settleArenaTournament(tournament.id);

        const snapAfterSettle = arenaService.getRealBalanceSnapshot(userId);
        assert.equal(snapAfterSettle.available_minor, 10_000); // $100.00 real
        assert.equal(snapAfterSettle.bonus_margin_minor, 250); // $2.50 bônus trancado (Rollover 25x = 6.250 cents)

        // 2. Tentativa de sacar o bônus sem cumprir o Rollover 25x -> 403 BONUS_ROLLOVER_INCOMPLETE
        const illegalBonusWithdraw1 = await app.inject({
          method: "POST",
          url: "/api/v1/wallet/real/withdraw",
          headers: { "idempotency-key": "wdr-bonus-illegal-1" },
          payload: {
            amount_minor: 250,
            method: "PIX",
            destination_account: "pix-user",
            attempt_from_bonus: true
          }
        });
        assert.equal(illegalBonusWithdraw1.statusCode, 403);
        assert.equal(JSON.parse(illegalBonusWithdraw1.payload).error, "BONUS_ROLLOVER_INCOMPLETE");

        // Tentativa de sacar $101.00 (10.100 cents > 10.000 available, invadindo os 250 de bonus_margin) -> 403 BONUS_ROLLOVER_INCOMPLETE
        const illegalBonusWithdraw2 = await app.inject({
          method: "POST",
          url: "/api/v1/wallet/real/withdraw",
          headers: { "idempotency-key": "wdr-bonus-illegal-2" },
          payload: {
            amount_minor: 10_100,
            method: "PIX",
            destination_account: "pix-user"
          }
        });
        assert.equal(illegalBonusWithdraw2.statusCode, 403);
        assert.equal(JSON.parse(illegalBonusWithdraw2.payload).error, "BONUS_ROLLOVER_INCOMPLETE");

        // 3. Dispara 20 pedidos de saque simultâneos (Promise.all) de $100.00 (10.000 cents) cada para um saldo real de $100.00!
        const concurrentWithdrawals = await Promise.all(
          Array.from({ length: 20 }, (_, idx) =>
            app.inject({
              method: "POST",
              url: "/api/v1/wallet/real/withdraw",
              headers: { "idempotency-key": `wdr-race-100-${idx + 1}` },
              payload: {
                amount_minor: 10_000,
                method: "PIX",
                destination_account: "pix-user"
              }
            })
          )
        );

        const approved201 = concurrentWithdrawals.filter((r) => r.statusCode === 201);
        const rejected422 = concurrentWithdrawals.filter((r) => r.statusCode === 422);

        assert.equal(approved201.length, 1, "Exatamente 1 pedido de saque de $100 deve ser aprovado");
        assert.equal(rejected422.length, 19, "Os outros 19 pedidos concorrentes devem ser rejeitados com 422 INSUFFICIENT_BALANCE");

        const snapAfterRace = arenaService.getRealBalanceSnapshot(userId);
        assert.equal(snapAfterRace.available_minor, 0, "Saldo real disponível deve zerar sem jamais ficar negativo");
        assert.equal(snapAfterRace.reserved_minor, 10_000, "Exatamente $100.00 deve estar em Hold (reserved)");

        const realAvailAcc = BlnkClient.getUserRealAccount(userId, "available");
        const realResAcc = BlnkClient.getUserRealAccount(userId, "reserved");
        assert.equal(blnkServer.accounts.get(realAvailAcc)?.balance, 0);
        assert.equal(blnkServer.accounts.get(realResAcc)?.balance, 10_000);

        // 4. Completa o Rollover 25x (volume = 6.250 cents) e verifica liberação automática do bônus para available!
        await arenaService.recordRealTradingVolumeForRollover(userId, 6_250);
        const snapAfterRollover = arenaService.getRealBalanceSnapshot(userId);
        assert.equal(snapAfterRollover.bonus_margin_minor, 0);
        assert.equal(snapAfterRollover.available_minor, 250);
        assert.equal(blnkServer.accounts.get(realAvailAcc)?.balance, 250);

        assert.equal(blnkServer.getAlgebraicTotalSum(), 0);
      } finally {
        await app.close();
        await blnkServer.close();
      }
    });
  });
}

if (
  !(globalThis as any).__vitest_worker__ &&
  process.argv.some((arg) => arg.includes("tournament-blnk-arena-audit"))
) {
  registerTournamentBlnkArenaAuditSuite(nodeDescribe, nodeIt);
}
