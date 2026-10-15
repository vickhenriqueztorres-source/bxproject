#!/usr/bin/env node
/**
 * PASSO 6 — Simulação de 1.000.000 de trades de 60s no gerador ao vivo
 * Verifica que estratégias ingênuas:
 * 1) Mean-reversion (apostar contra o desvio do preço base)
 * 2) Trend-following (seguir a direção do último minuto)
 * 3) Invert-last-candle (inverter a direção do último minuto)
 * ficam todas estritamente entre 49,7% e 50,3% de acerto.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createPriceGenerator } from '../services/tick-engine/core.mjs';
import { ASSETS_CONFIG } from './lib/ou-engine.mjs';

const TOTAL_TRADES = Number(process.env.SIM_TRADES || 1_000_000);
const generator = createPriceGenerator();

const asset = ASSETS_CONFIG.find((a) => a.symbol === 'VOL_50') || ASSETS_CONFIG[0];
const basePrice = asset.price;
const sigma = asset.sigma;
const theta = asset.theta;
const precision = asset.precision;

let currentPriceStr = basePrice.toFixed(precision);
let currentPrice = basePrice;

// Primeiro minuto de aquecimento (60 ticks de 1s)
const prevMinuteOpen = currentPrice;
for (let s = 0; s < 60; s++) {
  currentPriceStr = generator(currentPriceStr, sigma, precision, theta, basePrice);
}
currentPrice = parseFloat(currentPriceStr);
let lastMinuteDelta = currentPrice - prevMinuteOpen;

let mrWins = 0;
let mrTotal = 0;
let tfWins = 0;
let tfTotal = 0;
let invWins = 0;
let invTotal = 0;

const t0 = performance.now();

for (let i = 0; i < TOTAL_TRADES; i++) {
  const entryPrice = currentPrice;
  const mrDir = entryPrice >= basePrice ? -1 : 1;
  const tfDir = lastMinuteDelta >= 0 ? 1 : -1;
  const invDir = -tfDir;

  // Avança 60 segundos no gerador ao vivo (60 ticks de dt=1s)
  for (let s = 0; s < 60; s++) {
    currentPriceStr = generator(currentPriceStr, sigma, precision, theta, basePrice);
  }
  const exitPrice = parseFloat(currentPriceStr);
  const tradeDelta = exitPrice - entryPrice;

  if (tradeDelta !== 0) {
    const actualDir = tradeDelta > 0 ? 1 : -1;
    mrTotal += 1;
    tfTotal += 1;
    invTotal += 1;
    if (mrDir === actualDir) mrWins += 1;
    if (tfDir === actualDir) tfWins += 1;
    if (invDir === actualDir) invWins += 1;
  }

  lastMinuteDelta = tradeDelta;
  currentPrice = exitPrice;
}

const elapsedMs = performance.now() - t0;

const mrRate = (mrWins / mrTotal) * 100;
const tfRate = (tfWins / tfTotal) * 100;
const invRate = (invWins / invTotal) * 100;

const result = {
  symbol: asset.symbol,
  totalTrades: TOTAL_TRADES,
  decidedTrades: mrTotal,
  ticksSimulated: (TOTAL_TRADES + 1) * 60,
  sigma,
  theta,
  elapsedMs: Number(elapsedMs.toFixed(1)),
  strategies: {
    meanReversionAgainstBase: {
      wins: mrWins,
      total: mrTotal,
      winRatePct: Number(mrRate.toFixed(4)),
      pass: mrRate >= 49.7 && mrRate <= 50.3,
    },
    trendFollowLastMinute: {
      wins: tfWins,
      total: tfTotal,
      winRatePct: Number(tfRate.toFixed(4)),
      pass: tfRate >= 49.7 && tfRate <= 50.3,
    },
    invertLastMinute: {
      wins: invWins,
      total: invTotal,
      winRatePct: Number(invRate.toFixed(4)),
      pass: invRate >= 49.7 && invRate <= 50.3,
    },
  },
};

const outDir = path.resolve(process.cwd(), 'scratch');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'sim-1m-trades.json'), JSON.stringify(result, null, 2));

console.log('=== SIMULAÇÃO DE 1.000.000 TRADES DE 60s NO GERADOR AO VIVO ===');
console.log(`Ativo: ${result.symbol} | Trades: ${result.totalTrades} (${result.decidedTrades} decididos, ${result.ticksSimulated} ticks de 1s) | Tempo: ${result.elapsedMs}ms`);
console.log(`1) Contra desvio da base (Mean-Reversion): ${result.strategies.meanReversionAgainstBase.winRatePct}% -> ${result.strategies.meanReversionAgainstBase.pass ? 'PASS' : 'FAIL'}`);
console.log(`2) Seguir último minuto (Trend-Following): ${result.strategies.trendFollowLastMinute.winRatePct}% -> ${result.strategies.trendFollowLastMinute.pass ? 'PASS' : 'FAIL'}`);
console.log(`3) Inverter último minuto (Mean-Rev 1m):   ${result.strategies.invertLastMinute.winRatePct}% -> ${result.strategies.invertLastMinute.pass ? 'PASS' : 'FAIL'}`);

if (
  !result.strategies.meanReversionAgainstBase.pass ||
  !result.strategies.trendFollowLastMinute.pass ||
  !result.strategies.invertLastMinute.pass
) {
  process.exit(1);
}
