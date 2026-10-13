/**
 * Subetapa 03 — Testes de Multi-Ativos no BinmaxPortfolioDrawer
 *
 * Valida:
 * 1. Operações abertas de diferentes ativos usam as cotações do seu respectivo símbolo.
 * 2. Operação de EURUSD_OTC não é erroneamente comparada com o preço de SYNTH_VOL_50.
 * 3. Fallback seguro para currentPrice único se currentPrices não for fornecido.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BinmaxPortfolioDrawer } from './BinmaxPortfolioDrawer';

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: `contract-${Math.random().toString(36).slice(2, 8)}`,
    symbol: 'EURUSD_OTC',
    direction: 'UP',
    status: 'OPEN',
    stake_minor: 10000, // $100
    payout_minor: 8500,  // $85
    entry_price: '1.08500',
    strike_price: '1.08500',
    created_at: new Date(Date.now() - 10000).toISOString(),
    expires_at: new Date(Date.now() + 30000).toISOString(),
    ...overrides,
  };
}

describe('Subetapa 03 — BinmaxPortfolioDrawer Multi-Asset', () => {
  it('T01: Avalia cada contrato aberto com a cotação do seu respectivo ativo via currentPrices', () => {
    const contracts = [
      // Vol 50: UP a 500.00 -> Preço atual 505.00 -> Ganha (+85.00)
      makeContract({ id: 'c1', symbol: 'SYNTH_VOL_50', entry_price: '500.00', strike_price: '500.00', direction: 'UP' }),
      // EUR/USD: UP a 1.08500 -> Preço atual 1.08400 -> Perde (-100.00)
      makeContract({ id: 'c2', symbol: 'EURUSD_OTC', entry_price: '1.08500', strike_price: '1.08500', direction: 'UP' }),
    ];

    const currentPrices = {
      SYNTH_VOL_50: 505.00,
      EURUSD_OTC: 1.08400,
    };

    const html = renderToString(
      <BinmaxPortfolioDrawer
        contracts={contracts as any}
        currentPrice={505.00} // Preço do ativo ativo no gráfico
        currentPrices={currentPrices}
        onClose={() => {}}
      />
    );

    // Deve conter +$85.00 para o Vol 50
    expect(html).toContain('+$85.00');
    // Deve conter -$100.00 para o EUR/USD (e NÃO ser comparado contra 505.00 do Vol 50!)
    expect(html).toContain('-$100.00');
  });

  it('T02: Mantém compatibilidade retroativa com prop currentPrice única caso currentPrices esteja ausente', () => {
    const contracts = [
      makeContract({ id: 'c1', symbol: 'SYNTH_VOL_50', entry_price: '500.00', strike_price: '500.00', direction: 'UP' }),
    ];

    const html = renderToString(
      <BinmaxPortfolioDrawer
        contracts={contracts as any}
        currentPrice={505.00}
        onClose={() => {}}
      />
    );

    expect(html).toContain('+$85.00');
  });
});
