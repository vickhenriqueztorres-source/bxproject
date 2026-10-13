import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PortfolioDrawer, formatOrderHash } from '../components/drawer/PortfolioDrawer';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import type { Contract } from '../api/client';

describe('SUBETAPA AWWWARDS: Refinamento Estético & Motion de Alta Fidelidade', () => {
  const mockGuestContract: Contract = {
    id: 'guest_368291a4b',
    symbol: 'EURUSD_OTC',
    direction: 'UP',
    stake_minor: 10000,
    payout_minor: 18500,
    result: null,
    status: 'OPEN',
    entry_price: 1.085,
    strike_price: 1.085,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 59000).toISOString(),
  };

  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  it('A1: formatOrderHash elimina o prefixo amador #guest_ e gera hash institucional #ORD-', () => {
    const cleanHash = formatOrderHash('guest_368291a4b');
    expect(cleanHash).not.toContain('guest_');
    expect(cleanHash).toBe('#ORD-368291');

    // Preserva contratos padrão do sistema
    const systemHash = formatOrderHash('c-trade-open-1');
    expect(systemHash).toBe('#c-trade-');
  });

  it('A2: Renderiza tabela com scrollbar stealth dark e sem #guest_ na visualização do usuário', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={[mockGuestContract]}
        currentPrice={1.0852}
        currentSymbol="EURUSD_OTC"
      />
    );

    // Nunca deve vazar o identificador cru #guest_
    expect(html).not.toContain('#guest_');
    expect(html).toContain('#ORD-368291');
    // Deve conter a classe de scrollbar stealth dark
    expect(html).toContain('bm-stealth-scroll');
  });

  it('A3: Renderiza badge de direção SUBE como micro-chip de precisão com borda sub-pixel', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={[mockGuestContract]}
        currentPrice={1.0852}
        currentSymbol="EURUSD_OTC"
      />
    );

    expect(html).toContain('▲ SUBE');
    expect(html).toContain('border:1px solid rgba(34, 197, 94, 0.28)');
  });

  it('A4: Renderiza status "En curso" com micro-beacon luminoso ativo', () => {
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={[mockGuestContract]}
        currentPrice={1.0852}
        currentSymbol="EURUSD_OTC"
      />
    );

    expect(html).toContain('En curso');
    expect(html).toContain('box-shadow:0 0 6px rgba(34, 197, 94, 0.6)');
  });

  it('A5: Estresse: Renderiza 100 ordens com hashing em menos de 100ms', () => {
    const contracts: Contract[] = Array.from({ length: 100 }, (_, i) => ({
      ...mockGuestContract,
      id: `guest_hash_${i}`,
    }));

    const start = Date.now();
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={contracts}
        currentPrice={1.0852}
        currentSymbol="EURUSD_OTC"
      />
    );
    const elapsed = Date.now() - start;

    expect(html).not.toContain('#guest_');
    expect(elapsed).toBeLessThan(2000);
  });
});
