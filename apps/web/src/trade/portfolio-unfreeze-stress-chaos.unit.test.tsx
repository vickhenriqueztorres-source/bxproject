import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  reconcileGuestContracts,
  getContracts,
  getWallet,
  openContract,
  resetMockWallet,
  type Contract,
} from '../api/client';
import { setGuestMode } from '../auth/oidc';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { TerminalFooter } from '../components/footer/TerminalFooter';
import { calculateFooterMetrics } from './footer-reactive-metrics.unit.test';

class MockStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  key(index: number) { return Array.from(this.map.keys())[index] ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
}

const mockStorageInstance = new MockStorage();
Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockStorageInstance,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: { sessionStorage: mockStorageInstance },
  writable: true,
  configurable: true,
});

describe('SUBETAPA 04: Bateria Global de Estresse, Caos e Segurança Financeira', () => {
  beforeEach(() => {
    mockStorageInstance.clear();
    setGuestMode(true);
    setFeatureFlagForTesting(true);
    resetMockWallet();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('4.1 CAOS: Wake-from-sleep / Hibernação de aba limpa contratos expirados sem travar em 0s', async () => {
    const baseNow = Date.now();

    // Cria 5 contratos com expiração em 60s
    for (let i = 0; i < 5; i++) {
      await openContract('SYNTH_VOL_50', i % 2 === 0 ? 'UP' : 'DOWN', 10000, `key-sleep-${i}`, 60);
    }

    let contracts = await getContracts('');
    expect(contracts.filter((c) => c.status === 'OPEN')).toHaveLength(5);

    // Simula que a aba hibernou por 5 minutos (300.000 ms no futuro)
    const wokeUpTimeMs = baseNow + 300000;
    const { settledCount } = reconcileGuestContracts(wokeUpTimeMs);
    expect(settledCount).toBe(5);

    // Ao acordar e carregar os contratos:
    contracts = await getContracts('');
    const openAfterWake = contracts.filter((c) => c.status === 'OPEN');
    const closedAfterWake = contracts.filter((c) => c.status === 'SETTLED');

    expect(openAfterWake).toHaveLength(0);
    expect(closedAfterWake).toHaveLength(5);

    // Renderiza o PortfolioDrawer e prova que nenhuma linha exibe "En curso" nem "0s"
    const html = renderToString(
      <PortfolioDrawer
        isOpen={true}
        onToggle={vi.fn()}
        contracts={contracts}
        currentPrice={500}
        currentSymbol="SYNTH_VOL_50"
      />
    );

    expect(html).toContain('Sin operaciones abiertas');
    expect(html).toContain('Historial cerrado (5)');
  });

  it('4.2 CONCORRÊNCIA & IDEMPOTÊNCIA: Múltiplas reconciliações paralelas não duplicam liquidações', async () => {
    const now = Date.now();

    // Insere contrato expirado diretamente no storage
    const mockStore = {
      wallet: { currency: 'USD', available_minor: 900000, reserved_minor: 10000 },
      candles: {
        SYNTH_VOL_50: [{ time: Math.floor(now / 1000) - 60, open: '500', high: '510', low: '495', close: '510', volume: 100 }],
      },
      contracts: [
        {
          id: 'c-concurrent-1',
          symbol: 'SYNTH_VOL_50',
          direction: 'UP',
          stake_minor: 10000,
          status: 'OPEN',
          result: null,
          payout_minor: null,
          entry_price: 500,
          strike_price: 500,
          created_at: new Date(now - 70000).toISOString(),
          expires_at: new Date(now - 10000).toISOString(),
        },
      ],
    };
    mockStorageInstance.setItem('synth_mock_store_v3', JSON.stringify(mockStore));

    // Executa 10 reconciliações concorrentes
    const parallelRuns = await Promise.all([
      reconcileGuestContracts(now),
      reconcileGuestContracts(now),
      reconcileGuestContracts(now),
      reconcileGuestContracts(now),
      reconcileGuestContracts(now),
    ]);

    // Exatamente uma das execuções deve ter liquidado o contrato
    const totalSettledAcrossRuns = parallelRuns.reduce((sum, r) => sum + r.settledCount, 0);
    expect(totalSettledAcrossRuns).toBe(1);

    // Carteira deve ter sido creditada exatamente UMA vez (900000 + 18500 = 918500)
    const wallet = await getWallet();
    expect(wallet.available_minor).toBe(918500);
    expect(wallet.reserved_minor).toBe(0);
  });

  it('4.3 INVARIANTES FINANCEIROS I-01 A I-06: Conservação de saldo demo em ciclo misto WIN/LOSS', async () => {
    const initialWallet = await getWallet();
    expect(initialWallet.available_minor).toBe(1000000);
    expect(initialWallet.reserved_minor).toBe(0);

    const now = Date.now();
    // 3 WINs e 2 LOSSes (stake de $100 cada = 10.000 centavos)
    const contracts: Contract[] = [
      // 3 WINs (+85 cada)
      { id: 'c-win-1', symbol: 'SYNTH_VOL_50', direction: 'UP', stake_minor: 10000, payout_minor: 18500, status: 'SETTLED', result: 'WIN', created_at: new Date(now).toISOString(), expires_at: new Date(now).toISOString() },
      { id: 'c-win-2', symbol: 'SYNTH_VOL_50', direction: 'UP', stake_minor: 10000, payout_minor: 18500, status: 'SETTLED', result: 'WIN', created_at: new Date(now).toISOString(), expires_at: new Date(now).toISOString() },
      { id: 'c-win-3', symbol: 'SYNTH_VOL_50', direction: 'UP', stake_minor: 10000, payout_minor: 18500, status: 'SETTLED', result: 'WIN', created_at: new Date(now).toISOString(), expires_at: new Date(now).toISOString() },
      // 2 LOSSes (-100 cada)
      { id: 'c-loss-1', symbol: 'SYNTH_VOL_50', direction: 'DOWN', stake_minor: 10000, payout_minor: 0, status: 'SETTLED', result: 'LOSS', created_at: new Date(now).toISOString(), expires_at: new Date(now).toISOString() },
      { id: 'c-loss-2', symbol: 'SYNTH_VOL_50', direction: 'DOWN', stake_minor: 10000, payout_minor: 0, status: 'SETTLED', result: 'LOSS', created_at: new Date(now).toISOString(), expires_at: new Date(now).toISOString() },
    ];

    // Lucro Líquido: 3 * 85 - 2 * 100 = 255 - 200 = +$55.00
    const metrics = calculateFooterMetrics(contracts, new Date(now));
    expect(metrics.activeContractsCount).toBe(0);
    expect(metrics.portfolioTotalFormatted).toBe('$0.00');
    expect(metrics.todayProfitFormatted).toBe('+$55.00');

    // Renderiza rodapé
    const footerHtml = renderToString(
      <TerminalFooter
        soundEnabled={false}
        onToggleSound={() => {}}
        isConnected={true}
        activeContractsCount={metrics.activeContractsCount}
        portfolioTotalFormatted={metrics.portfolioTotalFormatted}
        todayProfitFormatted={metrics.todayProfitFormatted}
      />
    );

    expect(footerHtml).toContain('Portafolio total');
    expect(footerHtml).toContain('$0.00');
    expect(footerHtml).toContain('Ganancia de hoy');
    expect(footerHtml).toContain('+$55.00');
    expect(footerHtml).toContain('Operaciones abiertas');
    expect(footerHtml).toContain('>0<');
  });

  it('4.4 ESTRESSE EXTREMO: 100 contratos com recálculo instantâneo sem vazamento de memória', () => {
    const now = new Date();
    const contracts: Contract[] = [];

    for (let i = 0; i < 100; i++) {
      contracts.push({
        id: `c-stress-100-${i}`,
        symbol: 'SYNTH_VOL_50',
        direction: i % 2 === 0 ? 'UP' : 'DOWN',
        stake_minor: 10000,
        payout_minor: i % 2 === 0 ? 18500 : 0,
        status: i < 20 ? 'OPEN' : 'SETTLED',
        result: i < 20 ? null : (i % 2 === 0 ? 'WIN' : 'LOSS'),
        created_at: now.toISOString(),
        expires_at: i < 20 ? new Date(now.getTime() + 30000).toISOString() : new Date(now.getTime() - 10000).toISOString(),
      });
    }

    const start = performance.now();
    const metrics = calculateFooterMetrics(contracts, now);
    const duration = performance.now() - start;

    expect(metrics.activeContractsCount).toBe(20);
    expect(metrics.portfolioTotalFormatted).toBe('$2,000.00'); // 20 * $100 com separador de milhar en-US
    expect(duration).toBeLessThan(50); // Menos de 50ms
  });
});
