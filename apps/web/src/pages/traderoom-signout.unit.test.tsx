import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { signOut, setGuestMode, isGuestMode } from '../auth/oidc';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { AccountSelectorDropdown } from '../components/header/AccountSelectorDropdown';
import { RouterProvider } from '../router/RouterContext';

describe('TERMINAL & TRADEROOM: Botão Salir / Cerrar Sesión', () => {
  beforeEach(() => {
    const localStore: Record<string, string> = {
      binmax_auth_session: JSON.stringify({ token: 'test-token', user: { id: 'u-1', email: 'trader@binmax.com' } }),
    };
    const sessionStore: Record<string, string> = {
      synth_guest_mode: 'true',
    };

    (globalThis as any).window = {
      location: {
        pathname: '/operar',
        origin: 'https://binmaxbroker.com',
        href: 'https://binmaxbroker.com/operar',
        assign: vi.fn(),
      },
      localStorage: {
        getItem: (k: string) => localStore[k] ?? null,
        setItem: (k: string, v: string) => { localStore[k] = v; },
        removeItem: (k: string) => { delete localStore[k]; },
      },
      sessionStorage: {
        getItem: (k: string) => sessionStore[k] ?? null,
        setItem: (k: string, v: string) => { sessionStore[k] = v; },
        removeItem: (k: string) => { delete sessionStore[k]; },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });

  it('1.1 signOut() limpa tokens em localStorage e encerra modo convidado em sessionStorage', async () => {
    expect(window.localStorage.getItem('binmax_auth_session')).not.toBeNull();
    expect(isGuestMode()).toBe(true);

    await signOut('/');

    expect(window.localStorage.getItem('binmax_auth_session')).toBeNull();
    expect(isGuestMode()).toBe(false);
    expect(window.location.assign).toHaveBeenCalledWith('/');
  });

  it('1.2 signOut() não quebra mesmo se userManager não tiver sessão ativa', async () => {
    await expect(signOut('/')).resolves.not.toThrow();
    expect(window.location.assign).toHaveBeenCalledWith('/');
  });

  it('1.3 TerminalHeader renderiza o botão "Salir" com data-testid="header-signout-button"', () => {
    const handleSignOut = vi.fn();
    const html = renderToString(
      <RouterProvider>
        <TerminalHeader
          activeSymbol="VOL_50"
          openTabs={['VOL_50']}
          onSelectTab={() => {}}
          onCloseTab={() => {}}
          onAddTab={() => {}}
          balanceMinor={1000000}
          accountEmail="trader@binmax.com"
          isLive={true}
          latencyMs={16}
          onResetDemo={() => {}}
          onSignOut={handleSignOut}
          currentLayout="1x1"
          onSelectLayout={() => {}}
          contracts={[]}
          currentPrices={{ VOL_50: 1250.5 }}
        />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="header-signout-button"');
    expect(html).toContain('Salir');
  });

  it('1.4 AccountSelectorDropdown renderiza botão "Cerrar sesión" quando aberto e recebe onSignOut', () => {
    const handleSignOut = vi.fn();
    const html = renderToString(
      <RouterProvider>
        <AccountSelectorDropdown
          balanceMinor={1000000}
          accountType="DEMO"
          onSelectAccountType={() => {}}
          onResetDemo={() => {}}
          accountEmail="trader@binmax.com"
          initialOpen={true}
          onSignOut={handleSignOut}
        />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="dropdown-signout-button"');
    expect(html).toContain('Cerrar sesión');
  });

  it('1.5 Teste de Estresse: 50 chamadas sequenciais de signOut() executam sem exceção', async () => {
    for (let i = 0; i < 50; i++) {
      window.localStorage.setItem('binmax_auth_session', 'dummy');
      setGuestMode(true);
      await signOut('/');
      expect(window.localStorage.getItem('binmax_auth_session')).toBeNull();
      expect(isGuestMode()).toBe(false);
    }
  });
});
