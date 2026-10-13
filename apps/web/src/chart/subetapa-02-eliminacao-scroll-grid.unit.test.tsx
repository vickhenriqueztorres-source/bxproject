import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MultiChartGrid } from './MultiChartGrid';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';

describe('SUBETAPA 02: Eliminação do Scrollbar Feio & Integração Multi-Gráfico + Gaveta de Posições', () => {
  const renderWithQuery = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return renderToString(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('2.1 MultiChartGrid em modo multi-gráfico renderiza boletas com overflow hidden e classe bm-stealth-scroll', () => {
    const html = renderWithQuery(
      <MultiChartGrid
        activeSymbol="SYNTH_VOL_50"
        onActiveSymbolChange={vi.fn()}
        allContracts={[]}
        layout="2x2"
        openTabs={['SYNTH_VOL_50', 'EURUSD_OTC', 'BTCUSD_OTC', 'ETHUSD_OTC']}
        availableMinor={1000000}
        soundEnabled={true}
        onChanged={vi.fn()}
      />
    );

    // Deve conter classes stealth e overflow hidden
    expect(html).toContain('cell-order-ticket-container');
    expect(html).toContain('bm-stealth-scroll');
    expect(html).toContain('overflow:hidden');
    // Não deve conter overflowY auto nas células
    expect(html).not.toContain('overflow-y:auto');
  });

  it('2.2 PortfolioDrawer aberto renderiza com altura adaptativa clamp para não esmagar gráficos e boletas', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={[]}
        currentPrice={1.2345}
        currentSymbol="EURUSD_OTC"
      />
    );

    // Conteúdo expandido deve usar clamp de altura
    expect(html).toContain('clamp(160px, 20vh, 220px)');
    expect(html).toContain('max-height:220px');
    // Deve conter classe stealth scrollbar na tabela
    expect(html).toContain('bm-stealth-scroll');
  });

  it('2.3 Layout 1x2 vertical renderiza ambas as células com boletas integradas sem scrollbar nativo', () => {
    const html = renderWithQuery(
      <MultiChartGrid
        activeSymbol="EURUSD_OTC"
        onActiveSymbolChange={vi.fn()}
        allContracts={[]}
        layout="1x2"
        openTabs={['EURUSD_OTC', 'USDJPY_OTC']}
        availableMinor={1000000}
        soundEnabled={true}
        onChanged={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="cell-order-ticket-EURUSD_OTC"');
    expect(html).toContain('data-testid="cell-order-ticket-USDJPY_OTC"');
    expect(html).toContain('cell-order-ticket-container');
  });
});
