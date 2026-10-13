import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Fastify from '../../services/api/node_modules/fastify/fastify.js';
import pg from '../../services/api/node_modules/pg/lib/index.js';
import { authPlugin } from '../../services/api/src/plugins/auth.ts';
import { authRoutes } from '../../services/api/src/routes/auth.ts';

const name = `auth-oracle-${randomUUID()}`;
const dbName = 'auth_oracle';
const dbUser = 'auth_oracle';
const dbPassword = randomBytes(18).toString('hex');
const previousJwtSecret = process.env.JWT_SECRET;
const runId = randomUUID().replaceAll('-', '');
const migrationPath = fileURLToPath(new URL('../../db/migrations/0040_users_and_auth.up.sql', import.meta.url));
let containerStarted = false;
let pool;
let app;

function docker(...args) {
  const executable = process.platform === 'win32' ? 'cmd.exe' : 'docker';
  const commandArgs = process.platform === 'win32' ? ['/d', '/c', 'docker', ...args] : args;
  return execFileSync(executable, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function waitForDatabase(target) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { await target.query('SELECT 1'); return; }
    catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error(`PostgreSQL descartável inacessível: ${String(lastError)}`);
}

before(async () => {
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  docker('run', '--rm', '-d', '--name', name,
    '-e', `POSTGRES_DB=${dbName}`,
    '-e', `POSTGRES_USER=${dbUser}`,
    '-e', `POSTGRES_PASSWORD=${dbPassword}`,
    '-p', '127.0.0.1::5432', 'postgres:16-alpine');
  containerStarted = true;
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  assert.match(port, /^\d+$/);
  pool = new pg.Pool({
    host: '127.0.0.1', port: Number(port), user: dbUser,
    password: dbPassword, database: dbName, max: 20,
    connectionTimeoutMillis: 1000,
  });
  await waitForDatabase(pool);
  await pool.query(readFileSync(migrationPath, 'utf8'));
  app = Fastify({ logger: false });
  app.decorate('pg', pool);
  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.ready();
});

after(async () => {
  await app?.close();
  await pool?.end();
  if (containerStarted) docker('rm', '-f', name);
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
});

test('[AC-AUTH-04] Fastify 201 persiste exatamente uma linha consultada por email e UUID; repetição 409', async () => {
  const email = `solo-${runId}@example.test`;
  const response = await app.inject({
    method: 'POST', url: '/api/v1/auth/register',
    payload: { name: 'Oracle Solo', email: email.toUpperCase(), password: 'StrongPassword123', country: 'BR' },
  });
  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.user.email, email);
  assert.match(body.user.id, /^[0-9a-f-]{36}$/i);
  const byEmail = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
  const byId = await pool.query('SELECT id, email FROM users WHERE id = $1', [body.user.id]);
  assert.equal(byEmail.rowCount, 1);
  assert.deepEqual(byEmail.rows[0], { id: body.user.id, email });
  assert.equal(byId.rowCount, 1);
  assert.deepEqual(byId.rows[0], { id: body.user.id, email });
  const duplicate = await app.inject({
    method: 'POST', url: '/api/v1/auth/register',
    payload: { name: 'Oracle Duplicate', email, password: 'AnotherPassword456' },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal((await pool.query('SELECT id FROM users WHERE email = $1', [email])).rowCount, 1);
});

test('[AC-AUTH-04] 12 cadastros concorrentes dão 1×201, 11×409 e uma única linha real', async () => {
  const email = `parallel-${runId}@example.test`;
  const payload = { name: 'Oracle Parallel', email, password: 'StrongPassword123', country: 'BR' };
  // All twelve real SELECTs complete before any request is allowed to INSERT.
  // This forces the check-then-insert race instead of relying on scheduler luck.
  const originalQuery = pool.query.bind(pool);
  let selectsCompleted = 0;
  let releaseSelects;
  const allSelectsCompleted = new Promise(resolve => { releaseSelects = resolve; });
  pool.query = async (sql, params) => {
    const result = await originalQuery(sql, params);
    if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE email = $1') && params?.[0] === email) {
      selectsCompleted += 1;
      if (selectsCompleted === 12) releaseSelects();
      await allSelectsCompleted;
    }
    return result;
  };
  let responses;
  try {
    responses = await Promise.all(Array.from({ length: 12 }, () => app.inject({
      method: 'POST', url: '/api/v1/auth/register', payload,
    })));
  } finally {
    pool.query = originalQuery;
  }
  assert.equal(selectsCompleted, 12, 'Todos os SELECTs devem ter consultado PostgreSQL real');
  const successes = responses.filter(response => response.statusCode === 201);
  assert.equal(successes.length, 1);
  const persisted = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
  assert.equal(persisted.rowCount, 1);
  assert.deepEqual(persisted.rows[0], { id: successes[0].json().user.id, email });
  const serverErrors = responses.filter(response => response.statusCode >= 500).length;
  assert.equal(serverErrors, 0, `Cadastro concorrente gerou ${serverErrors} resposta(s) 5xx`);
  assert.equal(responses.filter(response => response.statusCode === 409).length, 11);
});
