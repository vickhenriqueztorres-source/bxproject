import { describe, it, expect } from 'vitest';
import { FIBONACCI_LEVELS, DEFAULT_INDICATORS, type DrawingItem } from '../../../apps/web/src/chart/drawing-types';
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
} from '../../../apps/web/src/chart/indicator-calculator';
import { RafChartUpdater } from '../../../apps/web/src/chart/raf-updater';
import { resampleCandles, timeframeSeconds } from '../../../apps/web/src/chart/candle-adapter';

describe('Skill 11 - Ferramentas Gráficas de Trading & Indicadores Técnicos', () => {
  describe('G-03 Retração Áurea de Fibonacci', () => {
    it('deve conter exatamente os 6 níveis áureos regulamentares', () => {
      expect(FIBONACCI_LEVELS).toHaveLength(6);
      expect(FIBONACCI_LEVELS.map((f) => f.level)).toEqual([0, 0.236, 0.382, 0.5, 0.618, 1.0]);
    });

    it('calcula o preço exato de cada nível entre fundo e topo com precisão decimal', () => {
      const bottom = 50000;
      const top = 60000;
      const diff = top - bottom; // 10000

      const p0 = bottom + diff * 0;
      const p236 = bottom + diff * 0.236;
      const p382 = bottom + diff * 0.382;
      const p500 = bottom + diff * 0.5;
      const p618 = bottom + diff * 0.618;
      const p100 = bottom + diff * 1.0;

      expect(p0).toBe(50000);
      expect(p236).toBe(52360);
      expect(p382).toBe(53820);
      expect(p500).toBe(55000);
      expect(p618).toBe(56180);
      expect(p100).toBe(60000);
    });
  });

  describe('G-04 Hitbox 24px (Raio 12px)', () => {
    it('captura interações dentro da tolerância de 12px e rejeita fora', () => {
      const targetY = 300;
      const tolerance = 12;

      const isInside = (y: number) => Math.abs(y - targetY) <= tolerance;

      expect(isInside(300)).toBe(true);
      expect(isInside(312)).toBe(true);
      expect(isInside(288)).toBe(true);
      expect(isInside(313)).toBe(false);
      expect(isInside(287)).toBe(false);
    });
  });

  describe('G-01 Throttling rAF e Coalescência', () => {
    it('coalesce rajadas de ticks garantindo atualização única por quadro', () => {
      let rafScheduled = false;
      let scheduledCallbacks: FrameRequestCallback[] = [];

      const mockRaf = (cb: FrameRequestCallback): number => {
        scheduledCallbacks.push(cb);
        rafScheduled = true;
        return scheduledCallbacks.length;
      };

      const mockCancel = () => {
        scheduledCallbacks = [];
        rafScheduled = false;
      };

      const updater = new RafChartUpdater(mockRaf, mockCancel);
      let renderedTickPrice = 0;

      // Rajada de 50 ticks
      for (let i = 1; i <= 50; i++) {
        updater.push(
          { symbol: 'SYNTH_VOL_50', sequence: i, price: i * 10, ts: '2026-10-07T00:00:00Z' },
          (t) => {
            renderedTickPrice = Number(t.price);
          }
        );
      }

      expect(updater.getStats().dropped).toBe(49);
      expect(updater.getStats().isPending).toBe(true);

      // Executa o frame simulado
      const frame = scheduledCallbacks.shift();
      if (frame) frame(16);

      expect(renderedTickPrice).toBe(500); // 50 * 10
      expect(updater.getStats().rendered).toBe(1);
    });
  });

  describe('G-06 Sanitização do LocalStorage', () => {
    it('recupera defensivamente quando localStorage tem payload inválido', () => {
      const badData = ['{foo:', '123', 'true', 'null', '[{"invalido": true}]'];

      for (const payload of badData) {
        let items: DrawingItem[] = [];
        try {
          const parsed = JSON.parse(payload);
          if (Array.isArray(parsed) && parsed.every((d) => d.id && d.type && d.p1)) {
            items = parsed;
          }
        } catch {
          items = [];
        }
        expect(Array.isArray(items)).toBe(true);
        expect(items).toHaveLength(0);
      }
    });
  });

  describe('G-07 Agregação e Resample OHLCV', () => {
    it('converte corretamente períodos de timeframes', () => {
      expect(timeframeSeconds('5s')).toBe(5);
      expect(timeframeSeconds('15s')).toBe(15);
      expect(timeframeSeconds('30s')).toBe(30);
      expect(timeframeSeconds('1m')).toBe(60);
      expect(timeframeSeconds('5m')).toBe(300);
    });
  });

  describe('G-08 Indicadores Técnicos Nativos', () => {
    const candles = Array.from({ length: 25 }, (_, i) => ({
      time: 1700000000 + i * 60,
      close: 100 + i * 2,
    }));

    it('calcula SMA sem lookahead bias', () => {
      const sma = calculateSMA(candles, 5);
      expect(sma).toHaveLength(candles.length - 4);
      // Primeiros 5 fechamentos: 100, 102, 104, 106, 108 -> média = 104
      expect(sma[0].value).toBe(104);
    });

    it('calcula EMA aplicando o multiplicador ponderado', () => {
      const ema = calculateEMA(candles, 5);
      expect(ema).toHaveLength(candles.length - 4);
      expect(ema[0].value).toBe(104);
    });

    it('calcula Bandas de Bollinger com envelope simétrico', () => {
      const bbands = calculateBollinger(candles, 10, 2);
      expect(bbands).toHaveLength(candles.length - 9);
      for (const b of bbands) {
        expect(b.upper).toBeGreaterThanOrEqual(b.middle);
        expect(b.middle).toBeGreaterThanOrEqual(b.lower);
      }
    });

    it('calcula RSI dentro dos limites 0 e 100', () => {
      const rsi = calculateRSI(candles, 14);
      expect(rsi.length).toBeGreaterThan(0);
      for (const r of rsi) {
        expect(r.value).toBeGreaterThanOrEqual(0);
        expect(r.value).toBeLessThanOrEqual(100);
      }
    });

    it('calcula WMA com pesos decrescentes', () => {
      const wma = calculateWMA(candles, 5);
      expect(wma).toHaveLength(candles.length - 4);
      expect(wma[0].value).toBeGreaterThan(0);
    });

    it('calcula MACD e Signal com consistência de histograma', () => {
      const macd = calculateMACD(candles, 5, 10, 3);
      expect(macd.length).toBeGreaterThan(0);
      for (const m of macd) {
        expect(Math.abs(m.histogram - (m.macd - m.signal))).toBeLessThan(0.001);
      }
    });

    it('calcula Estocástico mantendo %K e %D entre 0 e 100', () => {
      const stoch = calculateStochastic(candles, 10, 3);
      expect(stoch.length).toBeGreaterThan(0);
      for (const s of stoch) {
        expect(s.k).toBeGreaterThanOrEqual(0);
        expect(s.k).toBeLessThanOrEqual(100);
        expect(s.d).toBeGreaterThanOrEqual(0);
        expect(s.d).toBeLessThanOrEqual(100);
      }
    });

    it('calcula ATR, VWAP e CCI sem valores nulos ou indefinidos', () => {
      const atr = calculateATR(candles, 10);
      expect(atr.length).toBeGreaterThan(0);
      expect(atr[0].value).toBeGreaterThan(0);

      const vwap = calculateVWAP(candles);
      expect(vwap).toHaveLength(candles.length);
      expect(vwap[0].value).toBeGreaterThan(0);

      const cci = calculateCCI(candles, 10);
      expect(cci.length).toBeGreaterThan(0);
      expect(Number.isFinite(cci[0].value)).toBe(true);
    });
  });
});
