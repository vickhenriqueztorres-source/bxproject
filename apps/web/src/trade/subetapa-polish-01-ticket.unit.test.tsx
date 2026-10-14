import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderTicket } from './OrderTicket';
import { setTraderoomPolishEnabled, resetTraderoomPolishForTesting } from '../lib/traderoom-polish';

vi.mock('../lib/feature-flags', () => ({ isNewTraderoomEnabled: () => true }));

// Relógio fixo: a expiração exibida depende de Date.
const FIXED = new Date('2026-10-13T20:00:10.000Z');

function render(props: Partial<React.ComponentProps<typeof OrderTicket>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToString(
    <QueryClientProvider client={qc}>
      <OrderTicket symbol="VOL_50" paused={false} stale={false} availableMinor={1_000_000} soundEnabled={false} onChanged={() => {}} {...props} />
    </QueryClientProvider>,
  );
}

// Extrai o atributo style de um elemento pelo data-testid.
function styleOf(html: string, testid: string): string {
  const m = html.match(new RegExp(`data-testid="${testid}"[^>]*style="([^"]*)"`)) ?? html.match(new RegExp(`style="([^"]*)"[^>]*data-testid="${testid}"`));
  return m?.[1] ?? '';
}
const px = (style: string, prop: string) => Number(style.match(new RegExp('(?:^|;)' + prop + ':([0-9]+(?:[.][0-9]+)?)px'))?.[1] ?? NaN);

describe('Subetapa 01 — Ticket com TRADEROOM_POLISH', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED); });
  afterEach(() => { vi.useRealTimers(); resetTraderoomPolishForTesting(); });

  describe('chave desligada: sala exatamente como antes', () => {
    it('HTML idêntico ao snapshot gravado antes da mudança (normal)', () => {
      setTraderoomPolishEnabled(false);
      expect(render()).toMatchSnapshot();
    });
    it('HTML idêntico ao snapshot gravado antes da mudança (compacto)', () => {
      setTraderoomPolishEnabled(false);
      expect(render({ isCompact: true })).toMatchSnapshot();
    });
  });

  describe('chave ligada', () => {
    beforeEach(() => setTraderoomPolishEnabled(true));

    it('sem chips de valor (proibidos em dashboard-ux.md §D)', () => {
      for (const compact of [false, true]) {
        const html = render({ isCompact: compact });
        expect(html).not.toContain('data-testid="stake-presets"');
        expect(html).not.toMatch(/data-testid="preset-\d+"/);
      }
    });

    it('mantém todos os blocos, testids e textos', () => {
      const html = render();
      for (const id of ['binmax-order-ticket', 'ticket-block-monto', 'ticket-block-expiracion', 'ticket-block-ganancia', 'ganancia-pct', 'ganancia-amount', 'btn-sube', 'btn-baja']) {
        expect(html).toContain(`data-testid="${id}"`);
      }
      for (const t of ['Monto', 'Expiración', 'Ganancia', 'SUBE', 'BAJA']) expect(html).toContain(t);
      expect(html).toContain('aria-label="Disminuir monto"');
      expect(html).toContain('aria-label="Aumentar monto"');
    });

    it('Ganancia em destaque: número ≥ 40px e % menor, verde do token', () => {
      const html = render();
      const pct = styleOf(html, 'ganancia-pct');
      expect(px(pct, 'font-size')).toBeGreaterThanOrEqual(40);
      expect(pct).toContain('color:var(--profit)');
      expect(html).toMatch(/data-testid="ganancia-pct-sign"[^>]*style="[^"]*font-size:24px/);
      expect(styleOf(html, 'ganancia-amount')).toContain('font-size:18px');
    });

    it('compliance: SUBE e BAJA simétricos (mesma altura, raio, peso) e quase quadrados', () => {
      const html = render();
      const sube = styleOf(html, 'btn-sube');
      const baja = styleOf(html, 'btn-baja');
      const strip = (s: string) => s.replace(/var\(--(profit|loss)\)/g, 'X').replace(/aria-label="[^"]*"/g, '');
      expect(strip(sube)).toBe(strip(baja));
      expect(px(sube, 'height')).toBeGreaterThanOrEqual(76);
      expect(sube).toContain('background:var(--profit)');
      expect(baja).toContain('background:var(--loss)');
    });

    it('sem glow, sem gradiente, sem cores fora do manual', () => {
      const html = render();
      for (const id of ['btn-sube', 'btn-baja']) {
        const s = styleOf(html, id);
        expect(s).not.toMatch(/box-shadow:(?!none)/);
        expect(s).not.toContain('gradient');
      }
      for (const banned of ['#00e5ff', '#00e676', '#22c55e', '#e5484d', '#151922', '#1a1f2b', "'Inter'"]) {
        expect(html.toLowerCase()).not.toContain(banned.toLowerCase());
      }
    });

    it('motion: só tokens (100ms + --ease)', () => {
      const s = styleOf(render(), 'btn-sube');
      expect(s).toContain('var(--t-micro)');
      expect(s).toContain('var(--ease)');
      expect(s).not.toMatch(/0\.12s ease/);
    });

    it('acessibilidade D10: + e − com área de clique ≥ 24px', () => {
      const html = render({ isCompact: true });
      const m = [...html.matchAll(/aria-label="(Disminuir|Aumentar) monto"[^>]*style="([^"]*)"/g)];
      expect(m.length).toBe(2);
      for (const [, , st] of m) expect(px(st, 'width')).toBeGreaterThanOrEqual(24);
    });

    it('caos: pausado / atrasado desabilitam os dois botões igualmente', () => {
      for (const p of [{ paused: true }, { stale: true }]) {
        const html = render(p);
        const sube = styleOf(html, 'btn-sube');
        const baja = styleOf(html, 'btn-baja');
        expect(sube).toContain('opacity:0.45');
        expect(baja).toContain('opacity:0.45');
        expect(html).toMatch(/data-testid="btn-sube"[^>]*disabled=""|disabled=""[^>]*data-testid="btn-sube"/);
        expect(html).toMatch(/data-testid="btn-baja"[^>]*disabled=""|disabled=""[^>]*data-testid="btn-baja"/);
      }
    });

    it('caos: saldo nulo e símbolo desconhecido não quebram', () => {
      expect(() => render({ availableMinor: null })).not.toThrow();
      expect(() => render({ symbol: 'NAO_EXISTE' })).not.toThrow();
    });

    it('segurança: símbolo malicioso não vira HTML', () => {
      const html = render({ symbol: '<img src=x onerror=alert(1)>' });
      expect(html).not.toContain('<img src=x');
    });

    it('estresse: 500 renderizações em menos de 1500 ms', () => {
      vi.useRealTimers();
      const t0 = performance.now();
      for (let i = 0; i < 500; i++) render({ isCompact: i % 2 === 0 });
      expect(performance.now() - t0).toBeLessThan(1500);
    });
  });
});
