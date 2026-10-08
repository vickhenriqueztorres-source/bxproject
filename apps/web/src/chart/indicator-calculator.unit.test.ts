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
  extractCandleValues,
} from './indicator-calculator';
import type { Candle } from '../api/client';

describe('indicator-calculator - Suíte Completa dos 10 Indicadores', () => {
  const mockCandles: Candle[] = Array.from({ length: 40 }, (_, i) => ({
    time: Math.floor((1700000000000 + i * 60000) / 1000),
    open_time: new Date(1700000000000 + i * 60000).toISOString(),
    open: (100 + i).toString(),
    high: (105 + i * 2).toString(),
    low: (95 + i).toString(),
    close: (100 + i * 2).toString(), // [100, 102, 104, 106, ...]
    volume: 10 + (i % 5),
  }));

  describe('1. SMA (Simple Moving Average)', () => {
    it('calcula média móvel simples com precisão', () => {
      const sma = calculateSMA(mockCandles, 5);
      expect(sma.length).toBe(mockCandles.length - 5 + 1);
      // Para os primeiros 5 elementos: 100, 102, 104, 106, 108 -> média = 104
      expect(sma[0].value).toBe(104);
    });
  });

  describe('2. EMA (Exponential Moving Average)', () => {
    it('calcula EMA com fator de ponderação exponencial', () => {
      const ema = calculateEMA(mockCandles, 5);
      expect(ema.length).toBe(mockCandles.length - 5 + 1);
      expect(ema[0].value).toBe(104);
      // Próximo fecha em 110: k = 2/6 = 1/3; ema = (110 - 104) * (1/3) + 104 = 106
      expect(ema[1].value).toBe(106);
    });
  });

  describe('3. WMA (Weighted Moving Average)', () => {
    it('calcula WMA aplicando pesos lineares decrescentes', () => {
      const wma = calculateWMA(mockCandles, 3);
      expect(wma.length).toBe(mockCandles.length - 3 + 1);
      // Primeiros 3: 100, 102, 104
      // Pesos: 1, 2, 3 -> soma = 6
      // (100*1 + 102*2 + 104*3) / 6 = (100 + 204 + 312) / 6 = 616 / 6 = 102.6667
      expect(wma[0].value).toBe(102.6667);
    });
  });

  describe('4. Bandas de Bollinger', () => {
    it('calcula upper > middle > lower com desvio padrão', () => {
      const bollinger = calculateBollinger(mockCandles, 10, 2);
      expect(bollinger.length).toBe(mockCandles.length - 10 + 1);
      const first = bollinger[0];
      expect(first.upper).toBeGreaterThan(first.middle);
      expect(first.middle).toBeGreaterThan(first.lower);
    });
  });

  describe('5. RSI (Relative Strength Index)', () => {
    it('mantém valores no intervalo [0, 100] sob suavização de Wilder', () => {
      const rsi = calculateRSI(mockCandles, 14);
      expect(rsi.length).toBeGreaterThan(0);
      for (const point of rsi) {
        expect(point.value).toBeGreaterThanOrEqual(0);
        expect(point.value).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('6. MACD (Moving Average Convergence Divergence)', () => {
    it('calcula MACD Line, Signal Line e Histograma de forma consistente', () => {
      const macd = calculateMACD(mockCandles, 5, 10, 3);
      expect(macd.length).toBeGreaterThan(0);
      for (const pt of macd) {
        expect(Number.isFinite(pt.macd)).toBe(true);
        expect(Number.isFinite(pt.signal)).toBe(true);
        expect(Number.isFinite(pt.histogram)).toBe(true);
        expect(Math.abs(pt.histogram - (pt.macd - pt.signal))).toBeLessThan(0.001);
      }
    });
  });

  describe('7. STOCHASTIC (Oscilador Estocástico)', () => {
    it('mantém %K e %D estritamente entre 0 e 100', () => {
      const stoch = calculateStochastic(mockCandles, 14, 3);
      expect(stoch.length).toBeGreaterThan(0);
      for (const pt of stoch) {
        expect(pt.k).toBeGreaterThanOrEqual(0);
        expect(pt.k).toBeLessThanOrEqual(100);
        expect(pt.d).toBeGreaterThanOrEqual(0);
        expect(pt.d).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('8. ATR (Average True Range)', () => {
    it('mede a volatilidade média absoluta estritamente positiva', () => {
      const atr = calculateATR(mockCandles, 14);
      expect(atr.length).toBeGreaterThan(0);
      for (const pt of atr) {
        expect(pt.value).toBeGreaterThan(0);
      }
    });
  });

  describe('9. VWAP (Volume Weighted Average Price)', () => {
    it('calcula preço médio ponderado acumulado pelo volume', () => {
      const vwap = calculateVWAP(mockCandles);
      expect(vwap.length).toBe(mockCandles.length);
      for (const pt of vwap) {
        expect(pt.value).toBeGreaterThan(0);
      }
    });
  });

  describe('10. CCI (Commodity Channel Index)', () => {
    it('calcula CCI com escala centrada em zero', () => {
      const cci = calculateCCI(mockCandles, 14);
      expect(cci.length).toBeGreaterThan(0);
      for (const pt of cci) {
        expect(Number.isFinite(pt.value)).toBe(true);
      }
    });
  });

  describe('Casos Extremos e Resiliência (Caos)', () => {
    it('retorna array vazio quando há velas insuficientes', () => {
      const few = mockCandles.slice(0, 3);
      expect(calculateSMA(few, 10)).toEqual([]);
      expect(calculateEMA(few, 10)).toEqual([]);
      expect(calculateWMA(few, 10)).toEqual([]);
      expect(calculateBollinger(few, 10)).toEqual([]);
      expect(calculateRSI(few, 14)).toEqual([]);
      expect(calculateMACD(few, 12, 26, 9)).toEqual([]);
      expect(calculateStochastic(few, 14, 3)).toEqual([]);
      expect(calculateATR(few, 14)).toEqual([]);
      expect(calculateCCI(few, 20)).toEqual([]);
    });

    it('protege contra velas sem variação (preço constante: divisão por zero evitada)', () => {
      const flatCandles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        time: 1700000000 + i * 60,
        open: '100',
        high: '100',
        low: '100',
        close: '100',
        volume: 10,
      }));

      // Bollinger: stdDev deve ser 0
      const bbands = calculateBollinger(flatCandles, 10, 2);
      expect(bbands[0].upper).toBe(100);
      expect(bbands[0].lower).toBe(100);

      // Stochastic: range 0 não gera NaN, retorna valor neutro 50
      const stoch = calculateStochastic(flatCandles, 14, 3);
      expect(stoch[0].k).toBe(50);
      expect(stoch[0].d).toBe(50);

      // CCI: meanDev 0 não gera NaN, retorna 0
      const cci = calculateCCI(flatCandles, 14);
      expect(cci[0].value).toBe(0);
    });

    it('sanitiza tipos numéricos e strings malformadas via extractCandleValues', () => {
      const raw = {
        time: 1700000000,
        open: '200',
        high: '150', // High menor que open (anomalia de dados)
        low: '250',  // Low maior que close (anomalia de dados)
        close: '210',
        volume: -5,  // Volume negativo inválido
      };

      const extracted = extractCandleValues(raw);
      expect(extracted.high).toBe(210); // Auto-ajustado para max(open, close, high)
      expect(extracted.low).toBe(200);  // Auto-ajustado para min(open, close, low)
      expect(extracted.volume).toBe(1);  // Auto-ajustado para fallback seguro >= 0
    });
  });
});
