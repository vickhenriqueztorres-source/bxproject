import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RouterProvider, useRouter } from './RouterContext';

describe('SUBETAPA 01: RouterContext e Roteamento SPA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function TestConsumer() {
    const { currentPath, searchParams } = useRouter();
    return (
      <div data-testid="router-test">
        <span data-testid="path">{currentPath}</span>
        <span data-testid="symbol">{searchParams.get('symbol') || 'none'}</span>
      </div>
    );
  }

  it('1.1 Provedor RouterProvider provê o caminho atual e query params para os componentes', () => {
    const html = renderToString(
      <RouterProvider>
        <TestConsumer />
      </RouterProvider>
    );

    expect(html).toContain('data-testid="router-test"');
    expect(html).toContain('data-testid="path"');
    expect(html).toContain('data-testid="symbol"');
  });

  it('1.2 useRouter retorna fallback seguro mesmo fora de RouterProvider', () => {
    const html = renderToString(<TestConsumer />);
    expect(html).toContain('data-testid="router-test"');
  });
});
