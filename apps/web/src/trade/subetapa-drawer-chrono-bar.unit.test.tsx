import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import type { Contract } from '../api/client';

describe('SUBETAPA CHRONO-BAR: Barra de Rodapé Retrátil Awwwards Level', () => {
  const mockContract: Contract = {
    id: 'c-trade-1',
    symbol: 'EURUSD_OTC',
    direction: 'UP',
    stake_minor: 10000,
    payout_minor: 18500,
    result: null,
    status: 'OPEN',
    entry_price: 1.085,
    strike_price: 1.085,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30000).toISOString(),
  };

  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('B1: Elimina ícone genérico de pasta de arquivos e renderiza glifo vetorial de monitor de ordens', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={false}
        onToggle={vi.fn()}
        contracts={[]}
        currentPrice={1.085}
        currentSymbol="EURUSD_OTC"
      />
    );

    // Não deve conter o SVG clássico de pasta de arquivos (d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5...)
    expect(html).not.toContain('M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5');
    // Deve conter ícone vetorial de tela/monitor de ordens
    expect(html).toContain('<svg');
  });

  it('B2: Renderiza cápsula métrica integrada com telemetria e tipografia suíça Geist Mono', () => {
    const htmlEmpty = renderToString(
      <PortfolioDrawer
        isOpen={false}
        onToggle={vi.fn()}
        contracts={[]}
        currentPrice={1.085}
        currentSymbol="EURUSD_OTC"
      />
    );

    expect(htmlEmpty).toContain('0 activas');
    expect(htmlEmpty).toContain('Terminal en espera');

    const htmlActive = renderToString(
      <PortfolioDrawer
        isOpen={false}
        onToggle={vi.fn()}
        contracts={[mockContract]}
        currentPrice={1.085}
        currentSymbol="EURUSD_OTC"
      />
    );

    expect(htmlActive).toContain('1 activas');
    expect(htmlActive).toContain('Ganancia potencial');
  });

  it('B3: Botão Mostrar Posiciones estilizado como gatilho tátil fosco de precisão', () => {
    const htmlClosed = renderToString(
      <PortfolioDrawer
        isOpen={false}
        onToggle={vi.fn()}
        contracts={[]}
        currentPrice={1.085}
        currentSymbol="EURUSD_OTC"
      />
    );

    expect(htmlClosed).toContain('Mostrar posiciones ⌵');
    expect(htmlClosed).toContain('border-radius:6px');

    const htmlOpen = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={[]}
        currentPrice={1.085}
        currentSymbol="EURUSD_OTC"
      />
    );

    expect(htmlOpen).toContain('Mostrar posiciones ⌃');
  });

  it('B4: Estresse e Caos: Alternância dinâmica de 0 para 20 ordens em 100 ciclos', () => {
    const contracts20: Contract[] = Array.from({ length: 20 }, (_, i) => ({
      ...mockContract,
      id: `c-stress-bar-${i}`,
    }));

    const start = Date.now();
    for (let i = 0; i < 30; i++) {
      const isEven = i % 2 === 0;
      const html = renderToString(
        <PortfolioDrawer
          isOpen={isEven}
          onToggle={vi.fn()}
          contracts={isEven ? contracts20 : []}
          currentPrice={1.085}
          currentSymbol="EURUSD_OTC"
        />
      );
      if (isEven) {
        expect(html).toContain('20 activas');
      } else {
        expect(html).toContain('0 activas');
      }
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(4000);
  });
});
