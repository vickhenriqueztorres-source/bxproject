/**
 * Subetapa 10.3 (Gate D3) — Oráculo de Auditoria Automática (Hash-Chain, Velas 1m, Liquidação) e Métricas Prometheus
 * Cobertura:
 * - [Critério de Aceite Doc #10] Recalcular hash-chain, velas 1m de ticks e liquidação dos contratos SETTLED dá diff = 0.
 * - [Caos / Detecção de Corrupção] Injeção de divergência em candles, ticks.hash e contracts.payout_minor detectada imediatamente (ok = false) e restaurada para ok = true.
 * - [Observabilidade Doc #10] /metrics expõe tick_persist_ms, tick_persist_p99_ms, tick_persist_queue_depth, tick_dropped_total, outbox_pending_total e market_audit_diffs_total; /api/v1/audit/market-integrity responde HTTP 200.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createLiveMarketStore } from '../../services/tick-engine/live-market-store.mjs';
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
  '[Gate D3 | Auditoria Automática e Métricas Prometheus] verifyMarketAuditIntegrity valida hash-chain, velas 1m e liquidação, detecta adulterações e expõe métricas em /metrics e /api/v1/audit/market-integrity',
  { timeout: 180_000 },
  async () => {
    let feedProc = null;
    const symbols = ['VOL_10', 'VOL_25'];

    const store = createLiveMarketStore({
      pgPool: postgres.pool,
      redisUrl: redis.url,
      instanceId: `audit-leader-${randomUUID()}`,
    });

    try {
      await store.initialize(symbols.map((symbol) => ({ symbol })));

      assert.equal(
        typeof store.verifyMarketAuditIntegrity,
        'function',
        'liveMarketStore deve expor verifyMarketAuditIntegrity para auditoria contínua'
      );
      assert.equal(
        typeof store.getPersistenceMetrics,
        'function',
        'liveMarketStore deve expor getPersistenceMetrics para telemetria Prometheus'
      );

      // 1. Produz 2 lotes de ticks reais via produceTicksBatch
      const batch1 = await store.produceTicksBatch([
        { symbol: 'VOL_10', makePrice: (prev) => (Number(prev) + 1.25).toFixed(6) },
        { symbol: 'VOL_25', makePrice: (prev) => (Number(prev) + 2.5).toFixed(6) },
      ]);
      assert.equal(batch1.committedTicks.length, 2);

      await new Promise((resolve) => setTimeout(resolve, 1050));

      const batch2 = await store.produceTicksBatch([
        { symbol: 'VOL_10', makePrice: (prev) => (Number(prev) + 3.75).toFixed(6) },
        { symbol: 'VOL_25', makePrice: (prev) => (Number(prev) - 1.25).toFixed(6) },
      ]);
      assert.equal(batch2.committedTicks.length, 2);

      const tick1Vol10 = batch1.committedTicks.find((t) => t.symbol === 'VOL_10');
      const tick2Vol10 = batch2.committedTicks.find((t) => t.symbol === 'VOL_10');
      assert(tick1Vol10 && tick2Vol10);

      // 2. Cria um contrato SETTLED consistente com o tick oficial (tick2Vol10)
      const userId = randomUUID();
      const contractId = randomUUID();
      const stakeMinor = 1000;
      const expectedWinPayout = 1850; // 85% payout padrão (1000 + 850)

      await postgres.pool.query(
        `INSERT INTO contracts (
           id, user_id, symbol, direction, status, result,
           stake_minor, payout_minor,
           entry_price, exit_price, exit_tick_sequence,
           idempotency_key, opened_at, expires_at, settled_at, created_at
         )
         VALUES (
           $1, $2, 'VOL_10', 'UP', 'SETTLED', 'WIN',
           $3, $4,
           $5, $6, 2,
           $7, $8, $9, $9, $8
         )`,
        [
          contractId,
          userId,
          stakeMinor,
          expectedWinPayout,
          tick1Vol10.price,
          tick2Vol10.price,
          `idem-${contractId}`,
          tick1Vol10.ts,
          tick2Vol10.ts,
        ]
      );

      // 3. Executa auditoria nominal -> 0 divergências
      const cleanReport = await store.verifyMarketAuditIntegrity({ symbols });
      assert.equal(cleanReport.ok, true, 'Relatório nominal deve retornar ok = true');
      assert.equal(cleanReport.hashChainBreaks, 0);
      assert.equal(cleanReport.candleDiffCount, 0);
      assert.equal(cleanReport.settlementDiffCount, 0);
      assert.equal(cleanReport.totalDiffs, 0);

      const metricsNominal = await store.getPersistenceMetrics();
      assert(typeof metricsNominal.tick_persist_ms === 'number' && metricsNominal.tick_persist_ms >= 0);
      assert(typeof metricsNominal.tick_persist_p99_ms === 'number' && metricsNominal.tick_persist_p99_ms >= 0);
      assert.equal(typeof metricsNominal.tick_persist_queue_depth, 'number');
      assert.equal(typeof metricsNominal.tick_dropped_total, 'number');
      assert.equal(typeof metricsNominal.outbox_pending_total, 'number');
      assert.equal(metricsNominal.market_audit_diffs_total, 0);

      // 4. Injeção de Falha A: Adulteração de vela 1m em candles
      await postgres.pool.query(
        `UPDATE candles SET close = 999999.999999 WHERE symbol = 'VOL_10' AND interval = '1m'`
      );
      const candleCorruptReport = await store.verifyMarketAuditIntegrity({ symbols });
      assert.equal(candleCorruptReport.ok, false);
      assert(candleCorruptReport.candleDiffCount >= 1, 'Deve detectar divergência entre candles e ticks');

      // Restaura vela via rebuildCandles
      await store.rebuildCandles('VOL_10', { interval: '1m' });

      // 5. Injeção de Falha B: Adulteração de hash na tabela ticks
      await postgres.pool.query(
        `UPDATE ticks SET hash = $1 WHERE symbol = 'VOL_10' AND sequence = 1`,
        ['f'.repeat(64)]
      );
      const hashCorruptReport = await store.verifyMarketAuditIntegrity({ symbols });
      assert.equal(hashCorruptReport.ok, false);
      assert(hashCorruptReport.hashChainBreaks >= 1, 'Deve detectar quebra de hash-chain em ticks');

      // Restaura hash original
      await postgres.pool.query(
        `UPDATE ticks SET hash = $1 WHERE symbol = 'VOL_10' AND sequence = 1`,
        [tick1Vol10.hash]
      );

      // 6. Injeção de Falha C: Adulteração de payout_minor de contrato liquidado
      await postgres.pool.query(
        `UPDATE contracts SET payout_minor = 9999 WHERE id = $1`,
        [contractId]
      );
      const settlementCorruptReport = await store.verifyMarketAuditIntegrity({ symbols });
      assert.equal(settlementCorruptReport.ok, false);
      assert(
        settlementCorruptReport.settlementDiffCount >= 1,
        'Deve detectar divergência entre contrato SETTLED e tick oficial'
      );

      // Restaura payout_minor original e confirma retorno ao estado íntegro
      await postgres.pool.query(
        `UPDATE contracts SET payout_minor = $1 WHERE id = $2`,
        [expectedWinPayout, contractId]
      );
      const restoredReport = await store.verifyMarketAuditIntegrity({ symbols });
      assert.equal(restoredReport.ok, true);
      assert.equal(restoredReport.totalDiffs, 0);

      await store.close();

      // 7. Valida exposição HTTP em scripts/dev-live-feed.mjs (/api/v1/audit/market-integrity e /metrics)
      feedProc = await startEphemeralFeed({
        databaseUrl: databaseUrlOf(postgres),
        redisUrl: redis.url,
      });
      const baseUrl = `http://127.0.0.1:${feedProc.port}`;

      const auditRes = await fetch(`${baseUrl}/api/v1/audit/market-integrity?symbols=VOL_10,VOL_25`);
      assert.equal(auditRes.status, 200, 'GET /api/v1/audit/market-integrity deve responder HTTP 200');
      const auditJson = await auditRes.json();
      assert.equal(auditJson.ok, true);
      assert.equal(auditJson.totalDiffs, 0);

      const metricsRes = await fetch(`${baseUrl}/metrics`);
      assert.equal(metricsRes.status, 200);
      const metricsText = await metricsRes.text();
      for (const metricName of [
        'tick_persist_ms',
        'tick_persist_p99_ms',
        'tick_persist_queue_depth',
        'tick_dropped_total',
        'outbox_pending_total',
        'market_audit_diffs_total',
      ]) {
        assert(
          metricsText.includes(metricName),
          `/metrics deve expor a métrica ${metricName}`
        );
      }
    } finally {
      if (feedProc) {
        await stopEphemeralFeed(feedProc);
      }
      await store.close();
    }
  }
);
