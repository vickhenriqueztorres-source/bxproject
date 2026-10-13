/**
 * Subetapa 01 — Tab Badge Multi-Contrato
 *
 * Verifica que o badge PnL na aba do header agrega TODOS os contratos
 * abertos do símbolo, não apenas o primeiro.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalHeader } from '../components/header/TerminalHeader';

// Mock para isNewTraderoomEnabled
vi.mock('../lib/feature-flags', () => ({
  isNewTraderoomEnabled: () => true,
}));

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: `contract-${Math.random().toString(36).slice(2, 8)}`,
    symbol: 'SYNTH_VOL_50',
    direction: 'UP',
    status: 'OPEN',
    stake_minor: 10000, // $100
    payout_minor: 8500,  // $85
    entry_price: '500.00',
    strike_price: '500.00',
    expires_at: new Date(Date.now() + 30000).toISOString(),
    ...overrides,
  };
}

function render(contracts: Record<string, unknown>[], currentPrices: Record<string, number> = { SYNTH_VOL_50: 501 }) {
  return renderToString(
    React.createElement(TerminalHeader, {
      activeSymbol: 'SYNTH_VOL_50',
      openTabs: ['SYNTH_VOL_50'],
      onSelectTab: () => {},
      onCloseTab: () => {},
      onAddTab: () => {},
      balanceMinor: 1000000,
      accountEmail: 'test@test.com',
      isLive: false,
      onResetDemo: () => {},
      onSignOut: () => {},
      contracts: contracts as any,
      currentPrices,
    })
  );
}

describe('Subetapa 01 — Tab Badge Multi-Contrato', () => {
  // T01: 1 contrato WIN de $100
  it('T01 — Tab com 1 contrato WIN de $100 mostra +$85.00', () => {
    const html = render([makeContract()]);
    expect(html).toContain('+$85.00');
  });

  // T02: 3 contratos WIN de $100 → $255
  it('T02 — Tab com 3 contratos WIN de $100 mostra +$255.00', () => {
    const html = render([makeContract(), makeContract(), makeContract()]);
    expect(html).toContain('+$255.00');
  });

  // T03: 7 contratos WIN de $100 → $595
  it('T03 — Tab com 7 contratos WIN de $100 mostra +$595.00', () => {
    const contracts = Array.from({ length: 7 }, () => makeContract());
    const html = render(contracts);
    expect(html).toContain('+$595.00');
  });

  // T04: 2 WIN + 1 LOSS → PnL líquido = +$170 - $100 = +$70
  it('T04 — Tab com 2 WIN + 1 LOSS mostra PnL líquido correto', () => {
    const contracts = [
      makeContract(), // WIN: +$85
      makeContract(), // WIN: +$85
      makeContract({ direction: 'DOWN' }), // curP=501 > strike=500, DOWN = LOSS: -$100
    ];
    const html = render(contracts, { SYNTH_VOL_50: 501 });
    // netPnl = 8500 + 8500 - 10000 = 7000 → +$70.00
    expect(html).toContain('+$70.00');
  });

  // T05: 0 contratos → mostra 'Turbo'
  it('T05 — Tab com 0 contratos mostra Turbo (sem badge PnL)', () => {
    const html = render([]);
    expect(html).toContain('Turbo');
  });

  // T07: Contratos de diferentes ativos NÃO mistura
  it('T07 — Contratos de outro ativo NÃO afetam o badge do SYNTH_VOL_50', () => {
    const contracts = [
      makeContract(),                                    // SYNTH_VOL_50: +$85
      makeContract({ symbol: 'EURUSD_OTC' }),            // Outro ativo
    ];
    const html = render(contracts);
    // Deve mostrar apenas +$85 do SYNTH_VOL_50
    expect(html).toContain('+$85.00');
  });

  // T08: NÃO usa find() para buscar contratos OPEN (bug antigo)
  it('T08 — Código NÃO contém contracts?.find para OPEN (bug antigo)', () => {
    const { readFileSync } = require('fs');
    const { resolve } = require('path');
    const source = readFileSync(
      resolve(__dirname, '../components/header/TerminalHeader.tsx'),
      'utf-8'
    );
    // Deve usar filter, não find, para contratos OPEN
    const openFindPattern = /contracts\?\.\s*find\s*\(\s*\(\s*c\s*\)\s*=>\s*c\.symbol\s*===\s*sym\s*&&\s*c\.status\s*===\s*['"]OPEN['"]/;
    expect(source).not.toMatch(openFindPattern);
  });
});
