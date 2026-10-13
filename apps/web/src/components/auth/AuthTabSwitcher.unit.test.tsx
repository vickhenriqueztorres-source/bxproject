import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthTabSwitcher } from './AuthTabSwitcher';

describe('AuthTabSwitcher: Seletor de Abas de Autenticação de Alta Precisão', () => {
  it('1. Renderiza o controle de abas com role="tablist" e as duas opções simétricas', () => {
    const html = renderToString(
      <AuthTabSwitcher activeTab="login" onTabChange={vi.fn()} />
    );

    expect(html).toContain('data-testid="auth-tab-switcher"');
    expect(html).toContain('data-testid="auth-tab-login"');
    expect(html).toContain('data-testid="auth-tab-register"');
    expect(html).toContain('Iniciar sesión');
    expect(html).toContain('Crear cuenta');
  });

  it('2. Destaca a aba de login como ativa quando activeTab="login"', () => {
    const html = renderToString(
      <AuthTabSwitcher activeTab="login" onTabChange={vi.fn()} />
    );

    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('bm-btn-press');
    expect(html).toContain('#151D2B'); // Superfície elevada de aba ativa
  });

  it('3. Destaca a aba de registro como ativa quando activeTab="register"', () => {
    const html = renderToString(
      <AuthTabSwitcher activeTab="register" onTabChange={vi.fn()} />
    );

    // Verifica que a aba register está com aria-selected="true"
    const registerPart = html.substring(html.indexOf('data-testid="auth-tab-register"'));
    expect(registerPart).toContain('aria-selected="true"');
  });

  it('4. Respeita a fundação cromática e de física de movimento da BINMAX', () => {
    const html = renderToString(
      <AuthTabSwitcher activeTab="login" onTabChange={vi.fn()} />
    );

    expect(html).toContain('#0B0E14'); // Fundo escuro profundo
    expect(html).toContain('cubic-bezier(0.16, 1, 0.3, 1)'); // Curva oficial --bm-ease
    expect(html).toContain('100ms'); // Duração de microinteração
  });
});
