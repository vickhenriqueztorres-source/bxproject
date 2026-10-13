import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MultiChartGrid } from './MultiChartGrid';

describe('[SUBETAPA 01] MultiChartGrid - Seleção Fiel de Ativos e Mapeamento de Células', () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

  it('SELECTION-01: No layout 1x1, a célula visível renderiza ESTRITAMENTE o activeSymbol, ignorando a ordem de openTabs', () => {
    const queryClient = createQueryClient();
    // openTabs tem SYNTH_VOL_50 em primeiro lugar, mas o activeSymbol é AUDUSD_OTC
    const openTabs = ['SYNTH_VOL_50', 'AUDUSD_OTC', 'USDCAD_OTC'];
    const activeSymbol = 'AUDUSD_OTC';

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol={activeSymbol}
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          openTabs={openTabs}
          layout="1x1"
        />
      </QueryClientProvider>
    );

    // Deve renderizar a célula com AUDUSD_OTC como ativo visível
    expect(html).toContain('data-cell-symbol="AUDUSD_OTC"');
    // Em layout 1x1, NÃO deve renderizar célula com SYNTH_VOL_50
    expect(html).not.toContain('data-cell-symbol="SYNTH_VOL_50"');
  });

  it('SELECTION-02: Alternar activeSymbol em 1x1 troca imediatamente a célula visível para o ativo selecionado', () => {
    const queryClient = createQueryClient();
    const openTabs = ['SYNTH_VOL_50', 'AUDUSD_OTC', 'USDCAD_OTC', 'USDCHF_OTC'];
    const testCases = ['AUDUSD_OTC', 'USDCAD_OTC', 'USDCHF_OTC', 'SYNTH_VOL_50'];

    for (const targetSymbol of testCases) {
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MultiChartGrid
            activeSymbol={targetSymbol}
            onActiveSymbolChange={vi.fn()}
            allContracts={[]}
            openTabs={openTabs}
            layout="1x1"
          />
        </QueryClientProvider>
      );

      expect(html).toContain(`data-cell-symbol="${targetSymbol}"`);
    }
  });

  it('SELECTION-03: No layout 2x1 com openTabs, exibe células distintas e marca a célula do activeSymbol como ativa', () => {
    const queryClient = createQueryClient();
    const openTabs = ['AUDUSD_OTC', 'USDCAD_OTC'];
    const activeSymbol = 'USDCAD_OTC';

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol={activeSymbol}
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          openTabs={openTabs}
          layout="2x1"
        />
      </QueryClientProvider>
    );

    expect(html).toContain('data-cell-symbol="AUDUSD_OTC"');
    expect(html).toContain('data-cell-symbol="USDCAD_OTC"');
    // A célula do ativo ativo deve ter data-active="true"
    expect(html).toMatch(/data-cell-symbol="USDCAD_OTC"[^>]*data-active="true"/);
  });

  it('SELECTION-STRESS: 100 alternâncias consecutivas de abas e layouts em alta frequência', () => {
    const queryClient = createQueryClient();
    const symbols = ['EURUSD_OTC', 'BTCUSD_OTC', 'AUDUSD_OTC', 'USDCAD_OTC', 'SYNTH_VOL_50'];
    const layouts = ['1x1', '2x1', '2x2'] as const;

    for (let i = 0; i < 100; i++) {
      const active = symbols[i % symbols.length];
      const layout = layouts[i % layouts.length];
      const tabs = symbols.slice(0, (i % symbols.length) + 1);

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MultiChartGrid
            activeSymbol={active}
            onActiveSymbolChange={vi.fn()}
            allContracts={[]}
            openTabs={tabs}
            layout={layout}
          />
        </QueryClientProvider>
      );

      // Em 1x1, activeSymbol é garantidamente a célula
      if (layout === '1x1') {
        expect(html).toContain(`data-cell-symbol="${active}"`);
      }
      expect(html).toContain('data-testid="chart-sandbox-container"');
    }
  }, 15000);

  it('SELECTION-CHAOS: Resiliência contra openTabs vazio, nulo ou com duplicidades', () => {
    const queryClient = createQueryClient();

    // Caso 1: openTabs vazio
    const htmlEmpty = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol="SYNTH_VOL_50"
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          openTabs={[]}
          layout="1x1"
        />
      </QueryClientProvider>
    );
    expect(htmlEmpty).toContain('data-cell-symbol="SYNTH_VOL_50"');

    // Caso 2: openTabs com duplicidades
    const htmlDup = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol="AUDUSD_OTC"
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          openTabs={['AUDUSD_OTC', 'AUDUSD_OTC', 'AUDUSD_OTC']}
          layout="2x1"
        />
      </QueryClientProvider>
    );
    expect(htmlDup).toContain('data-cell-symbol="AUDUSD_OTC"');
  });
});
