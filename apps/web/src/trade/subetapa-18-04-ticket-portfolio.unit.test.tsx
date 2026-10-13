import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OrderTicket } from './OrderTicket';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import type { Contract } from '../api/client';

// Mock dos hooks react-query usados no OrderTicket
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn().mockReturnValue({
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
  useQuery: vi.fn().mockReturnValue({
    data: {
      id: 'c-settled-1',
      status: 'SETTLED',
      result: 'WIN',
      payout_minor: 18500,
    },
    isLoading: false,
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

describe('SUBETAPA 18-04: Ticket de Operações, Portfólio Retrátil e Resiliência de Conexão', () => {
  const mockContracts: Contract[] = [
    {
      id: 'c-test-4',
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

  it('TC-01: OrderTicket NÃO renderiza o cartão duplicado volumoso nem identificador #guest_', () => {
    const html = renderToString(
      <OrderTicket
        symbol="SYNTH_VOL_50"
        paused={false}
        stale={false}
        availableMinor={100000}
        onChanged={vi.fn()}
      />
    );

    // Não deve conter identificador de guest cru
    expect(html).not.toContain('#guest_');
    // Não deve conter formatação antiga em reais/português
    expect(html).not.toContain('US$');
  });

  it('TC-02: PortfolioDrawer exibe o acionador "Mostrar posiciones ⌵" quando fechado e "Mostrar posiciones ⌃" quando aberto', () => {
    const htmlClosed = renderToString(
      <PortfolioDrawer
        isOpen={false}
        onToggle={vi.fn()}
        contracts={mockContracts}
        currentPrice={502.0}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    expect(htmlClosed).toContain('Mostrar posiciones ⌵');
    expect(htmlClosed).not.toContain('height:220px');

    const htmlOpen = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={mockContracts}
        currentPrice={502.0}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    expect(htmlOpen).toContain('Mostrar posiciones ⌃');
    expect(htmlOpen).toContain('max-height:220px');
  });

  it('TC-03: PortfolioDrawer não renderiza texto "Portafolio total" na barra superior (elimina duplicidade com footer)', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={false}
        onToggle={vi.fn()}
        contracts={mockContracts}
        currentPrice={502.0}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    // Na barra superior da gaveta deve haver apenas o badge de ativas e ganho potencial
    expect(html).toContain('1 activas');
    expect(html).toContain('Ganancia potencial');
    expect(html).not.toContain('Portafolio total');
    expect(html).not.toContain('Portfólio Total');
  });

  it('TC-04: TerminalHeader exibe "16ms" com dot verde (#22C55E) quando isLive=true', () => {
    const htmlLive = renderToString(
      <TerminalHeader
        activeSymbol="SYNTH_VOL_50"
        openTabs={['SYNTH_VOL_50']}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onAddTab={vi.fn()}
        balanceMinor={100000}
        accountEmail="trader@binmax.com"
        isLive={true}
        latencyMs={16}
        onResetDemo={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    expect(htmlLive).toContain('16ms');
    expect(htmlLive).toContain('background:#22C55E');
    expect(htmlLive).not.toContain('Reconectando…');
  });

  it('TC-05: TerminalHeader exibe "Reconectando…" com dot cinza (#8A92A1) quando isLive=false', () => {
    const htmlDisconnected = renderToString(
      <TerminalHeader
        activeSymbol="SYNTH_VOL_50"
        openTabs={['SYNTH_VOL_50']}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onAddTab={vi.fn()}
        balanceMinor={100000}
        accountEmail="trader@binmax.com"
        isLive={false}
        latencyMs={0}
        onResetDemo={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    expect(htmlDisconnected).toContain('Reconectando…');
    expect(htmlDisconnected).toContain('background:#8A92A1');
    expect(htmlDisconnected).not.toContain('>0ms<');
  });
});
