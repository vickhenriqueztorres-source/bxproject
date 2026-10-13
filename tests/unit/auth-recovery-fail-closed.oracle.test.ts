import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../apps/web/src/auth/auth-service';

const store = new Map<string, string>();
const setItem = vi.fn((key: string, value: string) => { store.set(key, value); });

beforeEach(() => {
  store.clear();
  setItem.mockClear();
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem,
    removeItem: (key: string) => { store.delete(key); },
  } });
  vi.stubGlobal('crypto', webcrypto);
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('AC-AUTH-15: recuperação depende exclusivamente do servidor', () => {
  it('falha de rede na solicitação não cria token local', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(AuthService.requestPasswordRecovery('oracle@example.test')).rejects.toBeInstanceOf(Error);
    expect(setItem).not.toHaveBeenCalled();
    expect(store.has('binmax_auth_recovery_tokens')).toBe(false);
  });

  it('resposta pública uniforme não contém token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })));
    await expect(AuthService.requestPasswordRecovery('oracle@example.test')).resolves.toEqual({ success: true });
    expect(setItem).not.toHaveBeenCalled();
  });

  it('falha de rede no reset não altera senha local', async () => {
    store.set('binmax_auth_recovery_tokens', JSON.stringify([{ token: 'legacy-token', userId: 'legacy', expiresAt: new Date(Date.now() + 60000).toISOString(), usedAt: null }]));
    store.set('binmax_auth_users_db', JSON.stringify([{ id: 'legacy', email: 'oracle@example.test', passwordHash: 'old', passwordSalt: 'salt' }]));
    const before = [...store.entries()];
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(AuthService.resetPassword({ token: 'legacy-token', newPassword: 'FreshPassword123' })).rejects.toBeInstanceOf(Error);
    expect([...store.entries()]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
  });
});
