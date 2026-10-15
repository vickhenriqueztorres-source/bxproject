/**
 * Subetapa 04.2 (Gate T2) — Oráculo de Liquidação Oficial pelo Tick do Banco (ts >= expires_at)
 * e Blindagem de Segurança RBAC / BOLA nas Rotas da Arena
 * Cobertura:
 * 1. [I-03 / M-03] openArenaTrade grava entry_price e entry_tick_sequence do PostgreSQL (ticks);
 *    settleArenaTrade exige tick oficial ts >= expires_at (409 se ausente) e calcula WIN/LOSS/DRAW
 *    exclusivamente pelo preço oficial do banco, derrotando fraude de cliente que envia { result: "WIN" }.
 * 2. [S-01 / S-02 / S-03]
 *    - /api/v1/arena/tournaments/:id/settle exige autenticação (401 sem usuário autenticado).
 *    - /dev/spawn e /dev/fast-forward bloqueiam execução quando NODE_ENV === 'production' (403).
 *    - Proteção BOLA/IDOR (403 FORBIDDEN_BOLA) em deposit/confirm, withdraw/complete, withdraw/cancel e trades/settle.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import Fastify from '../../services/api/node_modules/fastify/fastify.js';
import {
  assertNotProduction,
  createEphemeralPostgres,
} from '../helpers/chart-durability-postgres.mjs';
import { BlnkClient } from '../../services/wallet-adapter/src/blnk-client.ts';
import { TournamentArenaService } from '../../services/api/src/services/tournament-arena-service.ts';
import { arenaRoutes } from '../../services/api/src/routes/arena.ts';

assertNotProduction();

function createMockBlnk() {
  const mockBlnk = new BlnkClient('http://localhost:5001');
  let seq = 0;
  mockBlnk.recordTransaction = async (payload) => ({
    transaction_id: `blnk_t2_${++seq}`,
    reference: payload.reference,
    amount: payload.amount,
    currency: 'USD',
    precision: 100,
    source: payload.source,
    destination: payload.destination,
    status: 'APPLIED',
    created_at: new Date().toISOString(),
  });
  return mockBlnk;
}

test(
  '[Gate T2 | I-03 & M-03] Liquidação oficial pelo primeiro tick ts >= expires_at no PostgreSQL derrota fraude de cliente enviando { result: "WIN" }',
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
      let currentUser = { id: 'usr_trader_t2_1', name: 'TraderT2', role: 'TRADER' };

      const app = Fastify();
      app.decorate('pg', postgres.pool);
      app.decorate('blnkClient', createMockBlnk());
      app.decorate('authenticate', async (req, reply) => {
        if (!currentUser) {
          return reply.status(401).send({ error: 'UNAUTHORIZED' });
        }
        req.user = currentUser;
      });
      await app.register(arenaRoutes);
      await app.ready();

      try {
        // 1. Insere ativo VOL_100 e tick oficial #1 com preço 1000.000000
        await postgres.pool.query(
          `INSERT INTO indices (symbol, name, base_price, volatility, mean_reversion_speed)
           VALUES ('VOL_100', 'Volatility 100 Index', 1000.000000, 0.250000, 0.150000)
           ON CONFLICT (symbol) DO NOTHING`
        );
        await postgres.pool.query(`DELETE FROM ticks WHERE symbol = 'VOL_100'`);
        const t0 = new Date(Date.now() - 2_000);
        await postgres.pool.query(
          `INSERT INTO ticks (symbol, sequence, price, prev_hash, hash, ts)
           VALUES ('VOL_100', 1, 1000.000000, 'GENESIS', 'hash_seq_1', $1)`,
          [t0]
        );

        // 2. Cria torneio e inscreve usr_trader_t2_1
        const spawnRes = await app.inject({
          method: 'POST',
          url: '/api/v1/arena/tournaments/dev/spawn',
          payload: {
            title: 'Gate T2 Official Tick Arena',
            symbol: 'VOL_100',
            payout_tier: 'TOP_10',
            buy_in_minor: 500,
            seed_count: 5,
          },
        });
        assert.equal(spawnRes.statusCode, 201);
        const tournamentId = spawnRes.json().tournament.id;

        const depRes = await app.inject({
          method: 'POST',
          url: '/api/v1/wallet/real/deposit',
          headers: { 'idempotency-key': 'idem_t2_dep_1' },
          payload: { amount_minor: 2000, method: 'PIX' },
        });
        await app.inject({
          method: 'POST',
          url: '/api/v1/wallet/real/deposit/confirm',
          payload: { tx_id: depRes.json().transaction.id },
        });

        const joinRes = await app.inject({
          method: 'POST',
          url: `/api/v1/arena/tournaments/${tournamentId}/join`,
          headers: { 'idempotency-key': 'idem_t2_join_1' },
          payload: { display_name: 'TraderT2', device_fingerprint: 'fp_t2_1' },
        });
        assert.equal(joinRes.statusCode, 201);

        // 3. Abre ordem UP de T$ 100,00 (10_000 minor units) com duração de 30s
        const openRes = await app.inject({
          method: 'POST',
          url: `/api/v1/arena/tournaments/${tournamentId}/trades`,
          payload: {
            symbol: 'VOL_100',
            direction: 'UP',
            stake_t_minor: 10_000,
            duration_seconds: 30,
          },
        });
        assert.equal(openRes.statusCode, 201);
        const order = openRes.json().order;
        assert.equal(Number(order.entry_price), 1000, 'entry_price deve vir do tick oficial #1');
        assert.equal(Number(order.entry_tick_sequence), 1, 'entry_tick_sequence deve ser 1');

        // 4. Tenta liquidar antes de existir tick oficial ts >= expires_at -> deve retornar 409
        const earlySettle = await app.inject({
          method: 'POST',
          url: `/api/v1/arena/tournaments/${tournamentId}/trades/${order.id}/settle`,
          payload: { result: 'WIN' },
        });
        assert.equal(
          earlySettle.statusCode,
          409,
          'Não pode liquidar ordem da Arena sem tick oficial ts >= expires_at'
        );

        // 5. Insere tick oficial #2 em ts = expires_at + 250ms com preço 992.500000 (queda -> ordem UP perdeu!)
        const settleTickTs = new Date(new Date(order.expires_at).getTime() + 250);
        await postgres.pool.query(
          `INSERT INTO ticks (symbol, sequence, price, prev_hash, hash, ts)
           VALUES ('VOL_100', 2, 992.500000, 'hash_seq_1', 'hash_seq_2', $1)`,
          [settleTickTs]
        );

        // 6. Cliente malicioso envia { result: "WIN" }, mas backend deve liquidar como LOSS pelo tick #2!
        const officialSettle = await app.inject({
          method: 'POST',
          url: `/api/v1/arena/tournaments/${tournamentId}/trades/${order.id}/settle`,
          payload: { result: 'WIN' },
        });
        assert.equal(officialSettle.statusCode, 200);
        const settledBody = officialSettle.json();
        assert.equal(
          settledBody.order.result,
          'LOSS',
          'Backend deve ignorar result="WIN" do cliente e liquidar como LOSS pelo tick oficial'
        );
        assert.equal(Number(settledBody.order.exit_price), 992.5);
        assert.equal(Number(settledBody.order.exit_tick_sequence), 2);
        assert.equal(settledBody.baseProfitMinor, 0);
        assert.equal(settledBody.participant.current_t_balance_minor, 90_000);
      } finally {
        await app.close();
      }
    } finally {
      await postgres.dispose();
    }
  }
);

test(
  '[Gate T2 | S-01, S-02 & S-03] Blindagem de autenticação em /settle, bloqueio de /dev/* em produção e proteção BOLA/IDOR entre usuários',
  async () => {
    TournamentArenaService.resetStateForTesting();
    let currentUser = { id: 'usr_alice', name: 'Alice', role: 'TRADER' };

    const app = Fastify();
    app.decorate('blnkClient', createMockBlnk());
    app.decorate('authenticate', async (req, reply) => {
      if (!currentUser) {
        return reply.status(401).send({ error: 'UNAUTHORIZED' });
      }
      req.user = currentUser;
    });
    await app.register(arenaRoutes);
    await app.ready();

    try {
      // 1. Cria depósito e saque de Alice
      const depAlice = await app.inject({
        method: 'POST',
        url: '/api/v1/wallet/real/deposit',
        headers: { 'idempotency-key': 'idem_alice_dep_1' },
        payload: { amount_minor: 5_000, method: 'PIX' },
      });
      const aliceDepTxId = depAlice.json().transaction.id;

      // 2. Bob tenta confirmar o depósito de Alice (BOLA) -> 403 FORBIDDEN_BOLA
      currentUser = { id: 'usr_bob_attacker', name: 'Bob', role: 'TRADER' };
      const bolaConfirm = await app.inject({
        method: 'POST',
        url: '/api/v1/wallet/real/deposit/confirm',
        payload: { tx_id: aliceDepTxId },
      });
      assert.equal(bolaConfirm.statusCode, 403, 'Bob não pode confirmar depósito de Alice (BOLA)');

      // Alice confirma o próprio depósito e solicita um saque
      currentUser = { id: 'usr_alice', name: 'Alice', role: 'TRADER' };
      await app.inject({
        method: 'POST',
        url: '/api/v1/wallet/real/deposit/confirm',
        payload: { tx_id: aliceDepTxId },
      });
      const wdrAlice = await app.inject({
        method: 'POST',
        url: '/api/v1/wallet/real/withdraw',
        headers: { 'idempotency-key': 'idem_alice_wdr_1' },
        payload: { amount_minor: 1_000, method: 'PIX', destination_account: 'pix_alice' },
      });
      const aliceWdrTxId = wdrAlice.json().transaction.id;

      // 3. Bob tenta cancelar ou completar o saque de Alice (BOLA) -> 403 FORBIDDEN_BOLA
      currentUser = { id: 'usr_bob_attacker', name: 'Bob', role: 'TRADER' };
      const bolaCancel = await app.inject({
        method: 'POST',
        url: `/api/v1/wallet/real/withdraw/${aliceWdrTxId}/cancel`,
      });
      assert.equal(bolaCancel.statusCode, 403, 'Bob não pode cancelar saque de Alice (BOLA)');

      const bolaComplete = await app.inject({
        method: 'POST',
        url: `/api/v1/wallet/real/withdraw/${aliceWdrTxId}/complete`,
      });
      assert.equal(bolaComplete.statusCode, 403, 'Bob não pode completar saque de Alice (BOLA)');

      // 4. Cria torneio, Alice entra e abre trade; Bob tenta liquidar o trade de Alice (BOLA) -> 403
      currentUser = { id: 'usr_alice', name: 'Alice', role: 'TRADER' };
      const spawnRes = await app.inject({
        method: 'POST',
        url: '/api/v1/arena/tournaments/dev/spawn',
        payload: { title: 'BOLA Test Arena', symbol: 'R_100', seed_count: 3 },
      });
      const tournamentId = spawnRes.json().tournament.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/arena/tournaments/${tournamentId}/join`,
        headers: { 'idempotency-key': 'idem_alice_join' },
        payload: { display_name: 'Alice', device_fingerprint: 'fp_alice' },
      });
      const tradeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/arena/tournaments/${tournamentId}/trades`,
        payload: { symbol: 'R_100', direction: 'UP', stake_t_minor: 5_000, duration_seconds: 30 },
      });
      const aliceTradeId = tradeRes.json().order.id;

      currentUser = { id: 'usr_bob_attacker', name: 'Bob', role: 'TRADER' };
      const bolaTradeSettle = await app.inject({
        method: 'POST',
        url: `/api/v1/arena/tournaments/${tournamentId}/trades/${aliceTradeId}/settle`,
        payload: { result: 'LOSS' },
      });
      assert.equal(bolaTradeSettle.statusCode, 403, 'Bob não pode liquidar ordem de Alice (BOLA)');

      // 5. /api/v1/arena/tournaments/:id/settle sem autenticação -> 401 UNAUTHORIZED
      currentUser = null;
      const unauthSettle = await app.inject({
        method: 'POST',
        url: `/api/v1/arena/tournaments/${tournamentId}/settle`,
      });
      assert.equal(
        unauthSettle.statusCode,
        401,
        '/api/v1/arena/tournaments/:id/settle deve exigir autenticação'
      );

      // 6. /dev/spawn e /dev/fast-forward bloqueados quando NODE_ENV === 'production' -> 403
      currentUser = { id: 'usr_alice', name: 'Alice', role: 'TRADER' };
      const prevNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const prodSpawn = await app.inject({
          method: 'POST',
          url: '/api/v1/arena/tournaments/dev/spawn',
          payload: { title: 'Prod Spawn Forbidden' },
        });
        assert.equal(prodSpawn.statusCode, 403, '/dev/spawn deve retornar 403 em produção');

        const prodFf = await app.inject({
          method: 'POST',
          url: `/api/v1/arena/tournaments/${tournamentId}/dev/fast-forward`,
          payload: { remaining_seconds: 10 },
        });
        assert.equal(prodFf.statusCode, 403, '/dev/fast-forward deve retornar 403 em produção');
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
      }
    } finally {
      await app.close();
    }
  }
);
