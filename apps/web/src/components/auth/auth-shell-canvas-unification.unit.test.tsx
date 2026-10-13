import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthShell } from './AuthShell';
import { RouterProvider } from '../../router/RouterContext';

describe('SUBETAPA 01: Unificação do Canvas e Eliminação de Paredes Artificiais no AuthShell', () => {
  it('1.1 Renderiza AuthShell com coluna esquerda perfeitamente transparente sem borda divisória dura', () => {
    const html = renderToString(
      <RouterProvider>
        <AuthShell activeMode="login">
          <div data-testid="test-child">Formulário de Teste</div>
        </AuthShell>
      </RouterProvider>
    );

    // O header translúcido e elegante está presente
    expect(html).toContain('data-testid="auth-header"');
    expect(html).toContain('rgba(7, 10, 15, 0.65)');

    // O background técnico continua posicionado como camada zero
    expect(html).toContain('data-testid="auth-background-grid-motion"');

    // A coluna esquerda existe, mas não possui background recortado opaco nem borda lateral
    expect(html).toContain('class="auth-left-panel"');
    expect(html).toContain('background-color:transparent');
    expect(html).not.toContain('border-right:1px solid');

    // O painel direito permanece com transparência para o card flutuar
    expect(html).toContain('class="auth-right-panel"');
    expect(html).toContain('data-testid="test-child"');
  });

  it('1.2 Preserva integralmente o conteúdo institucional e o mini gráfico Vol 50', () => {
    const html = renderToString(
      <RouterProvider>
        <AuthShell activeMode="login">
          <div>Conteúdo</div>
        </AuthShell>
      </RouterProvider>
    );

    expect(html).toContain('Terminal de Precisión Suiza');
    expect(html).toContain('Opera en 60 segundos.');
    expect(html).toContain('data-testid="vol50-mini-chart"');
    expect(html).toContain('Pagos en 24h');
    expect(html).toContain('Soporte en español');
    expect(html).toContain('Cuenta de práctica ilimitada');
  });

  describe('1.3 Bateria de Estresse: Resiliência de Renderização SSR do AuthShell Unificado', () => {
    it('executa 100 ciclos de renderização SSR em menos de 500ms sem vazamentos', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const html = renderToString(
          <RouterProvider>
            <AuthShell activeMode="login">
              <div>Ciclo {i}</div>
            </AuthShell>
          </RouterProvider>
        );
        expect(html.length).toBeGreaterThan(1000);
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500);
    });
  });
});
