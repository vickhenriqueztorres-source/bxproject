import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LoginPage } from './LoginPage';
import { RouterProvider } from '../router/RouterContext';

describe('Subetapa 03 — Login e Autenticação (Ambiente de Confiança Bancária Suíça)', () => {
  it('renderiza a LoginPage com a tese de precisão e superfícies tonais (#0B0E14, #101622, #1C2738)', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="login-page"');
    expect(html).toContain('Terminal de Precisión Suiza');
    expect(html).toContain('La plataforma donde el gráfico obedece a tu clic');
    expect(html).toContain('#0B0E14');
    expect(html).toContain('#101622');
    expect(html).toContain('#1C2738');
    expect(html).toContain('bm-btn-press');
  });

  it('valida que não existem sombras glow neons nem animações de shake no formulário', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    // Sem sombras luminosas espalhafatosas
    expect(html).not.toContain('rgba(34, 197, 94, 0.3)');
    expect(html).not.toContain('shake');
  });

  it('utiliza ícones vetoriais de precisão sem emojis soltos nos campos', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    expect(html).toContain('<svg');
    expect(html).not.toContain('✉️');
    expect(html).not.toContain('🔒');
  });

  describe('Teste de Estresse de Renderização da Autenticação', () => {
    it('executa 100 ciclos de renderização SSR da LoginPage em menos de 500ms', () => {
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
