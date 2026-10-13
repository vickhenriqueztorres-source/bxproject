import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PriceChart } from './PriceChart';

describe('SUBETAPA 03: Seletor de Ativo Flutuante In-Chart - Padrão Instrumento de Precisão', () => {
  const defaultProps = {
    symbol: 'EURUSD_OTC',
    candles: [
      {
        timestamp: 1710000000000,
        open: 1.1,
        high: 1.105,
        low: 1.095,
        close: 1.102,
        volume: 100,
        isClosed: true,
      },
    ],
    tick: { price: 1.102, symbol: 'EURUSD_OTC', latency_ms: 15, event_time: 1710000001000 },
    activeContracts: [],
    isStale: false,
    isVisible: true,
    onSelectSymbol: vi.fn(),
  };

  it('3.1 Elimina totalmente neons cianos (#00e5ff) do pill de ativo e controles in-chart', () => {
    const html = renderToString(<PriceChart {...defaultProps} />);
    expect(html).not.toContain('#00e5ff');
    expect(html).not.toContain('color:#00e5ff');
    expect(html).not.toContain('border:1px solid #00e5ff');
  });

  it('3.2 Renderiza tag Turbo refinada com semântica verde ganho (#22C47A) e chevron SVG animável', () => {
    const html = renderToString(<PriceChart {...defaultProps} />);
    expect(html).toContain('data-testid="chart-top-asset-pill"');
    expect(html).toContain('Turbo');
    expect(html).toContain('#22C47A');
    // Chevron SVG presente
    expect(html).toContain('data-testid="asset-selector-chevron"');
  });

  it('3.3 Renderiza ações secundárias (Info, Alerta, Favorito) com ícones vetoriais SVG de precisão', () => {
    const html = renderToString(<PriceChart {...defaultProps} />);
    expect(html).toContain('data-testid="asset-action-info"');
    expect(html).toContain('data-testid="asset-action-alert"');
    expect(html).toContain('data-testid="asset-action-favorite"');
    // Não contém glifos unicode crus
    expect(html).not.toContain('>ⓘ<');
    expect(html).not.toContain('>🔔<');
    expect(html).not.toContain('>★<');
  });

  it('3.4 Teste de Estresse: Executa 100 renderizações do Pill de Ativo em menos de 400ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      renderToString(<PriceChart {...defaultProps} symbol={i % 2 === 0 ? 'EURUSD_OTC' : 'BTCUSD_OTC'} />);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(400);
  });
});
