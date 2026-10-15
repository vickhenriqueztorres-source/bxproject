// Gate A — Provas adicionais de estresse (20 escritores + 36 ativos), caos (expiração de lease Redis,
// queda de sessão PostgreSQL via pg_terminate_backend, relógio retrocedendo) e segurança (entradas maliciosas,
// ausência de segredo em logs, proveniência explícita de velas legadas vs oficiais).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import Redis from '../../services/tick-engine/node_modules/ioredis/built/index.js';
import { canonicalHash, genesisHash } from '../../services/tick-engine/core.mjs';
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

test('[M-02][M-04][R-01][Gate-A-Stress] 20 concurrent writers across two simultaneous assets commit at most 1 tick per second per asset without cross-contamination',
  { timeout: 60_000 }, async () => {
    const assets = ['VOL_10', 'EURUSD_OTC'];
    const stores = Array.from({ length: 20 }, (_, i) =>
      createLiveMarketStore({
        pgPool: postgres.pool,
        redisUrl: redis.url,
        instanceId: `qa-writer-${i}`,
      })
    );

    try {
      await Promise.all(stores.map((s) => s.initialize(assets)));

      const [volResults, fxResults] = await Promise.all([
        Promise.all(
          stores.map((s, idx) =>
            s.produceTick('VOL_10', () => (100.5420 + (idx + 1) * 0.0001).toFixed(4))
          )
        ),
        Promise.all(
          stores.map((s, idx) =>
            s.produceTick('EURUSD_OTC', () => (1.08540 + (idx + 1) * 0.00001).toFixed(5))
          )
        ),
      ]);

      const committedVol = volResults.filter(Boolean);
      const committedFx = fxResults.filter(Boolean);
      assert.equal(committedVol.length, 1, 'Exactly 1 of 20 concurrent writers must commit for VOL_10');
      assert.equal(committedFx.length, 1, 'Exactly 1 of 20 concurrent writers must commit for EURUSD_OTC');

      for (const sym of assets) {
        const ticks = (
          await postgres.pool.query(
            'SELECT sequence, price, ts, prev_hash, hash FROM ticks WHERE symbol=$1 ORDER BY sequence',
            [sym]
          )
        ).rows;
        assert.equal(ticks.length, 1);
        assert.equal(Number(ticks[0].sequence), 1);
        assert.equal(ticks[0].prev_hash, genesisHash(sym));
        assert.equal(
          ticks[0].hash,
          canonicalHash(ticks[0].prev_hash, sym, 1, ticks[0].ts.toISOString(), String(ticks[0].price))
        );
      }
    } finally {
      await Promise.all(stores.map((s) => s.close()));
    }
  });

test('[D-09][M-02][Gate-A-Chaos] Redis lease expiration, fencing epoch increment, clock rollback, and real pg_terminate_backend recovery',
  { timeout: 90_000 }, async () => {
    const symbol = 'VOL_25';
    const storeA = createLiveMarketStore({
      pgPool: postgres.pool,
      redisUrl: redis.url,
      instanceId: 'leader-A',
    });
    const storeB = createLiveMarketStore({
      pgPool: postgres.pool,
      redisUrl: redis.url,
      instanceId: 'leader-B',
    });
    const redisClient = new Redis(redis.url);

    try {
      await storeA.initialize([symbol]);
      await storeB.initialize([symbol]);

      // 1. Leader A produz tick 1
      const tick1 = await storeA.produceTick(symbol, () => '250.9000');
      assert(tick1, 'Leader A must produce tick 1');
      assert.equal(tick1.sequence, 1);

      const epochAfterA = Number(
        (await postgres.pool.query('SELECT lease_epoch FROM index_state WHERE symbol=$1', [symbol]))
          .rows[0].lease_epoch
      );
      assert(epochAfterA >= 1);

      // 2. Simula expiração/perda de lease no Redis e avanço para o próximo segundo
      await redisClient.del(`lease:tick_leader:${symbol}`);
      await pause(1_050);

      // 3. Leader B assume a posse com epoch superior e produz tick 2 encadeado no tick 1
      const tick2 = await storeB.produceTick(symbol, () => '251.0000');
      assert(tick2, 'Leader B must take over after lease expiration');
      assert.equal(tick2.sequence, 2);
      assert.equal(tick2.prev_hash, tick1.hash);

      const epochAfterB = Number(
        (await postgres.pool.query('SELECT lease_epoch FROM index_state WHERE symbol=$1', [symbol]))
          .rows[0].lease_epoch
      );
      assert(epochAfterB > epochAfterA, 'Fencing epoch must strictly increase on leadership takeover');

      // 4. Relógio retrocedendo (last_ts no futuro em 2s): produceTick não permite regressão temporal
      const futureTs = new Date(Date.now() + 2_000);
      await postgres.pool.query('UPDATE index_state SET last_ts=$2 WHERE symbol=$1', [symbol, futureTs]);
      await postgres.pool.query('UPDATE ticks SET ts=$2 WHERE symbol=$1 AND sequence=2', [symbol, futureTs]);
      const blockedByFutureClock = await storeB.produceTick(symbol, () => '251.1000');
      assert.equal(blockedByFutureClock, null, 'Must not emit tick when clock is behind last_ts second');

      // Restaura last_ts para o passado (2s atrás) para testar queda real de sessão PostgreSQL
      const pastTs = new Date(Date.now() - 2_000);
      await postgres.pool.query('UPDATE index_state SET last_ts=$2 WHERE symbol=$1', [symbol, pastTs]);
      await postgres.pool.query('UPDATE ticks SET ts=$2 WHERE symbol=$1 AND sequence=2', [symbol, pastTs]);

      // 5. Queda real de sessão PostgreSQL (pg_terminate_backend) durante a transação
      await postgres.pool.query(`
        CREATE OR REPLACE FUNCTION qa_kill_backend_vol25() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.payload->>'symbol' = 'VOL_25' THEN
            PERFORM pg_terminate_backend(pg_backend_pid());
          END IF;
          RETURN NEW;
        END $$;
        CREATE TRIGGER qa_kill_vol25 BEFORE INSERT ON outbox_events
        FOR EACH ROW EXECUTE FUNCTION qa_kill_backend_vol25();
      `);

      await assert.rejects(storeB.produceTick(symbol, () => '251.2000'));

      // Remove o trigger de caos e verifica que nenhuma escrita parcial ficou e que a recuperação funciona
      await postgres.pool.query('DROP TRIGGER qa_kill_vol25 ON outbox_events; DROP FUNCTION qa_kill_backend_vol25();');
      const stateAfterKill = (
        await postgres.pool.query('SELECT last_sequence, last_hash FROM index_state WHERE symbol=$1', [symbol])
      ).rows[0];
      assert.equal(Number(stateAfterKill.last_sequence), 2, 'Terminated session must roll back completely');
      assert.equal(stateAfterKill.last_hash, tick2.hash);

      const tick3 = await storeB.produceTick(symbol, () => '251.3000');
      assert(tick3, 'Store must recover after terminated backend session');
      assert.equal(tick3.sequence, 3);
      assert.equal(tick3.prev_hash, tick2.hash);
    } finally {
      redisClient.disconnect();
      await storeA.close();
      await storeB.close();
    }
  });

test('[S-04][M-05][Q-04][Gate-A-Security-And-Load] malicious input rejection, legacy vs official candle provenance, 36-asset load p95, and zero secrets in logs',
  { timeout: 120_000 }, async () => {
    const store = createLiveMarketStore({
      pgPool: postgres.pool,
      redisUrl: redis.url,
      instanceId: 'security-checker',
    });
    try {
      await store.initialize(['VOL_75']);
      // Entradas maliciosas / inválidas
      await assert.rejects(() => store.produceTick("VOL_75'; DROP TABLE ticks;--", () => '100.0000'), /UNKNOWN_SYMBOL/);
      await assert.rejects(() => store.produceTick('VOL_75', () => '-50.0000'), /INVALID_PRICE_DECIMAL/);
      await assert.rejects(() => store.produceTick('VOL_75', () => '0.000000'), /INVALID_PRICE_DECIMAL/);
      await assert.rejects(() => store.produceTick('VOL_75', () => 'NaN'), /INVALID_PRICE_DECIMAL/);
      await assert.rejects(() => store.readTicksSince('VOL_75', -1, 10), /INVALID_TICK_CURSOR/);
      await assert.rejects(() => store.loadCandles('VOL_75', 999_999), /INVALID_CANDLE_LIMIT/);
    } finally {
      await store.close();
    }

    // Sobe o feed completo de 36 ativos e mede latência sob carga concorrente
    const feed = await startEphemeralFeed({
      databaseUrl: databaseUrlOf(postgres),
      redisUrl: redis.url,
    });
    try {
      await pause(2_200);

      // Mede 50 requisições concorrentes a /candles e /api/v1/snapshot
      const latencies = [];
      await Promise.all(
        Array.from({ length: 50 }, async (_, idx) => {
          const t0 = performance.now();
          const endpoint =
            idx % 2 === 0
              ? `http://127.0.0.1:${feed.port}/candles?symbol=VOL_50&limit=300`
              : `http://127.0.0.1:${feed.port}/api/v1/snapshot?symbol=VOL_50`;
          const res = await fetch(endpoint, { signal: AbortSignal.timeout(3_000) });
          assert.equal(res.status, 200);
          await res.json();
          latencies.push(performance.now() - t0);
        })
      );
      latencies.sort((a, b) => a - b);
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      assert(p95 < 200, `Expected p95 < 200ms under load, got ${p95.toFixed(2)}ms`);

      // Verifica proveniência explícita: legado visual identificado vs velas oficiais
      const candlesRes = await fetch(`http://127.0.0.1:${feed.port}/candles?symbol=VOL_50&limit=10080`);
      const bars = await candlesRes.json();
      assert(bars.length >= 1000, 'Should preserve legacy visual history before cutoff');
      const legacyBars = bars.filter((b) => b.legacy === true && b.provenance === 'legacy_visual');
      const officialBars = bars.filter((b) => b.legacy === false && b.provenance === 'official');
      assert(legacyBars.length > 0, 'Legacy visual bars must be explicitly identified');
      assert(officialBars.length > 0, 'Official persisted bars must be explicitly identified');
      assert(
        legacyBars[legacyBars.length - 1].time < officialBars[0].time,
        'Legacy visual bars must strictly precede official persisted candles'
      );

      // Verifica que todos os 36 ativos estão progredindo no PostgreSQL e que nenhum segredo vazou no stdout/stderr
      const activeCount = (
        await postgres.pool.query('SELECT count(*)::int AS n FROM index_state WHERE last_sequence >= 1')
      ).rows[0].n;
      assert.equal(activeCount, 36, 'All 36 catalog assets must persist official ticks');
      assert(!feed.output.includes('qa-ephemeral-feed-only'), 'JWT_SECRET must never appear in logs');
      assert(!feed.output.includes(postgres.pool.options.password), 'Database password must never appear in logs');
    } finally {
      await stopEphemeralFeed(feed);
    }
  });
