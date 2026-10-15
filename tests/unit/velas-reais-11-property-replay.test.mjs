import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  bucketStartTime,
  aggregateCandlesToInterval,
  aggregateTicksToCandles,
  applyTickToCandleBuffer,
  reconcileServerAndClientCandle,
  scaleOuParamsForFrequency,
} from '../../scripts/lib/candle-aggregation-engine.mjs';
import {
  computeNextAlignedSlot,
  createAlignedTickScheduler,
} from '../../scripts/lib/aligned-tick-scheduler.mjs';

describe('Relatório #11 — Velas Reais (5s/15s/30s), Frequência de Tick e Abertura da Vela', () => {
  it('1. Regra única de vela: open = primeiro tick do período (nunca prevClose) e período sem tick não gera vela', () => {
    const ticks = [
      { ts: 1700000000000, price: 100.0, sequence: 1 },
      { ts: 1700000002000, price: 105.5, sequence: 2 },
      { ts: 1700000004000, price: 102.25, sequence: 3 },
      // Período [1700000005, 1700000010) SEM TICKS -> não deve gerar vela!
      // Período [1700000010, 1700000015) abre com salto em 110.00 (diferente do prevClose 102.25)
      { ts: 1700000011000, price: 110.0, sequence: 4 },
      { ts: 1700000014000, price: 108.0, sequence: 5 },
    ];

    const candles5s = aggregateTicksToCandles(ticks, 5, 2);
    assert.equal(candles5s.length, 2, 'Período vazio [05..10) não pode virar vela');

    assert.equal(candles5s[0].time, 1700000000);
    assert.equal(candles5s[0].open, '100.00');
    assert.equal(candles5s[0].high, '105.50');
    assert.equal(candles5s[0].low, '100.00');
    assert.equal(candles5s[0].close, '102.25');
    assert.equal(candles5s[0].volume, 3);
    assert.equal(candles5s[0].last_sequence, 3);
    assert.equal(candles5s[0].source, 'ticks');

    assert.equal(candles5s[1].time, 1700000010);
    assert.equal(candles5s[1].open, '110.00', 'open deve ser o primeiro tick do período (110.00), nunca prevClose (102.25)');
    assert.equal(candles5s[1].high, '110.00');
    assert.equal(candles5s[1].low, '108.00');
    assert.equal(candles5s[1].close, '108.00');
    assert.equal(candles5s[1].volume, 2);
    assert.equal(candles5s[1].last_sequence, 5);
    assert.equal(candles5s[1].source, 'ticks');
  });

  it('2. Property-Based Test (100 sequências CSPRNG): somar 5s -> 15s/30s/1m === agregar direto dos ticks (diff = 0)', () => {
    const baseEpochMs = 1700000400000; // divisível por 60s

    for (let run = 0; run < 100; run++) {
      const ticks = [];
      let price = 1000 + crypto.randomInt(-200, 201);
      let seq = 1;

      // Gera até 180 segundos de ticks com possíveis buracos (períodos sem tick)
      for (let sec = 0; sec < 180; sec++) {
        // 15% de chance de pular o segundo para testar janelas esparsas e buracos
        if (crypto.randomInt(0, 100) < 15) continue;
        const delta = (crypto.randomInt(-500, 501)) / 100;
        price = Math.max(10, Number((price + delta).toFixed(2)));
        ticks.push({
          ts: baseEpochMs + sec * 1000,
          price,
          sequence: seq++,
        });
      }

      if (ticks.length === 0) continue;

      const candles5s = aggregateTicksToCandles(ticks, 5, 2);

      for (const targetStep of [15, 30, 60]) {
        const from5s = aggregateCandlesToInterval(candles5s, targetStep, 2, 5);
        const directFromTicks = aggregateTicksToCandles(ticks, targetStep, 2);

        assert.equal(
          from5s.length,
          directFromTicks.length,
          `Run #${run} (${targetStep}s): quantidade de velas deve ser idêntica`
        );

        for (let i = 0; i < directFromTicks.length; i++) {
          assert.equal(from5s[i].time, directFromTicks[i].time, `Run #${run} (${targetStep}s) [${i}] time`);
          assert.equal(from5s[i].open, directFromTicks[i].open, `Run #${run} (${targetStep}s) [${i}] open`);
          assert.equal(from5s[i].high, directFromTicks[i].high, `Run #${run} (${targetStep}s) [${i}] high`);
          assert.equal(from5s[i].low, directFromTicks[i].low, `Run #${run} (${targetStep}s) [${i}] low`);
          assert.equal(from5s[i].close, directFromTicks[i].close, `Run #${run} (${targetStep}s) [${i}] close`);
          assert.equal(from5s[i].volume, directFromTicks[i].volume, `Run #${run} (${targetStep}s) [${i}] volume`);
          assert.equal(
            from5s[i].last_sequence,
            directFromTicks[i].last_sequence,
            `Run #${run} (${targetStep}s) [${i}] last_sequence`
          );
          assert.equal(from5s[i].source, 'ticks');
        }
      }
    }
  });

  it('3. Replay de 1 hora (3.600 ticks a 1 Hz alinhados): 720 velas 5s (5 ticks/vela) e diff = 0 servidor x rebuild', () => {
    const startEpochSec = 1700002800; // alinhado a 3600s
    const liveBuffer5s = [];
    const allTicks = [];
    let currentPrice = 500.0;

    for (let i = 0; i < 3600; i++) {
      const timeSec = startEpochSec + i;
      const stepDelta = ((i % 7) - 3) * 0.15;
      currentPrice = Math.max(10, Number((currentPrice + stepDelta).toFixed(2)));
      const priceStr = currentPrice.toFixed(2);
      const sequence = i + 1;

      allTicks.push({
        ts: timeSec * 1000,
        price: priceStr,
        sequence,
      });

      applyTickToCandleBuffer(liveBuffer5s, {
        timeSec,
        priceStr,
        precision: 2,
        sequence,
        stepSec: 5,
        maxBufferSize: 2000,
        provenance: 'official',
      });
    }

    assert.equal(liveBuffer5s.length, 720, '1 hora a 1 Hz deve produzir exatamente 720 velas de 5s');
    for (const bar of liveBuffer5s) {
      assert.equal(bar.volume, 5, 'Cada vela de 5s a 1 Hz alinhado deve conter exatamente 5 ticks');
      assert.equal(bar.source, 'ticks');
      assert.ok(Number.isFinite(bar.last_sequence));
    }

    const rebuild5s = aggregateTicksToCandles(allTicks, 5, 2);
    assert.deepEqual(
      liveBuffer5s.map(({ time, open, high, low, close, volume, last_sequence, source }) => ({
        time,
        open,
        high,
        low,
        close,
        volume,
        last_sequence,
        source,
      })),
      rebuild5s.map(({ time, open, high, low, close, volume, last_sequence, source }) => ({
        time,
        open,
        high,
        low,
        close,
        volume,
        last_sequence,
        source,
      })),
      'Servidor (buffer circular 5s) e rebuild direto dos ticks devem ter diff = 0'
    );

    const derived15s = aggregateCandlesToInterval(liveBuffer5s, 15, 2, 5);
    const derived30s = aggregateCandlesToInterval(liveBuffer5s, 30, 2, 5);
    const derived1m = aggregateCandlesToInterval(liveBuffer5s, 60, 2, 5);

    assert.equal(derived15s.length, 240);
    assert.equal(derived30s.length, 120);
    assert.equal(derived1m.length, 60);
    assert.ok(derived15s.every((c) => c.volume === 15 && c.source === 'ticks'));
    assert.ok(derived30s.every((c) => c.volume === 30 && c.source === 'ticks'));
    assert.ok(derived1m.every((c) => c.volume === 60 && c.source === 'ticks'));
  });

  it('4. Reconciliação Servidor × Cliente por last_sequence: vela fechada usa servidor; vela aberta reconcilia high/low/close', () => {
    const serverClosed = {
      time: 1700000000,
      open: 100,
      high: 108,
      low: 99,
      close: 105,
      volume: 5,
      last_sequence: 10,
      source: 'ticks',
    };
    const clientClosedDivergent = {
      time: 1700000000,
      open: 101,
      high: 112,
      low: 95,
      close: 109,
      volume: 3,
      last_sequence: 12,
      source: 'ticks',
    };

    // Em vela fechada (isClosed = true), vale SEMPRE a do servidor e reporta mismatch
    const reconciledClosed = reconcileServerAndClientCandle(serverClosed, clientClosedDivergent, true);
    assert.deepEqual(reconciledClosed.merged, serverClosed);
    assert.equal(reconciledClosed.mismatch, true);

    // Na vela aberta (isClosed = false), se o cliente já recebeu o tick seq=16 e o REST do servidor veio no seq=14:
    const serverOpen = {
      time: 1700000005,
      open: 105,
      high: 109,
      low: 103, // servidor viu mínima 103 que o cliente perdeu
      close: 106,
      volume: 3,
      last_sequence: 14,
      source: 'ticks',
    };
    const clientOpenNewer = {
      time: 1700000005,
      open: 105,
      high: 111, // cliente viu máxima 111 no tick seq=16
      low: 104,
      close: 110.5,
      volume: 4,
      last_sequence: 16,
      source: 'ticks',
    };

    const reconciledOpen = reconcileServerAndClientCandle(serverOpen, clientOpenNewer, false);
    assert.equal(reconciledOpen.merged.open, 105);
    assert.equal(reconciledOpen.merged.high, 111, 'high deve ser max(servidor, cliente)');
    assert.equal(reconciledOpen.merged.low, 103, 'low deve ser min(servidor, cliente)');
    assert.equal(reconciledOpen.merged.close, 110.5, 'close deve vir do lado com sequence maior (cliente seq=16 > servidor seq=14)');
    assert.equal(reconciledOpen.merged.last_sequence, 16);

    // E quando o servidor tem sequence maior que o cliente (cliente perdeu último tick):
    const reconciledServerAhead = reconcileServerAndClientCandle(
      { ...serverOpen, close: 107.25, last_sequence: 18 },
      clientOpenNewer,
      false
    );
    assert.equal(reconciledServerAhead.merged.close, 107.25, 'close deve vir do servidor quando seq do servidor é maior');
    assert.equal(reconciledServerAhead.merged.last_sequence, 18);
  });

  it('5. Risco 1 — Calibração Ornstein-Uhlenbeck 1 Hz vs 4 Hz (250ms): sigma/2 e theta escalado preservam variância por minuto', () => {
    const baseSigma = 0.002;
    const baseTheta = 0.004;
    const scaled = scaleOuParamsForFrequency(baseSigma, baseTheta, 1, 4);

    assert.ok(Math.abs(scaled.sigma - baseSigma / 2) < 1e-12, 'A 4 Hz (250ms), sigma deve ser exatamente sigma/2');
    const expectedTheta = 1 - Math.pow(1 - baseTheta, 0.25);
    assert.ok(Math.abs(scaled.theta - expectedTheta) < 1e-12, 'theta deve seguir 1 - (1 - theta_0)^0.25');
    assert.ok(Math.abs(scaled.theta - 0.001) < 0.00001, 'theta a 4 Hz deve ser ~0.001');

    // Verifica algebricamente que 4 passos de 250ms têm a mesma taxa de decaimento de reversão à média que 1 passo de 1s:
    const retention1s = 1 - baseTheta;
    const retention4x250ms = Math.pow(1 - scaled.theta, 4);
    assert.ok(Math.abs(retention1s - retention4x250ms) < 1e-12);
  });

  it('6. Caos — Event-loop stall (3.5s) e Clock Skew (-800ms): pula slots sem rajada falsa e preserva monotonia', async () => {
    // 1. Stall de 3500ms: lastSlotSec = 1000, nowMs = 1003500 -> slots 1001 e 1002 foram perdidos; avança para slot 1003 sem rajada
    const jump = computeNextAlignedSlot(1003500, 1000, 1000);
    assert.equal(jump.effectiveSlotSec, 1003);
    assert.equal(jump.slotBoundaryMs, 1003000);
    assert.equal(jump.missedSlots, 2);
    assert.equal(jump.isClockSkew, false);

    // 2. Clock skew negativo de -800ms (NTP step back): lastSlotSec = 1000, nowMs = 999200 -> avança monotonicamente para 1001
    const skew = computeNextAlignedSlot(999200, 1000, 1000);
    assert.equal(skew.isClockSkew, true);
    assert.equal(skew.effectiveSlotSec, 1001);
    assert.equal(skew.slotBoundaryMs, 1001000);
    assert.equal(skew.missedSlots, 0);
  });
});
