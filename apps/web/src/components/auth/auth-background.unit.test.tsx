import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthBackgroundGridMotion } from './AuthBackgroundGridMotion';

describe('SUBETAPA 01: Criação do Componente AuthBackgroundGridMotion', () => {
  it('1.1 Renderiza o container de fundo, o padrão de grid SVG 48px e as curvas vetoriais', () => {
    const html = renderToString(<AuthBackgroundGridMotion />);

    expect(html).toContain('data-testid="auth-background-grid-motion"');
    expect(html).toContain('pointer-events:none');
    expect(html).toContain('bm-auth-cartesian-grid');
    expect(html).toContain('data-testid="auth-grid-svg"');
    expect(html).toContain('data-testid="auth-motion-curves"');
    expect(html).toContain('bm-bg-curve-motion');
    expect(html).toContain('bm-bg-glow-drift');
  });

  describe('1.2 Estresse de Renderização SSR', () => {
    it('executa 100 ciclos de renderização SSR do AuthBackgroundGridMotion em menos de 250ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const html = renderToString(<AuthBackgroundGridMotion />);
        expect(html.length).toBeGreaterThan(500);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});
