import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MultiChartGrid } from './MultiChartGrid';
import { OrderTicket } from '../trade/OrderTicket';
import { TerminalLayout } from '../components/layout/TerminalLayout';

describe('SUBETAPA 04: Boleta Multi-Gráfico - Call/Put Individual por Célula & Otimização de Largura', () => {
  const renderWithQuery = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return renderToString(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('4.1 No layout multi-gráfico (ex: 2x1), CADA célula renderiza seu próprio OrderTicket com Call/Put correspondente ao seu ativo', () => {
    const html = renderWithQuery(
      <MultiChartGrid
        activeSymbol="SYNTH_VOL_50"
        onActiveSymbolChange={vi.fn()}
        allContracts={[]}
        layout="2x1"
        openTabs={['SYNTH_VOL_50', 'EURUSD_OTC']}
        availableMinor={1000000}
        soundEnabled={true}
        onChanged={vi.fn()}
      />
    );

    // Célula 1 deve ter seu ticket individual acoplado com SUBE e BAJA
    expect(html).toContain('data-testid="cell-order-ticket-SYNTH_VOL_50"');
    // Célula 2 deve ter seu ticket individual acoplado com SUBE e BAJA
    expect(html).toContain('data-testid="cell-order-ticket-EURUSD_OTC"');

    // Botões SUBE e BAJA devem estar presentes em cada uma das células
    const subeMatches = (html.match(/data-testid="btn-sube"/g) || []).length;
    const bajaMatches = (html.match(/data-testid="btn-baja"/g) || []).length;
    expect(subeMatches).toBeGreaterThanOrEqual(2);
    expect(bajaMatches).toBeGreaterThanOrEqual(2);
  });

  it('4.2 No layout 1x1 clássico, as células não duplicam tickets internos, preservando a área máxima do gráfico', () => {
    const html = renderWithQuery(
      <MultiChartGrid
        activeSymbol="SYNTH_VOL_50"
        onActiveSymbolChange={vi.fn()}
        allContracts={[]}
        layout="1x1"
        openTabs={['SYNTH_VOL_50']}
        availableMinor={1000000}
        soundEnabled={true}
        onChanged={vi.fn()}
      />
    );

    // Não deve conter tickets acoplados nas células no modo 1x1
    expect(html).not.toContain('data-testid="cell-order-ticket-SYNTH_VOL_50"');
  });

  it('4.3 OrderTicket suporta modo isCompact=true com dimensões esguias e sem overflow', () => {
    const html = renderWithQuery(
      <OrderTicket
        symbol="EURUSD_OTC"
        paused={false}
        stale={false}
        availableMinor={1000000}
        soundEnabled={true}
        onChanged={vi.fn()}
        isCompact={true}
      />
    );

    expect(html).toContain('data-testid="binmax-order-ticket"');
    expect(html).toContain('data-testid="btn-sube"');
    expect(html).toContain('data-testid="btn-baja"');
    // Botões e inputs compactos elásticos para evitar scrollbar
    expect(html).toContain('clamp(32px, 4.6vh, 38px)');
  });

  it('4.4 TerminalLayout omite o aside terminal-order-dock quando orderDock for nulo/indefinido', () => {
    const html = renderToString(
      <TerminalLayout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        center={<div>Center Multi Chart</div>}
        orderDock={null}
      />
    );

    // O aside lateral não deve ser renderizado quando orderDock for null
    expect(html).not.toContain('<aside class="terminal-order-dock"');
    expect(html).toContain('Center Multi Chart');
  });

  it('4.5 Teste de Estresse & Caos: Renderiza grade 2x2 com 4 boletas autônomas simultâneas em menos de 500ms', () => {
    const start = performance.now();
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
    const elapsed = performance.now() - start;

    expect(html).toContain('data-testid="cell-order-ticket-SYNTH_VOL_50"');
    expect(html).toContain('data-testid="cell-order-ticket-EURUSD_OTC"');
    expect(html).toContain('data-testid="cell-order-ticket-BTCUSD_OTC"');
    expect(html).toContain('data-testid="cell-order-ticket-ETHUSD_OTC"');
    expect(elapsed).toBeLessThan(500);
  });
});
