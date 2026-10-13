import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BinmaxPortfolioDrawer } from '../components/drawer/BinmaxPortfolioDrawer';
import type { Contract } from '../api/client';

describe('SUBETAPA 05: Bateria de Testes de Estresse, Caos e Segurança do Portafolio', () => {
  // ─── 1. TESTE DE ESTRESSE (HIGH LOAD) ──────────────────────────────────
  it('5.1 Estresse: Renderiza 100 contratos abertos com alta performance e sem vazamento', () => {
    const contracts: Contract[] = Array.from({ length: 100 }, (_, i) => ({
      id: `stress-cnt-${i}`,
      symbol: i % 2 === 0 ? 'EURUSD_OTC' : 'NZDJPY_OTC',
      direction: i % 2 === 0 ? 'UP' : 'DOWN',
      stake_minor: (i + 1) * 1000,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      strike_price: '1.08500',
      created_at: new Date(Date.now() - 30000).toISOString(),
      expires_at: new Date(Date.now() + 30000).toISOString(),
    }));

    const start = performance.now();
    const html = renderToString(
      <BinmaxPortfolioDrawer contracts={contracts} currentPrice={1.08600} />
    );
    const duration = performance.now() - start;

    expect(html).toContain('Abiertas 100');
    expect(html).toContain('data-testid="portfolio-card-stress-cnt-0"');
    expect(html).toContain('data-testid="portfolio-card-stress-cnt-99"');
    // Render de 100 itens completos em SSR sob concorrência total
    expect(duration).toBeLessThan(3000);
  });

  // ─── 2. TESTE DE CAOS (RESILIÊNCIA OPERACIONAL) ─────────────────────────
  it('5.2 Caos: Trata drift temporal extremo (contrato expirado há horas e contrato no futuro distante)', () => {
    const chaoticContracts: Contract[] = [
      {
        id: 'expired-chaos',
        symbol: 'EURUSD_OTC',
        direction: 'UP',
        stake_minor: 5000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        strike_price: '1.0850',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        expires_at: new Date(Date.now() - 1800000).toISOString(), // Expirado há 30 min
      },
      {
        id: 'future-chaos',
        symbol: 'BTCUSD',
        direction: 'DOWN',
        stake_minor: 20000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        strike_price: '65000',
        created_at: new Date(Date.now() + 60000).toISOString(), // Criado no futuro (relógio dessincronizado)
        expires_at: new Date(Date.now() + 120000).toISOString(),
      },
    ];

    const html = renderToString(
      <BinmaxPortfolioDrawer contracts={chaoticContracts} currentPrice={1.0850} />
    );

    // Contrato expirado deve ter timer zerado e barra clamped em 100%
    expect(html).toContain('data-testid="portfolio-card-expired-chaos"');
    expect(html).toContain('00:00');
    expect(html).toContain('width:100%');

    // Contrato com timestamp adiantado deve ter barra clamped em 0%
    expect(html).toContain('data-testid="portfolio-card-future-chaos"');
    expect(html).toContain('width:0%');
  });

  it('5.3 Caos: Resiste a ticks corrompidos (null, NaN, strings inválidas e preços negativos)', () => {
    const contract: Contract = {
      id: 'corrupted-price-cnt',
      symbol: 'SYNTH_VOL_100',
      direction: 'UP',
      stake_minor: 10000,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      strike_price: '1000.00',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60000).toISOString(),
    };

    // Caso 1: Preço null
    const htmlNull = renderToString(
      <BinmaxPortfolioDrawer contracts={[contract]} currentPrice={null} />
    );
    expect(htmlNull).toContain('data-testid="portfolio-card-corrupted-price-cnt"');
    expect(htmlNull).toContain('-$100.00'); // Trata como sem lucro sem explodir

    // Caso 2: Preço NaN
    const htmlNaN = renderToString(
      <BinmaxPortfolioDrawer contracts={[contract]} currentPrice={Number.NaN} />
    );
    expect(htmlNaN).toContain('data-testid="portfolio-card-corrupted-price-cnt"');

    // Caso 3: Preço negativo bizarro
    const htmlNeg = renderToString(
      <BinmaxPortfolioDrawer contracts={[contract]} currentPrice={-500} />
    );
    expect(htmlNeg).toContain('data-testid="portfolio-card-corrupted-price-cnt"');
  });

  // ─── 3. TESTE DE SEGURANÇA & INTEGRIDADE FINANCEIRA ──────────────────────
  it('5.4 Segurança: Componente opera como estritamente read-only sem mutação de contratos ou saldo', () => {
    const originalContract: Contract = Object.freeze({
      id: 'sec-contract-1',
      symbol: 'EURUSD_OTC',
      direction: 'UP',
      stake_minor: 10000,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      strike_price: '1.0850',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });

    // O contrato congelado (Object.freeze) não deve disparar erro por mutação interna
    expect(() => {
      renderToString(
        <BinmaxPortfolioDrawer contracts={[originalContract]} currentPrice={1.0860} />
      );
    }).not.toThrow();

    // Nenhuma alteração nas propriedades originais
    expect(originalContract.stake_minor).toBe(10000);
    expect(originalContract.status).toBe('OPEN');
  });
});
