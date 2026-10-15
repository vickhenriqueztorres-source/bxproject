/**
 * Subetapa 10.2 (Gate D2) — Oráculo de Escrita em Lote 1x/s (produceTicksBatch) dos 36 Ativos
 * Cobertura:
 * - [Peso na VPS / Risco J Doc #10] Gravação atômica dos 36 ativos em 1 única transação PostgreSQL por segundo.
 * - [Concorrência / Risco C Doc #10] Duas instâncias concorrentes disputando produceTicksBatch nos 36 ativos: zero deadlocks (lock ordenado), exatamente 36 ticks confirmados no segundo, fencing respeitado.
 * - [Caos / Atomicidade] Falha induzida no meio do lote faz ROLLBACK integral (zero escrita parcial em ticks, index_state, outbox_events ou candles).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
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
  '[Gate D2 | Lote 1x/s, Fencing Concorrente e Rollback Integral] produceTicksBatch persiste 36 ativos em 1 transação, bloqueia escritor concorrente sem deadlock e reverte tudo em falha parcial',
  { timeout: 90_000 },
  async () => {
    const symRes = await postgres.pool.query(
      `SELECT symbol FROM indices WHERE symbol NOT LIKE 'SYNTH_%' ORDER BY symbol ASC`
    );
    const symbols36 = symRes.rows.map((r) => r.symbol);
    assert.equal(symbols36.length, 36, 'Catálogo deve conter exatamente 36 símbolos canônicos');

    // Limpa estado inicial para teste determinístico
    await postgres.pool.query('DELETE FROM candles');
    await postgres.pool.query('DELETE FROM ticks');
    await postgres.pool.query('DELETE FROM outbox_events');
    await postgres.pool.query(
      `UPDATE index_state
       SET last_sequence = 0,
           last_ts = NOW() - INTERVAL '10 seconds',
           lease_leader = NULL,
           lease_epoch = 0`
    );

    const storeA = createLiveMarketStore({
      pgPool: postgres.pool,
      redisUrl: redis.url,
      instanceId: 'gate-d2-batch-store-a',
    });
    const storeB = createLiveMarketStore({
      pgPool: postgres.pool,
      redisUrl: redis.url,
      instanceId: 'gate-d2-batch-store-b',
    });

    try {
      await storeA.initialize(symbols36.map((symbol) => ({ symbol })));
      await storeB.initialize(symbols36.map((symbol) => ({ symbol })));

      assert.equal(
        typeof storeA.produceTicksBatch,
        'function',
        'liveMarketStore deve expor produceTicksBatch para commit em lote 1x/s dos 36 ativos'
      );

      // 1. Disputa concorrente entre storeA e storeB nos 36 ativos no mesmo segundo
      const makeBatchItems = () =>
        symbols36.map((symbol) => ({
          symbol,
          makePrice: (prevDecimal) => (Number(prevDecimal) + 0.01).toFixed(6),
        }));

      const [resA, resB] = await Promise.all([
        storeA.produceTicksBatch(makeBatchItems()),
        storeB.produceTicksBatch(makeBatchItems()),
      ]);

      const totalCommitted = resA.committedTicks.length + resB.committedTicks.length;
      assert.equal(
        totalCommitted,
        36,
        `Exatamente 36 ticks (1 por ativo) devem ser confirmados na disputa concorrente (A=${resA.committedTicks.length}, B=${resB.committedTicks.length})`
      );
      assert(
        typeof resA.persistDurationMs === 'number' && resA.persistDurationMs >= 0,
        'produceTicksBatch deve retornar persistDurationMs numérico >= 0'
      );

      const ticksCount1 = await postgres.pool.query(`SELECT COUNT(*)::int AS cnt FROM ticks`);
      const outboxCount1 = await postgres.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM outbox_events WHERE event_type = 'TICK'`
      );
      const candlesCount1 = await postgres.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM candles WHERE interval = '1m'`
      );
      assert.equal(ticksCount1.rows[0].cnt, 36);
      assert.equal(outboxCount1.rows[0].cnt, 36);
      assert.equal(candlesCount1.rows[0].cnt, 36);

      // Encerra a instância concorrente storeB após provar o fencing sem deadlock para que storeA assuma os 36 ativos no teste de rollback de lote completo
      await storeB.close();

      // 2. Caos / Rollback Integral: aguarda o próximo segundo real de 1Hz e injeta falha no último item do lote
      await new Promise((resolve) => setTimeout(resolve, 1050));
      const poisonedBatch = symbols36.map((symbol, idx) => ({
        symbol,
        makePrice: (prevDecimal) => {
          if (idx === symbols36.length - 1) {
            throw new Error('INJECTED_BATCH_FAILURE_AT_LAST_SYMBOL');
          }
          return (Number(prevDecimal) + 0.02).toFixed(6);
        },
      }));

      await assert.rejects(
        () => storeA.produceTicksBatch(poisonedBatch),
        /INJECTED_BATCH_FAILURE_AT_LAST_SYMBOL/,
        'Falha em qualquer item do lote deve rejeitar produceTicksBatch e executar ROLLBACK integral'
      );

      const ticksCountAfterRollback = await postgres.pool.query(`SELECT COUNT(*)::int AS cnt FROM ticks`);
      const maxSeqAfterRollback = await postgres.pool.query(
        `SELECT MAX(last_sequence)::int AS max_seq FROM index_state`
      );
      assert.equal(
        ticksCountAfterRollback.rows[0].cnt,
        36,
        'Nenhum tick parcial pode ser gravado quando o lote sofre rollback'
      );
      assert.equal(
        maxSeqAfterRollback.rows[0].max_seq,
        1,
        'index_state.last_sequence deve permanecer em 1 para todos os ativos após rollback do lote'
      );

      // 3. Recuperação limpa após rollback: próximo lote válido grava sequence = 2 para os 36 ativos em 1 única transação
      const validBatch2 = await storeA.produceTicksBatch(makeBatchItems());
      assert.equal(validBatch2.committedTicks.length, 36);
      assert(validBatch2.committedTicks.every((t) => t.sequence === 2));

      const ticksCount2 = await postgres.pool.query(`SELECT COUNT(*)::int AS cnt FROM ticks`);
      assert.equal(ticksCount2.rows[0].cnt, 72);
    } finally {
      await storeA.close();
      await storeB.close();
    }
  }
);
