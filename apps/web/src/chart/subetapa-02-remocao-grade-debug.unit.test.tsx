import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MultiChartGrid } from './MultiChartGrid';

describe('SUBETAPA 02: Limpeza Visual - Remoção da Barra de Grade de Gráficos Técnica', () => {
  const renderWithQuery = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return renderToString(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('2.1 No modo Binmax, a barra Grade de Gráficos NUNCA é renderizada (mesmo em layouts multi-chart 2x1, 2x2, 3x2)', () => {
    const layouts = ['1x1', '2x1', '2x2', '3x2'] as const;

    layouts.forEach((layout) => {
      const html = renderWithQuery(
        <MultiChartGrid
          activeSymbol="SYNTH_VOL_50"
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          layout={layout}
          openTabs={['SYNTH_VOL_50', 'EURUSD_OTC']}
        />
      );

      // A barra técnica com esses textos NÃO pode existir
      expect(html).not.toContain('Grade de Gráficos:');
      expect(html).not.toContain('[ 1 ]');
      expect(html).not.toContain('[ 2 ]');
      expect(html).not.toContain('[ 4 ]');
      expect(html).not.toContain('[ 6 ]');
      expect(html).not.toContain('SINCRONIZADO');
      expect(html).not.toContain('Ativo em Foco:');
    });
  });

  it('2.2 Preserva a estrutura de células e renderização correta dos gráficos da grade', () => {
    const html = renderWithQuery(
      <MultiChartGrid
        activeSymbol="SYNTH_VOL_50"
        onActiveSymbolChange={vi.fn()}
        allContracts={[]}
        layout="2x1"
        openTabs={['SYNTH_VOL_50', 'EURUSD_OTC']}
      />
    );

    // Células do grid continuam existindo
    expect(html).toContain('data-testid="grid-cell-SYNTH_VOL_50"');
    expect(html).toContain('data-testid="grid-cell-EURUSD_OTC"');
  });
});
