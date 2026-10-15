import fs from 'node:fs';

const BOOT_TIMESTAMP_MS = 1791992404010; // From pm2 describe 0: 2026-10-14T15:40:04.010Z
const BOOT_SEC = Math.floor(BOOT_TIMESTAMP_MS / 1000);
const BOOT_BUCKET_SEC = Math.floor(BOOT_SEC / 60) * 60; // 1791992400

const assets = [
  { symbol: 'VOL_50', file: 'test_vol50.json', basePrice: 500.1250, sigma: 0.00060 },
  { symbol: 'EURUSD_OTC', file: 'test_eurusd.json', basePrice: 1.08542, sigma: 0.00018 },
  { symbol: 'GBPUSD_OTC', file: 'test_gbpusd.json', basePrice: 1.29415, sigma: 0.00020 },
  { symbol: 'USDJPY_OTC', file: 'test_usdjpy.json', basePrice: 153.820, sigma: 0.00018 },
];

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((acc, x) => acc + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function lag1Autocorrelation(arr) {
  if (arr.length < 3) return 0;
  const m = mean(arr);
  let num = 0;
  let den = 0;
  for (let i = 0; i < arr.length; i++) {
    den += (arr[i] - m) ** 2;
  }
  for (let i = 1; i < arr.length; i++) {
    num += (arr[i] - m) * (arr[i - 1] - m);
  }
  return den === 0 ? 0 : num / den;
}

function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    denX += dx ** 2;
    denY += dy ** 2;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

const loadedData = {};
const results = [];

for (const a of assets) {
  const raw = JSON.parse(fs.readFileSync(a.file, 'utf8'));
  loadedData[a.symbol] = raw;

  // Encontra o índice da primeira vela >= BOOT_BUCKET_SEC
  let bootIdx = raw.findIndex((c) => c.time >= BOOT_BUCKET_SEC);
  if (bootIdx === -1) {
    bootIdx = raw.length - 1;
  }

  const beforeCandles = raw.slice(0, bootIdx);
  const afterCandles = raw.slice(bootIdx);

  // Log-retornos: ln(close_t / close_{t-1})
  const returnsBefore = [];
  for (let i = 1; i < beforeCandles.length; i++) {
    returnsBefore.push(Math.log(parseFloat(beforeCandles[i].close) / parseFloat(beforeCandles[i - 1].close)));
  }

  const returnsAfter = [];
  for (let i = 1; i < afterCandles.length; i++) {
    returnsAfter.push(Math.log(parseFloat(afterCandles[i].close) / parseFloat(afterCandles[i - 1].close)));
  }

  // Range percentual: (high - low) / close
  const rangesBefore = beforeCandles.map((c) => (parseFloat(c.high) - parseFloat(c.low)) / parseFloat(c.close));
  const rangesAfter = afterCandles.map((c) => (parseFloat(c.high) - parseFloat(c.low)) / parseFloat(c.close));

  // Distância até basePrice: |close - basePrice|
  const distBefore = beforeCandles.map((c) => Math.abs(parseFloat(c.close) - a.basePrice));
  const distAfter = afterCandles.map((c) => Math.abs(parseFloat(c.close) - a.basePrice));

  // Distância percentual até basePrice: |close - basePrice| / basePrice
  const distPctBefore = beforeCandles.map((c) => Math.abs(parseFloat(c.close) - a.basePrice) / a.basePrice);
  const distPctAfter = afterCandles.map((c) => Math.abs(parseFloat(c.close) - a.basePrice) / a.basePrice);

  const stdBefore = stdDev(returnsBefore);
  const stdAfter = stdDev(returnsAfter);
  const ratioStd = stdBefore > 0 ? (stdAfter / stdBefore) : 0;

  const meanRangeBefore = mean(rangesBefore);
  const meanRangeAfter = mean(rangesAfter);
  const ratioRange = meanRangeBefore > 0 ? (meanRangeAfter / meanRangeBefore) : 0;

  const autoCorrBefore = lag1Autocorrelation(returnsBefore);
  const autoCorrAfter = lag1Autocorrelation(returnsAfter);

  const meanDistBefore = mean(distBefore);
  const meanDistAfter = mean(distAfter);
  const meanDistPctBefore = mean(distPctBefore) * 100;
  const meanDistPctAfter = mean(distPctAfter) * 100;

  results.push({
    symbol: a.symbol,
    totalCandles: raw.length,
    bootIndex: bootIdx,
    bootTimeSec: BOOT_BUCKET_SEC,
    bootTimeIso: new Date(BOOT_BUCKET_SEC * 1000).toISOString(),
    candlesBefore: beforeCandles.length,
    candlesAfter: afterCandles.length,
    stdBefore,
    stdAfter,
    ratioStd,
    meanRangeBefore,
    meanRangeAfter,
    ratioRange,
    autoCorrBefore,
    autoCorrAfter,
    meanDistBefore,
    meanDistAfter,
    meanDistPctBefore,
    meanDistPctAfter,
  });
}

console.log('=== RESULTADOS POR ATIVO (ANTES vs DEPOIS DO BOOT) ===');
console.table(
  results.map((r) => ({
    Ativo: r.symbol,
    'Velas Antes/Depois': `${r.candlesBefore} / ${r.candlesAfter} (Idx: ${r.bootIndex})`,
    'Std Ret Antes': (r.stdBefore * 10000).toFixed(2) + ' bps',
    'Std Ret Depois': (r.stdAfter * 10000).toFixed(2) + ' bps',
    'Razão Std (Depois/Antes)': r.ratioStd.toFixed(2) + 'x',
    'Range Médio Antes': (r.meanRangeBefore * 100).toFixed(3) + '%',
    'Range Médio Depois': (r.meanRangeAfter * 100).toFixed(3) + '%',
    'Razão Range': r.ratioRange.toFixed(2) + 'x',
    'AutoCorr-1 Antes': r.autoCorrBefore.toFixed(3),
    'AutoCorr-1 Depois': r.autoCorrAfter.toFixed(3),
    'Dist BasePrice Antes': r.meanDistPctBefore.toFixed(2) + '%',
    'Dist BasePrice Depois': r.meanDistPctAfter.toFixed(2) + '%',
  }))
);

// Análise de Correlação entre pares de ativos
console.log('\n=== CORRELAÇÃO DE RETORNOS ENTRE ATIVOS ===');
const symbols = assets.map((a) => a.symbol);
const corrMatrixBefore = {};
const corrMatrixAfter = {};

for (const s1 of symbols) {
  corrMatrixBefore[s1] = {};
  corrMatrixAfter[s1] = {};
  const raw1 = loadedData[s1];
  const bootIdx1 = raw1.findIndex((c) => c.time >= BOOT_BUCKET_SEC);

  for (const s2 of symbols) {
    const raw2 = loadedData[s2];
    const bootIdx2 = raw2.findIndex((c) => c.time >= BOOT_BUCKET_SEC);

    const minBefore = Math.min(bootIdx1, bootIdx2);
    const ret1Before = [];
    const ret2Before = [];
    for (let i = 1; i < minBefore; i++) {
      ret1Before.push(Math.log(parseFloat(raw1[i].close) / parseFloat(raw1[i - 1].close)));
      ret2Before.push(Math.log(parseFloat(raw2[i].close) / parseFloat(raw2[i - 1].close)));
    }

    const ret1After = [];
    const ret2After = [];
    const minAfter = Math.min(raw1.length - bootIdx1, raw2.length - bootIdx2);
    for (let i = 1; i < minAfter; i++) {
      ret1After.push(Math.log(parseFloat(raw1[bootIdx1 + i].close) / parseFloat(raw1[bootIdx1 + i - 1].close)));
      ret2After.push(Math.log(parseFloat(raw2[bootIdx2 + i].close) / parseFloat(raw2[bootIdx2 + i - 1].close)));
    }

    corrMatrixBefore[s1][s2] = pearsonCorrelation(ret1Before, ret2Before).toFixed(3);
    corrMatrixAfter[s1][s2] = pearsonCorrelation(ret1After, ret2After).toFixed(3);
  }
}

console.log('--- Matriz de Correlação ANTES do Boot (Histórico Semeado) ---');
console.table(corrMatrixBefore);

console.log('--- Matriz de Correlação DEPOIS do Boot (Ao Vivo) ---');
console.table(corrMatrixAfter);
