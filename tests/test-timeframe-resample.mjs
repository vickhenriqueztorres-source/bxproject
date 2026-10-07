import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  timeframeSeconds,
  isSubMinuteTimeframe,
  resampleCandles,
  candleFromTick,
} from '../apps/web/src/chart/candle-adapter.ts';

console.log('🧪 Iniciando Bateria de Testes: Resolução Temporal e Resampling Multi-Timeframe (5s, 15s, 30s, 1m, 5m)');

// --- Teste 1: Conversão de Timeframes e Sub-minuto ---
console.log('\n[Cenário 1] Validação de Segundos por Timeframe:');
assert.strictEqual(timeframeSeconds('5s'), 5, '5s deve ter 5 segundos');
assert.strictEqual(timeframeSeconds('15s'), 15, '15s deve ter 15 segundos');
assert.strictEqual(timeframeSeconds('30s'), 30, '30s deve ter 30 segundos');
assert.strictEqual(timeframeSeconds('1m'), 60, '1m deve ter 60 segundos');
assert.strictEqual(timeframeSeconds('5m'), 300, '5m deve ter 300 segundos');

assert.strictEqual(isSubMinuteTimeframe('5s'), true, '5s é sub-minuto');
assert.strictEqual(isSubMinuteTimeframe('15s'), true, '15s é sub-minuto');
assert.strictEqual(isSubMinuteTimeframe('30s'), true, '30s é sub-minuto');
assert.strictEqual(isSubMinuteTimeframe('1m'), false, '1m não é sub-minuto');
assert.strictEqual(isSubMinuteTimeframe('5m'), false, '5m não é sub-minuto');
console.log('  ✅ [PASS] Conversão de passos temporais e flags de sub-minuto 100% corretos');

// --- Teste 2: Agregação 5m a partir de Velas de 1m ---
console.log('\n[Cenário 2] Resampling de 1m para 5m (Agregação de Blocos OHLCV):');
const base5m = 1712000400; // 1712000400 % 300 === 0 (alinhado a 5 minutos)
const mock1mCandles = [
  { time: base5m, open: '100.0', high: '102.0', low: '99.5', close: '101.0', volume: 60 },
  { time: base5m + 60, open: '101.0', high: '103.5', low: '100.5', close: '103.0', volume: 60 },
  { time: base5m + 120, open: '103.0', high: '104.0', low: '102.0', close: '102.5', volume: 60 },
  { time: base5m + 180, open: '102.5', high: '103.0', low: '98.0', close: '99.0', volume: 60 },
  { time: base5m + 240, open: '99.0', high: '101.0', low: '98.5', close: '100.5', volume: 60 },
  // Segunda vela de 5m
  { time: base5m + 300, open: '100.5', high: '105.0', low: '100.0', close: '104.5', volume: 60 },
];

const resampled5m = resampleCandles(mock1mCandles, '5m');
assert.strictEqual(resampled5m.length, 2, 'Deve gerar exatamente 2 velas de 5m');
assert.strictEqual(resampled5m[0].time, base5m, 'Timestamp da 1ª vela 5m deve ser base5m');
assert.strictEqual(resampled5m[0].open, 100.0, 'Open da 1ª vela 5m deve ser o open da 1ª vela 1m (100.0)');
assert.strictEqual(resampled5m[0].high, 104.0, 'High da 1ª vela 5m deve ser o máximo de todas (104.0)');
assert.strictEqual(resampled5m[0].low, 98.0, 'Low da 1ª vela 5m deve ser o mínimo de todas (98.0)');
assert.strictEqual(resampled5m[0].close, 100.5, 'Close da 1ª vela 5m deve ser o close da 5ª vela 1m (100.5)');

assert.strictEqual(resampled5m[1].time, base5m + 300, 'Timestamp da 2ª vela 5m deve ser base5m + 300');
assert.strictEqual(resampled5m[1].open, 100.5, 'Open da 2ª vela 5m deve ser 100.5');
assert.strictEqual(resampled5m[1].high, 105.0, 'High da 2ª vela 5m deve ser 105.0');
console.log('  ✅ [PASS] Agregação de 5m preserva Open, High, Low e Close canônicos');

// --- Teste 3: Desdobramento Sub-minuto (5s, 15s, 30s) ---
console.log('\n[Cenário 3] Resampling de 1m para Sub-minuto (30s, 15s, 5s):');
const singleCandle = [
  { time: base5m, open: '100.0', high: '105.0', low: '95.0', close: '102.0', volume: 60 },
];

// 30s: 2 fatias
const resampled30s = resampleCandles(singleCandle, '30s');
assert.strictEqual(resampled30s.length, 2, '1 vela de 1m deve gerar 2 velas de 30s');
assert.strictEqual(resampled30s[0].time, base5m);
assert.strictEqual(resampled30s[1].time, base5m + 30);
assert(resampled30s[0].high <= 105.0 && resampled30s[0].low >= 95.0);
assert(resampled30s[1].high <= 105.0 && resampled30s[1].low >= 95.0);

// 15s: 4 fatias
const resampled15s = resampleCandles(singleCandle, '15s');
assert.strictEqual(resampled15s.length, 4, '1 vela de 1m deve gerar 4 velas de 15s');
for (let i = 0; i < 4; i++) {
  assert.strictEqual(resampled15s[i].time, base5m + i * 15);
  assert(resampled15s[i].high <= 105.0, 'High não pode ultrapassar a máxima da vela pai');
  assert(resampled15s[i].low >= 95.0, 'Low não pode furar a mínima da vela pai');
}

// 5s: 12 fatias
const resampled5s = resampleCandles(singleCandle, '5s');
assert.strictEqual(resampled5s.length, 12, '1 vela de 1m deve gerar 12 velas de 5s');
for (let i = 0; i < 12; i++) {
  assert.strictEqual(resampled5s[i].time, base5m + i * 5);
  assert(resampled5s[i].high <= 105.0, 'High não pode ultrapassar a máxima da vela pai');
  assert(resampled5s[i].low >= 95.0, 'Low não pode furar a mínima da vela pai');
  if (i > 0) {
    assert(resampled5s[i].time > resampled5s[i - 1].time, 'Timestamps devem ser estritamente crescentes');
  }
}
console.log('  ✅ [PASS] Desdobramento em 5s (12 fatias), 15s (4 fatias) e 30s (2 fatias) estritamente ordenado');

// --- Teste 4: Bucketing de Ticks ao Vivo por Timeframe ---
console.log('\n[Cenário 4] Processamento Reativo de Ticks (candleFromTick com Timeframe):');

// No segundo 03 (bucket 5s = 00)
const tick1 = { sequence: 1, symbol: 'EURUSD_OTC', price: '1.08500', ts: '2026-10-06T12:00:03.000Z' };
const c1 = candleFromTick(tick1, null, '5s');
assert.strictEqual(c1.time, Math.floor(Date.parse(tick1.ts) / 5000) * 5);
assert.strictEqual(c1.open, 1.085);
assert.strictEqual(c1.close, 1.085);

// No segundo 04 (mesmo bucket 5s = 00)
const tick2 = { sequence: 2, symbol: 'EURUSD_OTC', price: '1.08550', ts: '2026-10-06T12:00:04.000Z' };
const c2 = candleFromTick(tick2, c1, '5s');
assert.strictEqual(c2.time, c1.time, 'Tick no segundo 04 pertence ao mesmo bucket 5s');
assert.strictEqual(c2.open, 1.085);
assert.strictEqual(c2.high, 1.0855);
assert.strictEqual(c2.close, 1.0855);

// No segundo 06 (novo bucket 5s = 05)
const tick3 = { sequence: 3, symbol: 'EURUSD_OTC', price: '1.08520', ts: '2026-10-06T12:00:06.000Z' };
const c3 = candleFromTick(tick3, c2, '5s');
assert.strictEqual(c3.time, c1.time + 5, 'Tick no segundo 06 abre novo bucket de 5s');
assert.strictEqual(c3.open, 1.0852);
assert.strictEqual(c3.close, 1.0852);

// Teste em 5m:
const tick5m_1 = { sequence: 10, symbol: 'EURUSD_OTC', price: '1.08600', ts: '2026-10-06T12:01:30.000Z' };
const tick5m_2 = { sequence: 11, symbol: 'EURUSD_OTC', price: '1.08700', ts: '2026-10-06T12:04:45.000Z' };
const c5m_1 = candleFromTick(tick5m_1, null, '5m');
const c5m_2 = candleFromTick(tick5m_2, c5m_1, '5m');
assert.strictEqual(c5m_1.time, c5m_2.time, '12:01 e 12:04 devem cair no mesmo bucket de 5m (12:00)');
assert.strictEqual(c5m_2.high, 1.087);
console.log('  ✅ [PASS] Buckets de ticks ao vivo respeitam perfeitamente cada intervalo de tempo');

// --- Teste 5: Auditoria Estática do PriceChart.tsx ---
console.log('\n[Cenário 5] Auditoria de Código de PriceChart.tsx:');
const chartSource = readFileSync(resolve('apps/web/src/chart/PriceChart.tsx'), 'utf8');
assert(chartSource.includes('resampleCandles'), 'PriceChart utiliza resampleCandles');
assert(chartSource.includes('resampledCandles'), 'PriceChart mantém série atualizada com resampledCandles');
assert(chartSource.includes('secondsVisible: isSubMinuteTimeframe(timeframe)'), 'PriceChart ativa segundos no timeScale para sub-minuto');
assert(chartSource.includes('candleFromTick(tick, latestCandle.current, timeframe)'), 'PriceChart passa timeframe para o candleFromTick');
assert(chartSource.includes('scrollToRealTime()'), 'PriceChart reposiciona o gráfico ao trocar timeframe');
console.log('  ✅ [PASS] Integração visual e reatividade do PriceChart auditadas com sucesso');

console.log('\n========================================================================');
console.log('🎉 BATERIA DE TESTES DE TIMEFRAMES APROVADA COM 100% DE SUCESSO!');
console.log('========================================================================\n');
