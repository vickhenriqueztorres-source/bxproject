import { describe, it, expect } from 'vitest';
import {
  calculateSMA,
  calculateEMA,
  calculateWMA,
  calculateBollinger,
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  calculateATR,
  calculateVWAP,
  calculateCCI,
} from './indicator-calculator';
import type { Candle } from '../api/client';

describe('[SUBETAPA 5 - ESTRESSE, CAOS & SEGURANÇA] Indicadores Técnicos Institucionais', () => {
  // Geração de 1.000 velas sintéticas de alta volatilidade
  const largeCandleDataset: Candle[] = Array.from({ length: 1000 }, (_, i) => {
    const base = 1000 + Math.sin(i / 10) * 100 + (i % 20);
    return {
      time: 1700000000 + i * 60,
      open: base.toFixed(2),
      high: (base + 5 + (i % 3)).toFixed(2),
      low: (base - 5 - (i % 3)).toFixed(2),
      close: (base + (i % 2 === 0 ? 2 : -2)).toFixed(2),
      volume: 100 + (i % 50),
    };
  });

  describe('1. Testes de Estresse e Throughput', () => {
    it('executa o cálculo de TODOS os 10 indicadores sobre 1.000 velas em menos de 100ms', () => {
      const start = performance.now();

      const sma = calculateSMA(largeCandleDataset, 20);
      const ema = calculateEMA(largeCandleDataset, 20);
      const wma = calculateWMA(largeCandleDataset, 20);
      const bollinger = calculateBollinger(largeCandleDataset, 20, 2);
      const rsi = calculateRSI(largeCandleDataset, 14);
      const macd = calculateMACD(largeCandleDataset, 12, 26, 9);
      const stoch = calculateStochastic(largeCandleDataset, 14, 3);
      const atr = calculateATR(largeCandleDataset, 14);
      const vwap = calculateVWAP(largeCandleDataset);
      const cci = calculateCCI(largeCandleDataset, 20);

      const elapsed = performance.now() - start;

      expect(sma.length).toBeGreaterThan(900);
      expect(ema.length).toBeGreaterThan(900);
      expect(wma.length).toBeGreaterThan(900);
      expect(bollinger.length).toBeGreaterThan(900);
      expect(rsi.length).toBeGreaterThan(900);
      expect(macd.length).toBeGreaterThan(900);
      expect(stoch.length).toBeGreaterThan(900);
      expect(atr.length).toBeGreaterThan(900);
      expect(vwap.length).toBe(1000);
      expect(cci.length).toBeGreaterThan(900);

      // O tempo total para os 10 indicadores sobre 1.000 barras não pode exceder 100ms
      expect(elapsed).toBeLessThan(100);
    });

    it('suporta períodos longos (SMA 200 e EMA 200) sem estourar pilha de recursão', () => {
      expect(() => calculateSMA(largeCandleDataset, 200)).not.toThrow();
      expect(() => calculateEMA(largeCandleDataset, 200)).not.toThrow();
      expect(() => calculateWMA(largeCandleDataset, 200)).not.toThrow();
    });
  });

  describe('2. Testes de Caos e Anomalias de Dados', () => {
    it('resiste a velas com volume zerado, negativo ou string alfanumérica', () => {
      const corruptCandles = [
        { time: 1700000000, open: '100', high: '110', low: '90', close: '105', volume: '0' },
        { time: 1700000060, open: '105', high: '115', low: '95', close: '110', volume: '-50' },
        { time: 1700000120, open: '110', high: '120', low: '100', close: '115', volume: 'invalid_vol' },
      ];

      const vwap = calculateVWAP(corruptCandles as any);
      expect(vwap).toHaveLength(3);
      for (const pt of vwap) {
        expect(Number.isFinite(pt.value)).toBe(true);
        expect(pt.value).toBeGreaterThan(0);
      }
    });

    it('resiste a timestamps misturados (ms x s x ISO)', () => {
      const mixedCandles = [
        { time: 1700000000000, close: '100' }, // ms (> 10^10)
        { time: 1700000060, close: '102' },    // s
        { open_time: '2026-10-07T00:02:00Z', close: '104' }, // ISO string
      ];

      const sma = calculateSMA(mixedCandles, 2);
      expect(sma).toHaveLength(2);
      expect(sma[0].time).toBe(1700000060);
      expect(sma[1].time).toBe(Math.floor(Date.parse('2026-10-07T00:02:00Z') / 1000));
    });

    it('lida com spread zero absoluto (high = low = open = close) sem gerar NaN no ATR ou Estocástico', () => {
      const flatCandles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        time: 1700000000 + i * 60,
        open: '500',
        high: '500',
        low: '500',
        close: '500',
        volume: 10,
      }));

      const atr = calculateATR(flatCandles, 14);
      expect(atr.length).toBeGreaterThan(0);
      expect(atr[0].value).toBe(0);

      const stoch = calculateStochastic(flatCandles, 14, 3);
      expect(stoch.length).toBeGreaterThan(0);
      expect(stoch[0].k).toBe(50); // Neutro
      expect(stoch[0].d).toBe(50);
    });
  });

  describe('3. Testes de Segurança Numérica', () => {
    it('garante que nenhum valor retornado seja NaN, null ou undefined', () => {
      const indicatorsResults = [
        calculateSMA(largeCandleDataset.slice(0, 50), 10),
        calculateEMA(largeCandleDataset.slice(0, 50), 10),
        calculateWMA(largeCandleDataset.slice(0, 50), 10),
        calculateRSI(largeCandleDataset.slice(0, 50), 14),
        calculateATR(largeCandleDataset.slice(0, 50), 14),
        calculateVWAP(largeCandleDataset.slice(0, 50)),
        calculateCCI(largeCandleDataset.slice(0, 50), 14),
      ];

      for (const res of indicatorsResults) {
        for (const pt of res) {
          expect(Number.isFinite(pt.value)).toBe(true);
          expect(Number.isNaN(pt.value)).toBe(false);
        }
      }

      const bbands = calculateBollinger(largeCandleDataset.slice(0, 50), 10, 2);
      for (const b of bbands) {
        expect(Number.isFinite(b.upper)).toBe(true);
        expect(Number.isFinite(b.middle)).toBe(true);
        expect(Number.isFinite(b.lower)).toBe(true);
      }

      const macd = calculateMACD(largeCandleDataset.slice(0, 50), 12, 26, 9);
      for (const m of macd) {
        expect(Number.isFinite(m.macd)).toBe(true);
        expect(Number.isFinite(m.signal)).toBe(true);
        expect(Number.isFinite(m.histogram)).toBe(true);
      }

      const stoch = calculateStochastic(largeCandleDataset.slice(0, 50), 14, 3);
      for (const s of stoch) {
        expect(Number.isFinite(s.k)).toBe(true);
        expect(Number.isFinite(s.d)).toBe(true);
      }
    });
  });
});
