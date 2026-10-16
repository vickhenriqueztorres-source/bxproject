#!/usr/bin/env node
/**
 * P2-2 — Diagnóstico de Correlação Cross-Asset em 1440 minutos (scripts/diag/cross-asset-correlation.mjs)
 *
 * - Mede /candles 1m limit=1440 para todos os 36 ativos do catálogo (ASSETS_CONFIG).
 * - Calcula retornos logarítmicos r_{i,t} = ln(C_{i,t} / C_{i,t-1}) e a matriz 36×36 (630 pares).
 * - Se algum par ultrapassar |corr| >= 0.10 na Janela 1 (esperado ~0.015% de falsos positivos a 3.79σ
 *   em 630 pares gaussianos independentes), repete em uma segunda janela independente de 1440 minutos.
 * - Só aponta anomalia se o MESMO par repetir |corr| >= 0.10 nas duas janelas.
 */

import { fileURLToPath } from 'node:url';
import {
  ASSETS_CONFIG,
  generateSeededHistoricalCandlesUnified,
} from '../lib/ou-engine.mjs';

export function computeLogReturns(bars) {
  const returns = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = Number(bars[i - 1].close);
    const curr = Number(bars[i].close);
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    }
  }
  return returns;
}

export function computePearsonCorrelation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const denom = Math.sqrt(varX * varY);
  return denom > 0 ? cov / denom : 0;
}

async function fetchCandlesWindowHttp(baseUrl, limit = 1440, beforeSec = null) {
  const seriesBySymbol = new Map();
  for (const item of ASSETS_CONFIG) {
    const qs = new URLSearchParams({
      symbol: item.symbol,
      interval: '1m',
      limit: String(limit),
    });
    if (beforeSec !== null) {
      qs.set('before', String(beforeSec));
    }
    const url = `${baseUrl.replace(/\/$/, '')}/candles?${qs.toString()}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`HTTP_${res.status} on ${url}`);
    }
    const body = await res.json();
    const bars = Array.isArray(body) ? body : body.candles || body.bars || [];
    seriesBySymbol.set(item.symbol, bars);
  }
  return seriesBySymbol;
}

function generateCandlesWindowEngine(limit = 1440, windowTag = 'w1') {
  const anchorMinuteSec =
    windowTag === 'w1' ? 1_760_000_000 : 1_760_000_000 - limit * 60;
  const seriesBySymbol = new Map();
  for (const item of ASSETS_CONFIG) {
    const bars = generateSeededHistoricalCandlesUnified(
      item.symbol,
      item.price,
      item.precision,
      item.sigma,
      item.theta,
      limit,
      anchorMinuteSec,
      item.price,
      { deterministicSeed: `p2-2:${windowTag}:${item.symbol}:${anchorMinuteSec}` }
    );
    seriesBySymbol.set(item.symbol, bars);
  }
  return seriesBySymbol;
}

function analyzeWindowCorrelation(seriesBySymbol, threshold = 0.10) {
  const symbols = ASSETS_CONFIG.map((a) => a.symbol);
  const returnsBySymbol = new Map();
  for (const sym of symbols) {
    returnsBySymbol.set(sym, computeLogReturns(seriesBySymbol.get(sym) || []));
  }

  let maxAbsCorr = 0;
  let maxPair = null;
  let vol100EurUsdCorr = 0;
  const pairsAboveThreshold = [];
  let totalPairs = 0;

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      totalPairs += 1;
      const symA = symbols[i];
      const symB = symbols[j];
      const corr = computePearsonCorrelation(
        returnsBySymbol.get(symA),
        returnsBySymbol.get(symB)
      );
      const absCorr = Math.abs(corr);

      if (
        (symA === 'VOL_100' && symB === 'EURUSD_OTC') ||
        (symA === 'EURUSD_OTC' && symB === 'VOL_100')
      ) {
        vol100EurUsdCorr = Number(corr.toFixed(6));
      }

      if (absCorr > maxAbsCorr) {
        maxAbsCorr = absCorr;
        maxPair = `${symA} × ${symB}`;
      }

      if (absCorr >= threshold) {
        pairsAboveThreshold.push({
          pair: `${symA} × ${symB}`,
          correlation: Number(corr.toFixed(6)),
        });
      }
    }
  }

  return {
    totalPairs,
    maxAbsCorr: Number(maxAbsCorr.toFixed(6)),
    maxPair,
    vol100EurUsdCorr,
    pairsAboveThreshold,
  };
}

export async function runCrossAssetCorrelationReport({
  baseUrl = process.env.CANDLES_BASE_URL || 'http://127.0.0.1:3001',
  limit = 1440,
  threshold = 0.10,
  mode = 'auto',
} = {}) {
  let source = 'engine_1440m';
  let window1Series = null;
  let window2Series = null;

  if (mode === 'http' || mode === 'auto') {
    try {
      window1Series = await fetchCandlesWindowHttp(baseUrl, limit, null);
      const firstBars = window1Series.get('EURUSD_OTC') || [];
      const oldestSec = firstBars.length > 0 ? Number(firstBars[0].time) - 60 : null;
      window2Series = await fetchCandlesWindowHttp(baseUrl, limit, oldestSec);
      source = `http:${baseUrl}`;
    } catch (httpErr) {
      if (mode === 'http') throw httpErr;
      window1Series = generateCandlesWindowEngine(limit, 'w1');
      window2Series = generateCandlesWindowEngine(limit, 'w2');
      source = 'engine_1440m';
    }
  } else {
    window1Series = generateCandlesWindowEngine(limit, 'w1');
    window2Series = generateCandlesWindowEngine(limit, 'w2');
  }

  const w1 = analyzeWindowCorrelation(window1Series, threshold);
  const w2 = analyzeWindowCorrelation(window2Series, threshold);

  const w1Set = new Set(w1.pairsAboveThreshold.map((p) => p.pair));
  const persistentPairsAboveThreshold = w2.pairsAboveThreshold.filter((p) =>
    w1Set.has(p.pair)
  );

  return {
    source,
    assetsCount: ASSETS_CONFIG.length,
    totalPairs: w1.totalPairs,
    limit,
    threshold,
    vol100EurUsdCorrelationWindow1: w1.vol100EurUsdCorr,
    vol100EurUsdCorrWindow1: w1.vol100EurUsdCorr,
    vol100EurUsdCorrWindow2: w2.vol100EurUsdCorr,
    maxAbsCorrelationWindow1: w1.maxAbsCorr,
    maxPairWindow1: w1.maxPair,
    pairsAboveThresholdWindow1: w1.pairsAboveThreshold,
    maxAbsCorrelationWindow2: w2.maxAbsCorr,
    maxPairWindow2: w2.maxPair,
    pairsAboveThresholdWindow2: w2.pairsAboveThreshold,
    persistentPairsAboveThreshold,
    verdict:
      persistentPairsAboveThreshold.length === 0
        ? 'PASS_NO_PERSISTENT_CORRELATION'
        : 'FAIL_PERSISTENT_CORRELATION_DETECTED',
  };
}

// Corrige alias de propriedade no retorno
const origRun = runCrossAssetCorrelationReport;
export { origRun as default };

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runCrossAssetCorrelationReport()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((err) => {
      console.error('[P2-2 Correlation Error]', err.message);
      process.exit(1);
    });
}
