import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PriceChart } from './PriceChart';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { setTraderoomPolishEnabled, resetTraderoomPolishForTesting } from '../lib/traderoom-polish';
import { getAssetDisplayName, getAxisPrecision, POLISH_CHART_LOCALE, ASSET_CATALOG } from '../catalog/assets';

const FIXED = new Date('2026-10-13T20:00:10.000Z');
const baseProps = {
  candles: [],
  tick: null,
  symbol: 'SYNTH_VOL_50',
  activeContracts: [],
  isStale: false,
  isVisible: true,
  onSelectSymbol: vi.fn(),
};

// Recorta o HTML do pill do ativo (do container até o fim do botão de favorito).
function pillOf(html: string): string {
  const start = html.indexOf('data-testid="chart-top-asset-pill"');
  const fav = html.indexOf('data-testid="asset-action-favorite"', start);
  const end = html.indexOf('</svg>', fav);
  return start >= 0 && end > start ? html.slice(start, end) : '';
}

// Atributo style da tag que contém o data-testid.
function attrStyle(html: string, testid: string): string {
  const i = html.indexOf('data-testid="' + testid + '"');
  if (i < 0) return '';
  const tag = html.slice(html.lastIndexOf('<', i), html.indexOf('>', i));
  return tag.match(/style="([^"]*)"/)?.[1] ?? '';
}

describe('Subetapa 02 — nome de exibição e precisão do eixo (funções puras)', () => {
  it('sintéticos: VOL_50 e SYNTH_VOL_50 viram "Vol 50"', () => {
    expect(getAssetDisplayName('VOL_50')).toBe('Vol 50');
    expect(getAssetDisplayName('SYNTH_VOL_50')).toBe('Vol 50');
    expect(getAssetDisplayName('vol_100')).toBe('Vol 100');
    expect(getAssetDisplayName('CRASH_BOOM_100')).toBe('Crash 100');
  });

  it('forex e commodities', () => {
    expect(getAssetDisplayName('EURUSD_OTC')).toBe('EUR/USD');
    expect(getAssetDisplayName('NZDJPY_OTC')).toBe('NZD/JPY');
    expect(getAssetDisplayName('XAUUSD_OTC')).toBe('Gold');
  });

  it('desconhecido: sem underscore e sem SYNTH_', () => {
    expect(getAssetDisplayName('SYNTH_FOO_BAR')).toBe('FOO BAR');
    expect(getAssetDisplayName('')).toBe('');
  });

  it('todo ativo do catálogo tem nome sem "_" e não vazio', () => {
    for (const a of ASSET_CATALOG) {
      const n = getAssetDisplayName(a.symbol);
      expect(n.length).toBeGreaterThan(0);
      expect(n).not.toContain('_');
    }
  });

  it('precisão do eixo: sintéticos 2 casas, forex conforme catálogo', () => {
    expect(getAxisPrecision('VOL_50')).toBe(2);
    expect(getAxisPrecision('SYNTH_VOL_50')).toBe(2);
    expect(getAxisPrecision('EURUSD_OTC')).toBe(5);
    expect(getAxisPrecision('USDJPY_OTC')).toBe(3);
    expect(getAxisPrecision('NAO_EXISTE')).toBe(2);
  });

  it('eixo de tempo em espanhol', () => {
    expect(POLISH_CHART_LOCALE.startsWith('es')).toBe(true);
  });

  it('estresse: 10.000 nomes em menos de 50 ms', () => {
    const syms = ASSET_CATALOG.map((a) => a.symbol);
    const t0 = performance.now();
    for (let i = 0; i < 10_000; i++) getAssetDisplayName(syms[i % syms.length]);
    expect(performance.now() - t0).toBeLessThan(50);
  });
});

describe('Subetapa 02 — pill do ativo no gráfico', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
    setNewTraderoomEnabled(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    resetTraderoomPolishForTesting();
  });

  it('chave desligada: pill idêntico ao snapshot anterior', () => {
    setTraderoomPolishEnabled(false);
    const pill = pillOf(renderToString(<PriceChart {...baseProps} />));
    expect(pill.length).toBeGreaterThan(100);
    expect(pill).toMatchSnapshot();
  });

  describe('chave ligada', () => {
    beforeEach(() => setTraderoomPolishEnabled(true));

    it('mostra "Vol 50", nunca o símbolo cru', () => {
      const pill = pillOf(renderToString(<PriceChart {...baseProps} />));
      expect(pill).toContain('data-testid="chart-asset-display-name"');
      expect(pill).toContain('>Vol 50<');
      expect(pill).not.toContain('SYNTH_VOL_50');
      expect(pill).not.toContain('VOL_50<');
    });

    it('EURUSD_OTC continua EUR/USD', () => {
      expect(pillOf(renderToString(<PriceChart {...baseProps} symbol="EURUSD_OTC" />))).toContain('>EUR/USD<');
    });

    it('"Digital" é subtítulo neutro, sem selo verde', () => {
      const html = renderToString(<PriceChart {...baseProps} />);
      const pill = pillOf(html);
      expect(pill).toContain('Digital');
      expect(attrStyle(html, 'chart-asset-subtitle')).toContain('color:var(--text-muted)');
      // O selo verde (fundo/borda rgba(34,196,122)) some. O ícone do ativo (AssetFlagBadge)
      // é compartilhado com as abas do header e é tratado na Subetapa 07.
      expect(pill).not.toContain('rgba(34, 196, 122');
      expect(attrStyle(html, 'chart-asset-subtitle')).not.toMatch(/#22C47A|var\(--profit\)/i);
    });

    it('nome 16px peso 600; ações em botões de 32px', () => {
      const html = renderToString(<PriceChart {...baseProps} />);
      const name = attrStyle(html, 'chart-asset-display-name');
      expect(name).toContain('font-size:16px');
      expect(name).toContain('font-weight:600');
      for (const id of ['asset-action-info', 'asset-action-alert', 'asset-action-favorite']) {
        const s = attrStyle(html, id);
        expect(s).toContain('width:32px');
        expect(s).toContain('height:32px');
        expect(s).toContain('background:var(--bg-2)');
      }
    });

    it('mantém acessibilidade e ações (títulos, aria, chevron)', () => {
      const html = renderToString(<PriceChart {...baseProps} />);
      for (const t of [
        'title="Información del activo"',
        'title="Crear alerta"',
        'title="Agregar a favoritos"',
        'aria-label="Seleccionar activo del gráfico"',
        'data-testid="asset-selector-chevron"',
      ]) {
        expect(html).toContain(t);
      }
    });

    it('sem sombra pesada nem cores fora dos tokens no pill', () => {
      const pill = pillOf(renderToString(<PriceChart {...baseProps} />));
      expect(pill).not.toContain('rgba(0, 0, 0, 0.6)');
      expect(pill).not.toMatch(/#00e5ff|#00e676|#22c55e/i);
    });

    it('segurança: símbolo malicioso não vira HTML', () => {
      const html = renderToString(<PriceChart {...baseProps} symbol={'<img src=x onerror=alert(1)>'} />);
      expect(html).not.toContain('<img src=x');
    });

    it('caos: símbolo vazio ou desconhecido não quebra', () => {
      expect(() => renderToString(<PriceChart {...baseProps} symbol="" />)).not.toThrow();
      expect(() => renderToString(<PriceChart {...baseProps} symbol="NAO_EXISTE" />)).not.toThrow();
    });

    it('estresse: 100 renders trocando de ativo em menos de 2000 ms', () => {
      vi.useRealTimers();
      const syms = ASSET_CATALOG.map((a) => a.symbol);
      const t0 = performance.now();
      for (let i = 0; i < 100; i++) renderToString(<PriceChart {...baseProps} symbol={syms[i % syms.length]} />);
      expect(performance.now() - t0).toBeLessThan(2000);
    });
  });
});
