import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let WebSocket;
try {
  WebSocket = require('../node_modules/.pnpm/ws@8.22.0/node_modules/ws');
} catch {
  WebSocket = globalThis.WebSocket;
}

const BASE_URL = process.env.DIAG_BASE_URL || 'http://127.0.0.1:3001';
const WS_URL = process.env.DIAG_WS_URL || BASE_URL.replace(/^http/, 'ws') + '/ws';
const LIMIT = Number(process.env.DIAG_LIMIT || 1440);
const OUT_JSON = process.env.DIAG_OUT_JSON || path.resolve('scratch', 'diag-charts-before.json');
const OUT_TXT = process.env.DIAG_OUT_TXT || path.resolve('scratch', 'diag-charts-before.txt');

export const ASSETS_36 = [
  { symbol: 'EURUSD_OTC', basePrice: 1.08542 },
  { symbol: 'GBPUSD_OTC', basePrice: 1.29415 },
  { symbol: 'USDJPY_OTC', basePrice: 153.820 },
  { symbol: 'USDCHF_OTC', basePrice: 0.86510 },
  { symbol: 'AUDUSD_OTC', basePrice: 0.65820 },
  { symbol: 'USDCAD_OTC', basePrice: 1.38450 },
  { symbol: 'NZDUSD_OTC', basePrice: 0.59820 },
  { symbol: 'EURGBP_OTC', basePrice: 0.83850 },
  { symbol: 'EURJPY_OTC', basePrice: 166.950 },
  { symbol: 'GBPJPY_OTC', basePrice: 199.120 },
  { symbol: 'EURCAD_OTC', basePrice: 1.50280 },
  { symbol: 'EURAUD_OTC', basePrice: 1.64890 },
  { symbol: 'GBPAUD_OTC', basePrice: 1.96620 },
  { symbol: 'GBPCAD_OTC', basePrice: 1.79210 },
  { symbol: 'AUDCAD_OTC', basePrice: 0.91120 },
  { symbol: 'AUDJPY_OTC', basePrice: 101.250 },
  { symbol: 'CADJPY_OTC', basePrice: 111.120 },
  { symbol: 'NZDJPY_OTC', basePrice: 92.050 },
  { symbol: 'BTCUSD_OTC', basePrice: 64850.00 },
  { symbol: 'ETHUSD_OTC', basePrice: 3450.00 },
  { symbol: 'SOLUSD_OTC', basePrice: 152.40 },
  { symbol: 'BNBUSD_OTC', basePrice: 585.00 },
  { symbol: 'XRPUSD_OTC', basePrice: 0.5420 },
  { symbol: 'ADAUSD_OTC', basePrice: 0.3540 },
  { symbol: 'DOGEUSD_OTC', basePrice: 0.1240 },
  { symbol: 'AVAXUSD_OTC', basePrice: 28.40 },
  { symbol: 'XAUUSD_OTC', basePrice: 2652.80 },
  { symbol: 'XAGUSD_OTC', basePrice: 31.750 },
  { symbol: 'USOIL_OTC', basePrice: 72.40 },
  { symbol: 'UKOIL_OTC', basePrice: 76.20 },
  { symbol: 'VOL_10', basePrice: 100.5420 },
  { symbol: 'VOL_25', basePrice: 250.8410 },
  { symbol: 'VOL_50', basePrice: 500.1250 },
  { symbol: 'VOL_75', basePrice: 750.3200 },
  { symbol: 'VOL_100', basePrice: 1000.4500 },
  { symbol: 'CRASH_BOOM_100', basePrice: 1000.8200 },
];

function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function zScoreNormalized(arr) {
  if (!arr || arr.length < 2) return [];
  const m = mean(arr);
  const s = stdDev(arr);
  if (s === 0) return arr.map(() => 0);
  return arr.map((v) => (v - m) / s);
}

function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
}

function lag1Autocorr(arr) {
  if (!arr || arr.length < 3) return 0;
  return pearson(arr.slice(0, -1), arr.slice(1));
}

/**
 * Detecta o índice onde começa o trecho ao vivo ("depois do boot").
 * - Se houver campo provenance/legacy explícito, usa a primeira barra com provenance === 'official' ou legacy === false.
 * - Caso contrário (versão GitHub 264c9d0), as velas semeadas têm volume uniforme em [80, 320]
 *   e as velas ao vivo têm volume <= 60 (1 por tick de 1s).
 */
function detectBootIndex(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return -1;
  const hasExplicitProvenance = candles.some(
    (c) => c.provenance !== undefined || c.legacy !== undefined
  );
  if (hasExplicitProvenance) {
    const idx = candles.findIndex(
      (c) => c.provenance === 'official' || c.legacy === false
    );
    return idx;
  }
  // Heurística exata para 264c9d0: velas ao vivo acumulam 1 de volume por segundo (máx 60/min),
  // enquanto generateSeededHistoricalCandles usa Math.floor(80 + rand() * 240) >= 80.
  for (let i = candles.length - 1; i >= 0; i--) {
    if (Number(candles[i].volume) >= 80) {
      return i + 1 < candles.length ? i + 1 : -1;
    }
  }
  return -1;
}

async function fetchAllCandles() {
  const map = new Map();
  for (const item of ASSETS_36) {
    const url = `${BASE_URL}/candles?symbol=${encodeURIComponent(item.symbol)}&interval=1m&limit=${LIMIT}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      throw new Error(`Falha em ${url}: HTTP ${res.status}`);
    }
    const data = await res.json();
    map.set(item.symbol, data);
  }
  return map;
}

async function assertZeroOpenContracts() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/contracts`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const body = await res.json();
      const list = Array.isArray(body) ? body : (body.contracts || []);
      const open = list.filter((c) => c.status === 'OPEN');
      if (open.length > 0) {
        throw new Error(`ABORTADO: Existem ${open.length} contratos abertos! Aguarde a liquidação antes de reiniciar.`);
      }
    }
  } catch (err) {
    if (String(err.message).startsWith('ABORTADO:')) throw err;
  }
}

async function captureFirstLiveTicks(symbols, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const ticks = new Map();
    if (!WebSocket) {
      resolve(ticks);
      return;
    }
    let settled = false;
    const ws = new WebSocket(WS_URL);
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws.close(); } catch {}
        resolve(ticks);
      }
    }, timeoutMs);

    ws.on('open', () => {
      for (const sym of symbols) {
        ws.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
      }
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'tick' && msg.symbol && !ticks.has(msg.symbol)) {
          ticks.set(msg.symbol, msg);
          if (ticks.size >= symbols.length && !settled) {
            settled = true;
            clearTimeout(timer);
            try { ws.close(); } catch {}
            resolve(ticks);
          }
        }
      } catch {}
    });

    ws.on('error', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(ticks);
      }
    });
  });
}

async function restartFeedAndWait() {
  await assertZeroOpenContracts();
  const restartCmd =
    process.env.DIAG_RESTART_CMD ||
    'node scripts/remote-exec.mjs "pm2 restart broker-feed"';
  console.log(`[diag-charts] Executando reinício controlado do feed: ${restartCmd}`);
  execSync(restartCmd, { stdio: 'inherit' });

  // Aguarda servidor voltar a responder /candles
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(`${BASE_URL}/candles?symbol=VOL_50&interval=1m&limit=5`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        // Aguarda mais 2s para pelo menos 1-2 ticks ao vivo serem emitidos
        await new Promise((r) => setTimeout(r, 2000));
        return;
      }
    } catch {}
  }
  throw new Error('Timeout aguardando feed reiniciar.');
}

function sha256(payload) {
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

async function main() {
  console.log(`[diag-charts] Coletando Snapshot 1 de ${BASE_URL} para 36 ativos (limit=${LIMIT})...`);
  const snap1 = await fetchAllCandles();

  const perAsset = {};
  const returnsBySymbol = {};
  const returnsPreBySymbol = {};
  const returnsPostBySymbol = {};
  const zCloseBySymbol = {};
  const zClosePreBySymbol = {};
  const zClosePostBySymbol = {};

  for (const item of ASSETS_36) {
    const sym = item.symbol;
    const bars = snap1.get(sym) || [];
    const bootIdx = detectBootIndex(bars);
    const preBars = bootIdx > 0 ? bars.slice(0, bootIdx) : bars;
    const postBars = bootIdx >= 0 ? bars.slice(bootIdx) : [];

    const closes = bars.map((b) => Number(b.close));
    const preCloses = preBars.map((b) => Number(b.close));
    const postCloses = postBars.map((b) => Number(b.close));

    const logRet = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] > 0 && closes[i] > 0) {
        logRet.push(Math.log(closes[i] / closes[i - 1]));
      }
    }
    const logRetPre = [];
    for (let i = 1; i < preCloses.length; i++) {
      if (preCloses[i - 1] > 0 && preCloses[i] > 0) {
        logRetPre.push(Math.log(preCloses[i] / preCloses[i - 1]));
      }
    }
    const logRetPost = [];
    for (let i = 1; i < postCloses.length; i++) {
      if (postCloses[i - 1] > 0 && postCloses[i] > 0) {
        logRetPost.push(Math.log(postCloses[i] / postCloses[i - 1]));
      }
    }

    returnsBySymbol[sym] = logRet;
    returnsPreBySymbol[sym] = logRetPre;
    returnsPostBySymbol[sym] = logRetPost;

    zCloseBySymbol[sym] = zScoreNormalized(closes);
    zClosePreBySymbol[sym] = zScoreNormalized(preCloses);
    zClosePostBySymbol[sym] = zScoreNormalized(postCloses);

    // Exclui a última vela aberta (em formação no minuto corrente) para comparar apenas velas fechadas de 60s
    const closedPostBars = postBars.length > 1 ? postBars.slice(0, -1) : postBars;
    const pre60Bars = preBars.slice(-60);
    const post60Bars = closedPostBars.slice(0, 60);

    const rangePre = mean(
      pre60Bars.map((b) => (Number(b.high) - Number(b.low)) / Number(b.close))
    );
    const rangePost = mean(
      post60Bars.map((b) => (Number(b.high) - Number(b.low)) / Number(b.close))
    );
    const rangeRatio = rangePre > 0 && post60Bars.length > 0 ? rangePost / rangePre : null;

    const stdPre = stdDev(logRetPre);
    const stdPost = stdDev(logRetPost.slice(0, Math.max(1, closedPostBars.length - 1)));
    const stdRatio = stdPre > 0 && logRetPost.length > 1 ? stdPost / stdPre : null;

    const ac1Pre = lag1Autocorr(logRetPre);
    const ac1Post = lag1Autocorr(logRetPost);

    const distBasePrePct =
      mean(preCloses.map((c) => Math.abs(c - item.basePrice) / item.basePrice)) * 100;
    const distBasePostPct =
      postCloses.length > 0
        ? mean(postCloses.map((c) => Math.abs(c - item.basePrice) / item.basePrice)) * 100
        : null;

    const preTimeOhlc = preBars.map((b) => `${b.time}:${b.open}:${b.high}:${b.low}:${b.close}`).join('|');
    const preOnlyOhlc = preBars.map((b) => `${b.open}:${b.high}:${b.low}:${b.close}`).join('|');

    const lastPreClose = preBars.length > 0 ? Number(preBars[preBars.length - 1].close) : null;
    const firstPostOpen = postBars.length > 0 ? Number(postBars[0].open) : null;
    const junctionJumpPct =
      lastPreClose && firstPostOpen
        ? (Math.abs(firstPostOpen - lastPreClose) / lastPreClose) * 100
        : 0;

    perAsset[sym] = {
      symbol: sym,
      basePrice: item.basePrice,
      totalBars: bars.length,
      bootIndex: bootIdx,
      bootTimeSec: bootIdx >= 0 && bars[bootIdx] ? bars[bootIdx].time : null,
      preBootCount: preBars.length,
      postBootCount: postBars.length,
      closedPostBootCount: closedPostBars.length,
      hasExplicitProvenance: bars.some((c) => c.provenance !== undefined),
      provenanceSamplePre: preBars[preBars.length - 1]?.provenance ?? null,
      provenanceSamplePost: postBars[0]?.provenance ?? null,
      meanRangePre: rangePre,
      meanRangePost: rangePost,
      rangeRatioPostOverPre: rangeRatio,
      stdLogRetPre: stdPre,
      stdLogRetPost: stdPost,
      stdRatioPostOverPre: stdRatio,
      autocorrLag1Pre: ac1Pre,
      autocorrLag1Post: ac1Post,
      meanDistFromBasePctPre: distBasePrePct,
      meanDistFromBasePctPost: distBasePostPct,
      lastPreBootCloseSnap1: lastPreClose,
      firstPostBootOpenSnap1: firstPostOpen,
      junctionJumpPct,
      lastCloseBeforeRestart: bars.length > 0 ? Number(bars[bars.length - 1].close) : null,
      lastTimeBeforeRestart: bars.length > 0 ? Number(bars[bars.length - 1].time) : null,
      sha256PreTimeOhlcSnap1: sha256(preTimeOhlc),
      sha256PreOnlyOhlcSnap1: sha256(preOnlyOhlc),
    };
  }

  // Matriz 36x36 de correlação de retornos log e de fechamento normalizado (z-score)
  const symbols = ASSETS_36.map((a) => a.symbol);
  const returnCorrMatrix = {};
  const zCloseCorrMatrix = {};
  const zClosePostCorrMatrix = {};
  let maxAbsRetCorr = 0;
  let maxAbsRetCorrPair = null;
  let maxAbsZCloseCorr = 0;
  let maxAbsZCloseCorrPair = null;
  let maxAbsZClosePostCorr = 0;
  let maxAbsZClosePostCorrPair = null;

  for (let i = 0; i < symbols.length; i++) {
    const s1 = symbols[i];
    returnCorrMatrix[s1] = {};
    zCloseCorrMatrix[s1] = {};
    zClosePostCorrMatrix[s1] = {};
    for (let j = 0; j < symbols.length; j++) {
      const s2 = symbols[j];
      const rCorr = i === j ? 1 : pearson(returnsBySymbol[s1], returnsBySymbol[s2]);
      const zCorr = i === j ? 1 : pearson(zCloseBySymbol[s1], zCloseBySymbol[s2]);
      const zPostCorr = i === j ? 1 : pearson(zClosePostBySymbol[s1], zClosePostBySymbol[s2]);
      returnCorrMatrix[s1][s2] = Number(rCorr.toFixed(4));
      zCloseCorrMatrix[s1][s2] = Number(zCorr.toFixed(4));
      zClosePostCorrMatrix[s1][s2] = Number(zPostCorr.toFixed(4));

      if (i < j) {
        if (Math.abs(rCorr) > maxAbsRetCorr) {
          maxAbsRetCorr = Math.abs(rCorr);
          maxAbsRetCorrPair = `${s1} x ${s2} (${rCorr.toFixed(4)})`;
        }
        if (Math.abs(zCorr) > maxAbsZCloseCorr) {
          maxAbsZCloseCorr = Math.abs(zCorr);
          maxAbsZCloseCorrPair = `${s1} x ${s2} (${zCorr.toFixed(4)})`;
        }
        if (Math.abs(zPostCorr) > maxAbsZClosePostCorr) {
          maxAbsZClosePostCorr = Math.abs(zPostCorr);
          maxAbsZClosePostCorrPair = `${s1} x ${s2} (${zPostCorr.toFixed(4)})`;
        }
      }
    }
  }

  // Teste de 2 reinícios consecutivos (itens d e e / Passo 6) se DIAG_SKIP_RESTART !== '1'
  if (process.env.DIAG_SKIP_RESTART !== '1') {
    await restartFeedAndWait();
    console.log(`[diag-charts] Coletando Snapshot 2 (pós-reinício #1)...`);
    const snap2 = await fetchAllCandles();

    await restartFeedAndWait();
    console.log(`[diag-charts] Coletando Snapshot 3 (pós-reinício #2) e primeiro tick ao vivo...`);
    const [snap3, liveTicks] = await Promise.all([
      fetchAllCandles(),
      captureFirstLiveTicks(symbols, 5000),
    ]);

    for (const item of ASSETS_36) {
      const sym = item.symbol;
      const bars1 = snap1.get(sym) || [];
      const bars2 = snap2.get(sym) || [];
      const bars3 = snap3.get(sym) || [];
      const bootIdx2 = detectBootIndex(bars2);
      const bootIdx3 = detectBootIndex(bars3);
      const preBars2 = bootIdx2 > 0 ? bars2.slice(0, bootIdx2) : bars2;
      const preBars3 = bootIdx3 > 0 ? bars3.slice(0, bootIdx3) : bars3;
      const postBars3 = bootIdx3 >= 0 ? bars3.slice(bootIdx3) : [];

      const preTimeOhlc2 = preBars2.map((b) => `${b.time}:${b.open}:${b.high}:${b.low}:${b.close}`).join('|');
      const preOnlyOhlc2 = preBars2.map((b) => `${b.open}:${b.high}:${b.low}:${b.close}`).join('|');

      // Compara todas as velas fechadas de Snap 1 no intervalo comum presente em Snap 1, Snap 2 e Snap 3
      const snap1LastTime = bars1.length > 0 ? bars1[bars1.length - 1].time : Infinity;
      const times2 = new Set(bars2.map((b) => b.time));
      const times3 = new Set(bars3.map((b) => b.time));
      const overlap1Times = new Set(
        bars1
          .filter((b) => b.time < snap1LastTime && times2.has(b.time) && times3.has(b.time))
          .map((b) => b.time)
      );
      const overlap1 = bars1
        .filter((b) => overlap1Times.has(b.time))
        .map((b) => `${b.time}:${b.open}:${b.high}:${b.low}:${b.close}`);
      const overlap2 = bars2
        .filter((b) => overlap1Times.has(b.time))
        .map((b) => `${b.time}:${b.open}:${b.high}:${b.low}:${b.close}`);
      const overlap3 = bars3
        .filter((b) => overlap1Times.has(b.time))
        .map((b) => `${b.time}:${b.open}:${b.high}:${b.low}:${b.close}`);

      const hashOverlap1 = sha256(overlap1.join('|'));
      const hashOverlap2 = sha256(overlap2.join('|'));
      const hashOverlap3 = sha256(overlap3.join('|'));

      const lastHistCloseAfterRestart =
        preBars3.length > 0 ? Number(preBars3[preBars3.length - 1].close) : null;
      const lastBarCloseSnap3 =
        bars3.length > 0 ? Number(bars3[bars3.length - 1].close) : null;
      const firstLiveTickPrice = liveTicks.has(sym)
        ? Number(liveTicks.get(sym).price)
        : postBars3.length > 0
          ? Number(postBars3[postBars3.length - 1].close)
          : null;

      const lastCloseBefore = perAsset[sym].lastCloseBeforeRestart;
      const jumpRestartPct =
        lastCloseBefore && lastBarCloseSnap3
          ? (Math.abs(lastBarCloseSnap3 - lastCloseBefore) / lastCloseBefore) * 100
          : null;
      const jumpTickPct =
        lastBarCloseSnap3 && firstLiveTickPrice
          ? (Math.abs(firstLiveTickPrice - lastBarCloseSnap3) / lastBarCloseSnap3) * 100
          : null;

      Object.assign(perAsset[sym], {
        bootIndexSnap2: bootIdx2,
        bootIndexSnap3: bootIdx3,
        preBootCountSnap2: preBars2.length,
        preBootCountSnap3: preBars3.length,
        postBootCountSnap3: postBars3.length,
        sha256PreTimeOhlcSnap2: sha256(preTimeOhlc2),
        sha256PreOnlyOhlcSnap2: sha256(preOnlyOhlc2),
        sha256OverlapBeforeRestart: hashOverlap1,
        sha256OverlapAfterRestart1: hashOverlap2,
        sha256OverlapAfterRestart2: hashOverlap3,
        pastUnchangedByTimestamp:
          hashOverlap1 === hashOverlap2 &&
          hashOverlap1 === hashOverlap3 &&
          overlap1.length > 0,
        sameStaticCurveShiftedInTime:
          perAsset[sym].sha256PreOnlyOhlcSnap1 === sha256(preOnlyOhlc2) &&
          hashOverlap1 !== hashOverlap2,
        lastHistCloseAfterRestart,
        firstLiveTickAfterRestart: firstLiveTickPrice,
        jumpBeforeToAfterRestartPct: jumpRestartPct,
        jumpAfterHistToFirstTickPct: jumpTickPct,
      });
    }
  }

  const assetList = Object.values(perAsset);
  const validRangeRatios = assetList
    .map((a) => a.rangeRatioPostOverPre)
    .filter((v) => v !== null && Number.isFinite(v));
  const validStdRatios = assetList
    .map((a) => a.stdRatioPostOverPre)
    .filter((v) => v !== null && Number.isFinite(v));

  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    limit: LIMIT,
    assetsCount: assetList.length,
    maxAbsReturnCorrelation: maxAbsRetCorr,
    maxAbsReturnCorrelationPair: maxAbsRetCorrPair,
    maxAbsZCloseCorrelation: maxAbsZCloseCorr,
    maxAbsZCloseCorrelationPair: maxAbsZCloseCorrPair,
    maxAbsZClosePostBootCorrelation: maxAbsZClosePostCorr,
    maxAbsZClosePostBootCorrelationPair: maxAbsZClosePostCorrPair,
    meanRangeRatioPostOverPre: mean(validRangeRatios),
    minRangeRatioPostOverPre: validRangeRatios.length ? Math.min(...validRangeRatios) : null,
    maxRangeRatioPostOverPre: validRangeRatios.length ? Math.max(...validRangeRatios) : null,
    meanStdRatioPostOverPre: mean(validStdRatios),
    pastUnchangedCount: assetList.filter((a) => a.pastUnchangedByTimestamp === true).length,
    sameStaticCurveShiftedCount: assetList.filter((a) => a.sameStaticCurveShiftedInTime === true).length,
    meanJumpBeforeToAfterRestartPct: mean(
      assetList.map((a) => a.jumpBeforeToAfterRestartPct).filter((v) => v !== null)
    ),
    maxJunctionJumpPct: Math.max(...assetList.map((a) => a.junctionJumpPct || 0)),
  };

  const fullReport = {
    summary,
    perAsset,
    returnCorrMatrix,
    zCloseCorrMatrix,
    zClosePostCorrMatrix,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(fullReport, null, 2), 'utf8');

  const lines = [];
  lines.push('=== DIAGNÓSTICO DE GRÁFICOS E PREÇOS (36 ATIVOS) ===');
  lines.push(`Data/Hora: ${summary.timestamp}`);
  lines.push(`Servidor: ${summary.baseUrl} | Limit: ${summary.limit}`);
  lines.push('');
  lines.push('--- RESUMO GLOBAL ---');
  lines.push(`a) Maior |correlação| de retornos log 1m (36x36): ${summary.maxAbsReturnCorrelation.toFixed(4)} [${summary.maxAbsReturnCorrelationPair}] (Esperado: < 0.10)`);
  lines.push(`b) Maior |correlação| de close normalizado z-score (36x36): ${summary.maxAbsZCloseCorrelation.toFixed(4)} [${summary.maxAbsZCloseCorrelationPair}]`);
  lines.push(`   Maior |correlação| de close z-score PÓS-BOOT (36x36): ${summary.maxAbsZClosePostBootCorrelation.toFixed(4)} [${summary.maxAbsZClosePostBootCorrelationPair}]`);
  lines.push(`c) Razão média de amplitude 60v (H-L)/C (Pós-Boot / Pré-Boot): ${summary.meanRangeRatioPostOverPre.toFixed(2)}x [min=${summary.minRangeRatioPostOverPre?.toFixed(2)}x, max=${summary.maxRangeRatioPostOverPre?.toFixed(2)}x] (Esperado: 0.80x a 1.25x)`);
  lines.push(`   Razão média de std(retornos log 1m) (Pós-Boot / Pré-Boot): ${summary.meanStdRatioPostOverPre.toFixed(2)}x`);
  lines.push(`d) Ativos cujo passado (por timestamp) NÃO mudou após 2 restarts seguidos: ${summary.pastUnchangedCount}/36 (Esperado: 36/36)`);
  lines.push(`   Ativos que redesenharam a MESMA curva estática deslocada no tempo: ${summary.sameStaticCurveShiftedCount}/36`);
  lines.push(`e) Salto médio | último close antes do restart -> último close pós-2-restarts |: ${summary.meanJumpBeforeToAfterRestartPct.toFixed(4)}%`);
  lines.push(`   Maior salto na junção (última vela seed -> 1ª vela oficial): ${summary.maxJunctionJumpPct.toFixed(6)}%`);
  lines.push('');
  lines.push('--- DETALHE DOS ATIVOS PRINCIPAIS (VOL_50, USDJPY_OTC, EURUSD_OTC, GBPUSD_OTC, BTCUSD_OTC, XAUUSD_OTC) ---');
  for (const sym of ['VOL_50', 'USDJPY_OTC', 'EURUSD_OTC', 'GBPUSD_OTC', 'BTCUSD_OTC', 'XAUUSD_OTC']) {
    const a = perAsset[sym];
    if (!a) continue;
    lines.push(
      `${sym.padEnd(14)} | pre=${a.preBootCount} post=${a.postBootCount} | ` +
      `Range60(pre=${(a.meanRangePre * 100).toFixed(4)}%, post=${(a.meanRangePost * 100).toFixed(4)}%, ratio=${a.rangeRatioPostOverPre?.toFixed(2)}x) | ` +
      `StdRetRatio=${a.stdRatioPostOverPre?.toFixed(2)}x | ` +
      `AC1(pre=${a.autocorrLag1Pre.toFixed(3)}, post=${a.autocorrLag1Post.toFixed(3)}) | ` +
      `DistBase(pre=${a.meanDistFromBasePctPre.toFixed(3)}%, post=${a.meanDistFromBasePctPost?.toFixed(3)}%) | ` +
      `Close(preRestart=${a.lastCloseBeforeRestart}, tick1=${a.firstLiveTickAfterRestart}) | ` +
      `PastUnchanged2Restarts=${a.pastUnchangedByTimestamp} SameStaticCurve=${a.sameStaticCurveShiftedInTime}`
    );
  }

  const txt = lines.join('\n') + '\n';
  fs.writeFileSync(OUT_TXT, txt, 'utf8');
  console.log('\n' + txt);
  console.log(`[diag-charts] JSON salvo em: ${OUT_JSON}`);
  console.log(`[diag-charts] Resumo salvo em: ${OUT_TXT}`);
}

main().catch((err) => {
  console.error('[diag-charts FATAL]', err);
  process.exit(1);
});
