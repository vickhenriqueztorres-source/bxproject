import type { UTCTimestamp } from 'lightweight-charts';
import { normalizeTimeSeconds } from './chart-sanitizer';

export interface IndicatorPoint {
  time: UTCTimestamp;
  value: number;
}

export interface BollingerPoint {
  time: UTCTimestamp;
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdPoint {
  time: UTCTimestamp;
  macd: number;
  signal: number;
  histogram: number;
}

export interface StochasticPoint {
  time: UTCTimestamp;
  k: number;
  d: number;
}

export type CandleInput = {
  time?: UTCTimestamp | number | string;
  open_time?: string;
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close: number | string;
  volume?: number | string;
};

export interface AlignedCandleValue {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function extractCandleValues(c: CandleInput): AlignedCandleValue {
  const normalizedTime = normalizeTimeSeconds(c.time ?? c.open_time);
  const epochSec = (normalizedTime ?? Math.floor(Date.now() / 1000)) as UTCTimestamp;

  const close = Number(c.close);
  const open = c.open !== undefined ? Number(c.open) : close;
  const rawHigh = c.high !== undefined ? Number(c.high) : Math.max(open, close);
  const rawLow = c.low !== undefined ? Number(c.low) : Math.min(open, close);
  const high = Math.max(open, close, Number.isFinite(rawHigh) ? rawHigh : open);
  const low = Math.min(open, close, Number.isFinite(rawLow) ? rawLow : close);
  const rawVol = c.volume !== undefined ? Number(c.volume) : 1;
  const volume = Number.isFinite(rawVol) && rawVol >= 0 ? rawVol : 1;

  return { time: epochSec, open, high, low, close, volume };
}

/**
 * Sanitiza, ordena em UTC crescente e deduplica velas antes do cálculo de aquecimento (warmup)
 * de qualquer indicador técnico (#1344 - previne aquecimento invertido ou crash no setData).
 */
export function prepareAlignedCandles(candles: CandleInput[]): AlignedCandleValue[] {
  if (!candles || candles.length === 0) return [];

  const extracted: AlignedCandleValue[] = [];
  for (let i = 0; i < candles.length; i++) {
    const raw = candles[i];
    if (!raw || typeof raw !== 'object') continue;
    const val = extractCandleValues(raw);
    if (
      Number.isFinite(val.time) &&
      val.time > 0 &&
      Number.isFinite(val.close) &&
      val.close > 0 &&
      Number.isFinite(val.open) &&
      Number.isFinite(val.high) &&
      Number.isFinite(val.low)
    ) {
      extracted.push(val);
    }
  }

  if (extracted.length === 0) return [];

  extracted.sort((a, b) => Number(a.time) - Number(b.time));

  const deduplicated: AlignedCandleValue[] = [extracted[0]];
  for (let i = 1; i < extracted.length; i++) {
    const cur = extracted[i];
    const prev = deduplicated[deduplicated.length - 1];
    if (cur.time === prev.time) {
      prev.high = Math.max(prev.high, cur.high, prev.open, cur.close);
      prev.low = Math.min(prev.low, cur.low, prev.open, cur.close);
      prev.close = cur.close;
      prev.volume += cur.volume;
    } else if (cur.time > prev.time) {
      deduplicated.push(cur);
    }
  }

  return deduplicated;
}

/**
 * Calcula Média Móvel Simples (SMA)
 */
export function calculateSMA(candles: CandleInput[], period: number): IndicatorPoint[] {
  const aligned = prepareAlignedCandles(candles);
  if (aligned.length < period || period <= 0) return [];
  const result: IndicatorPoint[] = [];

  for (let i = period - 1; i < aligned.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += aligned[i - j].close;
    }
    result.push({
      time: aligned[i].time,
      value: Number((sum / period).toFixed(4)),
    });
  }

  return result;
}

/**
 * Calcula Média Móvel Exponencial (EMA)
 */
export function calculateEMA(candles: CandleInput[], period: number): IndicatorPoint[] {
  const aligned = prepareAlignedCandles(candles);
  if (aligned.length < period || period <= 0) return [];
  const result: IndicatorPoint[] = [];
  const multiplier = 2 / (period + 1);

  // Inicializar com SMA dos primeiros `period` elementos
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += aligned[i].close;
  }
  let prevEma = sum / period;
  result.push({ time: aligned[period - 1].time, value: Number(prevEma.toFixed(4)) });

  for (let i = period; i < aligned.length; i++) {
    const close = aligned[i].close;
    const curEma = (close - prevEma) * multiplier + prevEma;
    prevEma = curEma;
    result.push({
      time: aligned[i].time,
      value: Number(curEma.toFixed(4)),
    });
  }

  return result;
}

/**
 * Calcula Média Móvel Ponderada (WMA)
 * Dá peso linear decrescente (mais recente tem maior peso)
 */
export function calculateWMA(candles: CandleInput[], period: number): IndicatorPoint[] {
  const aligned = prepareAlignedCandles(candles);
  if (aligned.length < period || period <= 0) return [];
  const result: IndicatorPoint[] = [];
  const weightSum = (period * (period + 1)) / 2;

  for (let i = period - 1; i < aligned.length; i++) {
    let weightedSum = 0;
    for (let j = 0; j < period; j++) {
      const weight = period - j;
      weightedSum += aligned[i - j].close * weight;
    }
    result.push({
      time: aligned[i].time,
      value: Number((weightedSum / weightSum).toFixed(4)),
    });
  }

  return result;
}

/**
 * Calcula Bandas de Bollinger (SMA + Desvio Padrão * k)
 */
export function calculateBollinger(
  candles: CandleInput[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerPoint[] {
  const aligned = prepareAlignedCandles(candles);
  if (aligned.length < period || period <= 0) return [];
  const result: BollingerPoint[] = [];

  for (let i = period - 1; i < aligned.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += aligned[i - j].close;
    }
    const mean = sum / period;

    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow(aligned[i - j].close - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    result.push({
      time: aligned[i].time,
      upper: Number((mean + stdDevMultiplier * stdDev).toFixed(4)),
      middle: Number(mean.toFixed(4)),
      lower: Number((mean - stdDevMultiplier * stdDev).toFixed(4)),
    });
  }

  return result;
}

/**
 * Calcula RSI (Relative Strength Index) com suavização de Wilder
 */
export function calculateRSI(candles: CandleInput[], period: number = 14): IndicatorPoint[] {
  const aligned = prepareAlignedCandles(candles);
  if (aligned.length <= period || period <= 0) return [];
  const result: IndicatorPoint[] = [];

  const changes: number[] = [];
  for (let i = 1; i < aligned.length; i++) {
    changes.push(aligned[i].close - aligned[i - 1].close);
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const ch = changes[i];
    if (ch >= 0) avgGain += ch;
    else avgLoss += Math.abs(ch);
  }
  avgGain /= period;
  avgLoss /= period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  result.push({ time: aligned[period].time, value: Number(rsi.toFixed(2)) });

  // Suavização exponencial de Wilder para os próximos períodos
  for (let i = period; i < changes.length; i++) {
    const ch = changes[i];
    const gain = ch >= 0 ? ch : 0;
    const loss = ch < 0 ? Math.abs(ch) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    result.push({ time: aligned[i + 1].time, value: Number(rsi.toFixed(2)) });
  }

  return result;
}

/**
 * Calcula MACD (Moving Average Convergence Divergence)
 * Padrão: 12 (fast), 26 (slow), 9 (signal)
 */
export function calculateMACD(
  candles: CandleInput[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MacdPoint[] {
  const aligned = prepareAlignedCandles(candles);
  if (aligned.length < slowPeriod + signalPeriod - 1) return [];

  const fastEma = calculateEMA(aligned, fastPeriod);
  const slowEma = calculateEMA(aligned, slowPeriod);

  // Mapear tempos para alinhamento
  const fastMap = new Map<UTCTimestamp, number>();
  for (const f of fastEma) fastMap.set(f.time, f.value);

  // Linha MACD = FastEMA - SlowEMA
  const macdLinePoints: { time: UTCTimestamp; value: number }[] = [];
  for (const s of slowEma) {
    const fVal = fastMap.get(s.time);
    if (fVal !== undefined) {
      macdLinePoints.push({
        time: s.time,
        value: Number((fVal - s.value).toFixed(4)),
      });
    }
  }

  if (macdLinePoints.length < signalPeriod) return [];

  // Linha de Sinal = EMA(macdLinePoints, signalPeriod)
  const signalMultiplier = 2 / (signalPeriod + 1);
  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    sum += macdLinePoints[i].value;
  }
  let prevSignal = sum / signalPeriod;

  const result: MacdPoint[] = [];
  const firstMacd = macdLinePoints[signalPeriod - 1];
  result.push({
    time: firstMacd.time,
    macd: firstMacd.value,
    signal: Number(prevSignal.toFixed(4)),
    histogram: Number((firstMacd.value - prevSignal).toFixed(4)),
  });

  for (let i = signalPeriod; i < macdLinePoints.length; i++) {
    const curVal = macdLinePoints[i].value;
    const curSignal = (curVal - prevSignal) * signalMultiplier + prevSignal;
    prevSignal = curSignal;

    result.push({
      time: macdLinePoints[i].time,
      macd: curVal,
      signal: Number(curSignal.toFixed(4)),
      histogram: Number((curVal - curSignal).toFixed(4)),
    });
  }

  return result;
}

/**
 * Calcula Oscilador Estocástico (%K e %D)
 * Padrão: 14 (%K), 3 (%D)
 */
export function calculateStochastic(
  candles: CandleInput[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticPoint[] {
  const aligned = prepareAlignedCandles(candles);
  if (aligned.length < kPeriod + dPeriod - 1 || kPeriod <= 0 || dPeriod <= 0) return [];

  const rawK: { time: UTCTimestamp; k: number }[] = [];

  for (let i = kPeriod - 1; i < aligned.length; i++) {
    let minLow = Infinity;
    let maxHigh = -Infinity;

    for (let j = 0; j < kPeriod; j++) {
      const c = aligned[i - j];
      if (c.low < minLow) minLow = c.low;
      if (c.high > maxHigh) maxHigh = c.high;
    }

    const cur = aligned[i];
    const range = maxHigh - minLow;
    const kVal = range === 0 ? 50 : ((cur.close - minLow) / range) * 100;

    rawK.push({
      time: cur.time,
      k: Number(kVal.toFixed(2)),
    });
  }

  if (rawK.length < dPeriod) return [];

  // %D = SMA de %K sobre dPeriod
  const result: StochasticPoint[] = [];
  for (let i = dPeriod - 1; i < rawK.length; i++) {
    let sum = 0;
    for (let j = 0; j < dPeriod; j++) {
      sum += rawK[i - j].k;
    }
    const dVal = sum / dPeriod;
    result.push({
      time: rawK[i].time,
      k: rawK[i].k,
      d: Number(dVal.toFixed(2)),
    });
  }

  return result;
}

/**
 * Calcula Average True Range (ATR)
 * Medição de volatilidade absoluta de Welles Wilder
 */
export function calculateATR(candles: CandleInput[], period: number = 14): IndicatorPoint[] {
  const aligned = prepareAlignedCandles(candles);
  if (aligned.length <= period || period <= 0) return [];
  const result: IndicatorPoint[] = [];

  // Calcular True Range (TR)
  const trValues: { time: UTCTimestamp; tr: number }[] = [];
  const first = aligned[0];
  trValues.push({ time: first.time, tr: first.high - first.low });

  for (let i = 1; i < aligned.length; i++) {
    const cur = aligned[i];
    const prev = aligned[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trValues.push({ time: cur.time, tr });
  }

  // Primeiro ATR: SMA dos primeiros `period` TRs
  let sum = 0;
  for (let i = 1; i <= period; i++) {
    sum += trValues[i].tr;
  }
  let prevAtr = sum / period;
  result.push({ time: trValues[period].time, value: Number(prevAtr.toFixed(4)) });

  // Suavização de Wilder
  for (let i = period + 1; i < trValues.length; i++) {
    const curAtr = (prevAtr * (period - 1) + trValues[i].tr) / period;
    prevAtr = curAtr;
    result.push({ time: trValues[i].time, value: Number(curAtr.toFixed(4)) });
  }

  return result;
}

/**
 * Calcula Volume Weighted Average Price (VWAP)
 * Acumulado ponderado por volume: Σ(TypicalPrice * Volume) / Σ(Volume)
 */
export function calculateVWAP(candles: CandleInput[]): IndicatorPoint[] {
  const aligned = prepareAlignedCandles(candles);
  if (aligned.length === 0) return [];
  const result: IndicatorPoint[] = [];

  let cumVol = 0;
  let cumTPV = 0;

  for (const c of aligned) {
    const { time, high, low, close, volume } = c;
    const tp = (high + low + close) / 3;
    cumVol += volume;
    cumTPV += tp * volume;

    const vwap = cumVol === 0 ? tp : cumTPV / cumVol;
    result.push({
      time,
      value: Number(vwap.toFixed(4)),
    });
  }

  return result;
}

/**
 * Calcula Commodity Channel Index (CCI)
 * CCI = (TP - SMA(TP)) / (0.015 * MeanDeviation)
 */
export function calculateCCI(candles: CandleInput[], period: number = 20): IndicatorPoint[] {
  const aligned = prepareAlignedCandles(candles);
  if (aligned.length < period || period <= 0) return [];
  const result: IndicatorPoint[] = [];

  const tps: { time: UTCTimestamp; tp: number }[] = aligned.map((c) => {
    const { time, high, low, close } = c;
    return { time, tp: (high + low + close) / 3 };
  });

  for (let i = period - 1; i < tps.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += tps[i - j].tp;
    }
    const meanTP = sum / period;

    let devSum = 0;
    for (let j = 0; j < period; j++) {
      devSum += Math.abs(tps[i - j].tp - meanTP);
    }
    const meanDev = devSum / period;

    let cci = 0;
    if (meanDev > 0) {
      cci = (tps[i].tp - meanTP) / (0.015 * meanDev);
    }

    result.push({
      time: tps[i].time,
      value: Number(cci.toFixed(2)),
    });
  }

  return result;
}
