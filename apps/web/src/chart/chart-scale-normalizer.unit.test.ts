import { describe, it, expect } from 'vitest';
import type { Candle } from '../api/client';
import type { Tick } from '../feed/protocol';
import {
  normalizeSeedWithTick,
  safeCandleFromTick,
  detectPriceScaleAnomaly,
  calculateSafeCandleBounds,
} from './chart-scale-normalizer';

describe('[SUBETAPA 01] Normalização de Escala, Sementes e Prevenção de Velas Gigantes / Gaps', () => {
  const sampleCandles: Candle[] = [
    { time: 1700000000, open: '1.0800', high: '1.0820', low: '1.0790', close: '1.0810', volume: 50 },
    { time: 1700000060, open: '1.0810', high: '1.0830', low: '1.0805', close: '1.0825', volume: 60 },
    { time: 1700000120, open: '1.0825', high: '1.0840', low: '1.0820', close: '1.0835', volume: 70 },
  ];

  it('NORM-01: Ancoragem Suave: Ajusta a última vela da semente se o primeiro tick real divergir suavemente', () => {
    // O último candle do seed fechou em 1.0835. O primeiro tick real chega em 1.0838.
    const tick: Tick = {
      type: 'tick',
      sequence: 1,
      symbol: 'EURUSD_OTC',
      price: '1.0838',
      ts: new Date(1700000140 * 1000).toISOString(),
    };

    const normalized = normalizeSeedWithTick(sampleCandles, tick);
    expect(normalized).toHaveLength(3);
    const last = normalized[2];
    expect(Number(last.close)).toBeCloseTo(1.0838, 4);
    expect(Number(last.high)).toBeGreaterThanOrEqual(1.0838);
    expect(Number(last.low)).toBeLessThanOrEqual(1.0838);
  });

  it('NORM-02: Prevenção de Vela Gigante: Quando há salto estocástico irracional (>3%), renormaliza toda a semente para o nível de preço real', () => {
    // Semente estava em ~1.08, mas o ativo na verdade está cotado em 1.15 (ou tick real está em 1.15)
    const tick: Tick = {
      type: 'tick',
      sequence: 2,
      symbol: 'EURUSD_OTC',
      price: '1.1500',
      ts: new Date(1700000140 * 1000).toISOString(),
    };

    const normalized = normalizeSeedWithTick(sampleCandles, tick);
    const last = normalized[normalized.length - 1];

    // O último fechamento deve estar alinhado com o tick real sem criar um pavio absurdo
    expect(Number(last.close)).toBeCloseTo(1.1500, 4);
    // A amplitude da vela (high - low) não pode ser o salto absurdo de (1.15 - 1.08) = 0.07!
    const candleSpread = Number(last.high) - Number(last.low);
    expect(candleSpread).toBeLessThan(0.01); // Mantém volatilidade realista
  });

  it('NORM-03: Alinhamento de Gap Temporal: Garante que a semente não deixe um buraco de minutos até o primeiro tick', () => {
    // Tick chega 300 segundos após o último candle
    const futureTick: Tick = {
      type: 'tick',
      sequence: 3,
      symbol: 'EURUSD_OTC',
      price: '1.0840',
      ts: new Date((1700000120 + 300) * 1000).toISOString(),
    };

    const normalized = normalizeSeedWithTick(sampleCandles, futureTick);
    expect(normalized.length).toBeGreaterThanOrEqual(sampleCandles.length);
    const last = normalized[normalized.length - 1];
    expect(Number(last.time)).toBe(1700000120 + 300);
  });

  it('NORM-04: safeCandleFromTick descarta ticks corrompidos, NaN, ou com timestamp invertido', () => {
    const prevCandle = {
      time: 1700000120 as any,
      open: 1.0825,
      high: 1.0840,
      low: 1.0820,
      close: 1.0835,
    };

    // Preço inválido
    expect(safeCandleFromTick({ type: 'tick', sequence: 1, symbol: 'EURUSD_OTC', price: 'NaN', ts: '2026-01-01' }, prevCandle, '1m')).toBeNull();
    expect(safeCandleFromTick({ type: 'tick', sequence: 2, symbol: 'EURUSD_OTC', price: '-10', ts: '2026-01-01' }, prevCandle, '1m')).toBeNull();

    // Timestamp inválido
    expect(safeCandleFromTick({ type: 'tick', sequence: 3, symbol: 'EURUSD_OTC', price: '1.0840', ts: 'invalido' }, prevCandle, '1m')).toBeNull();

    // Timestamp no passado
    expect(safeCandleFromTick({ type: 'tick', sequence: 4, symbol: 'EURUSD_OTC', price: '1.0840', ts: new Date(1600000000 * 1000).toISOString() }, prevCandle, '1m')).toBeNull();
  });

  it('NORM-05: detectPriceScaleAnomaly acusa transição abrupta de ordem de magnitude (ex: BTC 64.000 -> EURUSD 1.08)', () => {
    // Mudança de 64.000 para 1.085 é anomalia de escala extrema
    const isAnomaly = detectPriceScaleAnomaly(64850.0, 1.0854);
    expect(isAnomaly).toBe(true);

    // Variação normal de 1.0850 para 1.0860 NÃO é anomalia
    const isNormal = detectPriceScaleAnomaly(1.0850, 1.0860);
    expect(isNormal).toBe(false);
  });

  it('NORM-06: Teste de Estresse: 5.000 atualizações consecutivas de ticks mantém velas dentro dos limites matemáticos', () => {
    let current = {
      time: 1700000000 as any,
      open: 100.0,
      high: 100.0,
      low: 100.0,
      close: 100.0,
    };

    let price = 100.0;
    for (let i = 1; i <= 5000; i++) {
      const delta = (Math.sin(i) * 0.5);
      price = Math.max(1.0, price + delta);
      const tick: Tick = {
        type: 'tick',
        sequence: i,
        symbol: 'SYNTH_VOL_50',
        price: price.toFixed(4),
        ts: new Date((1700000000 + Math.floor(i / 10)) * 1000).toISOString(),
      };

      const updated = safeCandleFromTick(tick, current, '1m');
      if (updated) {
        current = updated;
        const bounds = calculateSafeCandleBounds(updated);
        expect(bounds.isValid).toBe(true);
        expect(bounds.spreadPercent).toBeLessThan(10); // Nunca explode mais de 10% na mesma vela de 1m
      }
    }
  });
});
