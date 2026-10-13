import { describe, it, expect } from 'vitest';
import { getAssetBasePrice, ASSET_BASE_PRICES } from '../catalog/assets';
import { generateSeedCandles } from '../api/client';
import { safeCandleFromTick, detectPriceScaleAnomaly } from './chart-scale-normalizer';
import type { Tick } from '../feed/protocol';

describe('[SUBETAPA 01 REVISADA] Paridade de Preços Base e Estabilização de Escala Gráfica', () => {
  it('SCALE-01: Paridade Rigorosa: SYNTH_VOL_50 tem preço base exato de 500.1250 idêntico ao backend', () => {
    const basePrice = getAssetBasePrice('SYNTH_VOL_50');
    expect(basePrice).toBe(500.125);
    expect(ASSET_BASE_PRICES['SYNTH_VOL_50']).toBe(500.125);
  });

  it('SCALE-02: Zero Vela Gigante: A semente de 2.880 velas de SYNTH_VOL_50 termina próxima do preço do primeiro tick', () => {
    const candles = generateSeedCandles('SYNTH_VOL_50', 2880);
    expect(candles.length).toBe(2880);
    const lastCandle = candles[candles.length - 1];
    const lastClose = Number(lastCandle.close);

    // O preço final gerado pela semente deve estar na ordem de 500.125 (e NUNCA 1250.0!)
    expect(lastClose).toBeGreaterThan(400.0);
    expect(lastClose).toBeLessThan(650.0);

    // Quando o primeiro tick do backend chega em 500.1250:
    const firstTick: Tick = {
      type: 'tick',
      sequence: 1,
      symbol: 'SYNTH_VOL_50',
      price: '500.1250',
      ts: new Date().toISOString(),
    };

    const prevCandle = {
      time: Math.floor(Date.now() / 60000) * 60 as any,
      open: lastClose,
      high: Number(lastCandle.high),
      low: Number(lastCandle.low),
      close: lastClose,
    };

    const next = safeCandleFromTick(firstTick, prevCandle, '1m');
    expect(next).not.toBeNull();
    // A variação entre o último close da semente e o primeiro tick NÃO pode exceder 30%
    const jumpPercent = Math.abs(Number(next!.close) - lastClose) / lastClose * 100;
    expect(jumpPercent).toBeLessThan(30);
  });

  it('SCALE-03: Reset de Escala: Transição de BTCUSD ($64.850) para EURUSD ($1.0854) é flagrada como anomalia para reset imediato', () => {
    const btcPrice = getAssetBasePrice('BTCUSD_OTC');
    const eurusdPrice = getAssetBasePrice('EURUSD_OTC');

    expect(btcPrice).toBe(64850.0);
    expect(eurusdPrice).toBe(1.08542);

    expect(detectPriceScaleAnomaly(btcPrice, eurusdPrice)).toBe(true);
    expect(detectPriceScaleAnomaly(eurusdPrice, btcPrice)).toBe(true);
  });

  it('SCALE-04: Teste de Estresse de 10.000 Ticks: Mantém integridade das velas OHLC sem desvios absurdos', () => {
    let candle = {
      time: 1700000000 as any,
      open: 500.125,
      high: 500.125,
      low: 500.125,
      close: 500.125,
    };

    let price = 500.125;
    for (let i = 1; i <= 10000; i++) {
      price += (Math.sin(i * 0.1) * 0.05);
      const tick: Tick = {
        type: 'tick',
        sequence: i,
        symbol: 'SYNTH_VOL_50',
        price: price.toFixed(4),
        ts: new Date((1700000000 + Math.floor(i / 10)) * 1000).toISOString(),
      };

      const updated = safeCandleFromTick(tick, candle, '1m');
      if (updated) {
        candle = updated;
        expect(candle.high).toBeGreaterThanOrEqual(candle.low);
        expect(candle.high).toBeGreaterThanOrEqual(candle.open);
        expect(candle.high).toBeGreaterThanOrEqual(candle.close);
        expect(candle.low).toBeLessThanOrEqual(candle.open);
        expect(candle.low).toBeLessThanOrEqual(candle.close);
      }
    }
  }, 15000);
});
