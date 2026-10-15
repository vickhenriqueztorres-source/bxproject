// AC-ACTIVE-FEED-1: Dado PostgreSQL 16 efêmero e uma porta livre,
// quando o script real sobe com DEV_FEED_PORT, então /health atende nessa porta
// e o processo encerra sem interferir no feed já aberto em 3001.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { assertNotProduction, createEphemeralPostgres, createEphemeralRedis } from '../helpers/chart-durability-postgres.mjs';

assertNotProduction();
let environment;
let redis;
let feed;
let feedOutput = '';

before(async () => {
  environment = await createEphemeralPostgres();
  redis = await createEphemeralRedis();
  for (const migration of ['0001_initial_schema.sql', '0010_seed_multi_assets.up.sql',
    '0050_rename_synthetic_indices.up.sql']) {
    await environment.pool.query(await readFile(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'));
  }
}, { timeout: 120_000 });

after(async () => {
  if (feed && feed.exitCode === null && feed.signalCode === null) {
    const exited = once(feed, 'exit');
    feed.kill();
    await Promise.race([exited, pause(3_000)]);
    assert(feed.exitCode !== null || feed.signalCode !== null, `owned feed process ${feed.pid} did not stop`);
  }
  try { if (redis) await redis.dispose(); }
  finally { if (environment) await environment.dispose(); }
}, { timeout: 65_000 });

async function freeLoopbackPort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

test('[M-03][AC-ACTIVE-FEED-1] real feed binds an ephemeral port and stops without touching port 3001',
  { timeout: 25_000 }, async () => {
    const port = await freeLoopbackPort();
    assert.notEqual(port, 3001);
    const { host, port: dbPort, user, password, database } = environment.pool.options;
    const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${dbPort}/${database}`;
    feed = spawn(process.execPath, [fileURLToPath(new URL('../../scripts/dev-live-feed.mjs', import.meta.url))], {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      env: {
        ...process.env,
        TARGET_ENV: 'ephemeral',
        NODE_ENV: 'test',
        DEV_FEED_PORT: String(port),
        DATABASE_URL: databaseUrl,
        REDIS_URL: redis.url,
        BLNK_URL: 'http://127.0.0.1:1',
        JWT_SECRET: 'qa-ephemeral-feed-only',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    for (const stream of [feed.stdout, feed.stderr]) {
      stream.on('data', chunk => { feedOutput = (feedOutput + chunk.toString()).slice(-4_000); });
    }
    let response;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (feed.exitCode !== null) break;
      try {
        response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(200) });
        if (response.ok) break;
      } catch { /* the owned feed is still starting */ }
      await pause(100);
    }
    assert(response?.ok, `feed did not bind DEV_FEED_PORT=${port}; exit=${feed.exitCode}; output=${feedOutput}`);
    assert.equal((await response.json()).service, 'dev-live-feed');
    assert.equal(feed.exitCode, null);
  });
