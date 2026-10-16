import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { Contract } from '../api/client';
import { OrderFlagsOverlay, groupOpenContracts, layoutFlagRows } from './OrderFlagsOverlay';
import { PriceChart } from './PriceChart';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { setTraderoomPolishEnabled, resetTraderoomPolishForTesting } from '../lib/traderoom-polish';

const NOW = Date.parse('2026-10-13T20:55:20.000Z');

function c(id: string, strike: number, opts: Partial<Contract> = {}): Contract {
  return {
    id,
    symbol: 'SYNTH_VOL_50',
    direction: 'UP',
    stake_minor: 10000,
    status: 'OPEN',
    result: null,
    payout_minor: null,
    expires_at: new Date(NOW + 40_000).toISOString(),
    created_at: new Date(NOW - 20_000).toISOString(),
    strike_price: strike,
    entry_price: strike,
    ...opts,
  };
}

// Série falsa: 1 unidade de preço = 10px, preço 520 no y=100.
const series = { priceToCoordinate: (p: number) => 100 + (520 - p) * 10 } as any;

function render(contracts: Contract[], currentPrice: number | null = 517.29) {
  return renderToString(
    <OrderFlagsOverlay
      contracts={contracts}
      currentPrice={currentPrice}
      containerWidth={1600}
      containerHeight={800}
      activeSeries={series}
      chartInstance={null}
    />,
  );
}
const count = (html: string, needle: string) => html.split(needle).length - 1;

// Cenário da captura de produção (13/10 17:55): 6 SUBE em 2 strikes.
const PROD = [
  c('a', 519.6277), c('b', 519.6277), c('c', 519.6277), c('d', 519.6277),
  c('e', 519.4019), c('f', 519.4019),
];

describe('Subetapa 04 — agrupamento (funções puras)', () => {
  it('6 contratos em 2 strikes viram 2 grupos com contagem e stake somado', () => {
    const groups = groupOpenContracts(PROD, 517.29, NOW);
    expect(groups).toHaveLength(2);
    const g1 = groups.find((g) => g.strikeFormatted === '519.6277')!;
    expect(g1.count).toBe(4);
    expect(g1.totalStakeMinor).toBe(40000);
    expect(g1.isWinning).toBe(false);
  });

  it('SUBE e BAJA no mesmo strike não se misturam', () => {
    const groups = groupOpenContracts([c('a', 519), c('b', 519, { direction: 'DOWN' })], 517, NOW);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.direction === 'DOWN')!.isWinning).toBe(true);
  });

  it('o tempo do grupo é o da expiração mais próxima', () => {
    const groups = groupOpenContracts(
      [c('a', 519, { expires_at: new Date(NOW + 50_000).toISOString() }), c('b', 519, { expires_at: new Date(NOW + 12_000).toISOString() })],
      517,
      NOW,
    );
    expect(groups[0].secondsLeft).toBe(12);
  });

  it('anticolisão: linhas a 2px viram etiquetas separadas por ≥ 18px e dentro dos limites', () => {
    const rows = layoutFlagRows([300, 302, 303, 304], 18, 50, 750);
    for (let i = 1; i < rows.length; i++) expect(rows[i] - rows[i - 1]).toBeGreaterThanOrEqual(18);
    const edge = layoutFlagRows([745, 746, 748], 18, 50, 750);
    expect(Math.max(...edge)).toBeLessThanOrEqual(750);
    expect(Math.min(...edge)).toBeGreaterThanOrEqual(50);
  });

  it('caos: strike NaN, stake string e expiração inválida não quebram', () => {
    const groups = groupOpenContracts(
      [c('a', NaN), c('b', 519, { stake_minor: '2500', expires_at: 'not-a-date' })],
      null,
      NOW,
    );
    expect(groups.length).toBeGreaterThanOrEqual(1);
    for (const g of groups) {
      expect(Number.isFinite(g.totalStakeMinor)).toBe(true);
      expect(Number.isFinite(g.secondsLeft)).toBe(true);
    }
  });

  it('estresse: 2.000 contratos agrupados em menos de 30 ms', () => {
    const many = Array.from({ length: 2000 }, (_, i) => c(String(i), 500 + (i % 40) / 10));
    const t0 = performance.now();
    const groups = groupOpenContracts(many, 502, NOW);
    expect(performance.now() - t0).toBeLessThan(30);
    expect(groups).toHaveLength(40);
  });
});

describe('Subetapa 04 — overlay de posições', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    setNewTraderoomEnabled(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    resetTraderoomPolishForTesting();
  });

  it('chave desligada: overlay idêntico ao snapshot anterior', () => {
    setTraderoomPolishEnabled(false);
    expect(render(PROD)).toMatchSnapshot();
  });

  describe('chave ligada', () => {
    beforeEach(() => setTraderoomPolishEnabled(true));

    it('cenário de produção: 2 linhas e 2 etiquetas, não 6', () => {
      const html = render(PROD);
      expect(count(html, '<line')).toBe(2);
      expect(count(html, 'data-testid="order-flag-group-')).toBe(2);
      expect(html).toContain('4 × $100');
      expect(html).toContain('2 × $100');
      expect(html).not.toContain('data-testid="order-flag-a"');
    });

    it('12 strikes distintos: no máximo 3 etiquetas + "+9"', () => {
      const html = render(Array.from({ length: 12 }, (_, i) => c(String(i), 510 + i)));
      expect(count(html, 'data-testid="order-flag-group-')).toBe(3);
      expect(html).toContain('data-testid="order-flags-more"');
      expect(html).toContain('+9');
    });

    it('linhas de ponto de entrada retas, sólidas (2px) e destacadas, sem tracejado', () => {
      const html = render(PROD);
      expect(html).toContain('stroke-width="2"');
      expect(html).toContain('stroke-opacity="0.95"');
      expect(html).not.toContain('stroke-dasharray');
      expect(html).toContain('data-testid="strike-entry-dot-');
    });

    it('cor segue o estado provisório: perdendo = vermelho, ganhando = verde', () => {
      expect(render(PROD, 517.29)).toContain('stroke="var(--loss)"');
      expect(render(PROD, 521.0)).toContain('stroke="var(--profit)"');
    });

    it('sem glow, blur ou hex fora dos tokens', () => {
      const html = render(PROD);
      expect(html).not.toContain('backdrop-filter');
      expect(html).not.toContain('rgba(0, 0, 0, 0.6)');
      expect(html).not.toMatch(/#22C47A|#F2545B|#00e676|#ff3d71/i);
    });

    it('etiquetas não se sobrepõem (≥ 18px entre elas)', () => {
      const html = render([c('a', 519.62), c('b', 519.60, { direction: 'DOWN' }), c('c', 519.58)]);
      const tops = [...html.matchAll(/data-testid="order-flag-group-[^"]+"[^>]*style="[^"]*top:([0-9.]+)px/g)]
        .map((m) => Number(m[1]))
        .sort((x, y) => x - y);
      expect(tops).toHaveLength(3);
      for (let i = 1; i < tops.length; i++) expect(tops[i] - tops[i - 1]).toBeGreaterThanOrEqual(18);
    });

    it('segurança: símbolo e id maliciosos não viram HTML', () => {
      const html = render([c('<img src=x onerror=alert(1)>', 519, { symbol: '<script>x</script>' })]);
      expect(html).not.toContain('<img src=x');
      expect(html).not.toContain('<script>x');
    });

    it('caos: sem preço atual, sem série e lista vazia', () => {
      expect(() => render(PROD, null)).not.toThrow();
      expect(render([])).toBe('');
      expect(() =>
        renderToString(
          <OrderFlagsOverlay contracts={PROD} currentPrice={517} containerWidth={1600} containerHeight={800} activeSeries={null} chartInstance={null} />,
        ),
      ).not.toThrow();
    });

    it('telemetria do gráfico: rótulos 11px na fonte de interface (não 9px, não mono)', () => {
      const html = renderToString(
        <PriceChart candles={[]} tick={null} symbol="SYNTH_VOL_50" activeContracts={PROD} isStale={false} isVisible onSelectSymbol={() => {}} />,
      );
      const start = html.indexOf('data-testid="chart-trade-telemetry-strip"');
      expect(start).toBeGreaterThan(-1);
      const strip = html.slice(start, html.indexOf('GANANCIA ESPERADA', start) + 40);
      expect(strip).not.toContain('font-size:9px');
      for (const label of ['HORA DE COMPRA', 'INVERSIÓN TOTAL', 'GANANCIA ESPERADA']) {
        const style = strip.match(new RegExp('style="([^"]*)">' + label + '<'))?.[1] ?? '';
        expect(style).toContain('font-size:11px');
        expect(style).toContain('font-family:var(--font-ui)');
        expect(style).toContain('color:var(--text-muted)');
      }
    });

    it('estresse: 200 contratos em 20 strikes, 50 renders em menos de 1500 ms e DOM limitado', () => {
      vi.useRealTimers();
      const many = Array.from({ length: 200 }, (_, i) => c(String(i), 505 + (i % 20)));
      const t0 = performance.now();
      let html = '';
      for (let i = 0; i < 50; i++) html = render(many);
      expect(performance.now() - t0).toBeLessThan(1500);
      expect(count(html, '<line')).toBe(20);
      expect(count(html, 'data-testid="order-flag-group-')).toBe(3);
    });
  });
});
