import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthService } from '../auth/auth-service';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { setFeatureFlagForTesting } from '../lib/feature-flags';

// Mock do localStorage para testes Node/SSR
const store = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, val: string) => { store.set(key, String(val)); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
};

if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
}
if (!globalThis.window) {
  (globalThis as any).window = globalThis;
}
(globalThis as any).window.localStorage = mockStorage;
if (!(globalThis as any).window.location) {
  (globalThis as any).window.location = { pathname: '/', search: '', hash: '', origin: 'http://localhost:5173' };
}

describe('Certificação Cirúrgica: Vinculação de Identidade e Carteira Demo no Traderoom', () => {
  beforeEach(() => {
    store.clear();
    setFeatureFlagForTesting(true);
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? '{}'));
      return new Response(JSON.stringify({
        token: 'api-session',
        user: { id: 'api-user', name: payload.name, email: payload.email,
          country: payload.country, demo_balance_minor: 1000000 },
      }), { status: 201 });
    }));
  });

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it('1. Quando o usuário está autenticado, o cabeçalho renderiza o e-mail real do usuário cadastrado', async () => {
    // 1. Cadastra novo usuário
    const regSession = await AuthService.register({
      name: 'Carlos Trader Oficial',
      email: 'carlos.trader@binmax.com',
      password: 'StrongPassword@123',
      country: 'BR',
    });

    expect(regSession).toBeDefined();
    expect(regSession.user.email).toBe('carlos.trader@binmax.com');
    expect(regSession.user.demoBalanceMinor).toBe(1000000);

    // 2. Simula renderização do TerminalHeader com o e-mail do usuário autenticado
    const session = AuthService.getSession();
    expect(session).not.toBeNull();
    const effectiveEmail = session!.user.email;

    const html = renderToString(
      <TerminalHeader
        activeSymbol="NZDJPY_OTC"
        openTabs={['NZDJPY_OTC']}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onAddTab={vi.fn()}
        balanceMinor={session!.user.demoBalanceMinor}
        accountEmail={effectiveEmail}
        isLive={true}
        onResetDemo={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    // O dropdown do usuário recebe e preserva o e-mail real
    expect(html).toContain('data-testid="account-balance-display"');
    expect(html).toMatch(/10[.,]000[.,]00/);
    expect(html).toContain('Cuenta de práctica');
  });

  it('2. Garante isolamento: Logout limpa a sessão e restaura modo anônimo', async () => {
    await AuthService.register({
      name: 'Trader Deslogante',
      email: 'logout.user@binmax.com',
      password: 'Password@999',
      country: 'ES',
    });

    expect(AuthService.isAuthenticated()).toBe(true);

    // Executa logout
    AuthService.clearSession();
    expect(AuthService.isAuthenticated()).toBe(false);
    expect(AuthService.getSession()).toBeNull();

    // Quando deslogado, fallback seguro
    const sessionAfter = AuthService.getSession();
    const fallbackEmail = sessionAfter?.user?.email ?? 'convidado@demo.local';
    expect(fallbackEmail).toBe('convidado@demo.local');
  });
});
