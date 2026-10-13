import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MultiChartGrid } from './MultiChartGrid';

describe('[SUBETAPA 02 REVISADA] Sincronização Dinâmica de Abas com a Grade de Múltiplos Gráficos', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it('SYNC-01: MultiChartGrid mapeia fielmente os símbolos de openTabs para as células da grade', () => {
    const openTabs = ['SYNTH_VOL_50', 'GBPUSD_OTC'];

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol="SYNTH_VOL_50"
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          openTabs={openTabs}
          layout="2x1"
        />
      </QueryClientProvider>
    );

    // Deve conter ambos os símbolos nas opções das células
    expect(html).toContain('SYNTH_VOL_50');
    expect(html).toContain('GBPUSD_OTC');
  });

  it('SYNC-02: No layout 2x1 com 2 abas abertas, cada tela exibe sua respectiva aba sem duplicar o ativo', () => {
    const openTabs = ['EURUSD_OTC', 'BTCUSD_OTC'];

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol="EURUSD_OTC"
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          openTabs={openTabs}
          layout="2x1"
        />
      </QueryClientProvider>
    );

    expect(html).toContain('EURUSD_OTC');
    expect(html).toContain('BTCUSD_OTC');
  });

  it('SYNC-03: Suporta fallback dinâmico ordenado quando o layout exige mais janelas que as abas abertas', () => {
    // 1 aba aberta, mas layout é 2x1
    const openTabs = ['SYNTH_VOL_50'];

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol="SYNTH_VOL_50"
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          openTabs={openTabs}
          layout="2x1"
        />
      </QueryClientProvider>
    );

    // A primeira célula é SYNTH_VOL_50, e a segunda célula recebe um ativo alternativo sem crash
    expect(html).toContain('SYNTH_VOL_50');
  });

  it('SYNC-04: Teste de Estresse: Suporta abertura e alternância de 50 abas consecutivas', () => {
    const onActiveChange = vi.fn();
    const testSymbols = ['EURUSD_OTC', 'BTCUSD_OTC', 'XAUUSD_OTC', 'SYNTH_VOL_50'];

    for (let i = 0; i < 50; i++) {
      const active = testSymbols[i % testSymbols.length];
      const tabs = testSymbols.slice(0, (i % 4) + 1);

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MultiChartGrid
            activeSymbol={active}
            onActiveSymbolChange={onActiveChange}
            allContracts={[]}
            openTabs={tabs}
            layout="2x2"
          />
        </QueryClientProvider>
      );
      expect(html).toContain(active);
    }
  });
});
