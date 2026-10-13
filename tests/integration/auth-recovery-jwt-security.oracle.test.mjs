import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Fastify from '../../services/api/node_modules/fastify/fastify.js';
import pg from '../../services/api/node_modules/pg/lib/index.js';
import { authPlugin } from '../../services/api/src/plugins/auth.ts';
import { authRoutes } from '../../services/api/src/routes/auth.ts';
import { walletRoutes } from '../../services/api/src/routes/wallet.ts';

const containerName = `auth-security-oracle-${randomUUID()}`;
const mailpitName = `auth-mailpit-oracle-${randomUUID()}`;
const dbName = 'auth_security_oracle';
const dbUser = 'auth_security_oracle';
const dbPassword = randomBytes(18).toString('hex');
const email = `security-${randomUUID()}@example.test`;
const missingEmail = `missing-${randomUUID()}@example.test`;
const realm = 'auth-security-oracle';
const audience = 'broker-api';
const defaultJwtSecret = 'binmax-platform-master-key-32-chars-long!';
const migrationPath = fileURLToPath(new URL('../../db/migrations/0040_users_and_auth.up.sql', import.meta.url));
const identityMigrationPath = fileURLToPath(new URL('../../db/migrations/0041_identity_subject_links.up.sql', import.meta.url));
const previousJwtSecret = process.env.JWT_SECRET;
const previousBlnkUrl = process.env.BLNK_URL;
const previousSmtpHost = process.env.SMTP_HOST;
const previousSmtpPort = process.env.SMTP_PORT;
const previousSmtpFrom = process.env.SMTP_FROM;
const previousSmtpRequireTls = process.env.SMTP_REQUIRE_TLS;
const previousAppPublicUrl = process.env.APP_PUBLIC_URL;
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'oracle-rsa', alg: 'RS256', use: 'sig' };
let containerStarted = false;
let mailpitStarted = false;
let mailpitHttpPort;
let pool;
let app;
let jwksServer;
let failingBlnkServer;
let failingBlnkWrites = 0;
let issuer;
let userId;

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

function compactJwt(header, payload, algorithm) {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = `${encodedHeader}.${encodedPayload}`;
  const signature = algorithm === 'RS256'
    ? sign('RSA-SHA256', Buffer.from(input), privateKey)
    : createHmac('sha256', defaultJwtSecret).update(input).digest();
  return `${input}.${signature.toString('base64url')}`;
}

function claims(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: userId,
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + 300,
    realm_access: { roles: ['USER'] },
    ...overrides,
  };
}

function rs256Token(payload = claims(), headerOverrides = {}) {
  return compactJwt({ alg: 'RS256', kid: 'oracle-rsa', typ: 'Bearer', ...headerOverrides }, payload, 'RS256');
}

async function getMe(token) {
  return app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${token}` } });
}

before(async () => {
  // The fallback secret must be absent so the old code's built-in default is exercised.
  delete process.env.JWT_SECRET;

  jwksServer = createServer((request, response) => {
    if (request.url === `/realms/${realm}/protocol/openid-connect/certs`) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise(resolve => jwksServer.listen(0, '127.0.0.1', resolve));
  const keycloakUrl = `http://127.0.0.1:${jwksServer.address().port}`;
  issuer = `${keycloakUrl}/realms/${realm}`;

  docker('run', '--rm', '-d', '--name', containerName,
    '-e', `POSTGRES_DB=${dbName}`,
    '-e', `POSTGRES_USER=${dbUser}`,
    '-e', `POSTGRES_PASSWORD=${dbPassword}`,
    '-p', '127.0.0.1::5432', 'postgres:16-alpine');
  containerStarted = true;
  const port = docker('port', containerName, '5432/tcp').split(':').at(-1);
  assert.match(port, /^\d+$/);
  pool = new pg.Pool({
    host: '127.0.0.1', port: Number(port), user: dbUser,
    password: dbPassword, database: dbName, max: 5,
    connectionTimeoutMillis: 1000,
  });
  await waitForDatabase(pool);
  docker('run', '--rm', '-d', '--name', mailpitName,
    '-p', '127.0.0.1::1025', '-p', '127.0.0.1::8025', 'axllent/mailpit:v1.21.8');
  mailpitStarted = true;
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = docker('port', mailpitName, '1025/tcp').split(':').at(-1);
  process.env.SMTP_FROM = 'no-reply@example.test';
  process.env.SMTP_REQUIRE_TLS = 'false';
  process.env.APP_PUBLIC_URL = 'http://127.0.0.1:5173';
  mailpitHttpPort = docker('port', mailpitName, '8025/tcp').split(':').at(-1);
  await pool.query(readFileSync(migrationPath, 'utf8'));
  await pool.query(readFileSync(identityMigrationPath, 'utf8'));
  const inserted = await pool.query(
    'INSERT INTO users (name, email, password_hash, password_salt) VALUES ($1, $2, $3, $4) RETURNING id',
    ['Security Oracle', email, 'unused-hash', 'unused-salt'],
  );
  assert.equal(inserted.rowCount, 1);
  userId = inserted.rows[0].id;
  await pool.query(
    `INSERT INTO identity_subject_links (issuer, sub, principal_id, link_method, verified_at)
     VALUES ($1, $2, $3, 'verified_migration', now())`, [issuer, userId, userId],
  );

  app = Fastify({ logger: false });
  app.decorate('pg', pool);
  await app.register(authPlugin, { keycloakUrl, realm });
  await app.register(authRoutes);
  failingBlnkServer = createServer((request, response) => {
    if (request.method !== 'GET') failingBlnkWrites += 1;
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end('{"error":"unavailable"}');
  });
  await new Promise(resolve => failingBlnkServer.listen(0, '127.0.0.1', resolve));
  process.env.BLNK_URL = `http://127.0.0.1:${failingBlnkServer.address().port}`;
  await app.register(walletRoutes);
  await app.ready();
});

after(async () => {
  await app?.close();
  await pool?.end();
  if (containerStarted) docker('rm', '-f', containerName);
  if (mailpitStarted) docker('rm', '-f', mailpitName);
  if (jwksServer) await new Promise(resolve => jwksServer.close(resolve));
  if (failingBlnkServer) await new Promise(resolve => failingBlnkServer.close(resolve));
  if (previousBlnkUrl === undefined) delete process.env.BLNK_URL;
  else process.env.BLNK_URL = previousBlnkUrl;
  for (const [name, value] of [
    ['SMTP_HOST', previousSmtpHost], ['SMTP_PORT', previousSmtpPort],
    ['SMTP_FROM', previousSmtpFrom], ['SMTP_REQUIRE_TLS', previousSmtpRequireTls],
    ['APP_PUBLIC_URL', previousAppPublicUrl],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
});

test('[AC-AUTH-15][S-01] recuperação tem resposta uniforme e não divulga token', async () => {
  const requestRecovery = targetEmail => app.inject({
    method: 'POST', url: '/api/v1/auth/recovery/request', payload: { email: targetEmail },
  });
  const existing = await requestRecovery(email);
  const missing = await requestRecovery(missingEmail);
  assert.equal(existing.statusCode, 200);
  assert.equal(missing.statusCode, 200);

  const persisted = await pool.query(
    'SELECT token FROM password_recovery_tokens WHERE user_id = $1', [userId],
  );
  assert.equal(persisted.rowCount, 1, 'A recuperação da conta existente deve persistir um token real');
  assert.equal((await pool.query('SELECT id FROM users WHERE email = $1', [missingEmail])).rowCount, 0);
  assert.equal(Object.hasOwn(existing.json(), 'token'), false, 'A API nunca deve enviar token de recuperação');
  assert.equal(existing.body.includes(persisted.rows[0].token), false, 'O token persistido não pode aparecer na resposta');
  assert.deepEqual(existing.json(), missing.json(), 'O corpo não deve revelar a existência da conta');
});

test('[AC-AUTH-15][S-01] recuperação entrega link ao email em Mailpit real', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/recovery/request', payload: { email } });
  assert.equal(response.statusCode, 200);
  const message = await fetch(`http://127.0.0.1:${mailpitHttpPort}/view/latest.txt?query=${encodeURIComponent(`to:${email}`)}`);
  assert.equal(message.status, 200, 'A entrega SMTP deve aparecer no Mailpit');
  const body = await message.text();
  assert.match(body, /http:\/\/127\.0\.0\.1:5173\/recuperar#token=[0-9a-f]{64}/);
  assert.equal(response.body.includes(body.match(/token=([0-9a-f]{64})/)?.[1] || 'NOT_DELIVERED'), false);
});

test('[AC-AUTH-15][S-01] token de recuperação só é consumido uma vez sob 12 resets concorrentes', async () => {
  const request = await app.inject({ method: 'POST', url: '/api/v1/auth/recovery/request', payload: { email } });
  assert.equal(request.statusCode, 200);
  const mailbox = await fetch(`http://127.0.0.1:${mailpitHttpPort}/view/latest.txt?query=${encodeURIComponent(`to:${email}`)}`);
  assert.equal(mailbox.status, 200);
  const token = (await mailbox.text()).match(/token=([0-9a-f]{64})/)?.[1];
  assert.ok(token, 'O link enviado deve ter token válido');

  const originalQuery = pool.query.bind(pool);
  let selected = 0;
  let releaseSelects;
  const allSelected = new Promise(resolve => { releaseSelects = resolve; });
  pool.query = async (...args) => {
    const result = await originalQuery(...args);
    if (typeof args[0] === 'string' && args[0].includes('FROM password_recovery_tokens') && args[0].includes('WHERE token = $1')) {
      selected += 1;
      if (selected === 12) releaseSelects();
      await Promise.race([allSelected, new Promise(resolve => setTimeout(resolve, 2000))]);
    }
    return result;
  };
  let responses;
  try {
    responses = await Promise.all(Array.from({ length: 12 }, (_, index) => app.inject({
      method: 'POST', url: '/api/v1/auth/recovery/reset',
      payload: { token, new_password: `ConcurrentPassword${index}123` },
    })));
  } finally {
    pool.query = originalQuery;
  }
  const statuses = responses.map(response => response.statusCode);
  assert.equal(statuses.filter(status => status === 200).length, 1);
  assert.equal(statuses.filter(status => status === 400).length, 11);
  const consumed = await pool.query('SELECT used_at FROM password_recovery_tokens WHERE token = $1', [token]);
  assert.equal(consumed.rowCount, 1);
  assert.ok(consumed.rows[0].used_at);
});

test('[AC-AUTH-12][S-02] segredo padrão HS256 não autentica', async () => {
  const forged = compactJwt({ alg: 'HS256', typ: 'Bearer' }, claims(), 'HS256');
  const response = await getMe(forged);
  assert.equal(response.statusCode, 401);
  assert.notEqual(response.json().id, userId);
});

test('[AC-AUTH-12][S-06] sem segredo configurado o cadastro legado falha sem persistir conta', async () => {
  const candidate = `no-secret-${randomUUID()}@example.test`;
  const response = await app.inject({
    method: 'POST', url: '/api/v1/auth/register',
    payload: { name: 'No Secret', email: candidate, password: 'StrongPassword123' },
  });
  assert.equal(response.statusCode, 503);
  assert.equal((await pool.query('SELECT id FROM users WHERE email = $1', [candidate])).rowCount, 0);
});

test('[AC-AUTH-12][S-02] RS256 válido autentica com JWKS de teste', async () => {
  const response = await getMe(rs256Token());
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().id, userId);
  assert.equal((await pool.query('SELECT id FROM users WHERE id = $1', [userId])).rowCount, 1);
});

test('[AC-AUTH-07][S-03] token válido sem vínculo não fabrica perfil ou saldo', async () => {
  const missingId = randomUUID();
  const response = await getMe(rs256Token(claims({ sub: missingId })));
  assert.equal(response.statusCode, 401);
  assert.equal(Object.hasOwn(response.json(), 'demo_balance_minor'), false);
});

test('[AC-AUTH-06][I-01] Blnk indisponível não responde saldo fictício', async () => {
  const response = await app.inject({
    method: 'GET', url: '/api/v1/wallet',
    headers: { authorization: `Bearer ${rs256Token()}` },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(Object.hasOwn(response.json(), 'available_minor'), false);
  assert.equal(failingBlnkWrites, 0, 'Falha de leitura não deve iniciar onboarding');
});

for (const [claim, makeToken] of [
  ['iss', () => { const payload = claims(); delete payload.iss; return rs256Token(payload); }],
  ['aud', () => { const payload = claims(); delete payload.aud; return rs256Token(payload); }],
  ['typ', () => { const header = { alg: 'RS256', kid: 'oracle-rsa' }; return compactJwt(header, claims(), 'RS256'); }],
]) {
  test(`[AC-AUTH-12][S-02] RS256 sem ${claim} não autentica`, async () => {
    const response = await getMe(makeToken());
    assert.equal(response.statusCode, 401);
    assert.notEqual(response.json().id, userId);
  });
}
