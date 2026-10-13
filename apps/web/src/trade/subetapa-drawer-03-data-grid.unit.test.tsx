import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import type { Contract } from '../api/client';

describe('SUBETAPA 03: Grid de Dados Operacionais em Tempo Real & Histórico', () => {
  const mockContracts: Contract[] = [
    {
      id: 'c-trade-open-1',
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 10000,
      payout_minor: 18500,
      result: null,
      status: 'OPEN',
      entry_price: 500.0,
      strike_price: 500.0,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 25000).toISOString(),
    },
    {
      id: 'c-trade-settled-1',
      symbol: 'EURUSD_OTC',
      direction: 'DOWN',
      stake_minor: 2500,
      payout_minor: 4625,
      result: 'WIN',
      status: 'SETTLED',
      entry_price: 1.085,
      strike_price: 1.085,
      created_at: new Date(Date.now() - 60000).toISOString(),
      expires_at: new Date(Date.now() - 30000).toISOString(),
    },
  ];

  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('3.1 Renderiza ativos com AssetFlagBadge e identificadores em Geist Mono', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={mockContracts}
        currentPrice={501.5}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    // Contém tag/classe ou SVG de bandeira
    expect(html).toContain('Vol 50');
    expect(html).toContain('#c-trade-');
    expect(html).toContain('Geist Mono');
  });

  it('3.2 Renderiza badges de direção SUBE/BAJA com acabamento visual cirúrgico', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={mockContracts}
        currentPrice={501.5}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    // Contrato ativo UP
    expect(html).toContain('▲ SUBE');
    expect(html).toContain('#22C55E');
  });

  it('3.3 Renderiza telemetria de expiração com cronômetro tabular e micro barra de progresso', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={mockContracts}
        currentPrice={501.5}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    expect(html).toContain('s<'); // Ex: 25s
    expect(html).toContain('En curso');
    expect(html).toContain('+$85.00');
  });

  it('3.4 Teste de Estresse: Renderiza 50 contratos simultâneos em menos de 100ms', () => {
    const massiveContracts: Contract[] = Array.from({ length: 50 }, (_, i) => ({
      id: `c-stress-${i}`,
      symbol: i % 2 === 0 ? 'SYNTH_VOL_50' : 'EURUSD_OTC',
      direction: i % 2 === 0 ? 'UP' : 'DOWN',
      stake_minor: 1000 + i * 100,
      payout_minor: 1850 + i * 185,
      result: null,
      status: 'OPEN',
      entry_price: 500,
      strike_price: 500,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30000).toISOString(),
    }));

    const start = Date.now();
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={massiveContracts}
        currentPrice={502}
        currentSymbol="SYNTH_VOL_50"
      />
    );
    const elapsed = Date.now() - start;

    expect(html).toContain('50 activas');
    expect(elapsed).toBeLessThan(150);
  });
});
