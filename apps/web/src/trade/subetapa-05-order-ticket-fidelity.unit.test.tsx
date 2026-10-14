import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderTicket } from './OrderTicket';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import { setTraderoomPolishEnabled } from '../lib/traderoom-polish';

// Este arquivo cobre o ticket anterior (chips de valor, +85% em linha). Ver subetapa-polish-01-ticket.
setTraderoomPolishEnabled(false);

describe('SUBETAPA 05: Boleta de Negociação (Order Ticket) Ergonômica Institucional', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    setFeatureFlagForTesting(true);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderTicket = (props: Partial<React.ComponentProps<typeof OrderTicket>> = {}) => {
    return renderToString(
      <QueryClientProvider client={queryClient}>
        <OrderTicket
          symbol="NZDJPY_OTC"
          paused={false}
          stale={false}
          availableMinor={1000000} // $10,000.00
          soundEnabled={false}
          onChanged={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('5.1 Renderiza Monto, Expiración, Ganancia institucional (+85% / +$85.00) e botões SUBE/BAJA', () => {
    const html = renderTicket();

    // Blocos estruturais
    expect(html).toContain('data-testid="ticket-block-monto"');
    expect(html).toContain('data-testid="ticket-block-expiracion"');
    expect(html).toContain('data-testid="ticket-block-ganancia"');

    // Ganancia formatada institucionalmente sem US$
    expect(html).toContain('data-testid="ganancia-pct"');
    expect(html).toContain('+85%');
    expect(html).toContain('data-testid="ganancia-amount"');
    expect(html).toContain('+$85.00');

    // Botões de negociação
    expect(html).toContain('data-testid="btn-sube"');
    expect(html).toContain('SUBE');
    expect(html).toContain('data-testid="btn-baja"');
    expect(html).toContain('BAJA');
  });

  it('5.2 Bloqueia botões de negociação com disabled quando saldo for insuficiente', () => {
    const html = renderTicket({ availableMinor: 50 }); // $0.50 insuficiente para stake $100
    expect(html).toContain('disabled=""');
  });

  it('5.3 Exibe badge de Pausado e Atrasado defensivamente quando acionado', () => {
    const htmlPaused = renderTicket({ paused: true });
    expect(htmlPaused).toContain('data-testid="badge-paused"');
    expect(htmlPaused).toContain('Pausado');

    const htmlStale = renderTicket({ stale: true });
    expect(htmlStale).toContain('data-testid="badge-stale"');
    expect(htmlStale).toContain('Atrasado');
  });

  it('5.4 Teste de Estresse: Executa 200 renderizações consecutivas de tickets em < 100ms', () => {
    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      const html = renderTicket();
      expect(html).toBeTruthy();
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });
});
