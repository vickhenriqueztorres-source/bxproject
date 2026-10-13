/**
 * Subetapa 02 — Testes de Cotações em Background no Tab Badge
 *
 * Valida:
 * 1. Aba em background (não-selecionada) com contrato OPEN exibe PnL real (+$85.00)
 * 2. Aba em background com prejuízo exibe PnL real (-$100.00)
 * 3. Fallback inteligente com tradingFeedManager.getLastPrice caso currentPrices não esteja presente
 * 4. Múltiplas abas em segundo plano com cotações independentes
 * 5. App.tsx integra useMultiSymbolPriceFeed e propaga mapa consolidado de preços
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { tradingFeedManager } from '../feed/TradingFeedManager';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Mock de feature flag
vi.mock('../lib/feature-flags', () => ({
  isNewTraderoomEnabled: () => true,
}));

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
    expires_at: new Date(Date.now() + 30000).toISOString(),
    ...overrides,
  };
}

describe('Subetapa 02 — Cotações em Background no Tab Badge', () => {
  it('T01: Aba inativa EUR/USD exibe lucro real (+85.00) quando currentPrices possui a cotação', () => {
    const contracts = [
      makeContract({ symbol: 'SYNTH_VOL_50', strike_price: '500.00', entry_price: '500.00' }),
      makeContract({ symbol: 'EURUSD_OTC', strike_price: '1.08500', entry_price: '1.08500', direction: 'UP' }),
    ];

    const currentPrices = {
      SYNTH_VOL_50: 501.00,
      EURUSD_OTC: 1.08550, // Preço subiu -> UP está ganhando
    };

    const html = renderToString(
      <TerminalHeader
        activeSymbol="SYNTH_VOL_50"
        openTabs={['SYNTH_VOL_50', 'EURUSD_OTC']}
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onAddTab={() => {}}
        balanceMinor={1000000}
        accountEmail="demo@test.com"
        isLive={true}
        onResetDemo={() => {}}
        onSignOut={() => {}}
        contracts={contracts as any}
        currentPrices={currentPrices}
      />
    );

    // Deve conter +$85.00 para a aba do EUR/USD
    expect(html).toContain('+$85.00');
    // NÃO pode conter +$0.00
    expect(html).not.toContain('+$0.00');
  });

  it('T02: Aba inativa EUR/USD exibe prejuízo real (-$100.00) quando a cotação está contrária', () => {
    const contracts = [
      makeContract({ symbol: 'SYNTH_VOL_50', strike_price: '500.00', entry_price: '500.00' }),
      makeContract({ symbol: 'EURUSD_OTC', strike_price: '1.08500', entry_price: '1.08500', direction: 'UP' }),
    ];

    const currentPrices = {
      SYNTH_VOL_50: 501.00,
      EURUSD_OTC: 1.08450, // Preço caiu -> UP está perdendo
    };

    const html = renderToString(
      <TerminalHeader
        activeSymbol="SYNTH_VOL_50"
        openTabs={['SYNTH_VOL_50', 'EURUSD_OTC']}
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onAddTab={() => {}}
        balanceMinor={1000000}
        accountEmail="demo@test.com"
        isLive={true}
        onResetDemo={() => {}}
        onSignOut={() => {}}
        contracts={contracts as any}
        currentPrices={currentPrices}
      />
    );

    expect(html).toContain('-$100.00');
    expect(html).not.toContain('+$0.00');
  });

  it('T03: Resgate via tradingFeedManager.getLastPrice quando currentPrices não contém o símbolo', () => {
    // Configura cache no tradingFeedManager
    (tradingFeedManager as any).symbolLastPrices.set('EURUSD_OTC', '1.08580');

    const contracts = [
      makeContract({ symbol: 'SYNTH_VOL_50' }),
      makeContract({ symbol: 'EURUSD_OTC', strike_price: '1.08500', direction: 'UP' }),
    ];

    // currentPrices NÃO tem EURUSD_OTC propositalmente
    const currentPrices = {
      SYNTH_VOL_50: 501.00,
    };

    const html = renderToString(
      <TerminalHeader
        activeSymbol="SYNTH_VOL_50"
        openTabs={['SYNTH_VOL_50', 'EURUSD_OTC']}
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onAddTab={() => {}}
        balanceMinor={1000000}
        accountEmail="demo@test.com"
        isLive={true}
        onResetDemo={() => {}}
        onSignOut={() => {}}
        contracts={contracts as any}
        currentPrices={currentPrices}
      />
    );

    // O fallback para tradingFeedManager.getLastPrice deve evitar o +$0.00
    expect(html).toContain('+$85.00');
    expect(html).not.toContain('+$0.00');
  });

  it('T04: App.tsx importa e utiliza useMultiSymbolPriceFeed', () => {
    const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf-8');
    expect(appSource).toContain('useMultiSymbolPriceFeed');
    // Verifica que currentPrices não é mais restrito a apenas activeSymbol
    expect(appSource).not.toMatch(/currentPrices=\{feed\.tick \? \{ \[activeSymbol\]: Number\(feed\.tick\.price\) \} : \{\}\}/);
  });

  it('T05: Múltiplas abas (5 abas simultâneas) calculam seus lucros e perdas em tempo real sem colisão', () => {
    const contracts = [
      makeContract({ symbol: 'SYNTH_VOL_50', strike_price: '500.00', direction: 'UP' }),
      makeContract({ symbol: 'EURUSD_OTC', strike_price: '1.08500', direction: 'UP' }),
      makeContract({ symbol: 'BTCUSD_OTC', strike_price: '65000.00', direction: 'DOWN' }),
      makeContract({ symbol: 'GBPUSD_OTC', strike_price: '1.29000', direction: 'UP' }),
      makeContract({ symbol: 'USDJPY_OTC', strike_price: '154.000', direction: 'DOWN' }),
    ];

    const currentPrices = {
      SYNTH_VOL_50: 502.00,  // UP -> Ganha +$85.00
      EURUSD_OTC: 1.08600,   // UP -> Ganha +$85.00
      BTCUSD_OTC: 64900.00,  // DOWN -> Ganha +$85.00
      GBPUSD_OTC: 1.28500,   // UP -> Perde -$100.00
      USDJPY_OTC: 154.500,   // DOWN -> Perde -$100.00
    };

    const html = renderToString(
      <TerminalHeader
        activeSymbol="SYNTH_VOL_50"
        openTabs={['SYNTH_VOL_50', 'EURUSD_OTC', 'BTCUSD_OTC', 'GBPUSD_OTC', 'USDJPY_OTC']}
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onAddTab={() => {}}
        balanceMinor={1000000}
        accountEmail="demo@test.com"
        isLive={true}
        onResetDemo={() => {}}
        onSignOut={() => {}}
        contracts={contracts as any}
        currentPrices={currentPrices}
      />
    );

    // Deve conter os lucros e perdas de todas as 5 abas simultâneas
    expect(html).toContain('+$85.00');
    expect(html).toContain('-$100.00');
    expect(html).not.toContain('+$0.00');
  });

  it('T06: Alternância rápida de abas não causa oscilação para zero', () => {
    const contracts = [
      makeContract({ symbol: 'SYNTH_VOL_50', strike_price: '500.00', direction: 'UP' }),
      makeContract({ symbol: 'EURUSD_OTC', strike_price: '1.08500', direction: 'UP' }),
    ];

    const currentPrices = {
      SYNTH_VOL_50: 502.00,
      EURUSD_OTC: 1.08600,
    };

    // Testa alternando activeSymbol entre SYNTH_VOL_50 e EURUSD_OTC 50 vezes
    for (let i = 0; i < 50; i++) {
      const active = i % 2 === 0 ? 'SYNTH_VOL_50' : 'EURUSD_OTC';
      const html = renderToString(
        <TerminalHeader
          activeSymbol={active}
          openTabs={['SYNTH_VOL_50', 'EURUSD_OTC']}
          onSelectTab={() => {}}
          onCloseTab={() => {}}
          onAddTab={() => {}}
          balanceMinor={1000000}
          accountEmail="demo@test.com"
          isLive={true}
          onResetDemo={() => {}}
          onSignOut={() => {}}
          contracts={contracts as any}
          currentPrices={currentPrices}
        />
      );
      expect(html).not.toContain('+$0.00');
    }
  });
});

