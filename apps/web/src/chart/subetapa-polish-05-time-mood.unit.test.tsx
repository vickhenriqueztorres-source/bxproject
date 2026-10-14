import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TradersMoodBar, moodDiamondSplit } from './TradersMoodBar';
import { TimeLinesOverlay, computeTimeCountdowns, shouldPulseCountdown } from './TimeLinesOverlay';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { setTraderoomPolishEnabled, resetTraderoomPolishForTesting } from '../lib/traderoom-polish';

const TS = '2026-10-13T20:55:20.000Z';

function renderTimes(props: Partial<React.ComponentProps<typeof TimeLinesOverlay>> = {}) {
  return renderToString(
    <TimeLinesOverlay containerWidth={1600} containerHeight={800} chartInstance={null} latestCandleTime={null} tickTimestamp={TS} {...props} />,
  );
}
function attrStyle(html: string, testid: string): string {
  const i = html.indexOf('data-testid="' + testid + '"');
  if (i < 0) return '';
  const tag = html.slice(html.lastIndexOf('<', i), html.indexOf('>', i));
  return tag.match(/style="([^"]*)"/)?.[1] ?? '';
}
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('Subetapa 05 — funções puras', () => {
  it('sentimento: 12 losangos na proporção, estável nos extremos', () => {
    expect(moodDiamondSplit(52)).toEqual({ bulls: 6, bears: 6 });
    expect(moodDiamondSplit(75)).toEqual({ bulls: 9, bears: 3 });
    for (const p of [0, 5, 95, 100]) {
      const s = moodDiamondSplit(p);
      expect(s.bulls + s.bears).toBe(12);
      expect(s.bulls).toBeGreaterThanOrEqual(1);
      expect(s.bears).toBeGreaterThanOrEqual(1);
    }
  });

  it('caos: percentual NaN, negativo ou > 100 é limitado', () => {
    expect(moodDiamondSplit(NaN)).toEqual({ bulls: 6, bears: 6 });
    expect(moodDiamondSplit(-5).bulls).toBe(1);
    expect(moodDiamondSplit(140).bears).toBe(1);
  });

  it('contagens a partir do relógio: trava de compra aos :30 e expiração aos :00', () => {
    expect(computeTimeCountdowns(Date.parse('2026-10-13T20:55:20.000Z'))).toEqual({ secondsRemaining: 40, purchaseSecondsRemaining: 10, isPurchaseLocked: false });
    expect(computeTimeCountdowns(Date.parse('2026-10-13T20:55:45.000Z'))).toEqual({ secondsRemaining: 15, purchaseSecondsRemaining: 0, isPurchaseLocked: true });
    expect(computeTimeCountdowns(Date.parse('2026-10-13T20:56:00.000Z')).secondsRemaining).toBe(60);
  });

  it('caos: relógio inválido cai no relógio local sem NaN', () => {
    const r = computeTimeCountdowns(NaN);
    expect(Number.isFinite(r.secondsRemaining)).toBe(true);
    expect(Number.isFinite(r.purchaseSecondsRemaining)).toBe(true);
  });

  it('pulsação só nos últimos 5 s antes da trava (única pulsação permitida)', () => {
    expect([6, 5, 1, 0].map(shouldPulseCountdown)).toEqual([false, true, true, false]);
  });

  it('estresse: 100.000 contagens em menos de 100 ms', () => {
    const t0 = performance.now();
    for (let i = 0; i < 100_000; i++) computeTimeCountdowns(1_700_000_000_000 + i * 250);
    expect(performance.now() - t0).toBeLessThan(100);
  });
});

describe('Subetapa 05 — overlays', () => {
  beforeEach(() => setNewTraderoomEnabled(true));
  afterEach(() => resetTraderoomPolishForTesting());

  it('chave desligada: overlays idênticos ao snapshot anterior', () => {
    setTraderoomPolishEnabled(false);
    expect(renderTimes()).toMatchSnapshot();
    expect(renderToString(<TradersMoodBar bullsPercentage={52} />)).toMatchSnapshot();
  });

  describe('chave ligada', () => {
    beforeEach(() => setTraderoomPolishEnabled(true));

    it('sentimento: SUBE/52% em cima, 12 losangos, BAJA/48% embaixo', () => {
      const html = renderToString(<TradersMoodBar bullsPercentage={52} />);
      expect(html).toContain('data-testid="mood-diamond-column"');
      expect(count(html, 'data-mood-diamond="bull"')).toBe(6);
      expect(count(html, 'data-mood-diamond="bear"')).toBe(6);
      expect(html).toMatch(/data-testid="mood-tag-bulls"[^>]*>.*SUBE.*52%/s);
      expect(html).toMatch(/data-testid="mood-tag-bears"[^>]*>.*BAJA.*48%/s);
      expect(html).not.toContain('data-testid="mood-capsule"');
    });

    it('sentimento: rótulo 12px e número 14px 600 na fonte de interface, cores dos tokens', () => {
      const html = renderToString(<TradersMoodBar bullsPercentage={52} />);
      const tag = attrStyle(html, 'mood-tag-bulls');
      expect(tag).toContain('font-size:12px');
      expect(tag).toContain('font-family:var(--font-ui)');
      expect(attrStyle(html, 'mood-pct-bulls')).toContain('font-size:14px');
      expect(attrStyle(html, 'mood-pct-bulls')).toContain('font-weight:600');
      expect(html).not.toMatch(/#22C47A|#F2545B|Geist Mono/i);
      expect(html).not.toContain('box-shadow:0 0');
    });

    it('anticolisão: a coluna fica entre 28% e 62% da altura (acima da barra de ferramentas)', () => {
      const s = attrStyle(renderToString(<TradersMoodBar bullsPercentage={52} />), 'traders-mood-bar');
      expect(s).toContain('top:28%');
      expect(s).toContain('bottom:38%');
    });

    it('hora de compra: rótulo em 2 linhas sem caixa e contador 20px mono', () => {
      const html = renderToString(<TimeLinesOverlay containerWidth={1600} containerHeight={800} chartInstance={null} latestCandleTime={null} tickTimestamp={TS} />);
      const tag = attrStyle(html, 'time-tag-purchase');
      expect(tag).toContain('background:transparent');
      expect(tag).not.toContain('box-shadow:0 4px');
      expect(html).toMatch(/HORA DE<br\/?>COMPRA/);
      const counter = attrStyle(html, 'purchase-countdown');
      expect(counter).toContain('font-size:20px');
      expect(counter).toContain('font-family:var(--font-mono)');
    });

    it('expiração: sem pílula no topo, linha vermelha do token sem glow', () => {
      const html = renderTimes();
      expect(html).not.toContain('data-testid="time-tag-expiration"');
      const line = attrStyle(html, 'expiration-time-line');
      expect(line).toContain('background:var(--loss)');
      expect(line).toContain('box-shadow:none');
    });

    it('hideTopTags continua escondendo o rótulo da hora de compra', () => {
      expect(renderTimes({ hideTopTags: true })).not.toContain('data-testid="time-tag-purchase"');
    });

    it('caos: dimensões zero e timestamp inválido não quebram', () => {
      expect(renderTimes({ containerWidth: 0 })).toBe('');
      expect(() => renderTimes({ tickTimestamp: 'not-a-date' })).not.toThrow();
    });

    it('estresse: 200 renders de cada overlay em menos de 1500 ms', () => {
      const t0 = performance.now();
      for (let i = 0; i < 200; i++) {
        renderToString(<TradersMoodBar bullsPercentage={i % 101} />);
        renderTimes();
      }
      expect(performance.now() - t0).toBeLessThan(1500);
    });
  });
});
