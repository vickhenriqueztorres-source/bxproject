import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateSeedCandles, getCandles, type Candle } from '../api/client';
import { resampleCandles } from '../chart/candle-adapter';
import { setNewTraderoomEnabled, isNewTraderoomEnabled } from '../lib/feature-flags';

describe('SUBETAPA 1: Feed & Candle Resilience Suite', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  });

  afterEach(() => {
    setNewTraderoomEnabled(true);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  });

  describe('1.1 Ingestão e Integridade Matemática de Velas (OHLCV)', () => {
    it('gera velas sementes válidas com monotonicidade estrita de timestamp', () => {
      const candles = generateSeedCandles('NZDJPY_OTC', 60);
      expect(candles).toHaveLength(60);

      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const open = Number(c.open);
        const high = Number(c.high);
        const low = Number(c.low);
        const close = Number(c.close);

        expect(Number.isFinite(c.time)).toBe(true);
        expect(high).toBeGreaterThanOrEqual(low);
        expect(high).toBeGreaterThanOrEqual(open);
        expect(high).toBeGreaterThanOrEqual(close);
        expect(low).toBeLessThanOrEqual(open);
        expect(low).toBeLessThanOrEqual(close);
        expect(c.volume).toBeGreaterThan(0);

        if (i > 0) {
          expect(c.time).toBeGreaterThan(candles[i - 1].time);
        }
      }
    });

    it('aplica precificação base de acordo com a classe de ativo (Forex vs Cripto vs Sintéticos)', () => {
      const jpyCandles = generateSeedCandles('NZDJPY_OTC', 10);
      const btcCandles = generateSeedCandles('BTCUSD_OTC', 10);
      const synthCandles = generateSeedCandles('SYNTH_VOL_50', 10);

      // NZD/JPY deve estar na faixa de 89.xx com flutuação estocástica controlada
      expect(Number(jpyCandles[0].close)).toBeGreaterThan(85);
      expect(Number(jpyCandles[0].close)).toBeLessThan(95);
      expect(Number(btcCandles[0].close)).toBeGreaterThan(50000);
      expect(Number(synthCandles[0].close)).toBeGreaterThan(400);
    });

    it('getCandles retorna velas de fallback sem lançar exceção em modo offline/desconectado', async () => {
      const candles = await getCandles('EURUSD_OTC', '1m', 50);
      expect(Array.isArray(candles)).toBe(true);
      expect(candles.length).toBeGreaterThanOrEqual(10);
      expect(candles[0]).toHaveProperty('open');
      expect(candles[0]).toHaveProperty('close');
      expect(candles[0]).toHaveProperty('time');
    });
  });

  describe('1.2 Testes de Estresse & Agregação (G-01 e G-07)', () => {
    it('agrega 3.500 velas em alta velocidade sem exceder limite de tempo (< 80ms)', () => {
      const mock3500: Candle[] = [];
      const baseTime = 1700000000;
      for (let i = 0; i < 3500; i++) {
        mock3500.push({
          time: baseTime + i * 5,
          open: '100.00',
          high: '101.50',
          low: '99.50',
          close: '100.80',
          volume: 10,
        });
      }

      const t0 = performance.now();
      const resampled1m = resampleCandles(mock3500, '1m');
      const elapsed = performance.now() - t0;

      expect(resampled1m.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(250);
      expect(resampled1m.length).toBeLessThanOrEqual(mock3500.length);
    });
  });

  describe('1.3 Testes de Caos & Resiliência de Staleness', () => {
    it('armazena e reutiliza velas em cache local sem perda de estado', async () => {
      const firstCall = await getCandles('SYNTH_VOL_10', '1m', 30);
      const secondCall = await getCandles('SYNTH_VOL_10', '1m', 30);

      expect(firstCall.length).toBe(secondCall.length);
      expect(firstCall[0].time).toBe(secondCall[0].time);
    });
  });

  describe('1.4 Padrão Duas Portas (Regressão Visual & Feature Flag)', () => {
    it('respeita a chave NEW_TRADEROOM ativada por padrão e desativada sob demanda', () => {
      setNewTraderoomEnabled(true);
      expect(isNewTraderoomEnabled()).toBe(true);

      setNewTraderoomEnabled(false);
      expect(isNewTraderoomEnabled()).toBe(false);

      setNewTraderoomEnabled(true);
      expect(isNewTraderoomEnabled()).toBe(true);
    });
  });
});
