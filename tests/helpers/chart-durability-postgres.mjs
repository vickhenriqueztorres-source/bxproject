import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { setTimeout as pause } from 'node:timers/promises';
import pg from '../../services/tick-engine/node_modules/pg/lib/index.js';

const execute = promisify(execFile);
const label = 'io.binmax.chart-durability-run';

export function assertNotProduction() {
  assert.equal(process.env.TARGET_ENV, 'ephemeral', 'TARGET_ENV must be ephemeral');
  assert.notEqual(process.env.NODE_ENV, 'production', 'Production is forbidden');
}

async function docker(args, secret = '') {
  const executable = process.platform === 'win32' ? 'wsl.exe' : 'docker';
  const prefix = process.platform === 'win32'
    ? ['-d', 'Ubuntu', '-u', 'phase1runner', '--', 'docker'] : [];
  try {
    const result = await execute(executable, [...prefix, '--context', 'default', ...args], {
      timeout: 20_000, maxBuffer: 1024 * 1024, windowsHide: true,
    });
    return result.stdout.trim();
  } catch (error) {
    const detail = String(error.stderr ?? '').replaceAll(secret || '\0', '[REDACTED]');
    throw new Error(`DOCKER_${args[0]}_${error.killed ? 'DEADLINE_20S' : 'FAILED'}: ${detail}`);
  }
}

export async function createEphemeralPostgres() {
  assertNotProduction();
  const endpoint = await docker(['context', 'inspect', 'default', '--format', '{{.Endpoints.docker.Host}}']);
  assert.equal(endpoint, 'unix:///var/run/docker.sock', 'Only the local Unix Docker daemon is allowed');
  const runId = randomUUID();
  const name = `qa-chart-${runId}`;
  const password = randomBytes(24).toString('hex');
  let pool;
  let createAttempted = false;
  async function dispose() {
    if (pool) await pool.end();
    if (!createAttempted) return;
    const found = await docker(['ps', '-aq', '--filter', `name=^/${name}$`, '--filter', `label=${label}=${runId}`]);
    if (!found) return;
    const owned = JSON.parse(await docker(['inspect', name]))[0];
    assert.equal(owned.Config.Labels[label], runId, 'Refuse cleanup of another run');
    assert.equal(owned.Name, `/${name}`);
    await docker(['rm', '--force', '--volumes', owned.Id]);
  }
  try {
    createAttempted = true;
    await docker(['run', '--detach', '--pull=never', '--name', name,
      '--label', `${label}=${runId}`, '--publish', '127.0.0.1::5432',
      '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=256m',
      '--env', 'POSTGRES_DB=chart_qa', '--env', 'POSTGRES_USER=chart_qa',
      '--env', `POSTGRES_PASSWORD=${password}`, 'postgres:16-alpine'], password);
    const info = JSON.parse(await docker(['inspect', name]))[0];
    assert.equal(info.Config.Labels[label], runId);
    assert.deepEqual(info.Mounts.filter(m => m.Type === 'bind'), [], 'Host bind mounts are forbidden');
    const binding = info.NetworkSettings.Ports['5432/tcp'];
    assert.equal(binding.length, 1);
    assert.equal(binding[0].HostIp, '127.0.0.1');
    const port = Number(binding[0].HostPort);
    assert(Number.isInteger(port) && port > 0);
    const connection = { host: '127.0.0.1', port, database: 'chart_qa', user: 'chart_qa', password,
      max: 20, connectionTimeoutMillis: 2_000, query_timeout: 5_000,
      statement_timeout: 4_000, idle_in_transaction_session_timeout: 5_000 };
    pool = new pg.Pool(connection);
    let ready = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      try { await pool.query('SELECT 1'); ready = true; break; }
      catch (error) {
        if (attempt === 44) throw new Error(`EPHEMERAL_POSTGRES_UNREACHABLE: ${error.code ?? error.name}`);
        await pause(250);
      }
    }
    assert(ready);
    console.log(JSON.stringify({ runId, container: name, image: info.Config.Image,
      imageId: info.Image, publishedHost: '127.0.0.1', publishedPort: port, environment: 'ephemeral' }));
    return { pool, dispose, runId, createPool: overrides => new pg.Pool({ ...connection, ...overrides }) };
  } catch (error) {
    try { await dispose(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], `Setup failed; inspect owned container ${name}`); }
    throw error;
  }
}

export async function createEphemeralRedis() {
  assertNotProduction();
  const endpoint = await docker(['context', 'inspect', 'default', '--format', '{{.Endpoints.docker.Host}}']);
  assert.equal(endpoint, 'unix:///var/run/docker.sock', 'Only the local Unix Docker daemon is allowed');
  const runId = randomUUID();
  const name = `qa-feed-redis-${runId}`;
  const redisLabel = 'io.binmax.active-feed-redis-run';
  let createAttempted = false;
  async function dispose() {
    if (!createAttempted) return;
    const found = await docker(['ps', '-aq', '--filter', `name=^/${name}$`, '--filter', `label=${redisLabel}=${runId}`]);
    if (!found) return;
    const owned = JSON.parse(await docker(['inspect', name]))[0];
    assert.equal(owned.Config.Labels[redisLabel], runId, 'Refuse cleanup of another run');
    assert.equal(owned.Name, `/${name}`);
    await docker(['rm', '--force', '--volumes', owned.Id]);
  }
  try {
    createAttempted = true;
    await docker(['run', '--detach', '--pull=never', '--name', name,
      '--label', `${redisLabel}=${runId}`, '--publish', '127.0.0.1::6379',
      'redis:7-alpine', 'redis-server', '--appendonly', 'no']);
    const info = JSON.parse(await docker(['inspect', name]))[0];
    assert.equal(info.Config.Labels[redisLabel], runId);
    assert.deepEqual(info.Mounts.filter(m => m.Type === 'bind'), [], 'Host bind mounts are forbidden');
    const binding = info.NetworkSettings.Ports['6379/tcp'];
    assert.equal(binding.length, 1);
    assert.equal(binding[0].HostIp, '127.0.0.1');
    const port = Number(binding[0].HostPort);
    assert(Number.isInteger(port) && port > 0);
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        ready = (await docker(['exec', name, 'redis-cli', 'PING'])) === 'PONG';
        if (ready) break;
      } catch { /* isolated container is still starting */ }
      await pause(250);
    }
    assert(ready, 'Ephemeral Redis did not answer PING');
    console.log(JSON.stringify({ runId, container: name, image: info.Config.Image,
      imageId: info.Image, publishedHost: '127.0.0.1', publishedPort: port, environment: 'ephemeral' }));
    return { url: `redis://127.0.0.1:${port}`, port, dispose, runId };
  } catch (error) {
    try { await dispose(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], `Setup failed; inspect owned container ${name}`); }
    throw error;
  }
}
