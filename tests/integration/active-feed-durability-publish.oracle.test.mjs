// AC-ACTIVE-FEED-3: Dado feed real e PostgreSQL/Redis efêmeros, quando chega
// um tick WS, então seu preço, sequence, hash e outbox já estão confirmados.
// AC-ACTIVE-FEED-4: Dada falha real na INSERT da outbox, quando o próximo tick
// é tentado, então a injeção é provada e nenhum tick é gravado ou transmitido.
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
  try { if (redis) await redis.dispose(); }
  finally { if (postgres) await postgres.dispose(); }
}, { timeout: 90_000 });

async function subscribe(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ticks`);
  const messages = [];
  socket.on('message', raw => {
    try { messages.push(JSON.parse(raw.toString())); }
    catch { /* malformed frame is separately visible in the raw feed */ }
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  socket.send(JSON.stringify({ type: 'subscribe', symbol }));
  return { socket, messages };
}

async function waitForTick(messages) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const tick = messages.find(message => message.type === 'tick' && message.symbol === symbol);
    if (tick) return tick;
    await pause(100);
  }
  assert.fail(`No ${symbol} tick arrived within 6 seconds`);
}

test('[M-03][R-01][AC-ACTIVE-FEED-3] every WebSocket tick is already committed with one outbox event',
  { timeout: 90_000 }, async () => {
    let feed;
    let socket;
    try {
      feed = await startEphemeralFeed({ databaseUrl: databaseUrlOf(postgres), redisUrl: redis.url });
      const subscription = await subscribe(feed.port);
      socket = subscription.socket;
      const { messages } = subscription;
      const tick = await waitForTick(messages);
      const stored = await postgres.pool.query(`SELECT sequence,price,hash FROM ticks
        WHERE symbol=$1 AND sequence=$2`, [symbol, tick.sequence]);
      assert.equal(stored.rowCount, 1, `WS published uncommitted sequence ${tick.sequence}`);
      assert.equal(Number(stored.rows[0].price), Number(tick.price));
      assert.equal(stored.rows[0].hash, tick.hash);
      const outbox = await postgres.pool.query(`SELECT payload FROM outbox_events
        WHERE payload->>'symbol'=$1 AND payload->>'sequence'=$2`, [symbol, String(tick.sequence)]);
      assert.equal(outbox.rowCount, 1, 'tick and outbox are not 1:1 at broadcast time');
      assert.equal(Number(outbox.rows[0].payload.price), Number(tick.price));
    } finally {
      if (socket) socket.close();
      await stopEphemeralFeed(feed);
    }
  });

test('[M-03][R-01][AC-ACTIVE-FEED-4] real outbox failure prevents DB state change and any WS tick',
  { timeout: 90_000 }, async () => {
    await postgres.pool.query(`CREATE SEQUENCE qa_outbox_failure_probe;
      CREATE FUNCTION qa_force_outbox_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.payload->>'symbol' = 'VOL_50' THEN
          PERFORM nextval('qa_outbox_failure_probe');
          RAISE EXCEPTION 'QA_FORCED_OUTBOX_FAILURE' USING ERRCODE='P0001';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER qa_outbox_fail BEFORE INSERT ON outbox_events
      FOR EACH ROW EXECUTE FUNCTION qa_force_outbox_failure()`);
    const beforeState = (await postgres.pool.query(`SELECT last_sequence,last_price,last_hash
      FROM index_state WHERE symbol=$1`, [symbol])).rows[0];
    const beforeTicks = (await postgres.pool.query(`SELECT count(*)::int AS n FROM ticks WHERE symbol=$1`, [symbol])).rows[0].n;
    const beforeOutbox = (await postgres.pool.query(`SELECT count(*)::int AS n FROM outbox_events
      WHERE payload->>'symbol'=$1`, [symbol])).rows[0].n;
    let feed;
    let socket;
    let messages = [];
    try {
      try { feed = await startEphemeralFeed({ databaseUrl: databaseUrlOf(postgres), redisUrl: redis.url }); }
      catch { /* fail-closed startup is acceptable only if the failure probe fired */ }
      if (feed) ({ socket, messages } = await subscribe(feed.port));
      await pause(2_500);
      const probe = (await postgres.pool.query('SELECT is_called FROM qa_outbox_failure_probe')).rows[0];
      assert.equal(probe.is_called, true, 'injection was not exercised by the live tick path');
      const afterState = (await postgres.pool.query(`SELECT last_sequence,last_price,last_hash
        FROM index_state WHERE symbol=$1`, [symbol])).rows[0];
      const afterTicks = (await postgres.pool.query(`SELECT count(*)::int AS n FROM ticks WHERE symbol=$1`, [symbol])).rows[0].n;
      const afterOutbox = (await postgres.pool.query(`SELECT count(*)::int AS n FROM outbox_events
        WHERE payload->>'symbol'=$1`, [symbol])).rows[0].n;
      assert.deepEqual(afterState, beforeState, 'state changed despite aborted tick transaction');
      assert.equal(afterTicks, beforeTicks, 'tick survived failed outbox transaction');
      assert.equal(afterOutbox, beforeOutbox, 'outbox changed despite rejected INSERT');
      assert.equal(messages.filter(message => message.type === 'tick' && message.symbol === symbol).length, 0,
        'client received an official tick that did not commit');
    } finally {
      if (socket) socket.close();
      await stopEphemeralFeed(feed);
    }
  });
