import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { AuthService } from '../../apps/web/src/auth/auth-service';

const controlled = 'No se pudo completar la autenticación. Intenta de nuevo.';
const store = new Map<string, string>();
const setItem = vi.fn((key: string, value: string) => { store.set(key, value); });
const removeItem = vi.fn((key: string) => { store.delete(key); });
const password = 'FixturePassword123';
const email = 'fixture@example.test';
const actions = ['login', 'register', 'reset'] as const;
type Action = typeof actions[number];
const malformed: ReadonlyArray<readonly [string, unknown]> = [
  ['null', null], ['undefined', undefined], ['number', 7], ['string', 'offline'],
  ['no-message', {}], ['message-null', { message: null }],
  ['message-undefined', { message: undefined }], ['message-number', { message: 7 }],
  ['message-boolean', { message: false }], ['message-array', { message: [] }],
  ['boolean', false], ['function', () => undefined], ['array', []],
  ['symbol', Symbol('fixture-rejection')], ['bigint', BigInt(7)], ['message-object', { message: {} }],
];
// Getter/Proxy traps are a separate contract; this matrix covers plain rejection values only.
function invoke(action: Action) {
  if (action === 'login') return AuthService.login({ email, password });
  if (action === 'register') return AuthService.register({ name: 'Fixture User', email: 'new@example.test', password });
  return AuthService.resetPassword({ token: 'fixture-recovery', newPassword: 'ChangedPassword456' });
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  store.clear();
  setItem.mockClear();
  removeItem.mockClear();
  const salt = 'fixture-salt';
  store.set('binmax_auth_users_db', JSON.stringify([{
    id: 'fixture-user', name: 'Fixture User', email, passwordSalt: salt,
    passwordHash: createHash('sha256').update(password + salt).digest('hex'),
    country: 'ES', demoBalanceMinor: 1000000, failedLoginAttempts: 0, lockedUntil: null,
  }]));
  store.set('binmax_auth_recovery_tokens', JSON.stringify([{
    token: 'fixture-recovery', userId: 'fixture-user', expiresAt: '2026-10-10T12:15:00Z', usedAt: null,
  }]));
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem, removeItem,
  } });
  vi.stubGlobal('crypto', { subtle: webcrypto.subtle, getRandomValues: (value: Uint8Array) => value.fill(42) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('[DEF-T13-AUTH-UNKNOWN] Proposed contract; production change requires authorization', () => {
  it.each(actions.flatMap(action => (action === 'reset' ? ['fetch'] : ['fetch', 'json'])
    .flatMap(source => malformed.flatMap(([shape, value]) => ['seeded', 'empty', 'session']
      .map(storage => ({ action, source, shape, value, storage }))))))(
    '$action rejects $source/$shape in $storage with a controlled Error and zero writes', async ({ action, source, value, storage }) => {
      if (storage === 'empty') store.clear();
      if (storage === 'session') store.set('binmax_auth_session', JSON.stringify({
        token: 'fixture-prior-session', user: { id: 'fixture-user', name: 'Fixture User',
          email, country: 'ES', demoBalanceMinor: 1000000 },
      }));
      const before = [...store];
      const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(value);
      if (source === 'json') {
        const response = new Response('{}', { status: action === 'register' ? 201 : 200 });
        vi.spyOn(response, 'json').mockRejectedValue(value);
        fetchMock.mockResolvedValue(response);
      }
      vi.stubGlobal('fetch', fetchMock);
      const error: unknown = await invoke(action).then(() => null, (reason: unknown) => reason);
      expect.soft(setItem).not.toHaveBeenCalled();
      expect.soft(removeItem).not.toHaveBeenCalled();
      expect.soft([...store]).toEqual(before);
      expect.soft(error).toBeInstanceOf(Error);
      expect.soft(error).toHaveProperty('message', controlled);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  it.each([
    { action: 'register' as const, status: 409, message: 'El correo electrónico ya está registrado' },
    { action: 'login' as const, status: 401, message: 'Email o contraseña incorrectos' },
    { action: 'login' as const, status: 429, message: 'Cuenta bloqueada temporalmente' },
    { action: 'reset' as const, status: 400, message: 'El enlace es inválido o ha expirado' },
  ])('$action preserves denial $status without fallback', async ({ action, status, message }) => {
    const before = [...store];
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ message }), { status })));
    await expect(invoke(action)).rejects.toThrow(message);
    expect([...store]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
  it.each((['login', 'register'] as const).flatMap(action => [new Error('offline'), new TypeError('Failed to fetch'), { message: 'offline' }]
    .map(error => ({ action, error }))))('[AC-AUTH-05] $action fails closed on offline API without local writes', async ({ action, error }) => {
    const before = [...store];
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(error));
    await expect(invoke(action)).rejects.toBeInstanceOf(Error);
    expect([...store]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(AuthService.isAuthenticated()).toBe(false);
  });
  it.each([new Error('offline'), new TypeError('Failed to fetch'), { message: 'offline' }])
  ('reset fails closed offline without changing local recovery data', async error => {
    const before = [...store];
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(error));
    await expect(invoke('reset')).rejects.toThrow(controlled);
    expect([...store]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
  });
  it.each(actions)('%s preserves official successful response', async action => {
    const user = { id: 'remote-user', name: 'Remote User', email, country: 'CL', demo_balance_minor: 12345 };
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ token: 'remote-token', user }), {
      status: action === 'register' ? 201 : 200,
    })));
    const result = await invoke(action);
    if (action === 'reset') expect(result).toEqual({ success: true });
    else expect(result).toEqual({ token: 'remote-token', user: {
      id: user.id, name: user.name, email, country: user.country, demoBalanceMinor: 12345,
    } });
  });
});
