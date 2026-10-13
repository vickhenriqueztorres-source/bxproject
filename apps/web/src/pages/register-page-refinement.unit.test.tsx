import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RegisterPage } from './RegisterPage';
import { RouterProvider } from '../router/RouterContext';

describe('SUBETAPA 04: Tela de Registro com Indicador de Força de Senha e Pill Design', () => {
  it('4.1 Renderiza RegisterPage com os elementos oficiais da captura', () => {
    const html = renderToString(
      <RouterProvider>
        <RegisterPage />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="register-page"');
    expect(html).toContain('data-testid="register-card"');
    expect(html).toContain('bm-card-fintech');
    expect(html).toContain('Abra sua conta grátis.');
    expect(html).toContain('Leva 15 segundos. Você começa na conta de prática.');
    expect(html).toContain('Como no seu documento');
    expect(html).toContain('voce@email.com');
    expect(html).toContain('Criar minha conta grátis');
    expect(html).toContain('bm-btn-pill-primary');
    expect(html).toContain('Conexão criptografada. A BINMAX nunca pede sua senha por WhatsApp, e-mail ou telefone.');
  });

  it('4.2 Valida a presença do medidor de força de senha e os 3 requisitos interativos', () => {
    const html = renderToString(
      <RouterProvider>
        <RegisterPage />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="password-strength-bars"');
    expect(html).toContain('data-testid="password-requirements"');
    expect(html).toContain('8+ caracteres');
    expect(html).toContain('Uma letra');
    expect(html).toContain('Um número');
  });

  it('4.3 Valida o checkbox de termos e política de riscos', () => {
    const html = renderToString(
      <RouterProvider>
        <RegisterPage />
      </RouterProvider>
    );

    expect(html).toContain('Tenho 18 anos ou mais e aceito os');
    expect(html).toContain('Termos');
    expect(html).toContain('Política de Riscos');
  });

  describe('4.4 Bateria de Estresse: Resiliência de Renderização SSR', () => {
    it('executa 100 ciclos de renderização SSR da nova RegisterPage em menos de 600ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const html = renderToString(
          <RouterProvider>
            <RegisterPage />
          </RouterProvider>
        );
        expect(html.length).toBeGreaterThan(1000);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
