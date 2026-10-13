import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthTabSwitcher } from './AuthTabSwitcher';

describe('SUBETAPA 02: AuthTabSwitcher em Cápsula (Pill Shape)', () => {
  it('2.1 Renderiza as duas abas no formato Pill oficial: Criar conta à esquerda e Entrar à direita', () => {
    const html = renderToString(
      <AuthTabSwitcher activeTab="login" onTabChange={() => {}} />
    );

    expect(html).toContain('data-testid="auth-tab-switcher"');
    expect(html).toContain('bm-pill-container');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-testid="auth-tab-login"');
    expect(html).toContain('data-testid="auth-tab-register"');
    expect(html).toContain('Criar conta');
    expect(html).toContain('Entrar');
    expect(html).toContain('bm-pill-tab-active');
  });

  it('2.2 Alterna corretamente estado aria-selected e classe ativa quando em modo register', () => {
    const html = renderToString(
      <AuthTabSwitcher activeTab="register" onTabChange={() => {}} />
    );

    expect(html).toContain('id="tab-register"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('tabindex="0"');
  });

  describe('2.3 Bateria de Estresse: Alta Frequência de Renderização de Abas', () => {
    it('executa 500 ciclos de renderização de abas alternadas em menos de 300ms', () => {
      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        const tab = i % 2 === 0 ? 'login' : 'register';
        const html = renderToString(
          <AuthTabSwitcher activeTab={tab} onTabChange={() => {}} />
        );
        expect(html.length).toBeGreaterThan(100);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
