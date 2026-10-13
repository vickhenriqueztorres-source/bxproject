import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChartDrawingToolbar } from './ChartDrawingToolbar';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import type { IndicatorConfig } from './drawing-types';

describe('SUBETAPA UX 04: Redesign Profissional da Barra Flutuante de Velas, Timeframe e Indicadores', () => {
  const mockIndicators: IndicatorConfig[] = [
    { id: 'sma_20', type: 'SMA', period: 20, color: '#38bdf8', enabled: true },
    { id: 'ema_9', type: 'EMA', period: 9, color: '#f59e0b', enabled: false },
    { id: 'rsi_14', type: 'RSI', period: 14, color: '#a855f7', enabled: false },
  ];

  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('4.1 Modo Binmax renderiza ícones vetoriais SVG institucionais (elimina emojis 🕯️, ((•)), ✏️)', () => {
    const html = renderToString(
      <ChartDrawingToolbar
        chartType="candles"
        onSelectChartType={vi.fn()}
        timeframe="1m"
        onSelectTimeframe={vi.fn()}
        activeTool={null as any}
        onSelectTool={vi.fn()}
        activeColor="#00e676"
        onChangeColor={vi.fn()}
        drawingsCount={0}
        indicators={mockIndicators}
        onToggleIndicator={vi.fn()}
        onClearDrawings={vi.fn()}
      />
    );

    // Deve conter ícones SVG dedicados
    expect(html).toContain('data-testid="icon-candlestick-pair"');
    expect(html).toContain('data-testid="icon-wave-indicators"');
    expect(html).toContain('data-testid="icon-tool-pencil"');

    // NÃO deve conter emojis ou texto rústico
    expect(html).not.toContain('🕯️');
    expect(html).not.toContain('((•))');
    expect(html).not.toContain('✏️');
    expect(html).not.toContain('NEW');

    // Docking glassmorphism
    expect(html).toContain('data-testid="chart-drawing-toolbar-dock"');
    expect(html).toContain('backdrop-filter:blur(12px)');
  });

  it('4.2 Exibe contador de indicadores ativos com estilo elegante e tipografia Geist Mono para Timeframe', () => {
    const html = renderToString(
      <ChartDrawingToolbar
        chartType="candles"
        onSelectChartType={vi.fn()}
        timeframe="5s"
        onSelectTimeframe={vi.fn()}
        activeTool={null as any}
        onSelectTool={vi.fn()}
        activeColor="#00e676"
        onChangeColor={vi.fn()}
        drawingsCount={0}
        indicators={mockIndicators}
        onToggleIndicator={vi.fn()}
        onClearDrawings={vi.fn()}
      />
    );

    // Timeframe
    expect(html).toContain('data-testid="btn-timeframe"');
    expect(html).toContain('5s');
    expect(html).toContain('Geist Mono');

    // Badge com contagem de 1 indicador ativo
    expect(html).toContain('data-testid="indicators-count-badge"');
    expect(html).toContain('1');
  });

  it('4.3 Botão de Lixeira renderiza SVG IconTrash em vez de emoji 🗑️ quando há desenhos', () => {
    const html = renderToString(
      <ChartDrawingToolbar
        chartType="candles"
        onSelectChartType={vi.fn()}
        timeframe="1m"
        onSelectTimeframe={vi.fn()}
        activeTool={null as any}
        onSelectTool={vi.fn()}
        activeColor="#00e676"
        onChangeColor={vi.fn()}
        drawingsCount={3}
        indicators={mockIndicators}
        onToggleIndicator={vi.fn()}
        onClearDrawings={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="btn-clear-drawings"');
    expect(html).toContain('data-testid="icon-trash"');
    expect(html).not.toContain('🗑️');
  });

  it('4.4 Padrão Duas Portas: Modo Legado preserva emojis 🕯️, ((•)), ✏️ e badge NEW', () => {
    setFeatureFlagForTesting(false);
    const htmlLegacy = renderToString(
      <ChartDrawingToolbar
        chartType="candles"
        onSelectChartType={vi.fn()}
        timeframe="1m"
        onSelectTimeframe={vi.fn()}
        activeTool={null as any}
        onSelectTool={vi.fn()}
        activeColor="#00e676"
        onChangeColor={vi.fn()}
        drawingsCount={2}
        indicators={mockIndicators}
        onToggleIndicator={vi.fn()}
        onClearDrawings={vi.fn()}
      />
    );

    expect(htmlLegacy).toContain('🕯️');
    expect(htmlLegacy).toContain('((•))');
    expect(htmlLegacy).toContain('✏️');
    expect(htmlLegacy).toContain('NEW');
    expect(htmlLegacy).toContain('🗑️');
    expect(htmlLegacy).not.toContain('data-testid="icon-candlestick-pair"');
  });

  it('4.5 Teste de Estresse: Renderizações completas com variação de ferramentas', () => {
    const start = performance.now();
    for (let i = 0; i < 30; i++) {
      const isCandle = i % 2 === 0;
      const html = renderToString(
        <ChartDrawingToolbar
          chartType={isCandle ? 'candles' : 'line'}
          onSelectChartType={vi.fn()}
          timeframe="1m"
          onSelectTimeframe={vi.fn()}
          activeTool={i % 3 === 0 ? 'line' : (null as any)}
          onSelectTool={vi.fn()}
          activeColor="#00e676"
          onChangeColor={vi.fn()}
          drawingsCount={i % 5}
          indicators={mockIndicators}
          onToggleIndicator={vi.fn()}
          onClearDrawings={vi.fn()}
        />
      );
      expect(html).toContain('data-testid="chart-drawing-toolbar"');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});
