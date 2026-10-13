import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from '../../services/api/node_modules/pg/lib/index.js';

const suffix = randomUUID().slice(0, 12);
const network = `auth-kc-oracle-${suffix}`;
const pgName = `auth-kc-pg-${suffix}`;
const kcName = `auth-kc-${suffix}`;
const password = randomBytes(18).toString('hex');
const adminPassword = randomBytes(18).toString('hex');
const email = `client-${suffix}@example.test`;
const realmPath = fileURLToPath(new URL('../../infra/keycloak/broker-realm.json', import.meta.url));
const composePath = fileURLToPath(new URL('../../infra/compose.yaml', import.meta.url));
const keycloakImage = 'quay.io/keycloak/keycloak@sha256:09a381c715ab0b111835b70f2905955274843a219c6f27efb348e4d9f4086858';
let networkCreated = false;
let postgresStarted = false;
let keycloakStarted = false;
let pool;

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function waitFor(check, attempts = 100) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try { const result = await check(); if (result) return result; }
    catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Serviço descartável não ficou pronto: ${String(lastError)}`);
}

after(async () => {
  await pool?.end();
  if (keycloakStarted) docker('rm', '-f', kcName);
  if (postgresStarted) docker('rm', '-f', pgName);
  if (networkCreated) docker('network', 'rm', network);
});

test('[AC-AUTH-04][D-01] Compose declara PostgreSQL persistente e importação do realm', () => {
  const config = JSON.parse(execFileSync('docker', ['compose', '-f', composePath, 'config', '--format', 'json'], {
    encoding: 'utf8', env: { ...process.env, KEYCLOAK_DB_PASSWORD: password },
  }));
  const keycloak = config.services.keycloak;
  assert.equal(keycloak.image, keycloakImage);
  assert.equal(keycloak.environment.KC_DB, 'postgres');
  assert.equal(keycloak.environment.KC_DB_URL_HOST, 'keycloak-postgres');
  assert.ok(config.services['keycloak-postgres']);
  assert.ok(keycloak.command.some(part => part.includes('--import-realm')));
  assert.ok(keycloak.volumes.some(volume => volume.target === '/opt/keycloak/data/import/broker-realm.json'));
});

test('[AC-AUTH-04][D-01] cliente sintético fica em PostgreSQL do Keycloak após restart', async () => {
  docker('network', 'create', network);
  networkCreated = true;
  docker('run', '--rm', '-d', '--name', pgName, '--network', network,
    '-e', 'POSTGRES_DB=keycloak', '-e', 'POSTGRES_USER=keycloak',
    '-e', `POSTGRES_PASSWORD=${password}`, '-p', '127.0.0.1::5432', 'postgres:16-alpine');
  postgresStarted = true;
  const pgPort = Number(docker('port', pgName, '5432/tcp').split(':').at(-1));
  pool = new pg.Pool({ host: '127.0.0.1', port: pgPort, database: 'keycloak', user: 'keycloak', password, connectionTimeoutMillis: 1000 });
  await waitFor(async () => { await pool.query('SELECT 1'); return true; }, 30);

  docker('run', '--rm', '-d', '--name', kcName, '--network', network,
    '-p', '127.0.0.1::8080',
    '-e', 'KC_DB=postgres', '-e', `KC_DB_URL_HOST=${pgName}`,
    '-e', 'KC_DB_URL_DATABASE=keycloak', '-e', 'KC_DB_USERNAME=keycloak',
    '-e', `KC_DB_PASSWORD=${password}`,
    '-e', 'KC_BOOTSTRAP_ADMIN_USERNAME=admin', '-e', `KC_BOOTSTRAP_ADMIN_PASSWORD=${adminPassword}`,
    '-v', `${realmPath}:/opt/keycloak/data/import/broker-realm.json:ro`,
    keycloakImage, 'start-dev', '--import-realm', '--hostname-strict=false');
  keycloakStarted = true;
  let kcPort = Number(docker('port', kcName, '8080/tcp').split(':').at(-1));
  let base = `http://127.0.0.1:${kcPort}`;
  try {
    await waitFor(async () => {
      const response = await fetch(`${base}/realms/broker-demo/.well-known/openid-configuration`);
      return response.ok;
    });
  } catch (error) {
    const state = docker('inspect', '--format', '{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}}', kcName);
    const logs = docker('logs', '--tail', '12', kcName);
    throw new Error(`${String(error)}; keycloak=${state}; port=${kcPort}; logs=${logs}`);
  }

  async function adminToken() {
    const response = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: adminPassword }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).access_token;
  }
  const token = await adminToken();
  const created = await fetch(`${base}/admin/realms/broker-demo/users`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ username: email, email, firstName: 'Oracle', lastName: 'Client', enabled: true,
      credentials: [{ type: 'password', value: 'SyntheticPassword123', temporary: false }] }),
  });
  assert.equal(created.status, 201);
  const id = created.headers.get('location')?.split('/').at(-1);
  assert.match(id, /^[0-9a-f-]{36}$/);
  const persisted = await pool.query('SELECT id, email FROM user_entity WHERE id = $1', [id]);
  assert.equal(persisted.rowCount, 1);
  assert.equal(persisted.rows[0].email, email);

  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('hex');
  const redirectUri = 'http://localhost:5173/callback';
  const authorizationUrl = new URL(`${base}/realms/broker-demo/protocol/openid-connect/auth`);
  for (const [key, value] of Object.entries({ client_id: 'broker-web', response_type: 'code',
    redirect_uri: redirectUri, scope: 'openid email profile', state,
    code_challenge: challenge, code_challenge_method: 'S256' })) authorizationUrl.searchParams.set(key, value);
  const loginPage = await fetch(authorizationUrl, { redirect: 'manual' });
  assert.equal(loginPage.status, 200);
  const html = await loginPage.text();
  const formAction = html.match(/<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"/)?.[1]
    || html.match(/<form[^>]+action="([^"]+)"[^>]+id="kc-form-login"/)?.[1];
  assert.ok(formAction, 'Keycloak deve apresentar formulário de login OIDC');
  const cookies = loginPage.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const login = await fetch(formAction.replaceAll('&amp;', '&'), {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies },
    body: new URLSearchParams({ username: email, password: 'SyntheticPassword123' }),
  });
  assert.equal(login.status, 302, 'Credencial válida deve concluir login no Keycloak');
  const callback = new URL(login.headers.get('location'));
  assert.equal(callback.searchParams.get('state'), state);
  const code = callback.searchParams.get('code');
  assert.ok(code);
  const exchanged = await fetch(`${base}/realms/broker-demo/protocol/openid-connect/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'broker-web',
      redirect_uri: redirectUri, code, code_verifier: verifier }),
  });
  assert.equal(exchanged.status, 200, 'Código PKCE deve produzir access token');
  const accessToken = (await exchanged.json()).access_token;
  const claims = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(claims.sub, id);
  assert.ok([claims.aud].flat().includes('broker-api'), 'Access token real deve ter broker-api em aud');

  const legacyId = randomUUID();
  const importedEmail = `legacy-${suffix}@example.test`;
  const imported = await fetch(`${base}/admin/realms/broker-demo/users`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id: legacyId, username: importedEmail, email: importedEmail, enabled: true }),
  });
  assert.equal(imported.status, 201);
  const importedId = imported.headers.get('location')?.split('/').at(-1);
  assert.notEqual(importedId, legacyId, 'Este Keycloak 26 substitui o UUID enviado via Admin REST');
  assert.equal((await pool.query('SELECT id FROM user_entity WHERE id = $1', [importedId])).rowCount, 1);
  assert.equal((await pool.query('SELECT id FROM user_entity WHERE id = $1', [legacyId])).rowCount, 0);

  docker('restart', kcName);
  kcPort = Number(docker('port', kcName, '8080/tcp').split(':').at(-1));
  base = `http://127.0.0.1:${kcPort}`;
  await waitFor(async () => {
    const response = await fetch(`${base}/realms/broker-demo/.well-known/openid-configuration`);
    return response.ok;
  });
  const afterRestart = await fetch(`${base}/admin/realms/broker-demo/users/${id}`, {
    headers: { authorization: `Bearer ${await adminToken()}` },
  });
  assert.equal(afterRestart.status, 200);
  assert.equal((await afterRestart.json()).email, email);
  assert.equal((await pool.query('SELECT id FROM user_entity WHERE email = $1', [email])).rowCount, 1);
  assert.equal((await pool.query('SELECT id FROM user_entity WHERE email = $1 AND id = $2', [importedEmail, importedId])).rowCount, 1);
});
