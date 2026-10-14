import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../../App';
import { TournamentsPage } from '../../pages/TournamentsPage';
import { ArenaPage } from '../../pages/ArenaPage';
import { RouterProvider } from '../../router/RouterContext';
import { I18nProvider } from '../../i18n';

describe('Suite 06 — Navegação /torneos -> /arena, /sala/arena e Regressão de Rotas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderAtPath(pathname: string) {
    const store = new Map<string, string>();
    store.set(
      'binmax_auth_session',
      JSON.stringify({
        token: 'arena-test-bearer-token',
        user: { id: 'usr-arena-1', email: 'arena@binmax.test', demoBalanceMinor: 1000000 },
      })
    );
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    };

    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('sessionStorage', mockStorage);
    vi.stubGlobal('window', {
      location: {
        pathname,
        search: '',
        href: `http://localhost:5173${pathname}`,
      },
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      history: {
        pushState: vi.fn(),
        replaceState: vi.fn(),
      },
      scrollTo: vi.fn(),
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    return renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <App />
        </I18nProvider>
      </QueryClientProvider>
    );
  }

  it('6.1 TournamentsPage (/torneos) exibe o botão CTA "Arena Blitz · 15 min" preservando todo o conteúdo original', () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <RouterProvider>
          <TournamentsPage />
        </RouterProvider>
      </I18nProvider>
    );

    expect(html).toContain('Torneos de Trading Cuantitativo');
    expect(html).toContain('Copa BINMAX');
    expect(html).toContain('data-testid="tournaments-arena-blitz-cta"');
    expect(html).toContain('Arena Blitz · 15 min');
    expect(html).toContain('Entrada a partir de US$ 5,00. Top 3 levam o pote.');
  });

  it('6.2 Rota /arena e /sala/arena no App.tsx renderizam a ArenaPage com o Lobby da Arena Blitz', () => {
    const htmlArena = renderAtPath('/arena');
    expect(htmlArena).toContain('data-testid="arena-page-container"');
    expect(htmlArena).toContain('data-testid="arena-lobby-hero"');
    expect(htmlArena).toContain('Binmax Arena · Blitz #492');

    const htmlSalaArena = renderAtPath('/sala/arena');
    expect(htmlSalaArena).toContain('data-testid="arena-page-container"');
    expect(htmlSalaArena).toContain('data-testid="arena-lobby-hero"');
  });

  it('6.3 ArenaPage em modo running renderiza barra, gráfico espelhado, boleta T$ e abas Ranking/Robô/Extrato sem erros', () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <RouterProvider>
          <ArenaPage initialStage="running" initialTab="bot" />
        </RouterProvider>
      </I18nProvider>
    );

    expect(html).toContain('data-testid="arena-page-container"');
    expect(html).toContain('data-testid="arena-live-room"');
    expect(html).toContain('data-testid="arena-ghost-audit"');
    expect(html).toContain('Alpha_Quant · Alpha Quant Index');
  });
});
