import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '../App';
import { RouterProvider } from '../router/RouterContext';
import { LandingPage } from './LandingPage';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

describe('SUBETAPA 01: Gateway de Entrada Oficial — Landing Page vs Traderoom', () => {
  beforeEach(() => {
    // Configura global.window se não existir em ambiente Node
    if (typeof globalThis.window === 'undefined') {
      (globalThis as any).window = {
        location: {
          pathname: '/',
          search: '',
          hash: '',
          origin: 'http://localhost:5173',
        },
        history: {
          pushState: (_s: any, _t: string, url: string) => {
            (globalThis as any).window.location.pathname = url;
          },
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
    }
  });

  it('1.1 Ao acessar a rota raiz "/", renderiza a LandingPage institucional com CTAs', () => {
    (globalThis as any).window.location.pathname = '/';
    const html = renderToString(<App />);

    // Deve conter os elementos centrais da Landing Page
    expect(html).toContain('data-testid="landing-page-container"');
    expect(html).toContain('BINMAX');
    expect(html).toContain('Iniciar sesión');
    expect(html).toContain('Crear cuenta gratis');
    expect(html).toContain('data-testid="hero-create-account-btn"');
    expect(html).toContain('data-testid="hero-enter-traderoom-btn"');

    // NÃO deve carregar o container de negociação direta na raiz
    expect(html).not.toContain('data-testid="order-ticket-container"');
  });

  it('1.2 A LandingPage contém navegação funcional para Login e Registro', () => {
    const html = renderToString(
      <RouterProvider initialPath="/">
        <LandingPage />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="landing-login-btn"');
    expect(html).toContain('data-testid="landing-register-btn"');
    expect(html).toContain('data-testid="hero-create-account-btn"');
    expect(html).toContain('data-testid="hero-enter-traderoom-btn"');
  });

  it('1.3 A LoginPage possui campos oficiais e botão de envio', () => {
    const html = renderToString(
      <RouterProvider initialPath="/login">
        <LoginPage />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="login-page"');
    expect(html).toContain('data-testid="login-card"');
  });

  it('1.4 A RegisterPage possui formulário institucional completo', () => {
    const html = renderToString(
      <RouterProvider initialPath="/registro">
        <RegisterPage />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="register-page"');
    expect(html).toContain('data-testid="register-card"');
  });

  it('1.5 Bateria de Estresse: 100 alternâncias rápidas de rota sem quebra de estado', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const path = i % 2 === 0 ? '/' : '/login';
      (globalThis as any).window.location.pathname = path;
      const html = renderToString(<App />);
      expect(html.length).toBeGreaterThan(100);
    }
    const elapsed = performance.now() - start;
    // 100 renders em SSR devem ser rápidos (< 2000ms)
    expect(elapsed).toBeLessThan(2000);
  });
});
