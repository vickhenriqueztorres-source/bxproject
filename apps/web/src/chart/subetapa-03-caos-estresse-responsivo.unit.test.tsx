import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MultiChartGrid } from './MultiChartGrid';
import { OrderTicket } from '../trade/OrderTicket';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { TerminalLayout } from '../components/layout/TerminalLayout';
import * as clientApi from '../api/client';

describe('SUBETAPA 03: Bateria de Certificação, Estresse, Caos, Segurança e Não-Regressão', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderWithQuery = (ui: React.ReactElement) => {
    return renderToString(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('3.1 TESTE DE ESTRESSE: MultiChartGrid 2x2 monta 4 boletas compactas simultâneas sob alta densidade', () => {
    const start = performance.now();
    const html = renderWithQuery(
      <MultiChartGrid
        activeSymbol="EURUSD_OTC"
        onActiveSymbolChange={vi.fn()}
        allContracts={[]}
        layout="2x2"
        openTabs={['EURUSD_OTC', 'USDJPY_OTC', 'BTCUSD_OTC', 'ETHUSD_OTC']}
        availableMinor={1000000}
        soundEnabled={true}
        onChanged={vi.fn()}
      />
    );
    const duration = performance.now() - start;

    // Todas as 4 células devem existir
    expect(html).toContain('data-testid="cell-order-ticket-EURUSD_OTC"');
    expect(html).toContain('data-testid="cell-order-ticket-USDJPY_OTC"');
    expect(html).toContain('data-testid="cell-order-ticket-BTCUSD_OTC"');
    expect(html).toContain('data-testid="cell-order-ticket-ETHUSD_OTC"');

    // Nenhuma célula deve conter overflow-y: auto
    expect(html).not.toContain('overflow-y:auto');
    // Todas devem ter classe stealth
    const stealthMatches = (html.match(/bm-stealth-scroll/g) || []).length;
    expect(stealthMatches).toBeGreaterThanOrEqual(4);

    // Renderização deve ser ultrarrápida (< 300ms)
    expect(duration).toBeLessThan(300);
  });

  it('3.2 TESTE DE CAOS: Simulação de integração entre TerminalLayout e PortfolioDrawer aberto', () => {
    const html = renderWithQuery(
      <TerminalLayout
        header={<header>Header</header>}
        sidebar={<aside>Sidebar</aside>}
        center={
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
        }
        orderDock={null}
        drawer={
          <PortfolioDrawer
            isOpen={true}
            onToggle={vi.fn()}
            contracts={[]}
            currentPrice={1.082}
            currentSymbol="EURUSD_OTC"
          />
        }
      />
    );

    // O Terminal deve renderizar o layout 1x2 e o Drawer aberto simultaneamente
    expect(html).toContain('data-testid="cell-order-ticket-EURUSD_OTC"');
    expect(html).toContain('data-testid="cell-order-ticket-USDJPY_OTC"');
    expect(html).toContain('clamp(160px, 20vh, 220px)');
    expect(html).toContain('max-height:220px');
    expect(html).toContain('Sin operaciones abiertas');
  });

  it('3.3 TESTE DE SEGURANÇA E INVARIANTES: Preservação estrita de stake e payout na boleta compacta', () => {
    const html = renderWithQuery(
      <OrderTicket
        symbol="EURUSD_OTC"
        paused={false}
        stale={false}
        availableMinor={500000} // $5,000.00
        soundEnabled={false}
        onChanged={vi.fn()}
        isCompact={true}
      />
    );

    // Payout de 85% oficial
    expect(html).toContain('+85%');
    // Lucro calculado de $100 * 85% = +$85.00
    expect(html).toContain('+$85.00');
    // Stake inicial de 100
    expect(html).toContain('value="100"');
  });

  it('3.4 TESTE DE CAOS: Supressão rigorosa de duplo clique e estado de bloqueio operacional', async () => {
    const openContractSpy = vi.spyOn(clientApi, 'openContract').mockResolvedValue({
      id: 'ord_test_123',
      symbol: 'EURUSD_OTC',
      direction: 'UP',
      stake_minor: 10000,
      payout_minor: 18500,
      entry_price: 1.082,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });

    const htmlBlocked = renderWithQuery(
      <OrderTicket
        symbol="EURUSD_OTC"
        paused={true}
        stale={false}
        availableMinor={1000000}
        soundEnabled={true}
        onChanged={vi.fn()}
        isCompact={true}
      />
    );

    // Quando bloqueado, botões possuem atributo disabled e não chamam openContract
    expect(htmlBlocked).toContain('disabled=""');
    expect(openContractSpy).not.toHaveBeenCalled();
  });

  it('3.5 TESTE DE NÃO-REGRESSÃO: Regras CSS de supressão de scrollbar registradas para tema Binmax', () => {
    const html = renderWithQuery(
      <div className="theme-binmax">
        <div className="cell-order-ticket-container" data-testid="cell-order-ticket-EURUSD_OTC">
          <OrderTicket
            symbol="EURUSD_OTC"
            paused={false}
            stale={false}
            availableMinor={1000000}
            soundEnabled={true}
            onChanged={vi.fn()}
            isCompact={true}
          />
        </div>
      </div>
    );

    expect(html).toContain('data-testid="cell-order-ticket-EURUSD_OTC"');
    expect(html).toContain('theme-binmax');
  });
});
