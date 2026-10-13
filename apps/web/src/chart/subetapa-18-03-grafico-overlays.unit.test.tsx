import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChartDrawingToolbar } from './ChartDrawingToolbar';
import { TradersMoodBar } from './TradersMoodBar';
import { TimeLinesOverlay } from './TimeLinesOverlay';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { getTabDisplayTitle } from '../components/header/TerminalHeader';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import type { Contract } from '../api/client';
import type { IndicatorConfig } from './drawing-types';

describe('SUBETAPA 18-03: Engenharia Gráfica, Overlays e Limpeza do Grid', () => {
  const mockIndicators: IndicatorConfig[] = [
    { id: 'sma_20', type: 'SMA', period: 20, color: '#38bdf8', enabled: true },
  ];

  const mockContracts: Contract[] = [
    {
      id: 'c-overlay-1',
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 10000,
      payout_minor: 18500,
      result: null,
      status: 'OPEN',
      entry_price: 500.0,
      strike_price: 500.0,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30000).toISOString(),
    },
  ];

  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('TC-01: ChartDrawingToolbar fica ancorada no canto inferior esquerdo (bottom: 20px, left: 16px) e menus abrem para cima', () => {
    const html = renderToString(
      <ChartDrawingToolbar
        chartType="candles"
        onSelectChartType={vi.fn()}
        timeframe="1m"
        onSelectTimeframe={vi.fn()}
        activeTool={null as any}
        onSelectTool={vi.fn()}
        activeColor="#22C55E"
        onChangeColor={vi.fn()}
        drawingsCount={0}
        indicators={mockIndicators}
        onToggleIndicator={vi.fn()}
        onClearDrawings={vi.fn()}
      />
    );

    // Deve estar no canto inferior esquerdo para não cobrir a barra de sentimento
    expect(html).toContain('bottom:20px');
    expect(html).toContain('left:16px');
    expect(html).not.toContain('top:60px');
  });

  it('TC-02: TradersMoodBar possui largura ampla (64px) e rótulos transparentes sem fundo maciço', () => {
    const html = renderToString(<TradersMoodBar bullsPercentage={55} />);

    // Container de 64px evita corte de texto
    expect(html).toContain('width:64px');

    // Tags com fundo transparente e texto em cinza
    expect(html).toContain('SUBE 55%');
    expect(html).toContain('BAJA 45%');
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:#8A92A1');
  });

  it('TC-03: TimeLinesOverlay utiliza etiqueta de expiração escura translúcida e bandeirinha sutil de 14px', () => {
    const html = renderToString(
      <TimeLinesOverlay
        containerWidth={1000}
        containerHeight={600}
        chartInstance={null}
        latestCandleTime={null}
        timeframe="1m"
      />
    );

    // Etiqueta com fundo escuro e texto sóbrio #E5484D
    expect(html).toContain('background:rgba(15, 20, 28, 0.92)');
    expect(html).toContain('color:#E5484D');
    expect(html).toContain('EXPIRACIÓN');

    // Bandeirinha no rodapé de 14px
    expect(html).toContain('width:14px');
    expect(html).toContain('height:14px');
  });

  it('TC-04: getTabDisplayTitle converte símbolos técnicos ("SYNTH_VOL_50") para nomes comerciais amigáveis ("Vol 50")', () => {
    expect(getTabDisplayTitle('SYNTH_VOL_50')).toBe('Vol 50');
    expect(getTabDisplayTitle('SYNTH_VOL_100')).toBe('Vol 100');
    expect(getTabDisplayTitle('SYNTH_CRASH_BOOM_100')).toBe('Crash 100');
    expect(getTabDisplayTitle('BTCUSD_OTC')).toBe('BTC/USD');
  });

  it('TC-05: PortfolioDrawer exibe o nome comercial ("Vol 50") nas operações abertas em vez do código técnico interno', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={mockContracts}
        currentPrice={502.0}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    // Deve exibir Vol 50
    expect(html).toContain('Vol 50');
    // Não deve exibir SYNTH_VOL_50 na tabela
    expect(html).not.toContain('>SYNTH_VOL_50<');
  });
});
