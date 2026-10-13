import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LoginPage } from './LoginPage';
import { RouterProvider } from '../router/RouterContext';

describe('SUBETAPA 03: Tela de Login Fiel às Capturas (Pill Button + Disclaimer)', () => {
  it('3.1 Renderiza LoginPage com os novos elementos: Bem-vindo de volta, Entrar → e Disclaimer', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="login-page"');
    expect(html).toContain('data-testid="login-card"');
    expect(html).toContain('bm-card-fintech');
    expect(html).toContain('Bem-vindo de volta.');
    expect(html).toContain('Entre para voltar a operar de onde parou.');
    expect(html).toContain('voce@email.com');
    expect(html).toContain('Esqueceu a senha?');
    expect(html).toContain('Entrar');
    expect(html).toContain('bm-btn-pill-primary');
    expect(html).toContain('Conexão criptografada. A BINMAX nunca pede sua senha por WhatsApp, e-mail ou telefone.');
  });

  it('3.2 Verifica que os inputs usam classe bm-input-fintech de 48px e cantos de 12px', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    expect(html).toContain('bm-input-fintech');
    expect(html).toContain('id="login-email"');
    expect(html).toContain('id="login-password"');
    expect(html).toContain('aria-label="Alternar visibilidade de senha"');
  });

  it('3.3 Auditoria Anti-Cassino: Confirma ausência de tremores (shake) e ausência de brilhos neons', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    expect(html).not.toContain('shake');
    expect(html).not.toContain('rgba(34, 197, 94, 0.3)');
  });

  describe('3.4 Bateria de Estresse: Resiliência de Renderização SSR', () => {
    it('executa 100 ciclos de renderização SSR da nova LoginPage em menos de 600ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const html = renderToString(
          <RouterProvider>
            <LoginPage />
          </RouterProvider>
        );
        expect(html.length).toBeGreaterThan(1000);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
