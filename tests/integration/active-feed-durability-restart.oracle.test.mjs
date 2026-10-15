// AC-ACTIVE-FEED-2: Dado head, ticks, outbox e candle confirmados em PostgreSQL,
// quando o feed real inicia, emite mais ticks e reinicia, então preserva preço,
// sequence e hash; o candle histórico não é recriado a partir do catálogo.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { canonicalHash, genesisHash } from '../../services/tick-engine/core.mjs';
import { assertNotProduction, createEphemeralPostgres, createEphemeralRedis } from '../helpers/chart-durability-postgres.mjs';
import { databaseUrlOf, startEphemeralFeed, stopEphemeralFeed } from '../helpers/active-feed-process.mjs';

assertNotProduction();
let postgres;
let redis;
let feed;
const symbol = 'VOL_50';

before(async () => {
  postgres = await createEphemeralPostgres();
  redis = await createEphemeralRedis();
  for (const migration of ['0001_initial_schema.sql', '0010_seed_multi_assets.up.sql',
    '0050_rename_synthetic_indices.up.sql']) {
    await postgres.pool.query(await readFile(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'));
  }
}, { timeout: 120_000 });

after(async () => {
  try { await stopEphemeralFeed(feed); }
  finally {
    try { if (redis) await redis.dispose(); }
    finally { if (postgres) await postgres.dispose(); }
  }
}, { timeout: 90_000 });

async function seedPersistedHistory() {
  const price1 = '777.250000';
  const price2 = '777.500000';
  const first = new Date(Date.now() - 120_000);
  first.setMilliseconds(0);
  const second = new Date(first.getTime() + 1_000);
  const genesis = genesisHash(symbol);
  const hash1 = canonicalHash(genesis, symbol, 1, first.toISOString(), price1);
  const hash2 = canonicalHash(hash1, symbol, 2, second.toISOString(), price2);
  const state = await postgres.pool.query(`UPDATE index_state
    SET last_sequence=2,last_price=$2,last_hash=$3,last_ts=$4
    WHERE symbol=$1 RETURNING symbol`, [symbol, price2, hash2, second]);
  assert.equal(state.rowCount, 1, '0050 must seed the canonical VOL_50 symbol');
  for (const tick of [
    { sequence: 1, price: price1, ts: first, prev_hash: genesis, hash: hash1 },
    { sequence: 2, price: price2, ts: second, prev_hash: hash1, hash: hash2 },
  ]) {
    await postgres.pool.query(`INSERT INTO ticks(symbol,sequence,price,ts,prev_hash,hash)
      VALUES ($1,$2,$3,$4,$5,$6)`, [symbol, tick.sequence, tick.price, tick.ts, tick.prev_hash, tick.hash]);
    await postgres.pool.query(`INSERT INTO outbox_events(event_type,payload) VALUES ('TICK', $1::jsonb)`,
      [JSON.stringify({ symbol, sequence: String(tick.sequence), price: tick.price,
        ts: tick.ts.toISOString(), prev_hash: tick.prev_hash, hash: tick.hash })]);
  }
  const bucket = new Date(Math.floor(first.getTime() / 60_000) * 60_000);
  await postgres.pool.query(`INSERT INTO candles
    (symbol,interval,bucket_start,open,high,low,close,volume)
    VALUES ($1,'1m',$2,$3,$4,$3,$4,2)`, [symbol, bucket, price1, price2]);
  return { bucket, price2, hash2 };
}

async function snapshot(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/snapshot?symbol=${symbol}`,
    { signal: AbortSignal.timeout(2_000) });
  assert.equal(response.status, 200);
  return response.json();
}

test('[M-02][M-04][M-05][AC-ACTIVE-FEED-2] committed history survives feed boot and real process restart',
  { timeout: 120_000 }, async () => {
    const { bucket, price2, hash2 } = await seedPersistedHistory();
    feed = await startEphemeralFeed({ databaseUrl: databaseUrlOf(postgres), redisUrl: redis.url });
    const initial = await snapshot(feed.port);
    assert(Number(initial.sequence) >= 2,
      `boot reset committed sequence 2 to ${initial.sequence}`);
    if (Number(initial.sequence) === 2) {
      assert.equal(Number(initial.price), Number(price2), 'boot reset persisted price to catalog base');
      assert.equal(initial.hash, hash2, 'boot reset persisted hash');
    }
    const candlesResponse = await fetch(`http://127.0.0.1:${feed.port}/candles?symbol=${symbol}&limit=10080`,
      { signal: AbortSignal.timeout(4_000) });
    assert.equal(candlesResponse.status, 200);
    const candle = (await candlesResponse.json()).find(row => Number(row.time) === bucket.getTime() / 1000);
    assert(candle, 'persisted candle missing from chart history');
    assert.equal(Number(candle.open), 777.25);
    assert.equal(Number(candle.close), 777.5);
    assert.equal(Number(candle.volume), 2);

    let beforeRestart;
    for (let attempt = 0; attempt < 60; attempt++) {
      const result = await postgres.pool.query(`SELECT last_sequence,last_price,last_hash FROM index_state WHERE symbol=$1`, [symbol]);
      beforeRestart = result.rows[0];
      if (Number(beforeRestart.last_sequence) > 2) break;
      await pause(100);
    }
    assert(Number(beforeRestart.last_sequence) > 2, 'live ticks were never durably appended');
    const previousSequence = Number(beforeRestart.last_sequence);
    const previousHash = beforeRestart.last_hash;
    await stopEphemeralFeed(feed);
    feed = await startEphemeralFeed({ databaseUrl: databaseUrlOf(postgres), redisUrl: redis.url });
    const resumed = await snapshot(feed.port);
    assert(Number(resumed.sequence) >= previousSequence,
      `restart reset sequence ${previousSequence} to ${resumed.sequence}`);
    if (Number(resumed.sequence) === previousSequence) assert.equal(resumed.hash, previousHash);
    const next = await postgres.pool.query(`SELECT sequence,prev_hash FROM ticks
      WHERE symbol=$1 AND sequence=$2`, [symbol, previousSequence + 1]);
    if (next.rowCount) assert.equal(next.rows[0].prev_hash, previousHash,
      'first post-restart tick does not chain to committed predecessor');
  });
