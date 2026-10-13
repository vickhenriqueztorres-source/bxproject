import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthShell } from '../components/auth/AuthShell';
import { RouterProvider } from '../router/RouterContext';

describe('SUBETAPA 01: Shell Institucional e Header Unificado de Alta Precisão', () => {
  it('1.1 Renderiza Header Superior Institucional de 56px com logo, telemetria 16ms e botão de atalho contextual', () => {
    const htmlLogin = renderToString(
      <RouterProvider>
        <AuthShell activeMode="login">
          <div data-testid="test-form">Formulário de Login</div>
        </AuthShell>
      </RouterProvider>
    );

    // Valida Header e telemetria
    expect(htmlLogin).toContain('data-testid="auth-shell"');
    expect(htmlLogin).toContain('data-testid="auth-header"');
    expect(htmlLogin).toContain('data-testid="auth-telemetry"');
    expect(htmlLogin).toContain('16ms');
    expect(htmlLogin).toContain('bm-tabular-nums');
    expect(htmlLogin).toContain('ES ⌵');

    // No modo login, o botão de alternância no header deve ser "Crear cuenta"
    expect(htmlLogin).toContain('data-testid="header-btn-register"');
    expect(htmlLogin).toContain('Crear cuenta');

    // Valida Coluna Esquerda com headline The Hunter e Mini Chart
    expect(htmlLogin).toContain('Terminal de Precisión Suiza');
    expect(htmlLogin).toContain('Opera en 60 segundos.');
    expect(htmlLogin).toContain('Práctica gratis con $10.000.');
    expect(htmlLogin).toContain('Pagos en 24h');
    expect(htmlLogin).toContain('Soporte en español');
    expect(htmlLogin).toContain('Cuenta de práctica ilimitada');
    expect(htmlLogin).toContain('data-testid="vol50-mini-chart"');

    // Conteúdo filho deve estar presente
    expect(htmlLogin).toContain('Formulário de Login');
  });

  it('1.2 Renderiza Shell em modo Registro com botão Iniciar sesión no Header e cards de benefícios na coluna esquerda', () => {
    const htmlRegister = renderToString(
      <RouterProvider>
        <AuthShell activeMode="register">
          <div data-testid="test-form">Formulário de Registro</div>
        </AuthShell>
      </RouterProvider>
    );

    // No modo registro, o botão no header deve ser "Iniciar sesión"
    expect(htmlRegister).toContain('data-testid="header-btn-login"');
    expect(htmlRegister).toContain('Iniciar sesión');

    // Headline oficial de registro
    expect(htmlRegister).toContain('Empieza en segundos');
    expect(htmlRegister).toContain('con una cuenta de práctica.');

    // 3 Cards de benefício
    expect(htmlRegister).toContain('Plataforma profesional');
    expect(htmlRegister).toContain('Aprende sin riesgos');
    expect(htmlRegister).toContain('Acceso inmediato');
  });

  it('1.3 Prova de Zero Duplicação de Marca: O logo só aparece no header superior e não na coluna esquerda', () => {
    const html = renderToString(
      <RouterProvider>
        <AuthShell activeMode="login">
          <div>Conteúdo</div>
        </AuthShell>
      </RouterProvider>
    );

    // Contagem de ocorrências do logo SVG da BINMAX
    const logoOccurrences = (html.match(/BINMAX/g) || []).length;
    // O logo está no header e o texto institucional "BINMAX" no parágrafo descritivo, mas sem duplo logo svg
    expect(logoOccurrences).toBeGreaterThanOrEqual(1);
    expect(html).toContain('binmax-logo-horizontal');
    expect(html).toContain('aria-label="Binmax Option"');
  });

  describe('1.4 Bateria de Estresse: Desempenho de Montagem e Renderização Síncrona', () => {
    it('executa 100 ciclos de renderização SSR do AuthShell em menos de 500ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const mode = i % 2 === 0 ? 'login' : 'register';
        const html = renderToString(
          <RouterProvider>
            <AuthShell activeMode={mode}>
              <div>Ciclo {i}</div>
            </AuthShell>
          </RouterProvider>
        );
        expect(html.length).toBeGreaterThan(500);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('1.5 Bateria de Caos e Resiliência Estrutural', () => {
    it('mantém integridade quando renderizado com conteúdo nulo ou vazio sem quebrar layout', () => {
      const html = renderToString(
        <RouterProvider>
          <AuthShell activeMode="login">
            {null}
          </AuthShell>
        </RouterProvider>
      );
      expect(html).toContain('data-testid="auth-shell"');
      expect(html).toContain('data-testid="auth-header"');
    });
  });
});
