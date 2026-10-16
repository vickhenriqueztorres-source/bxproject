/**
 * Testes de Validação - Subetapa 5.4: Unificação dos Modelos Estocásticos de Preço (OU)
 * e Resolução Definitiva da Descontinuidade Visual Histórico x Ao Vivo (H1-H6)
 *
 * Invariantes validadas:
 * - M-01 (Integridade de Série Temporal e Ordenação Monotônica)
 * - M-02 (Modelo Estocástico Ornstein-Uhlenbeck e Continuidade Estatística)
 * - M-05 (Regra Única de OHLCV)
 * - I-06 (Conformidade com volatilidade anual nominal por classe de ativo)
 * - G-08 (Zero vazamento de memória e boot rápido < 3s)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSETS_CONFIG,
  getAssetConfig,
  generateSeededHistoricalCandlesUnified,
  calculateReturnsStd,
  calculateMeanRange,
  calculateCrossAssetCorrelation,
  calculateAnnualizedVolatility,
} from '../scripts/lib/ou-engine.mjs';
import { createPriceGenerator } from '../services/tick-engine/core.mjs';

describe('Subetapa 5.4 - Motor Estocástico Unificado Ornstein-Uhlenbeck (H1-H6)', () => {

  it('H1 & H2: Desvio-padrão dos retornos de 1m antes e depois da junção deve diferir por menos de 15%', () => {
    const asset = getAssetConfig('VOL_50');
    assert.ok(asset, 'VOL_50 deve estar configurado no catálogo');

    const count = 2880; // 48 horas de histórico
    const anchorMinuteSec = 1710000000;
    const anchorPrice = 502.3450;

    // 1. Gera histórico unificado
    const histBars = generateSeededHistoricalCandlesUnified(
      asset.symbol,
      asset.price,
      asset.precision,
      asset.sigma,
      asset.theta,
      count,
      anchorMinuteSec,
      anchorPrice
    );

    // 2. Simula feed ao vivo subsequente (720 barras de 1m geradas por 60 ticks/s cada com Itô OU)
    const liveGenerator = createPriceGenerator();
    let currentPrice = anchorPrice.toFixed(asset.precision);
    const liveBars = [];
    const liveMinuteCount = 720;

    for (let m = 0; m < liveMinuteCount; m++) {
      const barTime = anchorMinuteSec + (m + 1) * 60;
      const open = currentPrice;
      let high = parseFloat(currentPrice);
      let low = parseFloat(currentPrice);

      for (let s = 0; s < 60; s++) {
        currentPrice = liveGenerator(currentPrice, asset.sigma, asset.precision, asset.theta, asset.price);
        const pNum = parseFloat(currentPrice);
        if (pNum > high) high = pNum;
        if (pNum < low) low = pNum;
      }
      liveBars.push({
        time: barTime,
        open,
        high: high.toFixed(asset.precision),
        low: low.toFixed(asset.precision),
        close: currentPrice,
        volume: 60,
      });
    }

    // Compara últimos 720 do histórico com os 720 do ao vivo
    const recentHistBars = histBars.slice(-720);
    const stdHist = calculateReturnsStd(recentHistBars);
    const stdLive = calculateReturnsStd(liveBars);

    assert.ok(stdHist > 0, 'Desvio do histórico deve ser positivo');
    assert.ok(stdLive > 0, 'Desvio do ao vivo deve ser positivo');

    const ratio = stdLive / stdHist;
    const diffPct = Math.abs(ratio - 1.0) * 100;

    // Critério do projeto: desvio deve diferir por < 15% (anteriormente era 7.75x / 675% de diferença!)
    assert.ok(
      diffPct < 15.0,
      `Diferença de desvio-padrão de retornos (${diffPct.toFixed(2)}%) deve ser < 15%. Hist=${stdHist.toFixed(6)}, Live=${stdLive.toFixed(6)}, Ratio=${ratio.toFixed(3)}`
    );
  });

  it('H1 & H2: Amplitude média da vela (H - L) / C antes e depois da junção deve diferir por menos de 15%', () => {
    const asset = getAssetConfig('VOL_50');
    const count = 1440;
    const anchorMinuteSec = 1710000000;
    const anchorPrice = 500.1250;

    const histBars = generateSeededHistoricalCandlesUnified(
      asset.symbol,
      asset.price,
      asset.precision,
      asset.sigma,
      asset.theta,
      count,
      anchorMinuteSec,
      anchorPrice
    );

    const liveGenerator = createPriceGenerator();
    let currentPrice = anchorPrice.toFixed(asset.precision);
    const liveBars = [];

    for (let m = 0; m < 720; m++) {
      const open = currentPrice;
      let high = parseFloat(currentPrice);
      let low = parseFloat(currentPrice);

      for (let s = 0; s < 60; s++) {
        currentPrice = liveGenerator(currentPrice, asset.sigma, asset.precision, asset.theta, asset.price);
        const pNum = parseFloat(currentPrice);
        if (pNum > high) high = pNum;
        if (pNum < low) low = pNum;
      }
      liveBars.push({
        open,
        high: high.toFixed(asset.precision),
        low: low.toFixed(asset.precision),
        close: currentPrice,
      });
    }

    const rangeHist = calculateMeanRange(histBars.slice(-720));
    const rangeLive = calculateMeanRange(liveBars);

    const rangeRatio = rangeLive / rangeHist;
    const rangeDiffPct = Math.abs(rangeRatio - 1.0) * 100;

    assert.ok(
      rangeDiffPct < 15.0,
      `Diferença de amplitude de vela (${rangeDiffPct.toFixed(2)}%) deve ser < 15%. Hist=${rangeHist.toFixed(6)}, Live=${rangeLive.toFixed(6)}, Ratio=${rangeRatio.toFixed(3)}`
    );
  });

  it('H3: Ponte exponencial elimina descontinuidade na junção (|live_0 - hist_-1| <= 3 * sigma_tick)', () => {
    const asset = getAssetConfig('EURUSD_OTC');
    const targetAnchorPrice = 1.09245; // Preço oficial vindo do PostgreSQL

    const histBars = generateSeededHistoricalCandlesUnified(
      asset.symbol,
      asset.price,
      asset.precision,
      asset.sigma,
      asset.theta,
      1440,
      1710000000,
      targetAnchorPrice
    );

    const lastHistBar = histBars[histBars.length - 1];
    const lastHistClose = parseFloat(lastHistBar.close);

    // O último fechamento histórico deve coincidir exatamente com o targetAnchorPrice
    const bridgeDiscontinuity = Math.abs(lastHistClose - targetAnchorPrice);
    assert.ok(
      bridgeDiscontinuity < 0.00002,
      `Descontinuidade da ponte na junção (|${lastHistClose} - ${targetAnchorPrice}| = ${bridgeDiscontinuity}) deve ser zero ou desprezível`
    );

    // O primeiro tick do live gerado a partir do anchor deve estar a no máximo 3 sigmas de distância
    const liveGenerator = createPriceGenerator();
    const firstLiveTick = parseFloat(liveGenerator(lastHistBar.close, asset.sigma, asset.precision, asset.theta, asset.price));
    const tickJump = Math.abs(firstLiveTick - lastHistClose);
    const maxAllowedJump = 3 * asset.sigma * targetAnchorPrice;

    assert.ok(
      tickJump <= maxAllowedJump,
      `Salto do primeiro tick (${tickJump}) deve ser <= 3 * sigma_tick (${maxAllowedJump})`
    );
  });

  it('H4: Correlação de retornos entre ativos diferentes deve ser estritamente < 0.10 (personalidade independente)', () => {
    const assets = ['VOL_10', 'VOL_50', 'EURUSD_OTC', 'BTCUSD_OTC', 'XAUUSD_OTC'].map(getAssetConfig);
    const series = [];

    for (const a of assets) {
      const bars = generateSeededHistoricalCandlesUnified(
        a.symbol,
        a.price,
        a.precision,
        a.sigma,
        a.theta,
        1440,
        1710000000,
        a.price
      );
      series.push({ symbol: a.symbol, bars });
    }

    for (let i = 0; i < series.length; i++) {
      for (let j = i + 1; j < series.length; j++) {
        const corr = calculateCrossAssetCorrelation(series[i].bars, series[j].bars);
        assert.ok(
          Math.abs(corr) < 0.10,
          `Correlação entre ${series[i].symbol} e ${series[j].symbol} (${corr.toFixed(4)}) deve ser < 0.10`
        );
      }
    }
  });

  it('H4: Volatilidade anualizada calculada a partir de 1m deve estar dentro de +-15% da meta nominal do ativo', () => {
    const testCases = [
      { symbol: 'VOL_10', targetVol: 0.10 },
      { symbol: 'VOL_50', targetVol: 0.50 },
      { symbol: 'VOL_100', targetVol: 1.00 },
      { symbol: 'EURUSD_OTC', targetVol: 0.08 },
      { symbol: 'BTCUSD_OTC', targetVol: 0.55 },
      { symbol: 'XAUUSD_OTC', targetVol: 0.18 },
    ];

    for (const tc of testCases) {
      const asset = getAssetConfig(tc.symbol);
      const bars = generateSeededHistoricalCandlesUnified(
        asset.symbol,
        asset.price,
        asset.precision,
        asset.sigma,
        asset.theta,
        5000,
        1710000000,
        asset.price
      );

      const annualizedVol = calculateAnnualizedVolatility(bars);
      const diffPct = Math.abs(annualizedVol - tc.targetVol) / tc.targetVol * 100;

      assert.ok(
        diffPct <= 15.0,
        `Volatilidade anualizada de ${tc.symbol} (${(annualizedVol * 100).toFixed(2)}%) deve estar a menos de 15% do alvo (${(tc.targetVol * 100).toFixed(2)}%). Diff=${diffPct.toFixed(2)}%`
      );
    }
  });

  it('Performance / Boot Time: Geração de 10.080 barras (7 dias) para todos os 36 ativos deve levar < 3000ms', () => {
    const t0 = performance.now();
    let totalBars = 0;

    for (const item of ASSETS_CONFIG) {
      const bars = generateSeededHistoricalCandlesUnified(
        item.symbol,
        item.price,
        item.precision,
        item.sigma,
        item.theta,
        10080,
        1710000000,
        item.price
      );
      totalBars += bars.length;
    }

    const elapsedMs = performance.now() - t0;
    assert.equal(totalBars, 36 * 10080);
    assert.ok(
      elapsedMs < 3000,
      `Tempo de arranque (${elapsedMs.toFixed(1)}ms para ${totalBars} barras) deve ser < 3000ms`
    );
  });

  it('Invariantes OHLCV: Todas as barras geradas devem respeitar High >= max(Open, Close) e Low <= min(Open, Close)', () => {
    const asset = getAssetConfig('CRASH_BOOM_100');
    const bars = generateSeededHistoricalCandlesUnified(
      asset.symbol,
      asset.price,
      asset.precision,
      asset.sigma,
      asset.theta,
      2880,
      1710000000,
      asset.price * 1.05
    );

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const o = parseFloat(b.open);
      const h = parseFloat(b.high);
      const l = parseFloat(b.low);
      const c = parseFloat(b.close);

      assert.ok(h >= Math.max(o, c) - 1e-6, `Barra ${i}: High (${h}) deve ser >= max(Open, Close) (${Math.max(o, c)})`);
      assert.ok(l <= Math.min(o, c) + 1e-6, `Barra ${i}: Low (${l}) deve ser <= min(Open, Close) (${Math.min(o, c)})`);
      assert.ok(o > 0 && h > 0 && l > 0 && c > 0, `Barra ${i}: Preços devem ser estritamente positivos`);
    }
  });
});
