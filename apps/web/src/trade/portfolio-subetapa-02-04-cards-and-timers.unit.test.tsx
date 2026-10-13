import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BinmaxPortfolioDrawer } from '../components/drawer/BinmaxPortfolioDrawer';
import type { Contract } from '../api/client';

describe('SUBETAPAS 02–04: Cards Institucionais, Progress Bar, Timers e Aba Cerradas', () => {
  const baseOpenTime = new Date('2026-10-09T18:00:00Z').getTime();

  const mockOpenContracts: Contract[] = [
    {
      id: 'c-eurusd-win',
      symbol: 'EURUSD_OTC',
      direction: 'UP',
      stake_minor: 10000, // $100
      status: 'OPEN',
      result: null,
      payout_minor: null,
      strike_price: '1.08500',
      created_at: new Date(baseOpenTime).toISOString(),
      expires_at: new Date(baseOpenTime + 60000).toISOString(),
    },
    {
      id: 'c-nzdjpy-loss',
      symbol: 'NZDJPY_OTC',
      direction: 'DOWN',
      stake_minor: 5000, // $50
      status: 'OPEN',
      result: null,
      payout_minor: null,
      strike_price: '89.500',
      created_at: new Date(baseOpenTime).toISOString(),
      expires_at: new Date(baseOpenTime + 90000).toISOString(),
    },
  ];

  const mockClosedContracts: Contract[] = [
    {
      id: 'c-closed-win',
      symbol: 'EURUSD_OTC',
      direction: 'UP',
      stake_minor: 10000,
      status: 'SETTLED',
      result: 'WIN',
      payout_minor: 18500,
      created_at: '2026-10-09T17:58:00Z',
      expires_at: '2026-10-09T17:59:00Z',
    },
    {
      id: 'c-closed-loss',
      symbol: 'NZDJPY_OTC',
      direction: 'DOWN',
      stake_minor: 5000,
      status: 'SETTLED',
      result: 'LOSS',
      payout_minor: 0,
      created_at: '2026-10-09T17:55:00Z',
      expires_at: '2026-10-09T17:56:00Z',
    },
  ];

  it('2.1 Cards de Operações Abertas: Renderiza bandeiras duplas, símbolo, badges ↑ ARRIBA / ↓ ABAJO e P&L', () => {
    // currentPrice 1.08600: EUR/USD UP está vencendo (strike 1.08500), NZD/JPY DOWN perde se preço for maior
    const html = renderToString(
      <BinmaxPortfolioDrawer
        contracts={mockOpenContracts}
        currentPrice={1.08600}
      />
    );

    // Card 1 (EUR/USD)
    expect(html).toContain('data-testid="portfolio-card-c-eurusd-win"');
    expect(html).toContain('EUR/USD');
    expect(html).toContain('↑ ARRIBA');
    expect(html).toContain('+$85.00');
    expect(html).toContain('Invertido');
    expect(html).toContain('$100');

    // Card 2 (NZD/JPY)
    expect(html).toContain('data-testid="portfolio-card-c-nzdjpy-loss"');
    expect(html).toContain('NZD/JPY');
    expect(html).toContain('↓ ABAJO');
    expect(html).toContain('$50');
  });

  it('3.1 Barra de Progresso e Cronômetro Realtime: Renderiza trilho, barra, timer e carimbo Expira', () => {
    const html = renderToString(
      <BinmaxPortfolioDrawer
        contracts={mockOpenContracts}
        currentPrice={1.08600}
      />
    );

    expect(html).toContain('data-testid="portfolio-progress-track-c-eurusd-win"');
    expect(html).toContain('data-testid="portfolio-progress-bar-c-eurusd-win"');
    expect(html).toContain('data-testid="portfolio-timer-c-eurusd-win"');
    expect(html).toContain('data-testid="portfolio-expiry-time-c-eurusd-win"');
    expect(html).toContain('Expira');
  });

  it('4.1 Estado Vazio: Renderiza mensagem sóbria quando não há operações', () => {
    const html = renderToString(
      <BinmaxPortfolioDrawer contracts={[]} currentPrice={null} />
    );

    expect(html).toContain('data-testid="portfolio-empty-state"');
    expect(html).toContain('No tienes operaciones abiertas');
    expect(html).toContain('Abre una operación con SUBE o BAJA.');
  });
});
