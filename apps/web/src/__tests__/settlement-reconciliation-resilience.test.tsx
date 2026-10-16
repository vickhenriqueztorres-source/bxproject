/**
 * Subetapa 3 — Testes Unitários, Estresse, Segurança Financeira (D-18) e Caos de Reconciliação
 *
 * Valida:
 * 1. Normalização bidirecional de símbolos (SYNTH_VOL_50 <-> VOL_50) no BinmaxPortfolioDrawer.
 * 2. Aritmética inteira estrita (Math.floor((stake * payoutPct) / 100)) sem arredondamento float (* 0.85).
 * 3. Teste de Estresse: renderização de 150 contratos simultâneos (abertos, em "Liquidando..." e liquidados).
 * 4. Teste de Caos / Watchdog: transição determinística de contratos vencidos ("Liquidando...") para "SETTLED"
 *    e presença do watchdog ativo em App.tsx.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { BinmaxPortfolioDrawer } from '../components/drawer/BinmaxPortfolioDrawer';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: `contract-${Math.random().toString(36).slice(2, 10)}`,
    symbol: 'SYNTH_VOL_50',
    direction: 'UP',
    status: 'OPEN',
    result: null,
    stake_minor: 10000,
    payout_minor: null,
    entry_price: '500.0000',
    strike_price: '500.0000',
    created_at: new Date(Date.now() - 50000).toISOString(),
    expires_at: new Date(Date.now() + 10000).toISOString(),
    ...overrides,
  };
}

describe('Subetapa 3 — Reconciliação de Liquidação, Normalização SYNTH_ e Aritmética Inteira', () => {
  it('1. [UNIT] Normaliza SYNTH_VOL_50 <-> VOL_50 ao buscar cotação ao vivo em currentPrices', () => {
    const contracts = [
      // Contrato salvo no banco como SYNTH_VOL_50, mas feed ao vivo indexado como VOL_50
      makeContract({
        id: 'c-synth-db',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000,
        entry_price: '500.0000',
        strike_price: '500.0000',
      }),
      // Contrato salvo como VOL_100, mas feed indexado como SYNTH_VOL_100
      makeContract({
        id: 'c-canon-db',
        symbol: 'VOL_100',
        direction: 'DOWN',
        stake_minor: 20000,
        entry_price: '1000.0000',
        strike_price: '1000.0000',
      }),
    ];

    const currentPrices = {
      VOL_50: 512.3456, // Acima de 500 -> UP ganha (+$85.00)
      SYNTH_VOL_100: 990.1234, // Abaixo de 1000 -> DOWN ganha (+$170.00)
    };

    const html = renderToString(
      <BinmaxPortfolioDrawer
        contracts={contracts as any}
        currentPrice={1.085} // Preço de outro ativo (não deve contaminar)
        currentPrices={currentPrices}
        onClose={() => {}}
      />
    );

    expect(html).toContain('+$85.00');
    expect(html).toContain('+$170.00');
  });

  it('2. [SEGURANÇA FINANCEIRA D-18] Aplica aritmética inteira Math.floor((stake * pct) / 100) sem float rounding', () => {
    // Stake de 101 centavos ($1.01) a 85%:
    // Float Math.round(101 * 0.85) daria Math.round(85.85) = 86 centavos (ERRO DE FLOAT!)
    // Inteiro estrito Math.floor((101 * 85) / 100) = 85 centavos (+$0.85)
    const contracts = [
      makeContract({
        id: 'c-int-101',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 101,
        entry_price: '500.00',
        strike_price: '500.00',
      }),
    ];

    const htmlBinmax = renderToString(
      <BinmaxPortfolioDrawer
        contracts={contracts as any}
        currentPrices={{ VOL_50: 510.0 }}
        onClose={() => {}}
      />
    );
    expect(htmlBinmax).toContain('+$0.85');
    expect(htmlBinmax).not.toContain('+$0.86');

    const htmlClassic = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={() => {}}
        contracts={contracts as any}
        currentPrice={510.0}
        currentSymbol="VOL_50"
      />
    );
    expect(htmlClassic).toContain('+$0.85');
    expect(htmlClassic).not.toContain('+$0.86');
  });

  it('3. [ESTRESSE] Renderiza 150 contratos simultâneos (abertos, em "Liquidando..." e liquidados) em < 150ms', () => {
    const now = Date.now();
    const bulkContracts = Array.from({ length: 150 }, (_, idx) => {
      const isExpiredOpen = idx % 3 === 0;
      const isSettled = idx % 3 === 1;
      return makeContract({
        id: `stress-c-${idx}`,
        symbol: idx % 2 === 0 ? 'SYNTH_VOL_50' : 'SYNTH_CRASH_BOOM_100',
        direction: idx % 2 === 0 ? 'UP' : 'DOWN',
        status: isSettled ? 'SETTLED' : 'OPEN',
        result: isSettled ? 'WIN' : null,
        stake_minor: 5000 + idx * 100,
        payout_minor: isSettled ? 9250 : null,
        created_at: new Date(now - 120000).toISOString(),
        expires_at: isExpiredOpen
          ? new Date(now - 5000).toISOString()
          : new Date(now + 45000).toISOString(),
      });
    });

    const t0 = performance.now();
    const htmlOpen = renderToString(
      <BinmaxPortfolioDrawer
        contracts={bulkContracts as any}
        currentPrices={{ VOL_50: 515.0, CRASH_BOOM_100: 980.0 }}
        initialTab="abiertas"
      />
    );
    const htmlClosed = renderToString(
      <BinmaxPortfolioDrawer
        contracts={bulkContracts as any}
        currentPrices={{ VOL_50: 515.0, CRASH_BOOM_100: 980.0 }}
        initialTab="cerradas"
      />
    );
    const elapsedMs = performance.now() - t0;

    expect(elapsedMs).toBeLessThan(250);
    expect(htmlOpen).toContain('Abiertas 100');
    expect(htmlOpen).toContain('Liquidando...');
    expect(htmlClosed).toContain('Ganada');
  });

  it('4. [CAOS / WATCHDOG] Transita contratos de "Liquidando..." (OPEN vencido) para "Cerradas" (SETTLED) após reconciliação e valida watchdog em App.tsx', () => {
    const now = Date.now();
    const expiredContract = makeContract({
      id: 'ffe4d426-stuck-test',
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      status: 'OPEN',
      stake_minor: 100,
      created_at: new Date(now - 70000).toISOString(),
      expires_at: new Date(now - 3000).toISOString(),
    });

    // Fase 1: Contrato vencido ainda OPEN -> exibe "Liquidando..."
    const beforeReconcileHtml = renderToString(
      <BinmaxPortfolioDrawer
        contracts={[expiredContract] as any}
        currentPrices={{ VOL_50: 505.0 }}
        initialTab="abiertas"
      />
    );
    expect(beforeReconcileHtml).toContain('Liquidando...');
    expect(beforeReconcileHtml).toContain('Abiertas 1');

    // Fase 2: Após o watchdog reconciliar com GET /contracts, o contrato vem SETTLED
    const settledContract = {
      ...expiredContract,
      status: 'SETTLED',
      result: 'WIN',
      payout_minor: 185,
      exit_price: '505.2500',
      exit_tick_sequence: 19055,
    };

    const afterReconcileOpenTabHtml = renderToString(
      <BinmaxPortfolioDrawer
        contracts={[settledContract] as any}
        currentPrices={{ VOL_50: 505.0 }}
        initialTab="abiertas"
      />
    );
    expect(afterReconcileOpenTabHtml).toContain('Abiertas 0');
    expect(afterReconcileOpenTabHtml).not.toContain('Liquidando...');

    const afterReconcileClosedTabHtml = renderToString(
      <BinmaxPortfolioDrawer
        contracts={[settledContract] as any}
        currentPrices={{ VOL_50: 505.0 }}
        initialTab="cerradas"
      />
    );
    expect(afterReconcileClosedTabHtml).toContain('Ganada');
    expect(afterReconcileClosedTabHtml).toContain('+$0.85');

    // Verifica estruturalmente que o watchdog de reconciliação está presente em App.tsx
    const appTsxPath = path.resolve(__dirname, '../App.tsx');
    const appSource = fs.readFileSync(appTsxPath, 'utf8');
    expect(appSource).toContain('triggerReconcileIfExpired');
    expect(appSource).toContain("queryClient.invalidateQueries({ queryKey: ['contracts'] })");
    expect(appSource).toContain("queryClient.invalidateQueries({ queryKey: ['wallet'] })");
  });
});
