/**
 * Subetapa 04.1 (Gate T1) — Oráculo de Unificação Matemática, CSPRNG e Persistência Durável PostgreSQL
 * Cobertura:
 * 1. [I-02 / I-06] Paridade exata em centavos inteiros entre frontend (apps/web/src/arena/engine.ts)
 *    e backend (services/wallet-adapter/src/blnk-client.ts) para TOP_3, TOP_10, TOP_20 e TOP_30.
 * 2. [M-01] Proibição estrita de Math.random() em tournament-arena-service.ts e nas rotas de carteira/torneio.
 * 3. [DB-01 / I-01 / I-04] Persistência durável em PostgreSQL real (migrations 0061 + 0062) de torneios,
 *    participantes, eventos de ledger (buy-in/rebuy/payout/bonus), ordens de trade e saldos reais,
 *    com recuperação integral pós-restart via hydrateFromDatabase().
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  assertNotProduction,
  createEphemeralPostgres,
} from '../helpers/chart-durability-postgres.mjs';
import {
  TIER_WEIGHTS_BPS as FRONTEND_TIER_WEIGHTS_BPS,
  tierPrizes as frontendTierPrizes,
  podiumPrizes as frontendPodiumPrizes,
} from '../../apps/web/src/arena/engine.ts';
import {
  BlnkClient,
  TIER_WEIGHTS_BPS as BACKEND_TIER_WEIGHTS_BPS,
  calculateExactPrizeDistribution,
} from '../../services/wallet-adapter/src/blnk-client.ts';
import { TournamentArenaService } from '../../services/api/src/services/tournament-arena-service.ts';

assertNotProduction();

test(
  '[Gate T1 | I-02 & I-06] Paridade matemática exata Hare-Niemeyer entre frontend (engine.ts) e backend (blnk-client.ts) para TOP_3, TOP_10, TOP_20 e TOP_30',
  async () => {
    assert.deepEqual(
      FRONTEND_TIER_WEIGHTS_BPS,
      BACKEND_TIER_WEIGHTS_BPS,
      'TIER_WEIGHTS_BPS deve ser idêntico entre frontend e backend'
    );

    const samplePools = [100, 350, 500, 1_337, 10_503, 15_750, 43_750, 99_999];
    const tiers = ['TOP_3', 'TOP_10', 'TOP_20', 'TOP_30'];

    for (const pool of samplePools) {
      for (const tier of tiers) {
        const frontRes = frontendTierPrizes(pool, tier);
        const frontDist = frontRes.prizes;
        const backDist = calculateExactPrizeDistribution(pool, tier);
        assert.deepEqual(
          frontDist,
          backDist,
          `Divergência na distribuição Hare-Niemeyer para tier=${tier}, pool=${pool}`
        );
        const sumFront = frontDist.reduce((a, b) => a + b, 0);
        assert.equal(sumFront, pool, `Soma dos prêmios (${sumFront}) != pool (${pool})`);
        assert.equal(frontRes.residual, 0);
      }

      const podium = frontendPodiumPrizes(pool).prizes;
      const top3Back = calculateExactPrizeDistribution(pool, 'TOP_3');
      assert.deepEqual(
        [podium[0], podium[1], podium[2]],
        top3Back,
        `podiumPrizes(${pool}) deve coincidir exatamente com calculateExactPrizeDistribution(${pool}, 'TOP_3')`
      );
    }
  }
);

test(
  '[Gate T1 | M-01] Erradicação de Math.random() no serviço de torneios e nas rotas de carteira/torneio',
  async () => {
    const arenaServiceSrc = await readFile(
      new URL('../../services/api/src/services/tournament-arena-service.ts', import.meta.url),
      'utf8'
    );
    assert.equal(
      arenaServiceSrc.includes('Math.random('),
      false,
      'tournament-arena-service.ts não pode usar Math.random()'
    );

    const feedSrc = await readFile(
      new URL('../../scripts/dev-live-feed.mjs', import.meta.url),
      'utf8'
    );
    const walletSection = feedSrc.slice(
      feedSrc.indexOf('// Endpoint de Depósito:'),
      feedSrc.indexOf('// Endpoint de Saque:') + 1500
    );
    assert.equal(
      walletSection.includes('Math.random('),
      false,
      'Rotas financeiras em scripts/dev-live-feed.mjs não podem usar Math.random()'
    );
  }
);

test(
  '[Gate T1 | DB-01 & I-04] Persistência durável em PostgreSQL real (0061 + 0062) e recuperação integral pós-restart via hydrateFromDatabase()',
  { timeout: 120_000 },
  async () => {
    const postgres = await createEphemeralPostgres();
    try {
      for (const migration of [
        '0001_initial_schema.sql',
        '0061_arena_blitz_escrow_and_real_wallet.up.sql',
        '0062_arena_trade_orders.up.sql',
      ]) {
        const sql = await readFile(
          new URL(`../../db/migrations/${migration}`, import.meta.url),
          'utf8'
        );
        await postgres.pool.query(sql);
      }
      TournamentArenaService.resetStateForTesting();

    const blnkTransactions = [];
    const mockBlnk = new BlnkClient('http://localhost:5001');
    mockBlnk.recordTransaction = async (payload) => {
      const tx = {
        transaction_id: `blnk_tx_${blnkTransactions.length + 1}`,
        reference: payload.reference,
        amount: payload.amount,
        currency: 'USD',
        precision: 100,
        source: payload.source,
        destination: payload.destination,
        status: 'APPLIED',
        created_at: new Date().toISOString(),
      };
      blnkTransactions.push(tx);
      return tx;
    };

    const service1 = new TournamentArenaService(postgres.pool, undefined, mockBlnk);

    // 1. Criar torneio persistido no PostgreSQL
    const tournament = await service1.createTournament({
      title: 'Torneio Durável Gate T1',
      symbol: 'R_100',
      payoutTier: 'TOP_10',
      buyInMinor: 500,
      rebuyPriceMinor: 300,
      guaranteedPoolMinor: 5_000,
      durationSeconds: 900,
    });

    const dbTourRes = await postgres.pool.query(
      'SELECT id, code, payout_tier, status, buy_in_minor, guaranteed_pool_minor FROM arena_tournaments WHERE id = $1',
      [tournament.id]
    );
    assert.equal(dbTourRes.rowCount, 1, 'Torneio deve ser gravado em arena_tournaments');
    assert.equal(dbTourRes.rows[0].code, tournament.code);

    // 2. Depósito real confirmado + Buy-in + Seeder
    const userId = 'usr_gate_t1_champion';
    const depReq = await service1.requestRealDeposit({
      userId,
      amountMinor: 5_000,
      method: 'PIX',
      idempotencyKey: 'idem_dep_gate_t1_1',
    });
    await service1.confirmRealDeposit({ txId: depReq.transaction.id });

    await service1.seedArenaCompetitors(tournament.id, 12);

    const joinRes = await service1.joinTournament({
      tournamentId: tournament.id,
      userId,
      displayName: 'GateT1_Hero',
      countryCode: 'BR',
      deviceFingerprint: 'fp_gate_t1_hero',
      ipAddress: '198.51.100.77',
      idempotencyKey: 'idem_join_gate_t1_1',
    });
    assert.equal(joinRes.rakeMinor, 150);
    assert.equal(joinRes.escrowMinor, 350);

    // Verifica gravação em arena_participants e arena_ledger_events
    const dbPartRes = await postgres.pool.query(
      'SELECT user_id, current_t_balance_minor, status FROM arena_participants WHERE tournament_id = $1 AND user_id = $2',
      [tournament.id, userId]
    );
    assert.equal(dbPartRes.rowCount, 1, 'Participante humano deve estar em arena_participants');
    assert.equal(Number(dbPartRes.rows[0].current_t_balance_minor), 100_000);

    const dbLedgerRes = await postgres.pool.query(
      "SELECT event_type, gross_amount_minor, rake_amount_minor, escrow_amount_minor FROM arena_ledger_events WHERE tournament_id = $1 AND user_id = $2 AND event_type = 'BUY_IN'",
      [tournament.id, userId]
    );
    assert.equal(dbLedgerRes.rowCount, 1, 'Evento BUY_IN deve estar registrado em arena_ledger_events');
    assert.equal(Number(dbLedgerRes.rows[0].gross_amount_minor), 500);
    assert.equal(Number(dbLedgerRes.rows[0].rake_amount_minor), 150);
    assert.equal(Number(dbLedgerRes.rows[0].escrow_amount_minor), 350);

    // 3. Abrir e liquidar 3 ordens seguidas (Streak 3x) para colocar o jogador em #1
    let simNow = Date.now();
    for (let step = 1; step <= 3; step++) {
      simNow += 6_000;
      const partSnap = service1.getLeaderboardSnapshot(tournament.id, userId).my_position;
      const stake = Math.floor((partSnap.t_balance_minor * 20) / 100);
      const order = await service1.openArenaTrade({
        tournamentId: tournament.id,
        userId,
        symbol: 'R_100',
        direction: 'UP',
        stakeTMinor: stake,
        durationSeconds: 30,
        nowMs: simNow,
      });

      const dbOrderOpen = await postgres.pool.query(
        'SELECT status, stake_t_minor FROM arena_trade_orders WHERE id = $1',
        [order.id]
      );
      assert.equal(dbOrderOpen.rowCount, 1, 'Ordem aberta deve estar em arena_trade_orders');
      assert.equal(dbOrderOpen.rows[0].status, 'OPEN');

      await service1.settleArenaTrade({
        tournamentId: tournament.id,
        tradeId: order.id,
        result: 'WIN',
        payoutPct: 85,
      });

      const dbOrderSettled = await postgres.pool.query(
        'SELECT status, result, base_profit_t_minor, streak_bonus_t_minor FROM arena_trade_orders WHERE id = $1',
        [order.id]
      );
      assert.equal(dbOrderSettled.rows[0].status, 'SETTLED');
      assert.equal(dbOrderSettled.rows[0].result, 'WIN');
      if (step === 3) {
        assert.ok(Number(dbOrderSettled.rows[0].streak_bonus_t_minor) > 0, '3ª vitória deve persistir streak_bonus_t_minor > 0');
      }
    }

    const preRestartLeaderboard = service1.getLeaderboardSnapshot(tournament.id, userId);
    const preRestartBalance = service1.getRealBalanceSnapshot(userId);

    // 4. Simula restart completo do servidor (zera memória RAM) e hidrata do PostgreSQL
    TournamentArenaService.resetStateForTesting();
    assert.equal(service1.getTournament(tournament.id), undefined, 'Memória RAM deve estar vazia após reset');

    const serviceAfterRestart = new TournamentArenaService(postgres.pool, undefined, mockBlnk);
    await serviceAfterRestart.hydrateFromDatabase();

    const postRestartTour = serviceAfterRestart.getTournament(tournament.id);
    assert.ok(postRestartTour, 'Torneio deve ser recuperado do PostgreSQL após hydrateFromDatabase()');
    assert.equal(postRestartTour.current_pool_minor, tournament.current_pool_minor);

    const postRestartLeaderboard = serviceAfterRestart.getLeaderboardSnapshot(tournament.id, userId);
    assert.deepEqual(
      postRestartLeaderboard.my_position,
      preRestartLeaderboard.my_position,
      'Posição e saldo T$ do participante devem ser idênticos após restart'
    );
    assert.equal(
      postRestartLeaderboard.top_entries.length,
      preRestartLeaderboard.top_entries.length
    );

    const postRestartBalance = serviceAfterRestart.getRealBalanceSnapshot(userId);
    assert.deepEqual(
      postRestartBalance,
      preRestartBalance,
      'Saldo real USD (available/reserved/bonus) deve ser preservado após restart'
    );

    // 5. Liquida o torneio na instância pós-restart e verifica persistência de SETTLED e bônus
    const settlement = await serviceAfterRestart.settleArenaTournament(tournament.id);
    assert.equal(settlement.remainingEscrowMinor, 0);
    assert.equal(settlement.tournament.status, 'SETTLED');

    const dbSettledTour = await postgres.pool.query(
      'SELECT status, settled_at, current_pool_minor FROM arena_tournaments WHERE id = $1',
      [tournament.id]
    );
    assert.equal(dbSettledTour.rows[0].status, 'SETTLED');
    assert.ok(dbSettledTour.rows[0].settled_at, 'settled_at deve estar preenchido no banco');

    const dbBonusRes = await postgres.pool.query(
      'SELECT user_id, bonus_amount_minor, required_rollover_minor, status FROM user_bonus_grants WHERE tournament_id = $1 AND user_id = $2',
      [tournament.id, userId]
    );
    assert.equal(dbBonusRes.rowCount, 1, 'Bônus de margem por bater @Alpha_Quant deve estar persistido em user_bonus_grants');
    assert.equal(Number(dbBonusRes.rows[0].bonus_amount_minor), 250);
    assert.equal(Number(dbBonusRes.rows[0].required_rollover_minor), 6_250);
    } finally {
      await postgres.dispose();
    }
  }
);
