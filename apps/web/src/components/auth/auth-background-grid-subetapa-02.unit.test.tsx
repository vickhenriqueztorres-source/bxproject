import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthBackgroundGridMotion } from './AuthBackgroundGridMotion';

describe('SUBETAPA 02: Refinamento Óptico do Grid Cartesiano & Vinheta de Profundidade', () => {
  it('2.1 Renderiza AuthBackgroundGridMotion com vinheta perimétrica, pattern 48px e marcadores', () => {
    const html = renderToString(<AuthBackgroundGridMotion />);

    // Container com isolamento absoluto
    expect(html).toContain('data-testid="auth-background-grid-motion"');
    expect(html).toContain('position:absolute');
    expect(html).toContain('pointer-events:none');

    // SVG e Defs do Grid Cartesiano
    expect(html).toContain('data-testid="auth-grid-svg"');
    expect(html).toContain('id="bm-auth-cartesian-grid"');
    expect(html).toContain('width="48"');
    expect(html).toContain('height="48"');

    // Gradientes de alta precisão
    expect(html).toContain('id="bm-curve-fill"');
    expect(html).toContain('id="bm-curve-stroke"');
    expect(html).toContain('id="bm-curve-secondary"');

    // Vinheta perimétrica e camadas de glow
    expect(html).toContain('radial-gradient');
    expect(html).toContain('bm-bg-glow-drift');
  });

  describe('2.2 Bateria de Estresse: Resiliência de Renderização SSR do Fundo Técnico', () => {
    it('executa 100 ciclos de renderização SSR do AuthBackgroundGridMotion em menos de 200ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const html = renderToString(<AuthBackgroundGridMotion />);
        expect(html.length).toBeGreaterThan(1500);
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });
});
