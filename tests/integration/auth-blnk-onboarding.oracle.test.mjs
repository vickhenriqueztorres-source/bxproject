import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { BlnkClient } from '../../services/wallet-adapter/src/blnk-client.ts';

const suffix = randomUUID().slice(0, 12);
const network = `auth-blnk-oracle-${suffix}`;
const pgName = `auth-blnk-pg-${suffix}`;
const redisName = `auth-blnk-redis-${suffix}`;
const blnkName = `auth-blnk-core-${suffix}`;
const workerName = `auth-blnk-worker-${suffix}`;
const password = randomBytes(18).toString('hex');
const image = 'ghcr.io/blnkfinance/blnk@sha256:60f5faecbd61232812ee9adff8817cf2322cb2e54d3379cf7a8c71b6513339a9';
const userId = randomUUID();
let tempDir;
let networkCreated = false;
let pgStarted = false;
let redisStarted = false;
let blnkStarted = false;
let workerStarted = false;
let client;

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function waitFor(check, attempts = 60) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { if (await check()) return; } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Blnk descartável indisponível: ${String(lastError)}`);
}

before(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'auth-blnk-oracle-'));
  const configPath = join(tempDir, 'blnk.json');
  writeFileSync(configPath, JSON.stringify({
    project_name: 'Auth Blnk Oracle',
    data_source: { dns: `postgres://blnk:${password}@${pgName}:5432/blnk?sslmode=disable` },
    redis: { dns: `${redisName}:6379` },
    server: { port: '5001' },
  }));
  docker('network', 'create', network);
  networkCreated = true;
  docker('run', '--rm', '-d', '--name', pgName, '--network', network,
    '-e', 'POSTGRES_DB=blnk', '-e', 'POSTGRES_USER=blnk',
    '-e', `POSTGRES_PASSWORD=${password}`, 'postgres:16-alpine');
  pgStarted = true;
  docker('run', '--rm', '-d', '--name', redisName, '--network', network, 'redis:7-alpine');
  redisStarted = true;
  await waitFor(() => docker('exec', pgName, 'pg_isready', '-U', 'blnk', '-d', 'blnk').includes('accepting connections'), 30);
  docker('run', '--rm', '--network', network, '-v', `${configPath}:/blnk.json:ro`, image, 'blnk', 'migrate', 'up');
  docker('run', '--rm', '-d', '--name', blnkName, '--network', network,
    '-p', '127.0.0.1::5001', '-v', `${configPath}:/blnk.json:ro`, image);
  blnkStarted = true;
  docker('run', '--rm', '-d', '--name', workerName, '--network', network,
    '-v', `${configPath}:/blnk.json:ro`, image, 'blnk', 'workers');
  workerStarted = true;
  const port = Number(docker('port', blnkName, '5001/tcp').split(':').at(-1));
  assert.ok(Number.isInteger(port) && port > 0);
  const base = `http://127.0.0.1:${port}`;
  try {
    await waitFor(async () => {
      const response = await fetch(`${base}/health`);
      return response.ok;
    });
  } catch (error) {
    const status = docker('inspect', '--format', '{{.State.Status}} {{.State.ExitCode}}', blnkName);
    const logs = docker('logs', '--tail', '15', blnkName).replaceAll(password, '[redacted]');
    throw new Error(`${String(error)}; container=${status}; logs=${logs}`);
  }
  client = new BlnkClient(base);
});

after(() => {
  if (workerStarted) docker('rm', '-f', workerName);
  if (blnkStarted) docker('rm', '-f', blnkName);
  if (redisStarted) docker('rm', '-f', redisName);
  if (pgStarted) docker('rm', '-f', pgName);
  if (networkCreated) docker('network', 'rm', network);
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

test('[AC-AUTH-06][I-01] Blnk real credita exatamente uma vez após reentrega', async () => {
  const originalFetch = globalThis.fetch;
  const observed = [];
  globalThis.fetch = async (url, options) => {
    const response = await originalFetch(url, options);
    const summary = { method: options?.method || 'GET', path: new URL(url).pathname,
      status: response.status, body: (await response.clone().text()).slice(0, 160) };
    if (!observed.some(item => item.method === summary.method && item.path === summary.path && item.status === summary.status)) {
      observed.push(summary);
    }
    return response;
  };
  try {
    await client.initializeLedgerAndHouseAccounts();
    await client.onboardUser(userId);
  } catch (error) {
    throw new Error(`${String(error)}; Blnk HTTP=${JSON.stringify(observed)}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const first = await client.getBalance(userId);
  assert.equal(first.available_minor, 1_000_000);
  assert.equal(first.reserved_minor, 0);

  await client.onboardUser(userId);
  const repeated = await client.getBalance(userId);
  assert.equal(repeated.available_minor, 1_000_000);
  assert.equal(repeated.reserved_minor, 0);
});

test('[AC-AUTH-06][I-03] 12 provisionamentos concorrentes não duplicam crédito', async () => {
  const concurrentId = randomUUID();
  await Promise.all(Array.from({ length: 12 }, () => client.onboardUser(concurrentId)));
  const balance = await client.getBalance(concurrentId);
  assert.equal(balance.available_minor, 1_000_000);
  assert.equal(balance.reserved_minor, 0);
});
