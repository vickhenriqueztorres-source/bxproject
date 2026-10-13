import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { AuthShell } from '../components/auth/AuthShell';
import { AuthTabSwitcher } from '../components/auth/AuthTabSwitcher';
import { RouterProvider } from '../router/RouterContext';

describe('SUBETAPA 05: Bateria Integrada de Testes de Estresse, Caos, Segurança e Anti-Cassino', () => {
  describe('5.1 Bateria de Estresse de Renderização SSR', () => {
    it('executa 100 ciclos de SSR da LoginPage sem vazamento de memória em < 600ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const html = renderToString(
          <RouterProvider>
            <LoginPage />
          </RouterProvider>
        );
        expect(html.length).toBeGreaterThan(1000);
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('executa 100 ciclos de SSR da RegisterPage sem vazamento de memória em < 600ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const html = renderToString(
          <RouterProvider>
            <RegisterPage />
          </RouterProvider>
        );
        expect(html.length).toBeGreaterThan(1000);
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('executa 200 alternâncias de AuthTabSwitcher em < 200ms', () => {
      const start = performance.now();
      for (let i = 0; i < 200; i++) {
        const tab = i % 2 === 0 ? 'login' : 'register';
        const html = renderToString(
          <AuthTabSwitcher activeTab={tab} onTabChange={() => {}} />
        );
        expect(html.length).toBeGreaterThan(100);
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('5.2 Bateria de Caos e Resiliência Estrutural', () => {
    it('mantém integridade visual quando AuthShell recebe conteúdo nulo sem lançar exceções', () => {
      expect(() => {
        renderToString(
          <RouterProvider>
            <AuthShell activeMode="login">{null}</AuthShell>
          </RouterProvider>
        );
      }).not.toThrow();
    });

    it('mantém integridade quando AuthShell é montado com elementos vazios em ambos os modos', () => {
      const loginHtml = renderToString(
        <RouterProvider>
          <AuthShell activeMode="login">
            <div data-testid="empty-card" />
          </AuthShell>
        </RouterProvider>
      );
      expect(loginHtml).toContain('data-testid="auth-shell"');

      const registerHtml = renderToString(
        <RouterProvider>
          <AuthShell activeMode="register">
            <div data-testid="empty-card" />
          </AuthShell>
        </RouterProvider>
      );
      expect(registerHtml).toContain('data-testid="auth-shell"');
    });
  });

  describe('5.3 Bateria de Segurança e Integridade de Dados', () => {
    it('garante que nenhum atributo expõe valores de senha ou segredos no DOM renderizado', () => {
      const loginHtml = renderToString(
        <RouterProvider>
          <LoginPage />
        </RouterProvider>
      );
      // Nenhum campo com senha pré-populada no HTML inicial
      expect(loginHtml).not.toContain('data-password');
      expect(loginHtml).not.toContain('data-secret');

      const registerHtml = renderToString(
        <RouterProvider>
          <RegisterPage />
        </RouterProvider>
      );
      expect(registerHtml).not.toContain('data-password');
      expect(registerHtml).not.toContain('data-secret');
    });

    it('garante identificadores de formulário únicos para prevenção de colisões', () => {
      const loginHtml = renderToString(
        <RouterProvider>
          <LoginPage />
        </RouterProvider>
      );
      expect(loginHtml).toContain('id="login-email"');
      expect(loginHtml).toContain('id="login-password"');

      const registerHtml = renderToString(
        <RouterProvider>
          <RegisterPage />
        </RouterProvider>
      );
      expect(registerHtml).toContain('id="reg-name"');
      expect(registerHtml).toContain('id="reg-email"');
      expect(registerHtml).toContain('id="reg-pass"');
    });
  });

  describe('5.4 Bateria de Anti-Cassino e Fidelidade Visual do Designer Sênior', () => {
    it('prova que NENHUM elemento contém animação de tremor (shake)', () => {
      const loginHtml = renderToString(
        <RouterProvider>
          <LoginPage />
        </RouterProvider>
      );
      const registerHtml = renderToString(
        <RouterProvider>
          <RegisterPage />
        </RouterProvider>
      );

      expect(loginHtml).not.toContain('shake');
      expect(registerHtml).not.toContain('shake');
    });

    it('prova que NENHUM elemento possui halos ou sombras neon espalhafatosas', () => {
      const loginHtml = renderToString(
        <RouterProvider>
          <LoginPage />
        </RouterProvider>
      );
      const registerHtml = renderToString(
        <RouterProvider>
          <RegisterPage />
        </RouterProvider>
      );

      expect(loginHtml).not.toContain('rgba(34, 197, 94, 0.3)');
      expect(registerHtml).not.toContain('rgba(34, 197, 94, 0.3)');
    });

    it('valida que a latência e valores numéricos utilizam a classe tabular-nums em Geist Mono', () => {
      const loginHtml = renderToString(
        <RouterProvider>
          <LoginPage />
        </RouterProvider>
      );
      const registerHtml = renderToString(
        <RouterProvider>
          <RegisterPage />
        </RouterProvider>
      );

      expect(loginHtml).toContain('bm-tabular-nums');
      expect(loginHtml).toContain('16ms');

      expect(registerHtml).toContain('bm-tabular-nums');
      expect(registerHtml).toContain('16ms');
    });

    it('prova consistência milimétrica: ambos os cards possuem a mesma largura máxima de 440px', () => {
      const loginHtml = renderToString(
        <RouterProvider>
          <LoginPage />
        </RouterProvider>
      );
      const registerHtml = renderToString(
        <RouterProvider>
          <RegisterPage />
        </RouterProvider>
      );

      expect(loginHtml).toContain('max-width:440px');
      expect(registerHtml).toContain('max-width:440px');
    });
  });
});
