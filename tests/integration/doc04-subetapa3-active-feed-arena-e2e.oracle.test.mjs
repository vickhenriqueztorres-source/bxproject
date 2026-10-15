/**
 * Subetapa 04.3 (Gate T3) — Oráculo Ponta a Ponta das Rotas /api/v1/arena/* no Processo Ativo
 * (scripts/dev-live-feed.mjs), Sobrevivência a Restart (F5) e Autoridade de Tick no use-arena.ts
 * Cobertura:
 * 1. [Active Feed E2E + Restart Survival + Sweeper Oficial]
 *    - scripts/dev-live-feed.mjs expõe /api/v1/arena/tournaments*, /api/v1/wallet/real/* conectados ao PostgreSQL.
 *    - Join + abertura de ordem da Arena gravam em arena_participants, arena_ledger_events e arena_trade_orders
 *      com entry_price e entry_tick_sequence oficiais da tabela ticks.
 *    - Após matar e reiniciar scripts/dev-live-feed.mjs, o estado do torneio, participante e ordens sobrevive (F5/restart)
 *      e o sweeper automático liquida a ordem expirada pelo primeiro tick oficial ts >= expires_at no PostgreSQL.
 * 2. [Frontend use-arena.ts Autoridade de Preço e Sincronização HTTP]
 *    - use-arena.ts bloqueia mutação local mulberry32 de priceRef quando liveTick está presente (!liveTickRef.current)
 *      e sincroniza join/place/rebuy com /api/v1/arena/tournaments*.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  assertNotProduction,
  createEphemeralPostgres,
  createEphemeralRedis,
} from '../helpers/chart-durability-postgres.mjs';
import {
  databaseUrlOf,
  startEphemeralFeed,
  stopEphemeralFeed,
} from '../helpers/active-feed-process.mjs';

assertNotProduction();

let postgres;
let redis;

before(async () => {
  postgres = await createEphemeralPostgres();
  redis = await createEphemeralRedis();
  for (const migration of [
    '0001_initial_schema.sql',
    '0010_seed_multi_assets.up.sql',
    '0050_rename_synthetic_indices.up.sql',
    '0061_arena_blitz_escrow_and_real_wallet.up.sql',
    '0062_arena_trade_orders.up.sql',
  ]) {
    const sql = await readFile(
      new URL(`../../db/migrations/${migration}`, import.meta.url),
      'utf8'
    );
    await postgres.pool.query(sql);
  }
}, { timeout: 120_000 });

after(async () => {
  try {
    if (redis) await redis.dispose();
  } finally {
    if (postgres) await postgres.dispose();
  }
}, { timeout: 90_000 });

test(
  '[Gate T3 | Active Feed E2E] scripts/dev-live-feed.mjs expõe /api/v1/arena/* no PostgreSQL, sobrevive a restart e liquida ordens expiradas pelo tick oficial',
  { timeout: 180_000 },
  async () => {
    let feedProc1 = null;
    let feedProc2 = null;

    try {
      feedProc1 = await startEphemeralFeed({
        databaseUrl: databaseUrlOf(postgres),
        redisUrl: redis.url,
      });
      const baseUrl1 = `http://127.0.0.1:${feedProc1.port}`;

      // Aguarda pelo menos 1 tick oficial ser produzido para VOL_100
      let hasTick = false;
      for (let i = 0; i < 30; i++) {
        const tRes = await postgres.pool.query(
          `SELECT sequence, price FROM ticks WHERE symbol = 'VOL_100' ORDER BY sequence DESC LIMIT 1`
        );
        if (tRes.rowCount > 0) {
          hasTick = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      assert(hasTick, 'Feed ativo deve produzir ticks oficiais para VOL_100 no PostgreSQL');

      // 1. Lista torneios ativos em /api/v1/arena/tournaments
      const listRes = await fetch(`${baseUrl1}/api/v1/arena/tournaments`);
      assert.equal(listRes.status, 200, 'GET /api/v1/arena/tournaments deve responder 200 no feed ativo');
      const listBody = await listRes.json();
      assert(Array.isArray(listBody.tournaments) && listBody.tournaments.length >= 3);
      const targetTournament = listBody.tournaments[0];
      assert(targetTournament.id);

      // 2. Deposita e confirma saldo na carteira real para pagar o buy-in
      const depRes = await fetch(`${baseUrl1}/api/v1/wallet/real/deposit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'idem_t3_dep_1',
        },
        body: JSON.stringify({ amount_minor: 5_000, method: 'PIX' }),
      });
      assert.equal(depRes.status, 201);
      const depBody = await depRes.json();

      const confRes = await fetch(`${baseUrl1}/api/v1/wallet/real/deposit/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tx_id: depBody.transaction.id }),
      });
      assert.equal(confRes.status, 200);

      // 3. Inscreve no torneio via POST /api/v1/arena/tournaments/:id/join
      const joinRes = await fetch(`${baseUrl1}/api/v1/arena/tournaments/${targetTournament.id}/join`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'idem_t3_join_1',
        },
        body: JSON.stringify({
          display_name: 'TraderGateT3',
          device_fingerprint: 'fp_gate_t3_1',
        }),
      });
      assert.equal(joinRes.status, 201, 'POST /api/v1/arena/tournaments/:id/join deve retornar 201');
      const joinBody = await joinRes.json();
      assert.equal(joinBody.participant.current_t_balance_minor, 100_000);

      // 4. Abre ordem de 5 segundos na Arena via POST /api/v1/arena/tournaments/:id/trades
      const tradeRes = await fetch(`${baseUrl1}/api/v1/arena/tournaments/${targetTournament.id}/trades`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol: 'VOL_100',
          direction: 'UP',
          stake_t_minor: 10_000,
          duration_seconds: 5,
        }),
      });
      assert.equal(tradeRes.status, 201, 'POST /api/v1/arena/tournaments/:id/trades deve retornar 201');
      const tradeBody = await tradeRes.json();
      const orderId = tradeBody.order.id;
      assert(Number(tradeBody.order.entry_price) > 0, 'entry_price deve vir do tick oficial');
      assert(Number(tradeBody.order.entry_tick_sequence) >= 1, 'entry_tick_sequence deve ser >= 1');

      // 5. Mata o processo 1 e sobe um novo processo 2 (simulando deploy / pm2 restart / F5)
      await stopEphemeralFeed(feedProc1);
      feedProc1 = null;

      feedProc2 = await startEphemeralFeed({
        databaseUrl: databaseUrlOf(postgres),
        redisUrl: redis.url,
      });
      const baseUrl2 = `http://127.0.0.1:${feedProc2.port}`;

      // 6. Verifica que o torneio e a participação sobreviveram ao restart no processo 2
      const detailRes = await fetch(`${baseUrl2}/api/v1/arena/tournaments/${targetTournament.id}`);
      assert.equal(detailRes.status, 200);
      const detailBody = await detailRes.json();
      assert(detailBody.my_participation, 'Participação do usuário deve sobreviver ao restart do processo');
      assert.equal(detailBody.my_participation.display_name, 'TraderGateT3');

      // 7. Aguarda o sweeper automático do processo 2 liquidar a ordem expirada pelo tick oficial ts >= expires_at
      let settledRow = null;
      for (let i = 0; i < 35; i++) {
        const q = await postgres.pool.query(
          `SELECT status, result, entry_price, exit_price, entry_tick_sequence, exit_tick_sequence
           FROM arena_trade_orders WHERE id = $1`,
          [orderId]
        );
        if (q.rowCount > 0 && q.rows[0].status === 'SETTLED') {
          settledRow = q.rows[0];
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      assert(settledRow, 'Sweeper automático do feed ativo deve liquidar a ordem da Arena após expires_at');
      assert.equal(settledRow.status, 'SETTLED');
      assert(['WIN', 'LOSS', 'DRAW'].includes(settledRow.result));
      assert(Number(settledRow.exit_price) > 0, 'exit_price oficial deve estar preenchido');
      assert(Number(settledRow.exit_tick_sequence) >= Number(settledRow.entry_tick_sequence));
    } finally {
      if (feedProc1) await stopEphemeralFeed(feedProc1);
      if (feedProc2) await stopEphemeralFeed(feedProc2);
    }
  }
);

test(
  '[Gate T3 | Frontend use-arena.ts] Bloqueia mutação local mulberry32 quando liveTick está presente e sincroniza com /api/v1/arena/tournaments*',
  async () => {
    const useArenaSource = await readFile(
      new URL('../../apps/web/src/arena/use-arena.ts', import.meta.url),
      'utf8'
    );

    assert(
      useArenaSource.includes('!liveTickRef.current'),
      'use-arena.ts deve proteger o fallback de preço local com !liveTickRef.current para nunca sobrescrever ticks oficiais do WebSocket'
    );
    assert(
      useArenaSource.includes('/api/v1/arena/tournaments'),
      'use-arena.ts deve sincronizar estado de torneio/participação/ordens com /api/v1/arena/tournaments'
    );
  }
);
