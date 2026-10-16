import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { Contract } from '../api/client';
import { OrderFlagsOverlay } from './OrderFlagsOverlay';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { setTraderoomPolishEnabled, resetTraderoomPolishForTesting } from '../lib/traderoom-polish';

const NOW = Date.parse('2026-10-16T12:00:00.000Z');

function makeContract(id: string, strike: number, overrides: Partial<Contract> = {}): Contract {
  return {
    id,
    symbol: 'VOL_100',
    direction: 'UP',
    stake_minor: 21200,
    status: 'OPEN',
    result: null,
    payout_minor: 39220,
    expires_at: new Date(NOW + 44_000).toISOString(),
    created_at: new Date(NOW - 16_000).toISOString(),
    strike_price: strike,
    entry_price: strike,
    ...overrides,
  };
}

const mockSeries = {
  priceToCoordinate: (price: number) => 200 + (988 - price) * 40,
} as any;

describe('SUBETAPA 03 — Linha de Ponto de Entrada Reta (Sólida) e Altamente Destacada (Imagem 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    setNewTraderoomEnabled(true);
    setTraderoomPolishEnabled(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetTraderoomPolishForTesting();
  });

  describe('3.1 Linha Reta Sólida (Sem Pontilhado) e Destaque de Alta Visibilidade', () => {
    it('Renderiza a linha de ponto de entrada 100% reta e sólida (sem stroke-dasharray), com stroke-width="2", stroke-opacity="0.95" e ponto de ancoragem (strike-entry-dot)', () => {
      const contracts = [
        makeContract('c-1', 987.1393),
        makeContract('c-2', 987.1393),
      ];

      const html = renderToString(
        <OrderFlagsOverlay
          contracts={contracts}
          currentPrice={987.55}
          containerWidth={1440}
          containerHeight={720}
          activeSeries={mockSeries}
          chartInstance={null}
        />
      );

      expect(html).toContain('order-strike-lines-svg');
      expect(html).toContain('data-testid="strike-line-UP:987.1393"');
      expect(html).toContain('stroke-width="2"');
      expect(html).toContain('stroke-opacity="0.95"');
      expect(html).not.toContain('stroke-dasharray');
      expect(html).toContain('data-testid="strike-entry-dot-UP:987.1393"');
      expect(html).toContain('border:1.5px solid var(--profit)');
    });
  });

  describe('3.2 Conformidade Cromática Semântica (Ganhando vs Perdendo)', () => {
    it('Aplica var(--profit) quando ganhando e var(--loss) quando perdendo, sem efeitos cassino proibidos', () => {
      const contract = [makeContract('c-up', 987.1393, { direction: 'UP' })];

      const htmlWin = renderToString(
        <OrderFlagsOverlay
          contracts={contract}
          currentPrice={988.0}
          containerWidth={1440}
          containerHeight={720}
          activeSeries={mockSeries}
        />
      );
      expect(htmlWin).toContain('stroke="var(--profit)"');
      expect(htmlWin).not.toContain('stroke-dasharray');

      const htmlLoss = renderToString(
        <OrderFlagsOverlay
          contracts={contract}
          currentPrice={986.0}
          containerWidth={1440}
          containerHeight={720}
          activeSeries={mockSeries}
        />
      );
      expect(htmlLoss).toContain('stroke="var(--loss)"');
      expect(htmlLoss).not.toContain('stroke-dasharray');
    });
  });

  describe('3.3 Testes de Caos (Coordenadas Fora da Tela, Exceções na Série e Preço Nulo)', () => {
    it('Clampa coordenadas extremas dentro do canvas [20, height-20] e resiste a exceções de priceToCoordinate', () => {
      const chaoticSeries = {
        priceToCoordinate: (p: number) => {
          if (p > 1000) throw new Error('Series disposed');
          return -500;
        },
      } as any;

      const html = renderToString(
        <OrderFlagsOverlay
          contracts={[
            makeContract('c-low', 900),
            makeContract('c-err', 1500),
          ]}
          currentPrice={null}
          containerWidth={1200}
          containerHeight={600}
          activeSeries={chaoticSeries}
        />
      );

      expect(html).toContain('y1="20"');
      expect(html).not.toContain('stroke-dasharray');
    });
  });

  describe('3.4 Testes de Segurança (Imunidade a XSS em Atributos SVG)', () => {
    it('Escapa completamente IDs e símbolos maliciosos sem injetar elementos no SVG', () => {
      const malicious = makeContract('"><script>alert(1)</script>', 987.1393, {
        symbol: '"><img src=x onerror=alert(2)>',
      });

      const html = renderToString(
        <OrderFlagsOverlay
          contracts={[malicious]}
          currentPrice={987.2}
          containerWidth={1200}
          containerHeight={600}
          activeSeries={mockSeries}
        />
      );

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('<img src=x');
    });
  });

  describe('3.5 Teste de Estresse (250 Contratos Simultâneos com Linhas Sólidas)', () => {
    it('Renderiza 250 contratos abertos em 25 níveis de strike com linhas sólidas e âncoras em < 60ms', () => {
      vi.useRealTimers();
      const contracts = Array.from({ length: 250 }, (_, i) =>
        makeContract(`stress-${i}`, 980 + (i % 25) * 0.25, {
          direction: i % 2 === 0 ? 'UP' : 'DOWN',
        })
      );

      const start = performance.now();
      const html = renderToString(
        <OrderFlagsOverlay
          contracts={contracts}
          currentPrice={983.5}
          containerWidth={1440}
          containerHeight={720}
          activeSeries={mockSeries}
        />
      );
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(60);
      expect(html).not.toContain('stroke-dasharray');
      expect(html).toContain('data-testid="strike-entry-dot-');
    });
  });
});
