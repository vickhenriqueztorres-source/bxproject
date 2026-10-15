/**
 * Subetapa 10.1 (Gate D1) — Oráculo de Retenção Segura e Limpeza em Lotes (PostgreSQL 16 + Redis 7 Efêmeros)
 * Cobertura:
 * - [Risco A Doc #10] Limpeza em lotes limitados (SKIP LOCKED) de outbox_events ('TICK') e ticks expirados.
 * - [Invariante M-04 / checkHead] O tick cabeça (sequence = index_state.last_sequence) de cada ativo NUNCA é removido.
 * - [Invariante I-04 / M-03] Eventos financeiros PENDING/FAILED (RESERVE_STAKE, CONTRACT_SETTLED) e ticks de contratos OPEN ou referenciados por exit_tick_sequence NUNCA são removidos.
 * - [Invariante M-05] Velas de 1m em candles permanecem 100% permanentes após o expurgo de ticks.
 * - [Concorrência / Caos] pruneMarketStorage rodando simultaneamente com produceTick sem bloquear nem quebrar a hash chain.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { canonicalHash, genesisHash } from '../../services/tick-engine/core.mjs';
import { createLiveMarketStore } from '../../services/tick-engine/live-market-store.mjs';
import {
  assertNotProduction,
  createEphemeralPostgres,
  createEphemeralRedis,
} from '../helpers/chart-durability-postgres.mjs';

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
  ]) {
    await postgres.pool.query(
      await readFile(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8')
    );
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
  '[Gate D1 | Risco A & Invariantes] pruneMarketStorage limpa ticks e outbox TICK expirados em lotes preservando head tick, contratos OPEN/SETTLED, outbox financeiro PENDING e velas 1m',
  { timeout: 90_000 },
  async () => {
    const symbol = 'VOL_10';
    await postgres.pool.query('DELETE FROM contracts WHERE symbol = $1', [symbol]);
    await postgres.pool.query('DELETE FROM candles WHERE symbol = $1', [symbol]);
    await postgres.pool.query('DELETE FROM ticks WHERE symbol = $1', [symbol]);
    await postgres.pool.query('DELETE FROM outbox_events');

    // Insere cadeia de 6 ticks:
    // seq 1..4: há 40 dias (expirados para retenção de 30 dias, mas seq 2 é exit_tick_sequence de um contrato SETTLED e seq 4 cobre contrato OPEN)
    // seq 5: há 40 dias (expirado, sem vínculo)
    // seq 6: há 40 dias, mas é o HEAD (last_sequence = 6) -> NUNCA pode ser removido!
    const fortyDaysAgoMs = Date.now() - 40 * 24 * 3600 * 1000;
    let prevHash = genesisHash(symbol);
    for (let seq = 1; seq <= 6; seq++) {
      const ts = new Date(fortyDaysAgoMs + seq * 1000).toISOString();
      const price = (100 + seq * 0.5).toFixed(6);
      const hash = canonicalHash(prevHash, symbol, seq, ts, price);
      await postgres.pool.query(
        `INSERT INTO ticks (symbol, sequence, price, ts, prev_hash, hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $4)`,
        [symbol, seq, price, ts, prevHash, hash]
      );
      await postgres.pool.query(
        `INSERT INTO outbox_events (event_type, payload, status, created_at)
         VALUES ('TICK', $1::jsonb, 'PENDING', $2)`,
        [JSON.stringify({ symbol, sequence: seq, price, ts, prev_hash: prevHash, hash }), ts]
      );
      prevHash = hash;
      if (seq === 6) {
        await postgres.pool.query(
          `UPDATE index_state
           SET last_sequence = $2, last_price = $3, last_hash = $4, last_ts = $5, updated_at = NOW()
           WHERE symbol = $1`,
          [symbol, seq, price, prevHash, ts]
        );
      }
    }

    // Insere eventos financeiros em outbox_events (antigos mas PENDING/FAILED -> NUNCA podem ser apagados!)
    const pendingReserveId = randomUUID();
    const failedSettleId = randomUUID();
    await postgres.pool.query(
      `INSERT INTO outbox_events (id, event_type, payload, status, created_at)
       VALUES
         ($1, 'RESERVE_STAKE', '{"contract_id":"c1"}'::jsonb, 'PENDING', NOW() - INTERVAL '45 days'),
         ($2, 'CONTRACT_SETTLED', '{"contract_id":"c2"}'::jsonb, 'FAILED', NOW() - INTERVAL '45 days')`,
      [pendingReserveId, failedSettleId]
    );

    // Contrato SETTLED referenciando exit_tick_sequence = 2
    await postgres.pool.query(
      `INSERT INTO contracts (id, user_id, symbol, direction, status, result, stake_minor, payout_minor, entry_price, exit_price, exit_tick_sequence, idempotency_key, opened_at, expires_at, settled_at)
       VALUES ($1, $2, $3, 'UP', 'SETTLED', 'WIN', 1000, 1850, 100.500000, 101.000000, 2, $4, $5, $6, $6)`,
      [
        randomUUID(),
        '00000000-0000-4000-8000-000000000001',
        symbol,
        'idem-settled-seq2',
        new Date(fortyDaysAgoMs + 1000).toISOString(),
        new Date(fortyDaysAgoMs + 2000).toISOString(),
      ]
    );

    // Contrato OPEN aberto em fortyDaysAgoMs + 3500ms -> protege ticks com ts >= opened_at (seq 4, 5, 6)
    const openContractId = randomUUID();
    await postgres.pool.query(
      `INSERT INTO contracts (id, user_id, symbol, direction, status, stake_minor, entry_price, idempotency_key, opened_at, expires_at)
       VALUES ($1, $2, $3, 'UP', 'OPEN', 1000, 102.000000, $4, $5, $6)`,
      [
        openContractId,
        '00000000-0000-4000-8000-000000000001',
        symbol,
        'idem-open-seq4',
        new Date(fortyDaysAgoMs + 3500).toISOString(),
        new Date(fortyDaysAgoMs + 65000).toISOString(),
      ]
    );

    const store = createLiveMarketStore({
      pgPool: postgres.pool,
      redisUrl: redis.url,
      instanceId: 'gate-d1-retention-oracle',
    });

    try {
      await store.initialize([{ symbol }]);
      assert.equal(
        typeof store.pruneMarketStorage,
        'function',
        'liveMarketStore deve expor pruneMarketStorage para retenção segura de disco'
      );

      await store.rebuildCandles(symbol, { interval: '1m' });
      const candlesBefore = await store.loadCandles(symbol, 100);
      assert.equal(candlesBefore.length, 1, 'Deve existir 1 vela de 1m antes do expurgo');

      // Executa expurgo com retenção de 30 dias para ticks e 24h para outbox TICK
      const pruneResult = await store.pruneMarketStorage({
        tickRetentionMs: 30 * 24 * 3600 * 1000,
        outboxRetentionMs: 24 * 3600 * 1000,
        batchLimit: 100,
      });

      assert.equal(pruneResult.prunedOutboxCount, 6, 'Os 6 outbox_events do tipo TICK com > 24h devem ser expurgados');
      // Ticks:
      // seq 1 (sem contrato): expurgado
      // seq 2 (referenciado por exit_tick_sequence = 2): preservado
      // seq 3 (anterior ao opened_at do contrato OPEN): expurgado
      // seq 4, 5, 6 (ts >= opened_at do contrato OPEN, sendo seq 6 também o head): preservados!
      assert.equal(pruneResult.prunedTicksCount, 2, 'Apenas os ticks órfãos seq 1 e seq 3 devem ser expurgados');

      const remainingTicks = await postgres.pool.query(
        `SELECT sequence FROM ticks WHERE symbol = $1 ORDER BY sequence ASC`,
        [symbol]
      );
      assert.deepEqual(
        remainingTicks.rows.map((r) => Number(r.sequence)),
        [2, 4, 5, 6],
        'Ticks 2 (exit_tick_sequence), 4..5 (contrato OPEN) e 6 (head) devem permanecer intactos'
      );

      // Fecha o contrato OPEN e executa novo expurgo: agora seq 4 e 5 podem sair, mas seq 2 (exit_tick_sequence) e seq 6 (head) continuam protegidos!
      await postgres.pool.query(`UPDATE contracts SET status = 'CANCELLED' WHERE id = $1`, [openContractId]);
      const secondPrune = await store.pruneMarketStorage({
        tickRetentionMs: 30 * 24 * 3600 * 1000,
        outboxRetentionMs: 24 * 3600 * 1000,
        batchLimit: 100,
      });
      assert.equal(secondPrune.prunedTicksCount, 2, 'Após encerramento do contrato OPEN, seq 4 e seq 5 devem ser expurgados');

      const finalTicks = await postgres.pool.query(
        `SELECT sequence FROM ticks WHERE symbol = $1 ORDER BY sequence ASC`,
        [symbol]
      );
      assert.deepEqual(
        finalTicks.rows.map((r) => Number(r.sequence)),
        [2, 6],
        'Tick 2 (auditoria de liquidação) e Tick 6 (head last_sequence) nunca podem ser apagados'
      );

      // Verifica que eventos financeiros PENDING/FAILED continuam 100% preservados
      const finOutbox = await postgres.pool.query(
        `SELECT id, event_type, status FROM outbox_events WHERE id IN ($1, $2) ORDER BY event_type ASC`,
        [pendingReserveId, failedSettleId]
      );
      assert.equal(finOutbox.rowCount, 2, 'Eventos financeiros PENDING/FAILED jamais podem ser removidos pelo expurgo');

      // Verifica que as velas de 1m permanecem 100% intactas (M-05)
      const candlesAfter = await store.loadCandles(symbol, 100);
      assert.deepEqual(candlesAfter, candlesBefore, 'Velas de 1m devem permanecer permanentes após expurgo de ticks antigos');

      // Verifica que produceTick e pruneMarketStorage concorrentes funcionam sem quebrar checkHead
      const [produced] = await Promise.all([
        store.produceTick(symbol, (prev) => (Number(prev) + 0.125).toFixed(6)),
        store.pruneMarketStorage({
          tickRetentionMs: 30 * 24 * 3600 * 1000,
          outboxRetentionMs: 24 * 3600 * 1000,
          batchLimit: 100,
        }),
      ]);
      assert.ok(produced, 'produceTick deve continuar gerando normalmente após expurgo de ticks antigos');
      assert.equal(produced.sequence, 7, 'Próximo tick deve ser sequence 7 encadeado no head 6');
    } finally {
      await store.close();
    }
  }
);
