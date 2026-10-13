import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MultiChartGrid } from './MultiChartGrid';

let mockBinmax = true;
vi.mock('../lib/feature-flags', () => ({
  isNewTraderoomEnabled: () => mockBinmax,
}));

// Mock do Lightweight Charts
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    applyOptions: vi.fn(),
    addCandlestickSeries: vi.fn(() => ({
      setData: vi.fn(),
      update: vi.fn(),
      priceToCoordinate: vi.fn(() => 100),
      coordinateToPrice: vi.fn(() => 100),
    })),
    addAreaSeries: vi.fn(() => ({
      setData: vi.fn(),
      update: vi.fn(),
      priceToCoordinate: vi.fn(() => 100),
      coordinateToPrice: vi.fn(() => 100),
    })),
    remove: vi.fn(),
    timeScale: vi.fn(() => ({
      fitContent: vi.fn(),
      scrollToPosition: vi.fn(),
      coordinateToTime: vi.fn(),
      timeToCoordinate: vi.fn(() => 200),
      coordinateToLogical: vi.fn(() => 50),
      logicalToCoordinate: vi.fn(() => 60),
    })),
  })),
}));

describe('SUBETAPA 01: Remoção do Cabeçalho Repetido nas Células da Grade', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockBinmax = true;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('1.1 No modo Binmax com grade 2x1, NÃO renderiza o cabeçalho repetido com select nativo ou ATIVO ⚡', () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol="EURUSD_OTC"
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          layout="2x1"
          onLayoutChange={vi.fn()}
          openTabs={['EURUSD_OTC', 'GBPUSD_OTC']}
        />
      </QueryClientProvider>
    );

    // O cabeçalho repetido antigo continha a tag <select> com os pares e o badge "ATIVO"
    expect(html).not.toContain('<select');
    expect(html).not.toContain('>ATIVO<');
    expect(html).not.toContain('⚡ 0ms');
  });

  it('1.2 As células em grade possuem moldura sutil e delimitadora de foco', () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol="EURUSD_OTC"
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          layout="2x2"
          onLayoutChange={vi.fn()}
          openTabs={['EURUSD_OTC', 'GBPUSD_OTC', 'USDJPY_OTC', 'AUDUSD_OTC']}
        />
      </QueryClientProvider>
    );

    // Deve conter as células da grade
    expect(html).toContain('data-testid="multi-chart-grid"');
    expect(html).toContain('data-testid="grid-cell-EURUSD_OTC"');
    // Não deve conter a barra azul repetida
    expect(html).not.toContain('background:#0d1829');
  });

  it('1.3 No modo legado, o cabeçalho original com select é preservado para compatibilidade retroativa', () => {
    mockBinmax = false;
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MultiChartGrid
          activeSymbol="EURUSD_OTC"
          onActiveSymbolChange={vi.fn()}
          allContracts={[]}
          layout="2x1"
          onLayoutChange={vi.fn()}
          openTabs={['EURUSD_OTC', 'GBPUSD_OTC']}
        />
      </QueryClientProvider>
    );

    // Em modo legado deve conter o select do cabeçalho da célula
    expect(html).toContain('<select');
  });
});
