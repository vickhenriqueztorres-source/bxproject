import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderTicket } from './OrderTicket';

describe('SUBETAPA 01: Boleta Elástica e Responsiva Verticalmente (OrderTicket 100% Encaixado)', () => {
  const renderWithQuery = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return renderToString(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('1.1 Renderiza OrderTicket compacto com elementos estruturais completos para trading', () => {
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

    // Deve conter container principal Binmax
    expect(html).toContain('data-testid="binmax-order-ticket"');
    // Deve conter blocos essenciais
    expect(html).toContain('data-testid="ticket-block-monto"');
    expect(html).toContain('data-testid="stake-presets"');
    expect(html).toContain('data-testid="ticket-block-expiracion"');
    expect(html).toContain('data-testid="ticket-block-ganancia"');
    expect(html).toContain('data-testid="btn-sube"');
    expect(html).toContain('data-testid="btn-baja"');
  });

  it('1.2 Boleta compacta utiliza alturas elásticas (steppers e botões) para caber em altura <= 240px', () => {
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

    // Botões de Presets com altura compacta (20px)
    expect(html).toContain('height:20px');
    // Botões SUBE e BAJA adaptados
    expect(html).toContain('clamp(32px, 4.6vh, 38px)');
    // Steppers de campo adaptados
    expect(html).toContain('clamp(28px, 3.8vh, 32px)');
  });

  it('1.3 Todos os 4 botões de presets [10, 50, 100, 500] estão presentes na boleta compacta', () => {
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

    expect(html).toContain('data-testid="preset-10"');
    expect(html).toContain('data-testid="preset-50"');
    expect(html).toContain('data-testid="preset-100"');
    expect(html).toContain('data-testid="preset-500"');
  });

  it('1.4 Segurança Invariante: Bloqueio rigoroso de SUBE e BAJA quando paused ou stale', () => {
    const htmlPaused = renderWithQuery(
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

    // Botões devem conter disabled
    expect(htmlPaused).toContain('disabled=""');
    expect(htmlPaused).toContain('data-testid="badge-paused"');

    const htmlStale = renderWithQuery(
      <OrderTicket
        symbol="EURUSD_OTC"
        paused={false}
        stale={true}
        availableMinor={1000000}
        soundEnabled={true}
        onChanged={vi.fn()}
        isCompact={true}
      />
    );

    expect(htmlStale).toContain('disabled=""');
    expect(htmlStale).toContain('data-testid="badge-stale"');
  });

  it('1.5 Não-Regressão: Modo clássico isCompact=false preserva suas dimensões ergonômicas padrão (48px botão)', () => {
    const htmlStandard = renderWithQuery(
      <OrderTicket
        symbol="EURUSD_OTC"
        paused={false}
        stale={false}
        availableMinor={1000000}
        soundEnabled={true}
        onChanged={vi.fn()}
        isCompact={false}
      />
    );

    expect(htmlStandard).toContain('height:48px');
    expect(htmlStandard).toContain('height:42px');
    expect(htmlStandard).toContain('height:30px');
  });
});
