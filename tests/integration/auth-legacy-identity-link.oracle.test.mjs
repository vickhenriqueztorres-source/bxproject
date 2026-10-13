import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Fastify from '../../services/api/node_modules/fastify/fastify.js';
import pg from '../../services/api/node_modules/pg/lib/index.js';
import { authPlugin } from '../../services/api/src/plugins/auth.ts';
import { authRoutes } from '../../services/api/src/routes/auth.ts';
import { contractRoutes } from '../../services/api/src/routes/contracts.ts';

const container = `auth-legacy-link-${randomUUID()}`;
const password = randomBytes(18).toString('hex');
const legacyId = randomUUID();
const otherId = randomUUID();
const ownerSub = randomUUID();
const attackerSub = randomUUID();
const otherSub = randomUUID();
const contractId = randomUUID();
const otherContractId = randomUUID();
const realm = 'legacy-link-oracle';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'legacy-link-test', alg: 'RS256', use: 'sig' };
const migrations = [
  '../../db/migrations/0001_initial_schema.sql',
  '../../db/migrations/0040_users_and_auth.up.sql',
  '../../db/migrations/0041_identity_subject_links.up.sql',
];
const downMigration = fileURLToPath(new URL('../../db/migrations/0041_identity_subject_links.down.sql', import.meta.url));
let started = false;
let pool;
let app;
let jwksServer;
let issuer;

function docker(...args) {
  const executable = process.platform === 'win32' ? 'cmd.exe' : 'docker';
  const commandArgs = process.platform === 'win32' ? ['/d', '/c', 'docker', ...args] : args;
  return execFileSync(executable, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function token(sub, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'legacy-link-test', typ: 'Bearer' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    sub, iss: issuer, aud: 'broker-api', iat: now, exp: now + 300,
    email: 'same@example.test', realm_access: { roles: ['USER'] }, ...overrides,
  })).toString('base64url');
  const input = `${header}.${body}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}

function get(url, subject, overrides) {
  return app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token(subject, overrides)}` } });
}

before(async () => {
  jwksServer = createServer((request, response) => {
    if (request.url === `/realms/${realm}/protocol/openid-connect/certs`) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ keys: [publicJwk] }));
    } else { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => jwksServer.listen(0, '127.0.0.1', resolve));
  const keycloakUrl = `http://127.0.0.1:${jwksServer.address().port}`;
  issuer = `${keycloakUrl}/realms/${realm}`;

  docker('run', '--rm', '-d', '--name', container,
    '-e', 'POSTGRES_DB=auth_legacy_link', '-e', 'POSTGRES_USER=auth_legacy_link',
    '-e', `POSTGRES_PASSWORD=${password}`, '-p', '127.0.0.1::5432', 'postgres:16-alpine');
  started = true;
  const port = Number(docker('port', container, '5432/tcp').split(':').at(-1));
  pool = new pg.Pool({ host: '127.0.0.1', port, database: 'auth_legacy_link',
    user: 'auth_legacy_link', password, max: 16, connectionTimeoutMillis: 1000 });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { await pool.query('SELECT 1'); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(ready, 'PostgreSQL descartável deve iniciar');
  for (const migration of migrations) {
    await pool.query(readFileSync(fileURLToPath(new URL(migration, import.meta.url)), 'utf8'));
  }
  await pool.query(`INSERT INTO users (id, name, email, password_hash, password_salt)
    VALUES ($1, 'Legacy Owner', 'legacy@example.test', 'hash', 'salt'),
           ($2, 'Other Owner', 'other@example.test', 'hash', 'salt')`, [legacyId, otherId]);
  await pool.query(`INSERT INTO indices (symbol, name, base_price, volatility, mean_reversion_speed)
    VALUES ('AUTH-TEST', 'Auth Test', 100, 1, 0.1)`);
  await pool.query(`INSERT INTO contracts
    (id, user_id, symbol, direction, status, stake_minor, entry_price, idempotency_key, expires_at)
    VALUES ($1, $2, 'AUTH-TEST', 'UP', 'SETTLED', 100, 100, 'owner-order', now()),
           ($3, $4, 'AUTH-TEST', 'DOWN', 'SETTLED', 200, 100, 'other-order', now())`,
    [contractId, legacyId, otherContractId, otherId]);
  await pool.query(`INSERT INTO identity_subject_links
    (issuer, sub, principal_id, link_method, verified_at)
    VALUES ($1, $2, $3, 'verified_migration', now()),
           ($1, $4, $5, 'verified_migration', now())`,
    [issuer, ownerSub, legacyId, otherSub, otherId]);

  app = Fastify({ logger: false });
  app.decorate('pg', pool);
  await app.register(authPlugin, { keycloakUrl, realm });
  await app.register(authRoutes);
  await app.register(contractRoutes);
  await app.ready();
});

after(async () => {
  await app?.close();
  await pool?.end();
  if (started) docker('rm', '-f', container);
  if (jwksServer) await new Promise(resolve => jwksServer.close(resolve));
});

test('[AC-AUTH-07A] Keycloak sub vinculado acessa UUID legado e contrato original', async () => {
  const profile = await get('/api/v1/auth/me', ownerSub);
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().id, legacyId);
  const history = await get('/api/v1/contracts', ownerSub);
  assert.equal(history.statusCode, 200);
  assert.deepEqual(history.json().contracts.map(item => item.id), [contractId]);
});

test('[S-04] mesmo email em outro sub não reivindica o principal legado', async () => {
  const profile = await get('/api/v1/auth/me', attackerSub);
  assert.equal(profile.statusCode, 401);
  const history = await get('/api/v1/contracts', attackerSub);
  assert.equal(history.statusCode, 401);
  assert.equal((await get(`/api/v1/contracts/${contractId}`, attackerSub)).statusCode, 401);
});

test('[S-04] segundo principal vinculado só vê os próprios contratos', async () => {
  const history = await get('/api/v1/contracts', otherSub);
  assert.equal(history.statusCode, 200);
  assert.deepEqual(history.json().contracts.map(item => item.id), [otherContractId]);
  assert.equal((await get(`/api/v1/contracts/${contractId}`, otherSub)).statusCode, 404);
});

test('[S-02] issuer diferente não usa vínculo de outro realm', async () => {
  assert.equal((await get('/api/v1/auth/me', ownerSub, { iss: `${issuer}-evil` })).statusCode, 401);
});

test('[I-03] 12 reentregas do mesmo vínculo produzem uma linha', async () => {
  const newPrincipal = randomUUID();
  const newSub = randomUUID();
  const results = await Promise.all(Array.from({ length: 12 }, () => pool.query(
    `INSERT INTO identity_subject_links (issuer, sub, principal_id, link_method, verified_at)
     VALUES ($1, $2, $3, 'verified_migration', now())
     ON CONFLICT (issuer, sub) DO NOTHING`, [issuer, newSub, newPrincipal],
  )));
  assert.equal(results.reduce((sum, result) => sum + result.rowCount, 0), 1);
  assert.equal((await pool.query('SELECT 1 FROM identity_subject_links WHERE issuer = $1 AND sub = $2', [issuer, newSub])).rowCount, 1);
  await assert.rejects(pool.query(
    `INSERT INTO identity_subject_links (issuer, sub, principal_id, link_method, verified_at)
     VALUES ($1, $2, $3, 'verified_migration', now())`, [issuer, attackerSub, legacyId],
  ), { code: '23505' });
});

test('[DB-05] rollback rejeita remoção de vínculos existentes', async () => {
  await assert.rejects(pool.query(readFileSync(downMigration, 'utf8')), { code: 'P0001' });
  assert.equal((await pool.query('SELECT 1 FROM identity_subject_links WHERE issuer = $1 AND sub = $2', [issuer, ownerSub])).rowCount, 1);
});

test('[S-03] falha do armazenamento de vínculos fecha acesso sem usar sub direto', async () => {
  await pool.query('DROP TABLE identity_subject_links');
  const response = await get('/api/v1/contracts', ownerSub);
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, 'IDENTITY_UNAVAILABLE');
});

test('[DB-05] rollback permite remover somente tabela vazia', async () => {
  await pool.query(readFileSync(fileURLToPath(new URL(migrations.at(-1), import.meta.url)), 'utf8'));
  await pool.query(readFileSync(downMigration, 'utf8'));
  assert.equal((await pool.query(`SELECT to_regclass('identity_subject_links') AS table_name`)).rows[0].table_name, null);
});
