import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalFooter } from '../components/footer/TerminalFooter';
import { formatCurrencyBinmax } from '../lib/money';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import type { Contract } from '../api/client';

export function calculateFooterMetrics(contracts: Contract[], now: Date = new Date()): {
  activeContractsCount: number;
  portfolioTotalFormatted: string;
  todayProfitFormatted: string;
} {
  const openContracts = contracts.filter((c) => c.status === 'OPEN');
  const activeContractsCount = openContracts.length;

  const openPortfolioMinor = openContracts.reduce((sum, c) => {
    const stake = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : (c.stake_minor || 0);
    return sum + stake;
  }, 0);
  const portfolioTotalFormatted = formatCurrencyBinmax(openPortfolioMinor);

  // Início do dia de hoje (00:00:00 local)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();

  const settledToday = contracts.filter((c) => {
    if (c.status !== 'SETTLED') return false;
    const settledTime = c.expires_at ? Date.parse(c.expires_at) : (c.created_at ? Date.parse(c.created_at) : 0);
    return Number.isFinite(settledTime) && settledTime >= startOfDay;
  });

  const todayProfitMinor = settledToday.reduce((sum, c) => {
    const stake = typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : (c.stake_minor || 0);
    const payout = c.payout_minor !== null ? (typeof c.payout_minor === 'string' ? parseInt(c.payout_minor, 10) : (c.payout_minor || 0)) : 0;
    if (c.result === 'WIN') {
      return sum + (payout - stake);
    } else if (c.result === 'LOSS') {
      return sum - stake;
    }
    return sum; // DRAW
  }, 0);

  const absProfit = Math.abs(todayProfitMinor);
  const todayProfitFormatted = todayProfitMinor > 0
    ? `+${formatCurrencyBinmax(absProfit)}`
    : todayProfitMinor < 0
    ? `-${formatCurrencyBinmax(absProfit)}`
    : '$0.00';

  return { activeContractsCount, portfolioTotalFormatted, todayProfitFormatted };
}

describe('SUBETAPA 03: Métricas Dinâmicas e Reativas de Rodapé', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('3.1 PORTAFOLIO TOTAL: Calcula dinamicamente a soma de stakes das operações abertas', () => {
    const now = new Date();
    const contracts: Contract[] = [
      {
        id: 'ord-1',
        symbol: 'GBPUSD_OTC',
        direction: 'UP',
        stake_minor: 10000, // $100
        status: 'OPEN',
        result: null,
        payout_minor: null,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 60000).toISOString(),
      },
      {
        id: 'ord-2',
        symbol: 'GBPUSD_OTC',
        direction: 'UP',
        stake_minor: 10000, // $100
        status: 'OPEN',
        result: null,
        payout_minor: null,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 60000).toISOString(),
      },
      {
        id: 'ord-3',
        symbol: 'GBPUSD_OTC',
        direction: 'DOWN',
        stake_minor: 10000, // $100
        status: 'OPEN',
        result: null,
        payout_minor: null,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 60000).toISOString(),
      },
      {
        id: 'ord-4',
        symbol: 'GBPUSD_OTC',
        direction: 'DOWN',
        stake_minor: 10000, // $100
        status: 'OPEN',
        result: null,
        payout_minor: null,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 60000).toISOString(),
      },
    ];

    const metrics = calculateFooterMetrics(contracts, now);
    expect(metrics.activeContractsCount).toBe(4);
    expect(metrics.portfolioTotalFormatted).toBe('$400.00');
  });

  it('3.2 GANANCIA DE HOY (LUCRO LÍQUIDO): Soma lucros e prejuízos reais das operações de hoje', () => {
    const now = new Date();
    const contracts: Contract[] = [
      // 1 WIN: stake $100, payout $185 -> Lucro líquido = +$85
      {
        id: 'c-win-1',
        symbol: 'GBPUSD_OTC',
        direction: 'UP',
        stake_minor: 10000,
        payout_minor: 18500,
        status: 'SETTLED',
        result: 'WIN',
        created_at: new Date(now.getTime() - 3600000).toISOString(),
        expires_at: new Date(now.getTime() - 3540000).toISOString(),
      },
      // 1 LOSS: stake $100, payout $0 -> Prejuízo líquido = -$100
      {
        id: 'c-loss-1',
        symbol: 'GBPUSD_OTC',
        direction: 'DOWN',
        stake_minor: 10000,
        payout_minor: 0,
        status: 'SETTLED',
        result: 'LOSS',
        created_at: new Date(now.getTime() - 1800000).toISOString(),
        expires_at: new Date(now.getTime() - 1740000).toISOString(),
      },
    ];

    // Net: +$85 - $100 = -$15
    const metrics = calculateFooterMetrics(contracts, now);
    expect(metrics.todayProfitFormatted).toBe('-$15.00');
  });

  it('3.3 FILTRO DE DATA: Não inclui operações de ontem no lucro de hoje', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000 * 2); // 2 dias atrás
    const contracts: Contract[] = [
      // Operação de ontem que teve lucro de +$85
      {
        id: 'c-yesterday',
        symbol: 'GBPUSD_OTC',
        direction: 'UP',
        stake_minor: 10000,
        payout_minor: 18500,
        status: 'SETTLED',
        result: 'WIN',
        created_at: yesterday.toISOString(),
        expires_at: yesterday.toISOString(),
      },
    ];

    const metrics = calculateFooterMetrics(contracts, now);
    expect(metrics.todayProfitFormatted).toBe('$0.00');
  });

  it('3.4 RENDERIZAÇÃO NO TERMINAL FOOTER: Exibe cores e métricas dinâmicas', () => {
    const html = renderToString(
      <TerminalFooter
        soundEnabled={false}
        onToggleSound={() => {}}
        isConnected={true}
        activeContractsCount={4}
        portfolioTotalFormatted="$400.00"
        todayProfitFormatted="+$170.00"
      />
    );

    expect(html).toContain('Portafolio total');
    expect(html).toContain('$400.00');
    expect(html).toContain('Ganancia de hoy');
    expect(html).toContain('+$170.00');
    expect(html).toContain('Operaciones abiertas');
    expect(html).toContain('4');
  });
});
