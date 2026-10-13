import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PriceChart } from '../chart/PriceChart';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { ASSET_CATALOG } from '../catalog/assets';

describe('SUBETAPA 2: Seletor Interativo In-Chart & Troca Rápida de Ativos', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  const defaultProps = {
    candles: [],
    tick: null,
    symbol: 'SYNTH_VOL_50',
    activeContracts: [],
    isStale: false,
    isVisible: true,
    onSelectSymbol: vi.fn(),
  };

  it('IS-01: Pill Superior do Gráfico renderiza identificador do ativo e indicador interativo Digital ▾', () => {
    const html = renderToString(<PriceChart {...defaultProps} />);
    expect(html).toContain('data-testid="chart-top-asset-pill"');
    expect(html).toContain('SYNTH_VOL_50');
    expect(html).toContain('Digital');
    expect(html).toContain('data-testid="asset-selector-chevron"');
    expect(html).toContain('cursor:pointer');
  });

  it('IS-02: Formatação de pares cambiais no Pill (ex: EURUSD_OTC vira EUR/USD)', () => {
    const html = renderToString(<PriceChart {...defaultProps} symbol="EURUSD_OTC" />);
    expect(html).toContain('EUR/USD');
  });

  it('IS-03: Renderiza ações auxiliares do ativo (informação, alerta e favoritos)', () => {
    const html = renderToString(<PriceChart {...defaultProps} />);
    expect(html).toContain('title="Información del activo"');
    expect(html).toContain('title="Crear alerta"');
    expect(html).toContain('title="Agregar a favoritos"');
  });

  it('IS-04: Atributo aria e acessibilidade do seletor in-chart', () => {
    const html = renderToString(<PriceChart {...defaultProps} />);
    expect(html).toContain('aria-label="Seleccionar activo del gráfico"');
  });

  it('IS-05: Padrão Duas Portas — Quando NEW_TRADEROOM = false, pill binmax não é renderizado', () => {
    setNewTraderoomEnabled(false);
    const html = renderToString(<PriceChart {...defaultProps} />);
    expect(html).not.toContain('data-testid="chart-top-asset-pill"');
  });
});
