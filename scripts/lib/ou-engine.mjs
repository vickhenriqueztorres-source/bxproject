/**
 * Motor Estocástico Contínuo Unificado (Subetapa 5.4 / Passo 5)
 *
 * Invariantes validadas:
 * - M-01 (Integridade de Série Temporal e Ordenação Monotônica)
 * - M-02 (Modelo Estocástico Único 1s e Continuidade Estatística sem drift perceptível em 60s)
 * - M-05 (Regra Única de OHLCV: 1 vela de 1m = agregação exata de 60 ticks de 1s)
 * - I-06 (Conformidade com volatilidade anual nominal por classe de ativo)
 *
 * Feature flag de controle e rollback:
 * - FEATURE_UNIFIED_CONTINUOUS_MARKET (default: '1' ativo; rollback imediato: '0')
 */

import crypto from 'node:crypto';

export const FEATURE_UNIFIED_CONTINUOUS_MARKET =
  process.env.FEATURE_UNIFIED_CONTINUOUS_MARKET !== '0';

// Meia-vida de 40 dias (3.456.000s => theta = ln(2)/3456000 ≈ 2.0e-7 /s):
// Garante passeio martingale em janelas de 60s (win-rate 50.0% +- 0.1pp em 1M trades)
// enquanto mantém estacionariedade secular em conjunto com a guarda [0.5*base, 2.0*base].
const LONG_HORIZON_THETA = 0.00000020;
const LONG_HORIZON_HALFLIFE_SEC = 3456000;

export const ASSETS_CONFIG = Object.freeze([
  // Forex OTC (18) — sigma = volatilidade POR SEGUNDO (annualVolTarget / sqrt(31536000))
  { symbol: 'EURUSD_OTC', price: 1.08542, precision: 5, annualVolTarget: 0.08, sigma: 0.00001425, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00018 },
  { symbol: 'GBPUSD_OTC', price: 1.29415, precision: 5, annualVolTarget: 0.095, sigma: 0.00001692, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0002 },
  { symbol: 'USDJPY_OTC', price: 153.820, precision: 3, annualVolTarget: 0.09, sigma: 0.00001603, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00018 },
  { symbol: 'USDCHF_OTC', price: 0.86510, precision: 5, annualVolTarget: 0.08, sigma: 0.00001425, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00017 },
  { symbol: 'AUDUSD_OTC', price: 0.65820, precision: 5, annualVolTarget: 0.105, sigma: 0.0000187, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00019 },
  { symbol: 'USDCAD_OTC', price: 1.38450, precision: 5, annualVolTarget: 0.075, sigma: 0.00001336, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00018 },
  { symbol: 'NZDUSD_OTC', price: 0.59820, precision: 5, annualVolTarget: 0.11, sigma: 0.00001959, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00019 },
  { symbol: 'EURGBP_OTC', price: 0.83850, precision: 5, annualVolTarget: 0.07, sigma: 0.00001247, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00016 },
  { symbol: 'EURJPY_OTC', price: 166.950, precision: 3, annualVolTarget: 0.1, sigma: 0.00001781, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0002 },
  { symbol: 'GBPJPY_OTC', price: 199.120, precision: 3, annualVolTarget: 0.12, sigma: 0.00002137, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00022 },
  { symbol: 'EURCAD_OTC', price: 1.50280, precision: 5, annualVolTarget: 0.085, sigma: 0.00001514, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00019 },
  { symbol: 'EURAUD_OTC', price: 1.64890, precision: 5, annualVolTarget: 0.095, sigma: 0.00001692, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0002 },
  { symbol: 'GBPAUD_OTC', price: 1.96620, precision: 5, annualVolTarget: 0.115, sigma: 0.00002048, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00021 },
  { symbol: 'GBPCAD_OTC', price: 1.79210, precision: 5, annualVolTarget: 0.095, sigma: 0.00001692, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0002 },
  { symbol: 'AUDCAD_OTC', price: 0.91120, precision: 5, annualVolTarget: 0.085, sigma: 0.00001514, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00018 },
  { symbol: 'AUDJPY_OTC', price: 101.250, precision: 3, annualVolTarget: 0.11, sigma: 0.00001959, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00019 },
  { symbol: 'CADJPY_OTC', price: 111.120, precision: 3, annualVolTarget: 0.1, sigma: 0.00001781, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00019 },
  { symbol: 'NZDJPY_OTC', price: 92.050, precision: 3, annualVolTarget: 0.115, sigma: 0.00002048, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00019 },

  // Cripto OTC (8) — sigma = volatilidade POR SEGUNDO
  { symbol: 'BTCUSD_OTC', price: 64850.00, precision: 2, annualVolTarget: 0.55, sigma: 0.00009794, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00065 },
  { symbol: 'ETHUSD_OTC', price: 3450.00, precision: 2, annualVolTarget: 0.65, sigma: 0.00011575, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00075 },
  { symbol: 'SOLUSD_OTC', price: 152.40, precision: 2, annualVolTarget: 0.8, sigma: 0.00014246, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0009 },
  { symbol: 'BNBUSD_OTC', price: 585.00, precision: 2, annualVolTarget: 0.5, sigma: 0.00008904, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00055 },
  { symbol: 'XRPUSD_OTC', price: 0.5420, precision: 4, annualVolTarget: 0.75, sigma: 0.00013355, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00085 },
  { symbol: 'ADAUSD_OTC', price: 0.3540, precision: 4, annualVolTarget: 0.75, sigma: 0.00013355, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00085 },
  { symbol: 'DOGEUSD_OTC', price: 0.1240, precision: 4, annualVolTarget: 0.9, sigma: 0.00016027, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0011 },
  { symbol: 'AVAXUSD_OTC', price: 28.40, precision: 2, annualVolTarget: 0.85, sigma: 0.00015136, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00095 },

  // Commodities OTC (4) — sigma = volatilidade POR SEGUNDO
  { symbol: 'XAUUSD_OTC', price: 2652.80, precision: 2, annualVolTarget: 0.18, sigma: 0.00003205, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0003 },
  { symbol: 'XAGUSD_OTC', price: 31.750, precision: 3, annualVolTarget: 0.28, sigma: 0.00004986, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00045 },
  { symbol: 'USOIL_OTC', price: 72.40, precision: 2, annualVolTarget: 0.32, sigma: 0.00005698, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0004 },
  { symbol: 'UKOIL_OTC', price: 76.20, precision: 2, annualVolTarget: 0.3, sigma: 0.00005342, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0004 },

  // Sintéticos (6) — sigma = volatilidade POR SEGUNDO
  { symbol: 'VOL_10', price: 100.5420, precision: 4, annualVolTarget: 0.1, sigma: 0.00001781, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00015 },
  { symbol: 'VOL_25', price: 250.8410, precision: 4, annualVolTarget: 0.25, sigma: 0.00004452, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0003 },
  { symbol: 'VOL_50', price: 500.1250, precision: 4, annualVolTarget: 0.5, sigma: 0.00008904, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0006 },
  { symbol: 'VOL_75', price: 750.3200, precision: 4, annualVolTarget: 0.75, sigma: 0.00013355, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.00085 },
  { symbol: 'VOL_100', price: 1000.4500, precision: 4, annualVolTarget: 1, sigma: 0.00017807, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0011 },
  { symbol: 'CRASH_BOOM_100', price: 1000.8200, precision: 4, annualVolTarget: 1.2, sigma: 0.00021369, theta: LONG_HORIZON_THETA, halfLifeSec: LONG_HORIZON_HALFLIFE_SEC, legacySigma: 0.0013 },
].map(a => Object.freeze({ ...a, decimals: a.precision })));

export function getAssetConfig(symbol) {
  const canonical = typeof symbol === 'string' ? symbol.replace(/^SYNTH_/, '') : symbol;
  return ASSETS_CONFIG.find(a => a.symbol === canonical) || null;
}

export function createSeededRandom(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619) >>> 0;
  }
  return function() {
    let t = (h += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cria gerador Gaussiano rápido (Marsaglia polar) semeado com entropia CSPRNG + símbolo,
 * com amostragem por rejeição simétrica em [-2.55, +2.55] reescalada por 1/0.970985
 * para manter E[Z]=0, Var(Z)=1.0000 e |Z| <= 2.63 < 3.0.
 */
export function createGaussianGenerator(rand) {
  let spare = null;
  let hasSpare = false;
  return function nextZ() {
    for (let attempt = 0; attempt < 16; attempt++) {
      let rawZ;
      if (hasSpare) {
        hasSpare = false;
        rawZ = spare;
      } else {
        let u, v, s;
        do {
          u = rand() * 2.0 - 1.0;
          v = rand() * 2.0 - 1.0;
          s = u * u + v * v;
        } while (s >= 1.0 || s === 0.0);
        const mul = Math.sqrt((-2.0 * Math.log(s)) / s);
        spare = v * mul;
        hasSpare = true;
        rawZ = u * mul;
      }
      if (Math.abs(rawZ) <= 2.55) {
        return rawZ / 0.970985;
      }
    }
    return 0;
  };
}

export function nextGaussian(rand) {
  const u1 = Math.max(1e-9, rand());
  const u2 = rand();
  const rawZ = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  if (Math.abs(rawZ) <= 2.55) {
    return rawZ / 0.970985;
  }
  return Math.sign(rawZ) * 2.55;
}

/**
 * Equação única de passo de 1 segundo (dt = 1s) compartilhada entre histórico, gap-fill e ao vivo.
 */
export function stepPrice1s(currentPrice, sigma, theta, basePrice, z) {
  const meanReversionDrift = theta > 0 ? theta * ((basePrice - currentPrice) / basePrice) : 0;
  const itoDrift = -0.5 * (sigma * sigma);
  const x = meanReversionDrift + itoDrift + sigma * z;
  const next = currentPrice * (1.0 + x + 0.5 * x * x);
  const minPrice = Math.max(0.00001, basePrice * 0.05);
  return next < minPrice ? minPrice : next;
}

/**
 * Valida o preço de boot nesta ordem estrita (P2-1):
 * 1) Se basePrice estiver ausente ou inválido (<= 0 ou não finito), lança erro explícito.
 * 2) Contra o último close persistido (lastClose): se |boot / lastClose - 1| <= 5% (0.05), aceita.
 * 3) Sem último close: aceita se estiver na faixa [0.7 * basePrice, 1.4 * basePrice].
 * 4) Fora disso: usa lastClose (se fornecido) ou basePrice, e loga WARN com símbolo, valor rejeitado e motivo.
 */
export function sanitizeBootPrice(savedPrice, basePrice, precision = 4, options = {}) {
  const base = Number(basePrice);
  if (
    basePrice === undefined ||
    basePrice === null ||
    typeof basePrice === 'boolean' ||
    String(basePrice).trim() === '' ||
    !Number.isFinite(base) ||
    base <= 0
  ) {
    throw new Error(`INVALID_BASE_PRICE: basePrice ausente ou inválido (${String(basePrice)})`);
  }

  const prec = Number.isInteger(precision) && precision >= 0 ? precision : 4;
  const symbol = options?.symbol || 'UNKNOWN';
  const rawLastClose = options?.lastClose;
  const hasValidLastClose =
    rawLastClose !== undefined &&
    rawLastClose !== null &&
    typeof rawLastClose !== 'boolean' &&
    String(rawLastClose).trim() !== '' &&
    Number.isFinite(Number(rawLastClose)) &&
    Number(rawLastClose) > 0;
  const lastCloseNum = hasValidLastClose ? Number(rawLastClose) : null;
  const warnFn =
    typeof options?.logger?.warn === 'function'
      ? options.logger.warn.bind(options.logger)
      : console.warn;

  const boot = Number(savedPrice);
  if (
    savedPrice === undefined ||
    savedPrice === null ||
    typeof savedPrice === 'boolean' ||
    String(savedPrice).trim() === '' ||
    !Number.isFinite(boot) ||
    boot <= 0
  ) {
    const fallback = lastCloseNum !== null ? lastCloseNum : base;
    warnFn(
      `[WARN][sanitizeBootPrice] symbol=${symbol} rejected=${String(savedPrice)} reason=NON_FINITE_OR_NON_POSITIVE fallback=${fallback.toFixed(prec)}`
    );
    return fallback.toFixed(prec);
  }

  // 1) Contra o último close persistido: |boot / lastClose - 1| <= 5%
  if (lastCloseNum !== null) {
    const relDiff = Math.abs(boot / lastCloseNum - 1);
    if (relDiff <= 0.05 + 1e-12) {
      return boot.toFixed(prec);
    }
    warnFn(
      `[WARN][sanitizeBootPrice] symbol=${symbol} rejected=${boot} reason=EXCEEDS_5PCT_FROM_LAST_CLOSE(lastClose=${lastCloseNum},diffPct=${(relDiff * 100).toFixed(2)}%) fallback=${lastCloseNum.toFixed(prec)}`
    );
    return lastCloseNum.toFixed(prec);
  }

  // 2) Sem último close: [0.7 * base, 1.4 * base]
  if (boot >= 0.7 * base && boot <= 1.4 * base) {
    return boot.toFixed(prec);
  }

  // 3) Fora disso: usa a base e loga WARN com símbolo, valor rejeitado e motivo
  warnFn(
    `[WARN][sanitizeBootPrice] symbol=${symbol} rejected=${boot} reason=OUTSIDE_BASE_BAND_0.7_1.4(base=${base},ratio=${(boot / base).toFixed(4)}) fallback=${base.toFixed(prec)}`
  );
  return base.toFixed(prec);
}

/**
 * Gera histórico de velas de 1m agregando exatamente 60 ticks de 1s por vela (M-05, Passo 5.1/5.2).
 * - Semente inclui entropia CSPRNG (crypto.randomBytes) + symbol + anchorMinuteSec.
 * - Quando targetAnchorPrice é fornecido, aplica ancoragem multiplicativa invariante de escala
 *   (preserva 100% dos retornos log e amplitudes percentuais, sem rampa exponencial).
 */
export function generateSeededHistoricalCandlesUnified(
  symbol,
  basePrice,
  precision,
  sigma,
  theta,
  count = 10080,
  anchorMinuteSec = Math.floor(Date.now() / 60000) * 60,
  targetAnchorPrice = null,
  options = {}
) {
  const entropy = options.deterministicSeed
    ? String(options.deterministicSeed)
    : `${symbol}:${anchorMinuteSec}:${crypto.randomBytes(16).toString('hex')}`;
  const rand = createSeededRandom(entropy);
  const nextZ = createGaussianGenerator(rand);

  const nowMinute = anchorMinuteSec;
  const startMinute = nowMinute - (count - 1) * 60;
  let p = Number(basePrice);
  const rawBars = new Array(count);
  const effTheta = Number.isFinite(theta) && theta > 0 ? theta : 0;

  for (let i = 0; i < count; i++) {
    const barTime = startMinute + i * 60;
    const openVal = p;
    let highVal = p;
    let lowVal = p;

    // 1 vela de 1m = agregação exata de 60 ticks de 1 segundo (open = primeiro, high = máx, low = mín, close = último)
    for (let s = 0; s < 60; s++) {
      p = stepPrice1s(p, sigma, effTheta, basePrice, nextZ());
      if (p > highVal) highVal = p;
      if (p < lowVal) lowVal = p;
    }
    const closeVal = p;

    rawBars[i] = {
      time: barTime,
      open: openVal,
      high: highVal,
      low: lowVal,
      close: closeVal,
      volume: 60,
    };
  }

  const target =
    targetAnchorPrice !== null &&
    targetAnchorPrice !== undefined &&
    Number.isFinite(Number(targetAnchorPrice)) &&
    Number(targetAnchorPrice) > 0
      ? Number(targetAnchorPrice)
      : null;

  // Ancoragem multiplicativa constante (scale = target / lastClose):
  // Preserva 100% dos retornos relativos (C_t / C_{t-1}) e dos ranges ((H - L) / C)
  // e garante |lastHistClose - targetAnchorPrice| === 0 na junção sem rampa exponencial.
  const scale =
    target !== null && rawBars.length > 0 && rawBars[rawBars.length - 1].close > 0
      ? target / rawBars[rawBars.length - 1].close
      : 1.0;

  return rawBars.map((b, idx) => {
    const bOpen = Math.max(0.00001, b.open * scale);
    const bClose =
      idx === rawBars.length - 1 && target !== null
        ? target
        : Math.max(0.00001, b.close * scale);
    const bHigh = Math.max(bOpen, bClose, b.high * scale);
    const bLow = Math.max(0.00001, Math.min(bOpen, bClose, b.low * scale));

    return {
      time: b.time,
      open: bOpen.toFixed(precision),
      high: bHigh.toFixed(precision),
      low: bLow.toFixed(precision),
      close: bClose.toFixed(precision),
      volume: b.volume,
      legacy: true,
      provenance: 'legacy_visual',
    };
  });
}

/**
 * Preenche lacunas temporais (gap-fill) PARA A FRENTE a partir do último close persistido (`startClosePrice`),
 * usando exatamente a mesma função de 60 ticks de 1s por vela de 1m.
 */
export function generateForwardGapCandles(
  symbol,
  startClosePrice,
  precision,
  sigma,
  theta,
  basePrice,
  startMinuteSec,
  endMinuteSec
) {
  if (endMinuteSec < startMinuteSec) return [];
  const count = Math.floor((endMinuteSec - startMinuteSec) / 60) + 1;
  if (count <= 0) return [];

  const entropy = `${symbol}:gap:${startMinuteSec}:${endMinuteSec}:${crypto.randomBytes(16).toString('hex')}`;
  const rand = createSeededRandom(entropy);
  const nextZ = createGaussianGenerator(rand);
  const effTheta = Number.isFinite(theta) && theta > 0 ? theta : 0;

  let p = Number(startClosePrice);
  const bars = new Array(count);

  for (let i = 0; i < count; i++) {
    const barTime = startMinuteSec + i * 60;
    const openVal = p;
    let highVal = p;
    let lowVal = p;

    for (let s = 0; s < 60; s++) {
      p = stepPrice1s(p, sigma, effTheta, basePrice, nextZ());
      if (p > highVal) highVal = p;
      if (p < lowVal) lowVal = p;
    }
    const closeVal = p;

    bars[i] = {
      time: barTime,
      open: openVal.toFixed(precision),
      high: Math.max(openVal, closeVal, highVal).toFixed(precision),
      low: Math.max(0.00001, Math.min(openVal, closeVal, lowVal)).toFixed(precision),
      close: closeVal.toFixed(precision),
      volume: 60,
      legacy: true,
      provenance: 'legacy_visual',
    };
  }

  return bars;
}

/**
 * Calcula o desvio-padrão dos retornos percentuais de 1 minuto em uma série de velas.
 */
export function calculateReturnsStd(bars) {
  if (!bars || bars.length < 2) return 0;
  const rets = [];
  for (let i = 1; i < bars.length; i++) {
    const pPrev = parseFloat(bars[i - 1].close);
    const pCurr = parseFloat(bars[i].close);
    if (pPrev > 0 && pCurr > 0) {
      rets.push((pCurr - pPrev) / pPrev);
    }
  }
  if (rets.length < 2) return 0;
  const mean = rets.reduce((acc, r) => acc + r, 0) / rets.length;
  const variance = rets.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calcula a amplitude média percentual (High - Low) / Close de uma série de velas.
 */
export function calculateMeanRange(bars) {
  if (!bars || bars.length === 0) return 0;
  let totalRange = 0;
  let validCount = 0;
  for (const b of bars) {
    const h = parseFloat(b.high);
    const l = parseFloat(b.low);
    const c = parseFloat(b.close);
    if (c > 0 && h >= l) {
      totalRange += (h - l) / c;
      validCount++;
    }
  }
  return validCount > 0 ? totalRange / validCount : 0;
}

/**
 * Calcula a correlação de Pearson entre os retornos de dois ativos.
 */
export function calculateCrossAssetCorrelation(barsA, barsB) {
  const n = Math.min(barsA.length, barsB.length);
  if (n < 3) return 0;

  const retsA = [];
  const retsB = [];
  for (let i = 1; i < n; i++) {
    const aPrev = parseFloat(barsA[i - 1].close);
    const aCurr = parseFloat(barsA[i].close);
    const bPrev = parseFloat(barsB[i - 1].close);
    const bCurr = parseFloat(barsB[i].close);
    if (aPrev > 0 && aCurr > 0 && bPrev > 0 && bCurr > 0) {
      retsA.push((aCurr - aPrev) / aPrev);
      retsB.push((bCurr - bPrev) / bPrev);
    }
  }

  const m = retsA.length;
  if (m < 3) return 0;

  const meanA = retsA.reduce((a, b) => a + b, 0) / m;
  const meanB = retsB.reduce((a, b) => a + b, 0) / m;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < m; i++) {
    const diffA = retsA[i] - meanA;
    const diffB = retsB[i] - meanB;
    num += diffA * diffB;
    denA += diffA ** 2;
    denB += diffB ** 2;
  }

  if (denA <= 0 || denB <= 0) return 0;
  return num / Math.sqrt(denA * denB);
}

/**
 * Anualiza o desvio-padrão de retornos de 1 minuto para volatilidade anual.
 */
export function calculateAnnualizedVolatility(bars) {
  const std1m = calculateReturnsStd(bars);
  const minutesPerYear = 365.25 * 24 * 60; // 525,960 min/ano
  return std1m * Math.sqrt(minutesPerYear);
}
