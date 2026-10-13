import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { PasswordRecoveryPage } from './PasswordRecoveryPage';

afterEach(() => { vi.unstubAllGlobals(); });

it('[AC-AUTH-15] link com token entregue por email abre o formulário de nova senha', () => {
  vi.stubGlobal('window', { location: { pathname: '/recuperar', search: '', hash: `#token=${'a'.repeat(64)}` } });
  const html = renderToStaticMarkup(React.createElement(PasswordRecoveryPage));
  expect(html).toContain('data-testid="recovery-step-3"');
  expect(html).not.toContain('Simular clic en el enlace recibido');
});
