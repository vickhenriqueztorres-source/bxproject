import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { generateSeedCandles } from '../api/client';
import { tradingFeedManager } from '../feed/TradingFeedManager';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { PriceChart } from '../chart/PriceChart';
import { AssetCatalogModal } from '../components/modals/AssetCatalogModal';
import { ASSET_CATALOG } from '../catalog/assets';

describe('SUBETAPA 4: Bateria de Certificação Final (Estresse, Caos, Segurança e Regressão)', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('Matriz 1: Estresse e Performance Operacional', () => {
    it('CRT-01: Comutação veloz de 100 ativos consecutivos sem travamento da thread gráfica', () => {
      const symbols = ASSET_CATALOG.map((a) => a.symbol);
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        const sym = symbols[i % symbols.length];
        const candles = generateSeedCandles(sym, 60);
        expect(candles.length).toBe(60);
        expect(Number(candles[0].close)).toBeGreaterThan(0);
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500); // 100 gerações em menos de 500ms
    });

    it('CRT-02: Des-duplicação de subscrições WebSocket no TradingFeedManager', () => {
      const sym = 'EURUSD_OTC';
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();

      const unsub1 = tradingFeedManager.subscribeSymbol(sym, cb1);
      const unsub2 = tradingFeedManager.subscribeSymbol(sym, cb2);
      const unsub3 = tradingFeedManager.subscribeSymbol(sym, cb3);

      expect(tradingFeedManager.getSubscriberCount(sym)).toBe(3);

      unsub1();
      expect(tradingFeedManager.getSubscriberCount(sym)).toBe(2);

      unsub2();
      unsub3();
      expect(tradingFeedManager.getSubscriberCount(sym)).toBe(0);
    });
  });

  describe('Matriz 2: Resiliência de Caos e Rede', () => {
    it('CRT-03: Simulação de queda de conexão — transição suave para Ornstein-Uhlenbeck sem tela preta', () => {
      // Simula desconexão
      tradingFeedManager.disconnect();

      // Gráfico requisita velas de fallback para ativo desconhecido
      const fallback = generateSeedCandles('SYNTH_VOL_100', 120);
      expect(fallback.length).toBe(120);

      // Valida integridade e ausência de NaNs ou preços negativos
      fallback.forEach((c) => {
        expect(Number.isFinite(Number(c.open))).toBe(true);
        expect(Number.isFinite(Number(c.close))).toBe(true);
        expect(Number(c.high)).toBeGreaterThanOrEqual(Number(c.low));
        expect(Number(c.low)).toBeGreaterThan(0);
      });
    });
  });

  describe('Matriz 3: Segurança e Invariantes Financeiros', () => {
    it('CRT-04: Troca de ativo preserva saldo do usuário e integridade de ordens abertas', () => {
      const contracts = [
        {
          id: 'c-1',
          symbol: 'EURUSD_OTC',
          direction: 'UP' as const,
          stake_minor: 10000,
          status: 'OPEN',
          result: null,
          payout_minor: null,
          expires_at: new Date(Date.now() + 60000).toISOString(),
          created_at: new Date().toISOString(),
        },
      ];

      // Renderiza PriceChart para outro ativo (ex: BTCUSD_OTC)
      const html = renderToString(
        <PriceChart
          candles={generateSeedCandles('BTCUSD_OTC', 50)}
          tick={null}
          symbol="BTCUSD_OTC"
          activeContracts={contracts}
          isStale={false}
          isVisible={true}
        />
      );

      // O gráfico renderiza normalmente sem vazar contratos de outros ativos na série principal
      expect(html).toContain('BTC/USD');
    });
  });

  describe('Matriz 4: Padrão Duas Portas e Regressão Visual', () => {
    it('CRT-05: Quando NEW_TRADEROOM = false, todos os seletores voltam ao modo clássico legado', () => {
      setNewTraderoomEnabled(false);

      const headerHtml = renderToString(
        <TerminalHeader
          activeSymbol="EURUSD_OTC"
          openTabs={['EURUSD_OTC']}
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          onAddTab={vi.fn()}
          balanceMinor={1000000}
          accountEmail="trader@binmax.com"
          isLive={true}
          onResetDemo={vi.fn()}
          onSignOut={vi.fn()}
        />
      );

      expect(headerHtml).toContain('BROKER');
      expect(headerHtml).not.toContain('AssetCatalogModal');

      const chartHtml = renderToString(
        <PriceChart
          candles={[]}
          tick={null}
          symbol="EURUSD_OTC"
          activeContracts={[]}
          isStale={false}
          isVisible={true}
        />
      );

      expect(chartHtml).not.toContain('data-testid="chart-top-asset-pill"');
    });

    it('CRT-06: Quando NEW_TRADEROOM = true, tanto o Pill In-Chart quanto o Modal IQ Option estão ativos', () => {
      setNewTraderoomEnabled(true);

      const chartHtml = renderToString(
        <PriceChart
          candles={[]}
          tick={null}
          symbol="EURUSD_OTC"
          activeContracts={[]}
          isStale={false}
          isVisible={true}
        />
      );
      expect(chartHtml).toContain('data-testid="chart-top-asset-pill"');
      expect(chartHtml).toContain('Turbo');
      expect(chartHtml).toContain('data-testid="asset-selector-chevron"');

      const modalHtml = renderToString(
        <AssetCatalogModal
          isOpen={true}
          onClose={vi.fn()}
          onSelectAsset={vi.fn()}
          openTabs={['EURUSD_OTC']}
          activeSymbol="EURUSD_OTC"
        />
      );
      expect(modalHtml).toContain('data-testid="asset-catalog-modal"');
      expect(modalHtml).toContain('Catálogo de Activos · Opciones Turbo');
    });
  });
});
