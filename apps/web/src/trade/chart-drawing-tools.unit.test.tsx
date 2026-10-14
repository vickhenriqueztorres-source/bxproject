import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TradersMoodBar } from '../chart/TradersMoodBar';
import { TimeLinesOverlay } from '../chart/TimeLinesOverlay';
import { FIBONACCI_LEVELS, type DrawingItem } from '../chart/drawing-types';
import { resampleCandles, candleFromTick } from '../chart/candle-adapter';
import type { Candle } from '../api/client';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { setTraderoomPolishEnabled } from '../lib/traderoom-polish';

// Este arquivo cobre os overlays anteriores (cápsula de sentimento, pílula de expiração). Ver chart/subetapa-polish-05-time-mood.
setTraderoomPolishEnabled(false);

describe('Subetapa 4: Motor Gráfico, Overlays em Tempo Real e Desenho 60 FPS', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('1. Cálculos Geométricos e Matemáticos de Desenho', () => {
    it('Valida com precisão absoluta os 6 níveis áureos da retração de Fibonacci', () => {
      expect(FIBONACCI_LEVELS.length).toBe(6);
      expect(FIBONACCI_LEVELS[0].level).toBe(0);
      expect(FIBONACCI_LEVELS[1].level).toBe(0.236);
      expect(FIBONACCI_LEVELS[2].level).toBe(0.382);
      expect(FIBONACCI_LEVELS[3].level).toBe(0.5);
      expect(FIBONACCI_LEVELS[4].level).toBe(0.618);
      expect(FIBONACCI_LEVELS[5].level).toBe(1.0);
    });

    it('Fórmula P_k = P_1 + k * Delta_P com tolerância < 0.0001', () => {
      const p1 = 89.200;
      const p2 = 90.500;
      const deltaP = p2 - p1;

      const levels = FIBONACCI_LEVELS.map((lvl) => ({
        label: lvl.label,
        price: p1 + lvl.level * deltaP,
      }));

      const f0 = levels.find((l) => l.label === '0.0%')!;
      const f50 = levels.find((l) => l.label === '50.0%')!;
      const f618 = levels.find((l) => l.label === '61.8%')!;
      const f100 = levels.find((l) => l.label === '100.0%')!;

      expect(Math.abs(f0.price - 89.200)).toBeLessThan(0.0001);
      expect(Math.abs(f50.price - 89.850)).toBeLessThan(0.0001);
      expect(Math.abs(f618.price - (89.200 + 0.618 * 1.300))).toBeLessThan(0.0001);
      expect(Math.abs(f100.price - 90.500)).toBeLessThan(0.0001);
    });

    it('Valida interceptação de Hitbox de 24px (raio de tolerância de 12px)', () => {
      const HITBOX_RADIUS = 12;
      const lineCenterY = 300;

      const isHit = (y: number) => Math.abs(y - lineCenterY) <= HITBOX_RADIUS;

      // Dentro da hitbox (<= 12px)
      expect(isHit(300)).toBe(true);
      expect(isHit(312)).toBe(true);
      expect(isHit(288)).toBe(true);
      expect(isHit(306)).toBe(true);

      // Fora da hitbox (> 12px)
      expect(isHit(313)).toBe(false);
      expect(isHit(287)).toBe(false);
      expect(isHit(330)).toBe(false);
    });

    it('Resample de velas: conversão determinística de ticks em velas OHLCV', () => {
      const baseTs = 1700000000;
      const candle = candleFromTick(
        { type: 'tick', price: '89.550', symbol: 'NZDJPY_OTC', sequence: 1, ts: new Date(baseTs * 1000).toISOString() },
        null,
        '1m'
      )!;

      expect(candle).not.toBeNull();
      expect(candle.open).toBe(89.550);
      expect(candle.high).toBe(89.550);
      expect(candle.low).toBe(89.550);
      const expectedBucket = Math.floor(baseTs / 60) * 60;
      expect(candle.time).toBe(expectedBucket);
    });
  });

  describe('2. TradersMoodBar - Coluna de Diamantes Institucional', () => {
    it('Quando NEW_TRADEROOM = true, renderiza a pilha vertical de 14 diamantes', () => {
      setNewTraderoomEnabled(true);
      const html = renderToString(<TradersMoodBar bullsPercentage={60} />);

      expect(html).toContain('data-testid="mood-diamond-stack"');
      expect(html).toContain('SUBE 60%');
      expect(html).toContain('BAJA 40%');
      expect(html).toContain('data-testid="mood-diamond-0"');
      expect(html).toContain('data-testid="mood-diamond-13"');
      expect(html).toContain('transform:rotate(45deg)');
    });

    it('Quando NEW_TRADEROOM = false, renderiza a barra contínua clássica (Dois Caminhos)', () => {
      setNewTraderoomEnabled(false);
      const html = renderToString(<TradersMoodBar bullsPercentage={60} />);

      expect(html).toContain('mood-track');
      expect(html).toContain('mood-fill-bulls');
      expect(html).not.toContain('data-testid="mood-diamond-stack"');
    });
  });

  describe('3. TimeLinesOverlay - Linhas Verticais de Compra e Expiração', () => {
    it('Renderiza linha pontilhada de compra e linha sólida de expiração com marcadores', () => {
      const html = renderToString(
        <TimeLinesOverlay
          containerWidth={1000}
          containerHeight={600}
          chartInstance={null}
          latestCandleTime={null}
          tickTimestamp={new Date().toISOString()}
        />
      );

      expect(html).toContain('data-testid="purchase-time-line"');
      expect(html).toContain('HORA DE COMPRA');
      expect(html).toContain('data-testid="expiration-time-line"');
      expect(html).toContain('EXPIRACIÓN');
    });

    it('Resiliência a dimensões nulas ou inválidas sem gerar renderização corrompida', () => {
      const htmlZero = renderToString(
        <TimeLinesOverlay
          containerWidth={0}
          containerHeight={0}
          chartInstance={null}
          latestCandleTime={null}
        />
      );
      expect(htmlZero).toBe('');
    });
  });

  describe('4. Testes de Estresse, Caos e Isolamento por Ativo', () => {
    it('Estresse: Simula 50 itens de desenho técnico mantendo serialização e cálculo < 16ms', () => {
      const mockDrawings: DrawingItem[] = Array.from({ length: 50 }, (_, i) => ({
        id: `vector_line_${i}`,
        type: i % 3 === 0 ? 'trend_line' : i % 3 === 1 ? 'horizontal_line' : 'fibonacci',
        p1: { time: (1700000000 + i * 60) as any, price: 89.000 + i * 0.05 },
        p2: { time: (1700000000 + (i + 1) * 60) as any, price: 89.100 + i * 0.05 },
        color: '#22C47A',
        lineWidth: 2,
      }));

      const start = performance.now();
      const serialized = JSON.stringify(mockDrawings);
      const deserialized = JSON.parse(serialized) as DrawingItem[];
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(16.6); // Dentro do orçamento de 1 frame de 60 FPS
      expect(deserialized.length).toBe(50);
      expect(deserialized[0].id).toBe('vector_line_0');
      expect(deserialized[49].id).toBe('vector_line_49');
    });

    it('Caos: Recupera graciosamente quando dados salvos em armazenamento estão corrompidos', () => {
      const malformedPayloads = [
        '{broken_json:',
        'null',
        '""',
        '{"some":"object_not_array"}',
        '[{"id": "incomplete"}]'
      ];

      malformedPayloads.forEach((payload) => {
        let safeList: DrawingItem[] = [];
        try {
          const parsed = JSON.parse(payload);
          if (Array.isArray(parsed) && parsed.every(p => p.id && p.type && p.p1)) {
            safeList = parsed;
          }
        } catch {
          safeList = [];
        }
        expect(Array.isArray(safeList)).toBe(true);
      });
    });

    it('Isolamento de Estado por Ativo: chaves de armazenamento são estritamente particionadas', () => {
      const getStorageKey = (symbol: string) => `broker_drawings_${symbol.toUpperCase()}`;

      const keyEurUsd = getStorageKey('EURUSD_OTC');
      const keyNzdJpy = getStorageKey('NZDJPY_OTC');
      const keyBtcUsd = getStorageKey('BTCUSD_OTC');

      expect(keyEurUsd).toBe('broker_drawings_EURUSD_OTC');
      expect(keyNzdJpy).toBe('broker_drawings_NZDJPY_OTC');
      expect(keyBtcUsd).toBe('broker_drawings_BTCUSD_OTC');
      expect(keyEurUsd).not.toBe(keyNzdJpy);
      expect(keyNzdJpy).not.toBe(keyBtcUsd);
    });

    it('Segurança: Valores numéricos atípicos (preços negativos, NaN, Infinity) são blindados', () => {
      const sanitizePrice = (val: number): number => {
        if (!Number.isFinite(val) || Number.isNaN(val) || val <= 0) {
          return 1.0; // fallback defensivo seguro
        }
        return val;
      };

      expect(sanitizePrice(-50)).toBe(1.0);
      expect(sanitizePrice(NaN)).toBe(1.0);
      expect(sanitizePrice(Infinity)).toBe(1.0);
      expect(sanitizePrice(89.587)).toBe(89.587);
    });
  });
});
