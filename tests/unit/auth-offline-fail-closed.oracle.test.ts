import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../apps/web/src/auth/auth-service';

const email = 'offline-oracle@example.test';
const password = 'OraclePassword123';
const salt = 'fixed-oracle-salt';
const store = new Map<string, string>();
const setItem = vi.fn((key: string, value: string) => { store.set(key, value); });
const removeItem = vi.fn((key: string) => { store.delete(key); });

beforeEach(() => {
  store.clear();
  setItem.mockClear();
  removeItem.mockClear();
  store.set('binmax_auth_users_db', '[]');
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem,
      removeItem,
    },
  });
  vi.stubGlobal('crypto', webcrypto);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('S-01 / AC-AUTH-05: API indisponível não cria identidade local', () => {
  it.each([
    { failure: 'rede fora', response: () => Promise.reject(new TypeError('Failed to fetch')) },
    { failure: 'HTTP 503', response: () => Promise.resolve(new Response('{}', { status: 503 })) },
  ])('[AC-AUTH-05] cadastro com $failure rejeita sem gravar usuário ou sessão', async ({ response }) => {
    vi.stubGlobal('fetch', vi.fn(response));
    const before = [...store.entries()];

    await expect(AuthService.register({ name: 'Oracle Tester', email, password })).rejects.toBeInstanceOf(Error);

    expect([...store.entries()]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(AuthService.getSession()).toBeNull();
    expect(AuthService.isAuthenticated()).toBe(false);
  });

  it('[AC-AUTH-05] login com registro local prévio e API fora rejeita sem sessão', async () => {
    store.set('binmax_auth_users_db', JSON.stringify([{
      id: 'local-only-user', name: 'Oracle Tester', email,
      passwordSalt: salt,
      passwordHash: createHash('sha256').update(password + salt).digest('hex'),
      country: 'ES', demoBalanceMinor: 1000000,
      failedLoginAttempts: 0, lockedUntil: null,
    }]));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const before = [...store.entries()];

    await expect(AuthService.login({ email, password })).rejects.toBeInstanceOf(Error);

    expect([...store.entries()]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(AuthService.getSession()).toBeNull();
    expect(AuthService.isAuthenticated()).toBe(false);
  });
});

describe('I-01 / AC-AUTH-06: o cliente preserva o saldo retornado pelo servidor', () => {
  it.each([
    { action: 'cadastro', status: 201, call: () => AuthService.register({ name: 'Oracle Tester', email, password }) },
    { action: 'login', status: 200, call: () => AuthService.login({ email, password }) },
  ])('[AC-AUTH-06] $action preserva saldo zero confirmado pelo servidor', async ({ status, call }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'server-issued-token',
      user: { id: 'server-user-id', name: 'Oracle Tester', email, country: 'BR', demo_balance_minor: 0 },
    }), { status, headers: { 'Content-Type': 'application/json' } })));
    const session = await call();
    expect(session.user.demoBalanceMinor).toBe(0);
    expect(AuthService.getSession()?.user.demoBalanceMinor).toBe(0);
  });

  it.each([
    { action: 'cadastro', status: 201, call: () => AuthService.register({ name: 'Oracle Tester', email, password }) },
    { action: 'login', status: 200, call: () => AuthService.login({ email, password }) },
  ])('[AC-AUTH-06] $action rejeita saldo ausente em vez de inventar crédito', async ({ status, call }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'server-issued-token',
      user: { id: 'server-user-id', name: 'Oracle Tester', email, country: 'BR' },
    }), { status, headers: { 'Content-Type': 'application/json' } })));
    await expect(call()).rejects.toBeInstanceOf(Error);
    expect(AuthService.getSession()).toBeNull();
  });
});
