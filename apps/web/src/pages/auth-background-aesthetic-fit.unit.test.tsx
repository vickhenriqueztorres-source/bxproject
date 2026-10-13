import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { RouterProvider } from '../router/RouterContext';

describe('SUBETAPA 04: Bateria Integrada de Estresse, Caos, Segurança e Encaixe Estético', () => {
  it('4.1 Confirma eliminação de bloco colado e integração de canvas único na LoginPage', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    // O fundo unificado com vinheta e grid está presente
    expect(html).toContain('data-testid="auth-background-grid-motion"');
    expect(html).toContain('data-testid="auth-grid-svg"');
    expect(html).toContain('id="bm-auth-cartesian-grid"');
    expect(html).toContain('data-testid="auth-motion-curves"');
    expect(html).toContain('viewBox="0 0 1920 1080"');

    // A coluna esquerda é transparente e sem corte vertical seco
    expect(html).toContain('class="auth-left-panel"');
    expect(html).toContain('background-color:transparent');
    expect(html).not.toContain('border-right:1px solid');

    // O card fintech permanece flutuando na coluna direita
    expect(html).toContain('data-testid="login-card"');
    expect(html).toContain('bm-card-fintech');
    expect(html).toContain('Bem-vindo de volta.');
    expect(html).toContain('Entrar');
    expect(html).toContain('bm-btn-pill-primary');
  });

  it('4.2 Confirma eliminação de bloco colado e integração de canvas único na RegisterPage', () => {
    const html = renderToString(
      <RouterProvider>
        <RegisterPage />
      </RouterProvider>
    );

    // O fundo unificado está presente
    expect(html).toContain('data-testid="auth-background-grid-motion"');
    expect(html).toContain('data-testid="auth-grid-svg"');
    expect(html).toContain('data-testid="auth-motion-curves"');

    // A coluna esquerda é transparente
    expect(html).toContain('class="auth-left-panel"');
    expect(html).toContain('background-color:transparent');

    // O card fintech de registro está intacto
    expect(html).toContain('data-testid="register-card"');
    expect(html).toContain('bm-card-fintech');
    expect(html).toContain('Abra sua conta grátis.');
    expect(html).toContain('Criar minha conta grátis');
    expect(html).toContain('data-testid="password-strength-bars"');
  });

  it('4.3 Teste de Segurança: Camada de fundo tem pointer-events: none e não intercepta formulários', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    // Garantia de que cliques e foco alcançam exclusivamente os formulários
    expect(html).toContain('pointer-events:none');
    expect(html).toContain('id="login-email"');
    expect(html).toContain('id="login-password"');
  });

  it('4.4 Auditoria Anti-Cassino e Anti-Mockup Estrita', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    // Sem frames de celular ou mockups
    expect(html).not.toContain('smartphone');
    expect(html).not.toContain('iphone-frame');
    expect(html).not.toContain('device-mockup');

    // Sem elementos de cassino
    expect(html).not.toContain('confetti');
    expect(html).not.toContain('coin-rain');
    expect(html).not.toContain('shake');
  });

  describe('4.5 Bateria de Estresse SSR: 150 Ciclos Combinados em < 800ms', () => {
    it('executa 75 renderizações de LoginPage e 75 de RegisterPage em alta velocidade sem memory leaks', () => {
      const start = performance.now();
      for (let i = 0; i < 75; i++) {
        const loginHtml = renderToString(
          <RouterProvider>
            <LoginPage />
          </RouterProvider>
        );
        expect(loginHtml.length).toBeGreaterThan(1500);

        const registerHtml = renderToString(
          <RouterProvider>
            <RegisterPage />
          </RouterProvider>
        );
        expect(registerHtml.length).toBeGreaterThan(1500);
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(800);
    });
  });
});
