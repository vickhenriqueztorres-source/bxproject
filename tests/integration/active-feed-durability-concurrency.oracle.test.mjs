// AC-ACTIVE-FEED-5: Dadas duas instâncias reais contra o mesmo PostgreSQL 16
// e Redis 7 efêmeros, quando geram VOL_50 por 4 s, então apenas um produtor
// efetivo existe: sequência contínua, um tick e um outbox por sequência,
// nenhum WS publica preço que não está confirmado no banco.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { genesisHash } from '../../services/tick-engine/core.mjs';
import { assertNotProduction, createEphemeralPostgres, createEphemeralRedis } from '../helpers/chart-durability-postgres.mjs';
import { databaseUrlOf, startEphemeralFeed, stopEphemeralFeed } from '../helpers/active-feed-process.mjs';

assertNotProduction();
const require = createRequire(import.meta.url);
const WebSocket = require('../../node_modules/.pnpm/ws@8.22.0/node_modules/ws');
const symbol = 'VOL_50';
let postgres;
let redis;
let feeds = [];

before(async () => {
  postgres = await createEphemeralPostgres();
  redis = await createEphemeralRedis();
  for (const migration of ['0001_initial_schema.sql', '0010_seed_multi_assets.up.sql',
    '0050_rename_synthetic_indices.up.sql']) {
    await postgres.pool.query(await readFile(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'));
  }
  const state = await postgres.pool.query(`UPDATE index_state SET last_hash=$2 WHERE symbol=$1
    RETURNING symbol`, [symbol, genesisHash(symbol)]);
  assert.equal(state.rowCount, 1, '0050 must seed the canonical VOL_50 symbol');
}, { timeout: 120_000 });

after(async () => {
  try { await Promise.all(feeds.map(stopEphemeralFeed)); }
  finally {
    try { if (redis) await redis.dispose(); }
    finally { if (postgres) await postgres.dispose(); }
  }
}, { timeout: 90_000 });

async function watchTicks(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ticks`);
  const ticks = [];
  socket.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'tick' && message.symbol === symbol) ticks.push(message);
    } catch { /* malformed frames cannot satisfy the oracle */ }
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  socket.send(JSON.stringify({ type: 'subscribe', symbol }));
  return { socket, ticks };
}

test('[M-02][M-03][R-01][AC-ACTIVE-FEED-5] two feeds share one fenced producer and no phantom WS tick',
  { timeout: 120_000 }, async t => {
    const databaseUrl = databaseUrlOf(postgres);
    const starts = await Promise.allSettled(Array.from({ length: 2 }, () =>
      startEphemeralFeed({ databaseUrl, redisUrl: redis.url })));
    feeds = starts.filter(result => result.status === 'fulfilled').map(result => result.value);
    assert.equal(feeds.length, 2, `both isolated instances must start: ${starts.map(r => r.status).join(',')}`);
    assert.notEqual(feeds[0].child.pid, feeds[1].child.pid);
    assert.notEqual(feeds[0].port, feeds[1].port);
    const watchers = await Promise.all(feeds.map(feed => watchTicks(feed.port)));
    try {
      await pause(4_000);
      // Freeze the observation window before reading PostgreSQL. A later tick
      // must not enter this assertion after the database snapshot is taken.
      const observedTicks = watchers.flatMap(watcher => watcher.ticks.slice());
      const rows = (await postgres.pool.query(`SELECT sequence,price,ts,prev_hash,hash
        FROM ticks WHERE symbol=$1 ORDER BY sequence`, [symbol])).rows;
      assert(rows.length >= 2, `no durable tick sequence after 4 s with two feeds; rows=${rows.length}`);
      let previousHash = genesisHash(symbol);
      for (const [index, row] of rows.entries()) {
        assert.equal(Number(row.sequence), index + 1, 'tick sequence has a gap or duplicate');
        assert.equal(row.prev_hash, previousHash, 'tick hash chain diverged');
        previousHash = row.hash;
        const events = await postgres.pool.query(`SELECT payload FROM outbox_events
          WHERE payload->>'symbol'=$1 AND payload->>'sequence'=$2`, [symbol, String(row.sequence)]);
        assert.equal(events.rowCount, 1, `outbox is not 1:1 for sequence ${row.sequence}`);
      }
      const sameSecond = await postgres.pool.query(`SELECT date_trunc('second', ts) AS second,
        count(*)::int AS n FROM ticks WHERE symbol=$1
        GROUP BY second HAVING count(*) > 1`, [symbol]);
      assert.equal(sameSecond.rowCount, 0, 'two generators committed ticks in one second');
      const state = (await postgres.pool.query(`SELECT last_sequence,last_hash,lease_epoch
        FROM index_state WHERE symbol=$1`, [symbol])).rows[0];
      assert.equal(Number(state.last_sequence), rows.length);
      assert.equal(state.last_hash, previousHash);
      assert(Number(state.lease_epoch) >= 1, 'no database fencing epoch was recorded');
      for (const tick of observedTicks) {
        const stored = rows.find(row => Number(row.sequence) === Number(tick.sequence));
        assert(stored, `instance published phantom sequence ${tick.sequence}`);
        assert.equal(Number(stored.price), Number(tick.price));
        assert.equal(stored.hash, tick.hash);
      }
      assert(observedTicks.length > 0, 'no active feed instance emitted a tick');
      t.diagnostic(`real PIDs=${feeds.map(feed => feed.child.pid).join(',')} ports=${feeds.map(feed => feed.port).join(',')} durableTicks=${rows.length} observedTicks=${observedTicks.length}`);
    } finally {
      for (const watcher of watchers) watcher.socket.close();
    }
  });
