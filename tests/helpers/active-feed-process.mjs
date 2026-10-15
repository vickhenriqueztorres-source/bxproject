import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as pause } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { assertNotProduction } from './chart-durability-postgres.mjs';

export async function freeLoopbackPort() {
  assertNotProduction();
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  assert.notEqual(port, 3001, 'Never bind the existing developer feed port');
  return port;
}

export function databaseUrlOf(environment) {
  const { host, port, user, password, database } = environment.pool.options;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export async function startEphemeralFeed({
  databaseUrl,
  redisUrl,
  port,
  blnkUrl = 'http://127.0.0.1:1',
  jwtSecret = 'qa-ephemeral-feed-only',
}) {
  assertNotProduction();
  port ??= await freeLoopbackPort();
  assert.notEqual(port, 3001);
  let output = '';
  const child = spawn(process.execPath, [fileURLToPath(new URL('../../scripts/dev-live-feed.mjs', import.meta.url))], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: {
      ...process.env,
      TARGET_ENV: 'ephemeral', NODE_ENV: 'test', DEV_FEED_PORT: String(port),
      DATABASE_URL: databaseUrl, REDIS_URL: redisUrl,
      BLNK_URL: blnkUrl, JWT_SECRET: jwtSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => { output = (output + chunk.toString()).slice(-4_000); });
  }
  try {
    let response;
    for (let attempt = 0; attempt < 300; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null) break;
      try {
        response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(200) });
        if (response.ok) break;
      } catch { /* the owned feed is still starting */ }
      await pause(100);
    }
    assert(response?.ok, `feed did not bind DEV_FEED_PORT=${port}; exit=${child.exitCode}; output=${output}`);
    assert.equal((await response.json()).service, 'dev-live-feed');
    return { child, port, get output() { return output; } };
  } catch (error) {
    await stopEphemeralFeed({ child });
    throw error;
  }
}

export async function stopEphemeralFeed(feed) {
  if (!feed?.child) return;
  const { child } = feed;
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await Promise.race([exited, pause(3_000)]);
    assert(child.exitCode !== null || child.signalCode !== null, `owned feed process ${child.pid} did not stop`);
  }
}
