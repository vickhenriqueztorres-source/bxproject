import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { RouterProvider } from '../router/RouterContext';

describe('SUBETAPA 04: Integração do Fundo Grid Cartesiano com Motion Design no Auth', () => {
  it('4.1 Renderiza AuthBackgroundGridMotion em LoginPage sem deslocar o card de login', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    // Camada de fundo presente e devidamente configurada
    expect(html).toContain('data-testid="auth-background-grid-motion"');
    expect(html).toContain('data-testid="auth-grid-svg"');
    expect(html).toContain('data-testid="auth-motion-curves"');
    expect(html).toContain('bm-bg-curve-motion');
    expect(html).toContain('bm-bg-glow-drift');

    // Card do formulário intacto e preservado
    expect(html).toContain('data-testid="login-card"');
    expect(html).toContain('bm-card-fintech');
    expect(html).toContain('Bem-vindo de volta.');
    expect(html).toContain('Entrar');
    expect(html).toContain('bm-btn-pill-primary');
  });

  it('4.2 Renderiza AuthBackgroundGridMotion em RegisterPage sem deslocar o card de registro', () => {
    const html = renderToString(
      <RouterProvider>
        <RegisterPage />
      </RouterProvider>
    );

    // Camada de fundo presente e devidamente configurada
    expect(html).toContain('data-testid="auth-background-grid-motion"');
    expect(html).toContain('data-testid="auth-grid-svg"');
    expect(html).toContain('data-testid="auth-motion-curves"');
    expect(html).toContain('bm-bg-curve-motion');
    expect(html).toContain('bm-bg-glow-drift');

    // Card de registro intacto e preservado
    expect(html).toContain('data-testid="register-card"');
    expect(html).toContain('bm-card-fintech');
    expect(html).toContain('Abra sua conta grátis.');
    expect(html).toContain('Criar minha conta grátis');
    expect(html).toContain('bm-btn-pill-primary');
    expect(html).toContain('data-testid="password-strength-bars"');
  });

  it('4.3 Auditoria Anti-Cassino e Requisitos do Usuário (Sem mockup de celular, motion orgânico suave)', () => {
    const htmlLogin = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    // Sem menção a mockups de aparelho/celular no código de fundo
    expect(htmlLogin).not.toContain('smartphone-mockup');
    expect(htmlLogin).not.toContain('iphone-frame');

    // Ausência de animações apelativas de cassino
    expect(htmlLogin).not.toContain('shake');
    expect(htmlLogin).not.toContain('confetti');
    expect(htmlLogin).not.toContain('coin-rain');

    // Coordenadas SVG cartesianas e gradientes de precisão
    expect(htmlLogin).toContain('url(#bm-auth-cartesian-grid)');
    expect(htmlLogin).toContain('bm-curve-stroke');
    expect(htmlLogin).toContain('bm-curve-fill');
  });

  describe('4.4 Bateria de Estresse: 150 Ciclos Combinados SSR em < 800ms', () => {
    it('executa 75 renders de LoginPage e 75 de RegisterPage com fundo SVG em alta velocidade', () => {
      const start = performance.now();
      for (let i = 0; i < 75; i++) {
        const loginHtml = renderToString(
          <RouterProvider>
            <LoginPage />
          </RouterProvider>
        );
        expect(loginHtml.length).toBeGreaterThan(1200);

        const registerHtml = renderToString(
          <RouterProvider>
            <RegisterPage />
          </RouterProvider>
        );
        expect(registerHtml.length).toBeGreaterThan(1200);
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(800);
    });
  });
});
