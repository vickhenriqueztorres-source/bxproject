import { describe, it, expect } from 'vitest';
import {
  bucketStartTime,
  applyTick,
  buildCandlesFromTicks,
  aggregateSubCandles,
  reconcileServerAndClientCandle,
  scaleOuParamsForFrequency,
} from '../../packages/shared/src/candles';
import { candleData, resampleCandles } from '../../apps/web/src/chart/candle-adapter';
import { mergeObservedCandles, safeCandleFromTick } from '../../apps/web/src/chart/chart-scale-normalizer';

describe('Relatório #11 — @broker/shared & Frontend Candle Reconciliation (Vitest)', () => {
  it('1. @broker/shared/candles: buildCandlesFromTicks + aggregateSubCandles produzem resultado idêntico a agregar ticks direto', () => {
    const ticks = [
      { ts: 1700000000000, price: 100.0, sequence: 10 },
      { ts: 1700000001000, price: 102.0, sequence: 11 },
      { ts: 1700000004000, price: 101.0, sequence: 12 },
      // buraco em [05..10) -> não gera vela
      { ts: 1700000010000, price: 105.0, sequence: 13 },
      { ts: 1700000014000, price: 104.0, sequence: 14 },
    ];

    const c5s = buildCandlesFromTicks(ticks, 5);
    expect(c5s).toHaveLength(2);
    expect(c5s[0]).toEqual({
      time: 1700000000,
      open: 100,
      high: 102,
      low: 100,
      close: 101,
      volume: 3,
      last_sequence: 12,
      source: 'ticks',
    });
    expect(c5s[1]).toEqual({
      time: 1700000010,
      open: 105, // open = primeiro tick do período, nunca prevClose (101)
      high: 105,
      low: 104,
      close: 104,
      volume: 2,
      last_sequence: 14,
      source: 'ticks',
    });

    const c15sFrom5s = aggregateSubCandles(c5s, 15);
    const c15sDirect = buildCandlesFromTicks(ticks, 15);
    expect(c15sFrom5s).toEqual(c15sDirect);
    expect(c15sFrom5s[c15sFrom5s.length - 1].last_sequence).toBe(14);
    expect(c15sFrom5s[0].source).toBe('ticks');
  });

  it('2. applyTick e scaleOuParamsForFrequency funcionam determinísticamente em @broker/shared', () => {
    const first = applyTick(null, { ts: 1700000001000, price: 50.25, sequence: 1 }, 5);
    expect(first.time).toBe(1700000000);
    expect(first.open).toBe(50.25);
    expect(first.last_sequence).toBe(1);

    const second = applyTick(first, { ts: 1700000003000, price: 52.75, sequence: 2 }, 5);
    expect(second.open).toBe(50.25);
    expect(second.high).toBe(52.75);
    expect(second.close).toBe(52.75);
    expect(second.volume).toBe(2);
    expect(second.last_sequence).toBe(2);

    const ou4Hz = scaleOuParamsForFrequency(0.002, 0.004, 250);
    expect(ou4Hz.sigma).toBeCloseTo(0.001, 10);
    expect(ou4Hz.theta).toBeCloseTo(1 - Math.pow(1 - 0.004, 0.25), 10);
  });

  it('3. candle-adapter e chart-scale-normalizer preservam last_sequence e reconciliam vela aberta pelo maior sequence', () => {
    const rawServerCandles = [
      {
        time: 1700000000,
        open: '100.00',
        high: '105.00',
        low: '99.00',
        close: '102.00',
        volume: 5,
        last_sequence: 100,
        source: 'ticks',
      },
      {
        time: 1700000005,
        open: '102.50',
        high: '106.00',
        low: '101.00',
        close: '103.00',
        volume: 3,
        last_sequence: 103,
        source: 'ticks',
      },
    ];

    const adapted = rawServerCandles.map(candleData);
    expect(adapted).toHaveLength(2);
    expect(adapted[1].last_sequence).toBe(103);
    expect(adapted[1].source).toBe('ticks');

    // Simula observedBars no cliente onde a vela fechada (1700000000) divergiu, e a vela aberta (1700000005) tem sequence maior (105)
    const clientTick = safeCandleFromTick(
      { symbol: 'R_100', price: '102.50', ts: 1700000005000, sequence: 104 } as any,
      null,
      '5s'
    );
    const clientUpdated = safeCandleFromTick(
      { symbol: 'R_100', price: '108.00', ts: 1700000008000, sequence: 105 } as any,
      clientTick,
      '5s'
    );
    expect(clientUpdated?.last_sequence).toBe(105);

    const observedBars = [
      {
        time: 1700000000 as any,
        open: 98,
        high: 110,
        low: 95,
        close: 109,
        last_sequence: 99,
        source: 'ticks',
      },
      clientUpdated!,
    ];

    const merged = mergeObservedCandles(adapted, observedBars);
    expect(merged).toHaveLength(2);

    // Vela fechada (1700000000): vale SEMPRE a do servidor
    expect(merged[0].open).toBe(100);
    expect(merged[0].high).toBe(105);
    expect(merged[0].low).toBe(99);
    expect(merged[0].close).toBe(102);

    // Vela corrente (1700000005): open do servidor (102.5), high = max(106, 108) = 108, low = min(101, 102.5) = 101,
    // close vem do cliente (108) porque client.last_sequence (105) > server.last_sequence (103)
    expect(merged[1].open).toBe(102.5);
    expect(merged[1].high).toBe(108);
    expect(merged[1].low).toBe(101);
    expect(merged[1].close).toBe(108);
    expect((merged[1] as any).last_sequence).toBe(105);

    // Se o servidor tiver sequence maior (ex: 109 > 105), close deve vir do servidor (103.75):
    const adaptedServerAhead = [
      rawServerCandles[0],
      { ...rawServerCandles[1], last_sequence: 109, close: '103.75' },
    ].map(candleData);
    const mergedServerAhead = mergeObservedCandles(adaptedServerAhead, observedBars);
    expect(mergedServerAhead[1].close).toBe(103.75);
    expect(mergedServerAhead[1].high).toBe(108);
    expect(mergedServerAhead[1].low).toBe(101);
    expect((mergedServerAhead[1] as any).last_sequence).toBe(109);
  });
});
