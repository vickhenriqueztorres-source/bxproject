/**
 * AuthPerformanceStrip — Testes Unitários
 *
 * Valida: estrutura DOM, métricas de demo, sparkline SVG,
 * disclaimer institucional, tokens de design e acessibilidade.
 *
 * Segue: "NUNCA IMPLEMENTE NADA SEM TESTES ROBUSTOS"
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import { setNewTraderoomEnabled } from '../../lib/feature-flags';
import {
  PRECISION_COLORS,
  PRECISION_SURFACES,
} from '../../lib/design-tokens';

// Enable feature flag for all tests
beforeEach(() => {
  setNewTraderoomEnabled(true);
});

// Lazy import to ensure feature flag is set before module loads
async function renderStrip(props: Record<string, unknown> = {}) {
  const { AuthPerformanceStrip } = await import('./AuthPerformanceStrip');
  return renderToString(React.createElement(AuthPerformanceStrip, props));
}

describe('AuthPerformanceStrip', () => {
  describe('Structure & DOM', () => {
    it('renders with data-testid="auth-performance-strip"', async () => {
      const html = await renderStrip();
      expect(html).toContain('data-testid="auth-performance-strip"');
    });

    it('renders performance metrics grid', async () => {
      const html = await renderStrip();
      expect(html).toContain('data-testid="performance-metrics-grid"');
    });

    it('renders status dot indicator', async () => {
      const html = await renderStrip();
      expect(html).toContain('data-testid="performance-status-dot"');
    });

    it('renders institutional disclaimer', async () => {
      const html = await renderStrip();
      expect(html).toContain('data-testid="performance-disclaimer"');
    });
  });

  describe('Content — Demo Metrics', () => {
    it('displays "Operaciones hoy" metric with value', async () => {
      const html = await renderStrip();
      expect(html).toContain('Operaciones hoy');
      expect(html).toContain('12.840');
    });

    it('displays "Retorno medio" metric with profit color', async () => {
      const html = await renderStrip();
      expect(html).toContain('Retorno medio');
      expect(html).toContain('+87%');
      expect(html).toContain(PRECISION_COLORS.profit);
    });

    it('displays "Ejecución" metric with info color', async () => {
      const html = await renderStrip();
      expect(html).toContain('Ejecución');
      expect(html).toContain('16ms');
      expect(html).toContain(PRECISION_COLORS.info);
    });

    it('displays platform performance header label in Spanish', async () => {
      const html = await renderStrip();
      expect(html).toContain('Rendimiento de la plataforma');
    });

    it('displays disclaimer text about demo account', async () => {
      const html = await renderStrip();
      expect(html).toContain('Datos de la plataforma en tiempo real');
      expect(html).toContain('$10.000 virtuales');
    });
  });

  describe('Design Tokens Compliance', () => {
    it('uses PRECISION_SURFACES.line for border color', async () => {
      const html = await renderStrip();
      // The border uses the line token value
      expect(html).toContain('rgba(138, 146, 161, 0.16)');
    });

    it('uses backdrop-filter blur for glassmorphic effect', async () => {
      const html = await renderStrip();
      expect(html).toContain('backdrop-filter:blur(8px)');
    });

    it('uses bottom-only border-radius to fuse with chart above', async () => {
      const html = await renderStrip();
      expect(html).toContain('border-radius:0 0 8px 8px');
    });

    it('uses Geist Mono for numeric values (bm-tabular-nums class)', async () => {
      const html = await renderStrip();
      expect(html).toContain('bm-tabular-nums');
    });

    it('uses profit green (#22C47A) for status dot', async () => {
      const html = await renderStrip();
      // The dot uses PRECISION_COLORS.profit
      expect(html).toContain('#22C47A');
    });
  });

  describe('SVG Sparkline', () => {
    it('renders an SVG sparkline element', async () => {
      const html = await renderStrip();
      // Should contain SVG with sparkline path
      expect(html).toContain('<svg');
      expect(html).toContain('viewBox="0 0 120 32"');
    });

    it('sparkline uses profit color for stroke', async () => {
      const html = await renderStrip();
      // The sparkline path stroke uses profit color
      expect(html).toContain(`stroke="${PRECISION_COLORS.profit}"`);
    });

    it('sparkline has fill gradient defined', async () => {
      const html = await renderStrip();
      expect(html).toContain('auth-spark-fill');
    });

    it('sparkline has endpoint circle marker', async () => {
      const html = await renderStrip();
      // The last point has a circle marker
      expect(html).toContain('r="2.5"');
    });
  });

  describe('Anti-Casino Compliance', () => {
    it('contains NO animation keyframes or CSS animation properties', async () => {
      const html = await renderStrip();
      expect(html).not.toContain('animation:');
      expect(html).not.toContain('@keyframes');
      expect(html).not.toContain('animate');
    });

    it('contains NO glow or neon effects', async () => {
      const html = await renderStrip();
      expect(html).not.toContain('text-shadow');
      // box-shadow is acceptable for subtle elevation, but not neon glow
      // Just verify no neon colors in shadow
      expect(html).not.toContain('0 0 20px');
    });

    it('contains NO bounce or elastic physics', async () => {
      const html = await renderStrip();
      expect(html).not.toContain('bounce');
      expect(html).not.toContain('elastic');
      expect(html).not.toContain('spring');
    });
  });

  describe('Accessibility', () => {
    it('sparkline SVG has aria-hidden="true"', async () => {
      const html = await renderStrip();
      expect(html).toContain('aria-hidden="true"');
    });
  });
});
