/**
 * Gate C — Oráculos de Velas Derivadas e Corte de Leitura (PostgreSQL 16 + Redis 7 Reais Efêmeros)
 * Cobertura:
 * - [M-05][V-05][V-06][AC-GD-06-1][AC-GD-06-2] Buckets UTC [início, fim), OHLC por menor/maior sequence, volume = contagem de ticks únicos, replay 20x / chegada fora de ordem, vela mais antiga nunca sobrescreve a mais nova.
 * - [AC-GD-06-3][AC-GD-06-5] Restart no meio do bucket, rebuild completo a partir de ticks com diferença zero, lacuna sem ticks não fabrica vela oficial.
 * - [AC-GD-06-4][Stress] Paginação estável, allowlist de timeframe, rejeição de SQL injection / limites inválidos, separação estrita de legado visual vs oficial, e carga REST+WS sobre 36 ativos com p95 < 200ms e 0 erros 5xx.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { canonicalHash, genesisHash } from '../../services/tick-engine/core.mjs';
import { createLiveMarketStore } from '../../services/tick-engine/live-market-store.mjs';
import { aggregateCandlesToInterval } from '../../scripts/lib/candle-aggregation-engine.mjs';
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

async function insertTickChain(pool, symbol, rawTicks) {
  await pool.query('DELETE FROM candles WHERE symbol = $1', [symbol]);
  await pool.query('DELETE FROM ticks WHERE symbol = $1', [symbol]);
  let prevHash = genesisHash(symbol);
  let lastSeq = 0;
  let lastPrice = '100.000000';
  let lastTs = new Date(0).toISOString();

  const sortedBySeq = [...rawTicks].sort((a, b) => a.sequence - b.sequence);
  for (const item of sortedBySeq) {
    const hash = canonicalHash(prevHash, symbol, item.sequence, item.ts, item.price);
    await pool.query(
      `INSERT INTO ticks (symbol, sequence, price, ts, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [symbol, item.sequence, item.price, item.ts, prevHash, hash]
    );
    prevHash = hash;
    lastSeq = item.sequence;
    lastPrice = item.price;
    lastTs = item.ts;
  }

  await pool.query(
    `UPDATE index_state
     SET last_sequence = $2, last_price = $3, last_hash = $4, last_ts = $5, updated_at = NOW()
     WHERE symbol = $1`,
    [symbol, lastSeq, lastPrice, prevHash, lastTs]
  );
}

test(
  '[Gate C | M-05 & V-05 & V-06 & AC-GD-06-1 & AC-GD-06-2] Buckets UTC [início, fim), OHLC por menor/maior sequence, volume = contagem de ticks, replay 20x e proteção contra sobrescrita por vela antiga',
  { timeout: 90_000 },
  async () => {
    const symbol = 'VOL_10';
    // Fronteira UTC exata de virada de dia: 2026-10-14T23:59:00.000Z e 2026-10-15T00:00:00.000Z
    const b1Start = Date.parse('2026-10-14T23:59:00.000Z');
    const b2Start = Date.parse('2026-10-15T00:00:00.000Z'); // Exatamente no fim de b1 -> deve pertencer a b2!
    const b4Start = Date.parse('2026-10-15T00:02:00.000Z'); // Lacuna em 00:01:00.000Z (zero ticks -> nenhuma vela em 00:01!)

    const ticks = [
      // Bucket 1 [23:59:00, 00:00:00): sequences 1, 2, 3
      { sequence: 1, price: '101.100000', ts: new Date(b1Start + 0).toISOString() }, // open = 101.100000
      { sequence: 2, price: '105.900000', ts: new Date(b1Start + 15_000).toISOString() }, // high = 105.900000
      { sequence: 3, price: '98.200000', ts: new Date(b1Start + 59_999).toISOString() }, // low & close = 98.200000
      // Tick exatamente na fronteira 00:00:00.000Z -> pertence ao Bucket 2 [00:00:00, 00:01:00)!
      { sequence: 4, price: '102.000000', ts: new Date(b2Start + 0).toISOString() }, // open de b2 = 102.000000
      { sequence: 5, price: '100.500000', ts: new Date(b2Start + 4_999).toISOString() },
      { sequence: 6, price: '104.750000', ts: new Date(b2Start + 5_000).toISOString() }, // fronteira de 5s
      // Bucket 4 [00:02:00, 00:03:00) após lacuna de 1 minuto sem ticks em 00:01
      { sequence: 7, price: '110.000000', ts: new Date(b4Start + 1_000).toISOString() },
    ];

    await insertTickChain(postgres.pool, symbol, ticks);

    const store = createLiveMarketStore({
      pgPool: postgres.pool,
      redisUrl: redis.url,
      instanceId: 'gate-c-rebuild-oracle',
    });

    try {
      await store.initialize([{ symbol }]);
      assert.equal(
        typeof store.rebuildCandles,
        'function',
        'liveMarketStore deve expor rebuildCandles para reconstrução determinística a partir de ticks'
      );

      // Executa rebuild 20x concorrente/repetido em múltiplos timeframes ('5s', '15s', '30s', '1m', '5m')
      for (const interval of ['5s', '15s', '30s', '1m', '5m']) {
        await Promise.all(
          Array.from({ length: 20 }, () => store.rebuildCandles(symbol, { interval }))
        );

        const intervalSec = { '5s': 5, '15s': 15, '30s': 30, '1m': 60, '5m': 300 }[interval];

        // Recálculo SQL independente diretamente sobre a tabela ticks (Oráculo V-05 / V-06)
        const expectedSql = await postgres.pool.query(
          `SELECT
             to_timestamp(floor(extract(epoch from ts) / $2::int) * $2::int) AS bucket_start,
             (array_agg(price ORDER BY sequence ASC))[1] AS open,
             MAX(price) AS high,
             MIN(price) AS low,
             (array_agg(price ORDER BY sequence DESC))[1] AS close,
             COUNT(DISTINCT sequence)::bigint AS volume
           FROM ticks
           WHERE symbol = $1
           GROUP BY floor(extract(epoch from ts) / $2::int)
           ORDER BY bucket_start ASC`,
          [symbol, intervalSec]
        );

        const actualCandles = await postgres.pool.query(
          `SELECT bucket_start, open, high, low, close, volume
           FROM candles
           WHERE symbol = $1 AND interval = $2
           ORDER BY bucket_start ASC`,
          [symbol, interval]
        );

        assert.equal(
          actualCandles.rowCount,
          expectedSql.rowCount,
          `Quantidade de buckets em candles (${actualCandles.rowCount}) deve bater 100% com ticks (${expectedSql.rowCount}) para ${interval}`
        );

        for (let i = 0; i < expectedSql.rowCount; i++) {
          const exp = expectedSql.rows[i];
          const act = actualCandles.rows[i];
          assert.equal(act.bucket_start.toISOString(), exp.bucket_start.toISOString());
          assert.equal(Number(act.open), Number(exp.open), `open divergente em ${interval} idx ${i}`);
          assert.equal(Number(act.high), Number(exp.high), `high divergente em ${interval} idx ${i}`);
          assert.equal(Number(act.low), Number(exp.low), `low divergente em ${interval} idx ${i}`);
          assert.equal(Number(act.close), Number(exp.close), `close divergente em ${interval} idx ${i}`);
          assert.equal(Number(act.volume), Number(exp.volume), `volume divergente em ${interval} idx ${i}`);
        }
      }

      // Verifica especificamente que o minuto vazio 00:01:00Z NÃO virou vela fabricada em '1m' (AC-GD-06-5)
      const candles1m = await store.loadCandles(symbol, 100);
      assert.equal(candles1m.length, 3, 'Deve haver exatamente 3 velas de 1m (23:59, 00:00 e 00:02; 00:01 vazio não é fabricado)');
      assert.equal(candles1m[0].time, Math.floor(b1Start / 1000));
      assert.equal(Number(candles1m[0].open), 101.1);
      assert.equal(Number(candles1m[0].high), 105.9);
      assert.equal(Number(candles1m[0].low), 98.2);
      assert.equal(Number(candles1m[0].close), 98.2);
      assert.equal(candles1m[0].volume, 3);

      assert.equal(candles1m[1].time, Math.floor(b2Start / 1000));
      assert.equal(Number(candles1m[1].open), 102.0, 'Tick exato em 00:00:00.000Z deve ser o open do bucket 00:00');
      assert.equal(Number(candles1m[1].close), 104.75);
      assert.equal(candles1m[1].volume, 3);

      assert.equal(candles1m[2].time, Math.floor(b4Start / 1000));
      assert.equal(candles1m[2].volume, 1);

      // Verifica que aggregateCandlesToInterval NUNCA deixa vela antiga sobrescrever o close de vela mais nova nem duplica volume
      const outOfOrder1m = [
        { time: 300, open: '100.0000', high: '102.0000', low: '99.0000', close: '101.0000', volume: 10, legacy: false, provenance: 'official' },
        { time: 420, open: '103.0000', high: '108.0000', low: '102.0000', close: '107.5000', volume: 15, legacy: false, provenance: 'official' },
        // Vela mais antiga (time=360) chegando fora de ordem DEPOIS de time=420 + duplicata de time=300:
        { time: 360, open: '101.0000', high: '104.0000', low: '98.0000', close: '99.0000', volume: 12, legacy: false, provenance: 'official' },
        { time: 300, open: '100.0000', high: '102.0000', low: '99.0000', close: '101.0000', volume: 10, legacy: false, provenance: 'official' },
      ];
      const agg5m = aggregateCandlesToInterval(outOfOrder1m, 300);
      assert.equal(agg5m.length, 1);
      assert.equal(agg5m[0].open, '100.0000', 'open deve ser o da menor timestamp (300)');
      assert.equal(agg5m[0].close, '107.5000', 'close deve ser o da maior timestamp (420), nunca sobrescrito por vela antiga (360)');
      assert.equal(agg5m[0].high, '108.0000');
      assert.equal(agg5m[0].low, '98.0000');
      assert.equal(agg5m[0].volume, 37, 'volume deve somar apenas barras únicas (10 + 15 + 12 = 37)');
    } finally {
      await store.close();
    }
  }
);

test(
  '[Gate C | AC-GD-06-3 & AC-GD-06-4 & Stress] Restart no meio do bucket, validação de segurança/paginação em /candles e /v2/candles, separação legado vs oficial e carga de 36 ativos (p95 < 200ms)',
  { timeout: 120_000 },
  async () => {
    const symbol = 'VOL_50';
    // Limpa VOL_50 e inicia feed1 para produzir ticks reais no bucket atual
    await postgres.pool.query('DELETE FROM candles WHERE symbol = $1', [symbol]);
    await postgres.pool.query('DELETE FROM ticks WHERE symbol = $1', [symbol]);
    await postgres.pool.query(
      `UPDATE index_state
       SET last_sequence = 0, last_price = 500.125000, last_hash = $2, last_ts = NOW() - INTERVAL '5 seconds', lease_leader = NULL, lease_epoch = 0
       WHERE symbol = $1`,
      [symbol, genesisHash(symbol)]
    );

    let feed1;
    let feed2;
    try {
      feed1 = await startEphemeralFeed({
        databaseUrl: databaseUrlOf(postgres),
        redisUrl: redis.url,
      });

      // Aguarda pelo menos 2 ticks de VOL_50 em feed1
      for (let i = 0; i < 60; i++) {
        const c = await postgres.pool.query(`SELECT COUNT(*)::int AS cnt FROM ticks WHERE symbol = $1`, [symbol]);
        if (c.rows[0].cnt >= 2) break;
        await pause(100);
      }
      await stopEphemeralFeed(feed1);
      feed1 = null;

      // Reinicia imediatamente com feed2 (no meio do bucket) e produz mais ticks
      const countBeforeRestart = (
        await postgres.pool.query(`SELECT COUNT(*)::int AS cnt FROM ticks WHERE symbol = $1`, [symbol])
      ).rows[0].cnt;
      assert(countBeforeRestart >= 2, 'feed1 deve ter gravado pelo menos 2 ticks antes do restart');

      feed2 = await startEphemeralFeed({
        databaseUrl: databaseUrlOf(postgres),
        redisUrl: redis.url,
      });

      for (let i = 0; i < 60; i++) {
        const c = await postgres.pool.query(`SELECT COUNT(*)::int AS cnt FROM ticks WHERE symbol = $1`, [symbol]);
        if (c.rows[0].cnt >= countBeforeRestart + 2) break;
        await pause(100);
      }

      // 1. Verifica rejeição de parâmetros maliciosos / inválidos em /candles e /v2/candles (AC-GD-06-4)
      for (const badQuery of [
        '/candles?symbol=VOL_50&interval=999d',
        '/candles?symbol=VOL_50&interval=1m%27;DROP%20TABLE%20candles;--',
        '/candles?symbol=VOL_50&limit=0',
        '/candles?symbol=VOL_50&limit=999999',
        '/candles?symbol=VOL_50&limit=abc',
        '/candles?symbol=VOL_50&before=-10',
        '/candles?symbol=VOL_50&before=1700000000%20OR%201=1',
        '/v2/candles?symbol=VOL_50&interval=invalid',
      ]) {
        const badRes = await fetch(`http://127.0.0.1:${feed2.port}${badQuery}`);
        assert.equal(
          badRes.status,
          400,
          `Query inválida ${badQuery} deve ser rejeitada com 400 (recebeu ${badRes.status})`
        );
      }

      // 2. Compara /v2/candles (100% oficial a partir de ticks) e /candles (legado identificado + oficial) contra recálculo SQL independente
      const sqlRecalc1m = await postgres.pool.query(
        `SELECT
           floor(extract(epoch from ts) / 60)::bigint * 60 AS time_sec,
           (array_agg(price ORDER BY sequence ASC))[1] AS open,
           MAX(price) AS high,
           MIN(price) AS low,
           (array_agg(price ORDER BY sequence DESC))[1] AS close,
           COUNT(DISTINCT sequence)::bigint AS volume
         FROM ticks
         WHERE symbol = $1
         GROUP BY floor(extract(epoch from ts) / 60)
         ORDER BY time_sec ASC`,
        [symbol]
      );
      assert(sqlRecalc1m.rowCount >= 1, 'Deve existir pelo menos 1 bucket oficial de 1m recalculado de ticks');

      const v2Res1m = await fetch(`http://127.0.0.1:${feed2.port}/v2/candles?symbol=${symbol}&interval=1m&limit=100`);
      assert.equal(v2Res1m.status, 200);
      const v2Bars1m = await v2Res1m.json();
      assert.equal(v2Bars1m.length, sqlRecalc1m.rowCount, '/v2/candles deve retornar apenas os buckets oficiais persistidos');

      for (let i = 0; i < sqlRecalc1m.rowCount; i++) {
        const exp = sqlRecalc1m.rows[i];
        const act = v2Bars1m[i];
        assert.equal(act.time, Number(exp.time_sec));
        assert.equal(act.legacy, false);
        assert.equal(act.provenance, 'official');
        assert.equal(Number(act.open), Number(exp.open));
        assert.equal(Number(act.high), Number(exp.high));
        assert.equal(Number(act.low), Number(exp.low));
        assert.equal(Number(act.close), Number(exp.close), 'close da vela deve bater exatamente com o último tick do bucket');
        assert.equal(Number(act.volume), Number(exp.volume));
      }

      // Verifica /v2/candles em sub-minuto (5s e 15s) contra SQL independente
      for (const [tf, sec] of [['5s', 5], ['15s', 15]]) {
        const sqlSub = await postgres.pool.query(
          `SELECT
             floor(extract(epoch from ts) / $2::int)::bigint * $2::int AS time_sec,
             (array_agg(price ORDER BY sequence ASC))[1] AS open,
             MAX(price) AS high,
             MIN(price) AS low,
             (array_agg(price ORDER BY sequence DESC))[1] AS close,
             COUNT(DISTINCT sequence)::bigint AS volume
           FROM ticks
           WHERE symbol = $1
           GROUP BY floor(extract(epoch from ts) / $2::int)
           ORDER BY time_sec ASC`,
          [symbol, sec]
        );
        const resSub = await fetch(`http://127.0.0.1:${feed2.port}/v2/candles?symbol=${symbol}&interval=${tf}&limit=100`);
        assert.equal(resSub.status, 200);
        const barsSub = await resSub.json();
        assert.equal(barsSub.length, sqlSub.rowCount);
        for (let i = 0; i < sqlSub.rowCount; i++) {
          assert.equal(barsSub[i].time, Number(sqlSub.rows[i].time_sec));
          assert.equal(Number(barsSub[i].close), Number(sqlSub.rows[i].close));
          assert.equal(Number(barsSub[i].volume), Number(sqlSub.rows[i].volume));
        }
      }

      // Verifica /candles (compatibilidade com frontend): separa estritamente legado visual (< primeiro bucket oficial) dos buckets oficiais
      const v1Res = await fetch(`http://127.0.0.1:${feed2.port}/candles?symbol=${symbol}&interval=1m&limit=20`);
      assert.equal(v1Res.status, 200);
      const v1Bars = await v1Res.json();
      const v1Official = v1Bars.filter((b) => b.legacy === false && b.provenance === 'official');
      const v1Legacy = v1Bars.filter((b) => b.legacy === true && b.provenance === 'legacy_visual');
      assert.equal(v1Official.length, sqlRecalc1m.rowCount);
      assert(v1Legacy.length > 0, '/candles deve preservar o legado visual identificado antes do corte oficial');
      assert(
        v1Legacy[v1Legacy.length - 1].time < v1Official[0].time,
        'Todas as velas legadas devem ser estritamente anteriores à primeira vela oficial'
      );

      // 3. Paginação por `before`: não duplica nem omite velas fechadas
      const CutoffTime = v1Bars[v1Bars.length - 5].time;
      const pageRes = await fetch(
        `http://127.0.0.1:${feed2.port}/candles?symbol=${symbol}&interval=1m&before=${CutoffTime}&limit=10`
      );
      assert.equal(pageRes.status, 200);
      const pageBars = await pageRes.json();
      assert.equal(pageBars.length, 10);
      assert(pageBars.every((b) => b.time < CutoffTime), 'Paginação before deve retornar apenas velas com time < before');

      // 4. Stress / Carga sobre os 36 ativos: 180 requisições concorrentes (/candles e /v2/candles em 1m, 5m, 15s)
      const allSymbolsRes = await postgres.pool.query(
        `SELECT symbol FROM indices WHERE symbol NOT LIKE 'SYNTH_%' ORDER BY symbol ASC`
      );
      const symbols36 = allSymbolsRes.rows.map((r) => r.symbol);
      assert.equal(symbols36.length, 36);

      const latencies = [];
      const loadStatuses = [];
      await Promise.all(
        symbols36.map(async (sym, symIdx) => {
          for (let wave = 0; wave < 5; wave++) {
            const idx = wave * symbols36.length + symIdx;
            const tf = idx % 3 === 0 ? '1m' : idx % 3 === 1 ? '5m' : '15s';
            const endpoint = idx % 2 === 0 ? '/candles' : '/v2/candles';
            const t0 = performance.now();
            const r = await fetch(
              `http://127.0.0.1:${feed2.port}${endpoint}?symbol=${sym}&interval=${tf}&limit=120`
            );
            const body = await r.json();
            const dt = performance.now() - t0;
            latencies.push(dt);
            loadStatuses.push(r.status === 200 && Array.isArray(body) ? 200 : r.status);
          }
        })
      );

      assert.equal(loadStatuses.length, 180);
      assert(
        loadStatuses.every((s) => s === 200),
        `Zero erros 5xx/4xx permitidos sob carga de 180 reqs concorrentes em 36 ativos`
      );
      latencies.sort((a, b) => a - b);
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      assert(p95 < 200, `Latência p95 de GET candles sob carga deve ser < 200ms (medido: ${p95.toFixed(2)}ms)`);
    } finally {
      if (feed1) await stopEphemeralFeed(feed1);
      if (feed2) await stopEphemeralFeed(feed2);
    }
  }
);
