import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BinmaxPortfolioDrawer } from '../components/drawer/BinmaxPortfolioDrawer';
import { BinmaxHistoryDrawer } from '../components/drawer/BinmaxHistoryDrawer';
import type { Contract } from '../api/client';

describe('SUBETAPA 05: Gavetas Portafolio & Historial (Sessões 5, 5b & 6)', () => {
  const mockOpenContracts: Contract[] = [
    {
      id: 'cnt-1',
      symbol: 'EURUSD_OTC',
      direction: 'UP',
      stake_minor: 10200,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      entry_price: '1.0850',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30000).toISOString(),
    },
    {
      id: 'cnt-2',
      symbol: 'NZDJPY_OTC',
      direction: 'DOWN',
      stake_minor: 5000,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      entry_price: '89.587',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 45000).toISOString(),
    },
  ];

  const mockClosedContracts: Contract[] = [
    {
      id: 'cnt-3',
      symbol: 'EURUSD_OTC',
      direction: 'UP',
      stake_minor: 10000,
      status: 'SETTLED',
      result: 'WIN',
      payout_minor: 18500,
      entry_price: '1.0850',
      created_at: '2026-10-09T02:14:00Z',
      expires_at: '2026-10-09T02:15:00Z',
    },
    {
      id: 'cnt-4',
      symbol: 'NZDJPY_OTC',
      direction: 'DOWN',
      stake_minor: 5000,
      status: 'SETTLED',
      result: 'LOSS',
      payout_minor: 0,
      entry_price: '89.587',
      created_at: '2026-10-09T02:11:00Z',
      expires_at: '2026-10-09T02:12:00Z',
    },
  ];

  it('5.1 BinmaxPortfolioDrawer: Renderiza Estado Vazio da Sessão 5b quando não há ordens abertas', () => {
    const html = renderToString(
      <BinmaxPortfolioDrawer contracts={[]} currentPrice={null} onClose={vi.fn()} />
    );

    expect(html).toContain('data-testid="binmax-portfolio-drawer"');
    expect(html).toContain('Abiertas (0)');
    expect(html).toContain('Cerradas');
    expect(html).toContain('data-testid="portfolio-empty-state"');
    expect(html).toContain('No tienes operaciones abiertas');
    expect(html).toContain('Abre una operación con SUBE o BAJA.');
  });

  it('5.2 BinmaxPortfolioDrawer: Renderiza Lista de Operações da Sessão 5 com P&L em tempo real', () => {
    const html = renderToString(
      <BinmaxPortfolioDrawer
        contracts={mockOpenContracts}
        currentPrice={1.0860}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Abiertas (2)');
    expect(html).toContain('data-testid="portfolio-card-cnt-1"');
    expect(html).toContain('EUR/USD');
    expect(html).toContain('SUBE');
    expect(html).toContain('$102');

    expect(html).toContain('data-testid="portfolio-card-cnt-2"');
    expect(html).toContain('NZD/JPY');
    expect(html).toContain('BAJA');
    expect(html).toContain('$50');
  });

  it('5.3 BinmaxHistoryDrawer: Renderiza Histórico da Sessão 6 com filtro e agrupador Hoy', () => {
    const html = renderToString(
      <BinmaxHistoryDrawer contracts={mockClosedContracts} onClose={vi.fn()} />
    );

    expect(html).toContain('data-testid="binmax-history-drawer"');
    expect(html).toContain('data-testid="history-filter-select"');
    expect(html).toContain('Resultado: Todos');
    expect(html).toContain('Hoy');

    expect(html).toContain('data-testid="history-card-cnt-3"');
    expect(html).toContain('EUR/USD');
    expect(html).toContain('▲ SUBE');
    expect(html).toContain('+$85.00');

    expect(html).toContain('data-testid="history-card-cnt-4"');
    expect(html).toContain('NZD/JPY');
    expect(html).toContain('▼ BAJA');
    expect(html).toContain('-$50.00');
  });

  it('5.4 Teste de Estresse: Executa 100 renderizações de Portfólio e Histórico em alta performance', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      renderToString(
        <BinmaxPortfolioDrawer contracts={mockOpenContracts} currentPrice={1.0860} />
      );
      renderToString(<BinmaxHistoryDrawer contracts={mockClosedContracts} />);
    }
    const elapsed = performance.now() - start;
    // 200 renders completos de SSR sob concorrência total
    expect(elapsed).toBeLessThan(3000);
  });
});
