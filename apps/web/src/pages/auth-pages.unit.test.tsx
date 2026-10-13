import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Vol50LiveMiniChart } from '../components/chart/Vol50LiveMiniChart';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { PasswordRecoveryPage } from './PasswordRecoveryPage';
import { RouterProvider } from '../router/RouterContext';

describe('SUBETAPA 02: Módulo de Autenticação & Telas de Acesso BINMAX', () => {
  it('2.1 Vol50LiveMiniChart: Renderiza gráfico de velas OHLC mudo sem botões e badge de cotação', () => {
    const html = renderToString(<Vol50LiveMiniChart height={240} />);

    expect(html).toContain('data-testid="vol50-mini-chart"');
    expect(html).toContain('Vol 50');
    expect(html).toContain('line');
    expect(html).toContain('rect');
    expect(html).toContain('507.9397');
    expect(html).toContain('18:30');
    expect(html).toContain('21:30');
  });

  it('2.2 LoginPage: Renderiza novo design fiel: Bem-vindo de volta, Entrar →, inputs 48px e Disclaimer', () => {
    const html = renderToString(
      <RouterProvider>
        <LoginPage />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="login-page"');
    expect(html).toContain('Bem-vindo de volta.');
    expect(html).toContain('Entre para voltar a operar de onde parou.');
    expect(html).toContain('voce@email.com');
    expect(html).toContain('Esqueceu a senha?');
    expect(html).toContain('Entrar');
    expect(html).toContain('bm-btn-pill-primary');
    expect(html).toContain('Conexão criptografada');
  });

  it('2.3 RegisterPage: Renderiza formulário oficial: Abra sua conta grátis, força de senha e botão pill', () => {
    const html = renderToString(
      <RouterProvider>
        <RegisterPage />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="register-page"');
    expect(html).toContain('Abra sua conta grátis.');
    expect(html).toContain('Leva 15 segundos. Você começa na conta de prática.');
    expect(html).toContain('Como no seu documento');
    expect(html).toContain('voce@email.com');
    expect(html).toContain('data-testid="password-strength-bars"');
    expect(html).toContain('8+ caracteres');
    expect(html).toContain('Uma letra');
    expect(html).toContain('Um número');
    expect(html).toContain('Criar minha conta grátis');
    expect(html).toContain('bm-btn-pill-primary');
    expect(html).toContain('Conexão criptografada');
  });

  it('2.4 PasswordRecoveryPage: Renderiza fluxo com recuperação de acesso e 15 minutos de expiração', () => {
    const html = renderToString(
      <RouterProvider>
        <PasswordRecoveryPage />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="password-recovery-page"');
    expect(html).toContain('Recuperar acceso');
    expect(html).toContain('Ingresa tu correo electrónico y te enviaremos un enlace');
    expect(html).toContain('Enviar enlace');
    expect(html).toContain('Volver al inicio de sesión');
  });
});
