import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { BinmaxPortfolioDrawer } from '../components/drawer/BinmaxPortfolioDrawer';
import { OrderFlagsOverlay } from '../chart/OrderFlagsOverlay';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import type { Contract } from '../api/client';

describe('SUBETAPA 02: Descongelamento do Terminal, Transição Liquidando e Overlays', () => {
  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('2.1 TRANSIÇÃO VISUAL: Exibe "Liquidando..." quando tempo do contrato chega a 0s no PortfolioDrawer', () => {
    const now = Date.now();
    const contracts: Contract[] = [
      {
        id: 'ord-active-1',
        symbol: 'GBPUSD_OTC',
        direction: 'UP',
        stake_minor: 10000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        entry_price: 1.2835,
        created_at: new Date(now - 30000).toISOString(),
        expires_at: new Date(now + 30000).toISOString(), // 30s restantes
      },
      {
        id: 'ord-expired-1',
        symbol: 'GBPUSD_OTC',
        direction: 'UP',
        stake_minor: 10000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        entry_price: 1.2835,
        created_at: new Date(now - 60000).toISOString(),
        expires_at: new Date(now - 2000).toISOString(), // expirou há 2s
      },
    ];

    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={contracts}
        currentPrice={1.284}
        currentSymbol="GBPUSD_OTC"
      />
    );

    // Contrato ativo exibe "En curso"
    expect(html).toContain('En curso');
    // Contrato com tempo zerado exibe "Liquidando..."
    expect(html).toContain('Liquidando...');
  });

  it('2.2 GANHO POTENCIAL PRECISO: Não infla estimativa com ordens cujo tempo já esgotou', () => {
    const now = Date.now();
    const contracts: Contract[] = [
      {
        id: 'ord-active-1',
        symbol: 'GBPUSD_OTC',
        direction: 'UP',
        stake_minor: 10000, // $100 -> ganho potencial +$85
        status: 'OPEN',
        result: null,
        payout_minor: null,
        created_at: new Date(now - 10000).toISOString(),
        expires_at: new Date(now + 50000).toISOString(),
      },
      {
        id: 'ord-expired-zero',
        symbol: 'GBPUSD_OTC',
        direction: 'UP',
        stake_minor: 10000, // $100 -> expirado há 5s, não deve somar +$85
        status: 'OPEN',
        result: null,
        payout_minor: null,
        created_at: new Date(now - 65000).toISOString(),
        expires_at: new Date(now - 5000).toISOString(),
      },
    ];

    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={contracts}
        currentPrice={1.284}
        currentSymbol="GBPUSD_OTC"
      />
    );

    // Ganho potencial deve ser apenas $85.00 e NÃO $170.00
    expect(html).toContain('+$85.00');
    expect(html).not.toContain('+$170.00');
  });

  it('2.3 BINMAX PORTFOLIO DRAWER: Exibe "Liquidando..." na contagem regressiva se tempo esgotado', () => {
    const now = Date.now();
    const contracts: Contract[] = [
      {
        id: 'c-expiring-drawer',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        created_at: new Date(now - 60000).toISOString(),
        expires_at: new Date(now - 1000).toISOString(),
      },
    ];

    const html = renderToString(
      <BinmaxPortfolioDrawer
        contracts={contracts}
        currentPrice={500}
      />
    );

    expect(html).toContain('Liquidando...');
  });

  it('2.4 OVERLAYS DE GRÁFICO: Flag de strike é substituída pelo Pin de Resultado quando liquidado', () => {
    const now = Date.now();
    const settledContracts: Contract[] = [
      {
        id: 'c-settled-1',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000,
        payout_minor: 18500,
        status: 'SETTLED',
        result: 'WIN',
        entry_price: 500,
        strike_price: 500,
        created_at: new Date(now - 60000).toISOString(),
        expires_at: new Date(now - 1000).toISOString(),
      },
    ];

    const html = renderToString(
      <OrderFlagsOverlay
        contracts={settledContracts}
        currentPrice={505}
        containerWidth={1000}
        containerHeight={600}
        activeSeries={null}
      />
    );

    // Não deve mais conter a flag de strike ativa de ordem aberta
    expect(html).not.toContain('order-strike-flag');
    // Deve conter o pin de resultado
    expect(html).toContain('expiration-result-pin-win');
    expect(html).toContain('+$185.00');
  });
});
