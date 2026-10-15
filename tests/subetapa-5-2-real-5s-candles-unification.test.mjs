/**
 * Testes de Validação - Subetapa 5.2: Buffer Circular de Velas de 5s Reais,
 * Derivação Exata (15s/30s/1m) e Unificação da Regra de Abertura (open = primeiro tick)
 *
 * Invariantes validadas:
 * - M-01 (Integridade de Série Temporal e Ordenação Monotônica)
 * - M-05 (Regra Única de OHLCV: open=1º tick, high=max, low=min, close=último)
 * - G-01 (Preservação de invariantes matemáticas OHLCV: high >= max(open, close), low <= min(open, close))
 * - G-08 (Zero vazamento de memória e limite rígido de buffer circular)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateCandlesToInterval,
  applyTickToCandleBuffer,
  createCandleAggregationCache,
} from '../scripts/lib/candle-aggregation-engine.mjs';

describe('Subetapa 5.2 - Buffer Circular de 5s e Unificação de Abertura OHLCV', () => {

  it('deve aplicar regra única de abertura (open = primeiro tick do período) e atualizar high/low/close/volume', () => {
    const candles5s = [];
    const baseSec = 1710000000; // Alinhado a 5s

    // Tick 1: Primeiro tick do bucket 1710000000 (deve definir open)
    applyTickToCandleBuffer(candles5s, {
      timeSec: baseSec + 0,
      priceStr: '100.5000',
      precision: 4,
      sequence: 1,
      stepSec: 5,
      maxBufferSize: 3600,
    });

    assert.equal(candles5s.length, 1);
    assert.equal(candles5s[0].time, baseSec);
    assert.equal(candles5s[0].open, '100.5000');
    assert.equal(candles5s[0].high, '100.5000');
    assert.equal(candles5s[0].low, '100.5000');
    assert.equal(candles5s[0].close, '100.5000');
    assert.equal(candles5s[0].volume, 1);
    assert.equal(candles5s[0].last_sequence, 1);

    // Tick 2: Máxima temporária
    applyTickToCandleBuffer(candles5s, {
      timeSec: baseSec + 1,
      priceStr: '102.0000',
      precision: 4,
      sequence: 2,
      stepSec: 5,
      maxBufferSize: 3600,
    });

    assert.equal(candles5s.length, 1);
    assert.equal(candles5s[0].open, '100.5000', 'Open NÃO pode mudar com novos ticks');
    assert.equal(candles5s[0].high, '102.0000');
    assert.equal(candles5s[0].low, '100.5000');
    assert.equal(candles5s[0].close, '102.0000');
    assert.equal(candles5s[0].volume, 2);

    // Tick 3: Mínima temporária
    applyTickToCandleBuffer(candles5s, {
      timeSec: baseSec + 2,
      priceStr: '98.5000',
      precision: 4,
      sequence: 3,
      stepSec: 5,
      maxBufferSize: 3600,
    });

    assert.equal(candles5s.length, 1);
    assert.equal(candles5s[0].open, '100.5000');
    assert.equal(candles5s[0].high, '102.0000');
    assert.equal(candles5s[0].low, '98.5000');
    assert.equal(candles5s[0].close, '98.5000');
    assert.equal(candles5s[0].volume, 3);

    // Tick 4 & 5: Fechamento do bucket de 5s
    applyTickToCandleBuffer(candles5s, {
      timeSec: baseSec + 3,
      priceStr: '101.2000',
      precision: 4,
      sequence: 4,
      stepSec: 5,
      maxBufferSize: 3600,
    });
    applyTickToCandleBuffer(candles5s, {
      timeSec: baseSec + 4,
      priceStr: '99.9000',
      precision: 4,
      sequence: 5,
      stepSec: 5,
      maxBufferSize: 3600,
    });

    assert.equal(candles5s.length, 1);
    const bar = candles5s[0];
    assert.equal(bar.time, baseSec);
    assert.equal(bar.open, '100.5000', 'Open é estritamente o 1º tick');
    assert.equal(bar.high, '102.0000', 'High é o valor máximo atingido');
    assert.equal(bar.low, '98.5000', 'Low é o valor mínimo atingido');
    assert.equal(bar.close, '99.9000', 'Close é o último tick recebido');
    assert.equal(bar.volume, 5, 'Volume é exatamente a contagem de ticks no bucket');
    assert.equal(bar.last_sequence, 5);

    // Tick 6: Entra no próximo bucket de 5s (baseSec + 5)
    applyTickToCandleBuffer(candles5s, {
      timeSec: baseSec + 5,
      priceStr: '101.0000',
      precision: 4,
      sequence: 6,
      stepSec: 5,
      maxBufferSize: 3600,
    });

    assert.equal(candles5s.length, 2);
    assert.equal(candles5s[1].time, baseSec + 5);
    assert.equal(candles5s[1].open, '101.0000', 'Novo bucket inicia com seu próprio primeiro tick');
    assert.equal(candles5s[1].volume, 1);
  });

  it('deve respeitar a capacidade máxima do buffer circular sem vazamento de memória', () => {
    const candles5s = [];
    const maxCapacity = 50;
    const baseSec = 1710000000;

    for (let i = 0; i < 100; i++) {
      applyTickToCandleBuffer(candles5s, {
        timeSec: baseSec + (i * 5),
        priceStr: (100 + i * 0.1).toFixed(4),
        precision: 4,
        sequence: i + 1,
        stepSec: 5,
        maxBufferSize: maxCapacity,
      });
    }

    assert.equal(candles5s.length, maxCapacity, 'Buffer deve manter estritamente a capacidade máxima');
    assert.equal(candles5s[0].time, baseSec + (50 * 5), 'Primeiro item deve ser o corte de 50 barras atrás');
    assert.equal(candles5s[candles5s.length - 1].time, baseSec + (99 * 5));

    // Monotonicidade estrita
    for (let i = 1; i < candles5s.length; i++) {
      assert(candles5s[i].time > candles5s[i - 1].time, 'Timestamps devem ser estritamente crescentes');
    }
  });

  it('deve derivar com exatidão matemática 15s, 30s e 1m a partir do buffer de 5s (Property-based test)', () => {
    const candles5s = [];
    const baseSec = 1710000000; // Alinhado a 60s
    let currentPrice = 100.0;
    const TOTAL_TICKS = 600; // 600 segundos = 10 minutos = 120 velas de 5s

    // Simula 600 ticks a 1 Hz
    for (let sec = 0; sec < TOTAL_TICKS; sec++) {
      const delta = (Math.sin(sec / 10) * 0.2) + ((sec % 7 === 0) ? -0.15 : 0.08);
      currentPrice += delta;
      applyTickToCandleBuffer(candles5s, {
        timeSec: baseSec + sec,
        priceStr: currentPrice.toFixed(4),
        precision: 4,
        sequence: sec + 1,
        stepSec: 5,
        maxBufferSize: 3600,
      });
    }

    assert.equal(candles5s.length, 120, '600 ticks a 1 Hz devem gerar exatamente 120 velas de 5s');

    // Derivação para 15s
    const candles15s = aggregateCandlesToInterval(candles5s, 15);
    assert.equal(candles15s.length, 40, '120 velas de 5s devem gerar exatamente 40 velas de 15s');

    // Derivação para 30s
    const candles30s = aggregateCandlesToInterval(candles5s, 30);
    assert.equal(candles30s.length, 20, '120 velas de 5s devem gerar exatamente 20 velas de 30s');

    // Derivação para 60s (1m)
    const candles1m = aggregateCandlesToInterval(candles5s, 60);
    assert.equal(candles1m.length, 10, '120 velas de 5s devem gerar exatamente 10 velas de 1m');

    // Verificação de Invariantes em TODAS as velas derivadas
    for (const bar of [...candles5s, ...candles15s, ...candles30s, ...candles1m]) {
      const o = parseFloat(bar.open);
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      const c = parseFloat(bar.close);

      assert(h >= Math.max(o, c) - 1e-6, `High (${h}) deve ser >= max(open=${o}, close=${c})`);
      assert(l <= Math.min(o, c) + 1e-6, `Low (${l}) deve ser <= min(open=${o}, close=${c})`);
    }

    // Verificação de soma de volume e correspondência exata de pontas (open do primeiro 5s === open do 15s)
    for (let i = 0; i < candles15s.length; i++) {
      const bar15 = candles15s[i];
      const slice5s = candles5s.slice(i * 3, (i + 1) * 3);

      assert.equal(bar15.open, slice5s[0].open, 'Open da vela de 15s deve ser igual ao open da primeira vela de 5s');
      assert.equal(bar15.close, slice5s[2].close, 'Close da vela de 15s deve ser igual ao close da terceira vela de 5s');
      const expectedVol = slice5s.reduce((acc, b) => acc + b.volume, 0);
      assert.equal(bar15.volume, expectedVol, 'Volume de 15s deve ser a soma exata dos volumes de 5s');
    }

    // Verificação equivalente para 1m
    for (let i = 0; i < candles1m.length; i++) {
      const bar1m = candles1m[i];
      const slice5s = candles5s.slice(i * 12, (i + 1) * 12);

      assert.equal(bar1m.open, slice5s[0].open, 'Open da vela de 1m deve ser igual ao open da primeira vela de 5s');
      assert.equal(bar1m.close, slice5s[11].close, 'Close da vela de 1m deve ser igual ao close da 12ª vela de 5s');
      const expectedVol = slice5s.reduce((acc, b) => acc + b.volume, 0);
      assert.equal(bar1m.volume, expectedVol, 'Volume de 1m deve ser a soma exata das 12 velas de 5s');
    }
  });

  it('deve utilizar cache O(1) de agregação e invalidar automaticamente ao receber novos ticks', () => {
    const cacheEngine = createCandleAggregationCache({ ttlMs: 2000, maxEntries: 100 });
    const candles5s = [];
    const baseSec = 1710000000;

    for (let i = 0; i < 15; i++) {
      applyTickToCandleBuffer(candles5s, {
        timeSec: baseSec + i,
        priceStr: (100 + i).toFixed(4),
        precision: 4,
        sequence: i + 1,
        stepSec: 5,
      });
    }

    // 1ª chamada: Cache Miss
    const res1 = cacheEngine.getAggregatedCandles({
      symbol: 'VOL_50:5s_base',
      baseBars: candles5s,
      intervalSec: 15,
    });
    assert.equal(cacheEngine.telemetry.cacheHitsTotal, 0);
    assert.equal(cacheEngine.telemetry.cacheMissesTotal, 1);
    assert.equal(res1.length, 1);

    // 2ª chamada idêntica: Cache Hit
    const res2 = cacheEngine.getAggregatedCandles({
      symbol: 'VOL_50:5s_base',
      baseBars: candles5s,
      intervalSec: 15,
    });
    assert.equal(cacheEngine.telemetry.cacheHitsTotal, 1);
    assert.equal(res2, res1, 'Deve retornar a mesma referência cacheada');

    // Novo tick adicionado altera a assinatura do buffer
    applyTickToCandleBuffer(candles5s, {
      timeSec: baseSec + 15,
      priceStr: '120.0000',
      precision: 4,
      sequence: 16,
      stepSec: 5,
    });

    // 3ª chamada: Assinatura mudou -> Invalidação automática -> Cache Miss
    const res3 = cacheEngine.getAggregatedCandles({
      symbol: 'VOL_50:5s_base',
      baseBars: candles5s,
      intervalSec: 15,
    });
    assert.equal(cacheEngine.telemetry.cacheMissesTotal, 2);
    assert.equal(res3.length, 2, 'Agora deve ter 2 barras de 15s');
  });

  it('não deve fabricar velas em períodos de silêncio/gap (sem ticks)', () => {
    const candles5s = [];
    const baseSec = 1710000000;

    // Bucket 0..5
    applyTickToCandleBuffer(candles5s, {
      timeSec: baseSec,
      priceStr: '100.0000',
      stepSec: 5,
    });

    // Pula 30 segundos (gap de 6 velas de 5s)
    applyTickToCandleBuffer(candles5s, {
      timeSec: baseSec + 35,
      priceStr: '105.0000',
      stepSec: 5,
    });

    assert.equal(candles5s.length, 2, 'Nenhuma vela fantasma deve ser criada nos períodos sem ticks');
    assert.equal(candles5s[0].time, baseSec);
    assert.equal(candles5s[1].time, baseSec + 35);
  });
});
