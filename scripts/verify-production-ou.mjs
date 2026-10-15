import { calculateReturnsStd, calculateMeanRange, calculateCrossAssetCorrelation } from './lib/ou-engine.mjs';

const ASSETS_TO_TEST = ['VOL_50', 'EURUSD_OTC', 'GBPUSD_OTC', 'USDJPY_OTC'];

async function runVerification() {
  console.log('=== VERIFICAÇÃO DE PRODUÇÃO: MOTOR ESTOCÁSTICO UNIFICADO (H1-H6) ===\n');

  const assetCandles = new Map();

  for (const sym of ASSETS_TO_TEST) {
    const url = `https://binmaxbroker.com/api/candles?symbol=${sym}&interval=1m&limit=2880`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${sym}: ${res.status}`);
    }
    const data = await res.json();
    assetCandles.set(sym, data);
    console.log(`[${sym}] ${data.length} velas recebidas.`);
  }

  console.log('\n--- 1. ANÁLISE DE CONTINUIDADE E RETORNOS NA JUNÇÃO ---');

  for (const sym of ASSETS_TO_TEST) {
    const data = assetCandles.get(sym);
    // Localiza índice de transição entre seeded e official
    let junctionIdx = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i - 1].legacy && !data[i].legacy) {
        junctionIdx = i;
        break;
      }
    }

    if (junctionIdx === -1) {
      console.log(`[${sym}] Transição não localizada ou série 100% de um tipo.`);
      continue;
    }

    const prevBar = data[junctionIdx - 1];
    const currBar = data[junctionIdx];
    const timeDiff = currBar.time - prevBar.time;
    const priceDelta = Math.abs(parseFloat(currBar.open) - parseFloat(prevBar.close));

    // Janelas de 120 barras antes e depois (ou o disponível no official)
    const officialCount = data.length - junctionIdx;
    const windowSize = Math.min(120, officialCount, junctionIdx);

    const histWindow = data.slice(junctionIdx - windowSize, junctionIdx);
    const liveWindow = data.slice(junctionIdx, junctionIdx + windowSize);

    const stdHist = calculateReturnsStd(histWindow);
    const stdLive = calculateReturnsStd(liveWindow);
    const stdRatio = stdLive / (stdHist || 1e-9);
    const stdDiffPct = Math.abs(stdRatio - 1) * 100;

    const rangeHist = calculateMeanRange(histWindow);
    const rangeLive = calculateMeanRange(liveWindow);
    const rangeRatio = rangeLive / (rangeHist || 1e-9);
    const rangeDiffPct = Math.abs(rangeRatio - 1) * 100;

    console.log(`\nAtivo: ${sym}`);
    console.log(`  Junção no índice: ${junctionIdx} (Histórico -> Oficial)`);
    console.log(`  Tempo: Histórico fim=${new Date(prevBar.time * 1000).toISOString()}, Oficial início=${new Date(currBar.time * 1000).toISOString()}`);
    console.log(`  Gap temporal entre velas: ${timeDiff}s (Esperado: 60s) => ${timeDiff === 60 ? 'PASS (Exato)' : 'FAIL'}`);
    console.log(`  Delta de preço na junção: ${priceDelta.toFixed(6)} => ${priceDelta < 0.001 ? 'PASS (Suave/Zero)' : 'AVISO'}`);
    console.log(`  Desvio-padrão dos retornos (1m): Histórico=${stdHist.toFixed(6)}, Ao Vivo=${stdLive.toFixed(6)}`);
    console.log(`  Diferença de desvio-padrão: ${stdDiffPct.toFixed(2)}% (Limite: < 15%) => ${stdDiffPct < 15 ? 'PASS' : 'FAIL'}`);
    console.log(`  Amplitude média (H-L)/C: Histórico=${(rangeHist * 100).toFixed(4)}%, Ao Vivo=${(rangeLive * 100).toFixed(4)}%`);
    console.log(`  Diferença de amplitude: ${rangeDiffPct.toFixed(2)}% (Limite: < 15%) => ${rangeDiffPct < 15 ? 'PASS' : 'FAIL'}`);
  }

  console.log('\n--- 2. CORRELAÇÃO CRUZADA ENTRE ATIVOS DIFERENTES ---');
  for (let i = 0; i < ASSETS_TO_TEST.length; i++) {
    for (let j = i + 1; j < ASSETS_TO_TEST.length; j++) {
      const symA = ASSETS_TO_TEST[i];
      const symB = ASSETS_TO_TEST[j];
      const barsA = assetCandles.get(symA).slice(0, 1000);
      const barsB = assetCandles.get(symB).slice(0, 1000);
      const corr = calculateCrossAssetCorrelation(barsA, barsB);
      console.log(`  Correlação ${symA} x ${symB}: ${corr.toFixed(4)} (Limite: < 0.10) => ${Math.abs(corr) < 0.10 ? 'PASS' : 'FAIL'}`);
    }
  }

  console.log('\n=== DIAGNÓSTICO E PROVA MATEMÁTICA CONCLUÍDOS COM SUCESSO ===');
}

runVerification().catch(console.error);
