import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../api/client';
import type { Tick } from '../feed/protocol';

export function normalizeTimeSeconds(raw: unknown): UTCTimestamp | null {
  if (raw === null || raw === undefined || typeof raw === 'boolean') return null;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const sec = raw > 1e11 ? Math.floor(raw / 1000) : Math.floor(raw);
    return sec > 0 ? (sec as UTCTimestamp) : null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && !trimmed.includes('-') && !trimmed.includes(':')) {
      if (numeric <= 0) return null;
      const sec = numeric > 1e11 ? Math.floor(numeric / 1000) : Math.floor(numeric);
      return sec > 0 ? (sec as UTCTimestamp) : null;
    }

    let isoCandidate = trimmed;
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(isoCandidate)) {
      isoCandidate = isoCandidate.replace(/\s+/, 'T');
    }
    if (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoCandidate) &&
      !/([Zz]|[+-]\d{2}:?\d{2})$/.test(isoCandidate)
    ) {
      isoCandidate = `${isoCandidate}Z`;
    }

    const parsedMs = Date.parse(isoCandidate);
    if (!Number.isFinite(parsedMs) || parsedMs <= 0) return null;
    const sec = Math.floor(parsedMs / 1000);
    return sec > 0 ? (sec as UTCTimestamp) : null;
  }

  return null;
}

export type Timeframe = '5s' | '15s' | '30s' | '1m' | '5m';

export function timeframeSeconds(tf: Timeframe): number {
  switch (tf) {
    case '5s':
      return 5;
    case '15s':
      return 15;
    case '30s':
      return 30;
    case '1m':
      return 60;
    case '5m':
      return 300;
    default:
      return 60;
  }
}

export function isSubMinuteTimeframe(tf: Timeframe): boolean {
  return tf === '5s' || tf === '15s' || tf === '30s';
}

export function candleData(row: Candle): CandlestickData<UTCTimestamp> {
  const normalizedSec = normalizeTimeSeconds(row.time);
  const t = normalizedSec ?? 0;

  const open = Number(row.open);
  const close = Number(row.close);
  const rawHigh = Number(row.high);
  const rawLow = Number(row.low);

  const high = Math.max(open, close, Number.isFinite(rawHigh) ? rawHigh : open);
  const low = Math.min(open, close, Number.isFinite(rawLow) ? rawLow : close);

  return {
    time: t as UTCTimestamp,
    open,
    high,
    low,
    close,
  };
}

/**
 * Converte velas base (1m) para qualquer timeframe suportado ('5s', '15s', '30s', '1m', '5m').
 * Mantém os invariantes de OHLC, fusão de duplicatas e ordenação estritamente crescente de UTCTimestamp (#1344).
 */
export function resampleCandles(
  candles: Candle[],
  timeframe: Timeframe
): CandlestickData<UTCTimestamp>[] {
  if (!candles || candles.length === 0) return [];

  // Ordenar, validar e mesclar duplicatas nos dados de entrada (#1344)
  const validBase: CandlestickData<UTCTimestamp>[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candleData(candles[i]);
    if (
      c.time > 0 &&
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close) &&
      c.open > 0 &&
      c.high > 0 &&
      c.low > 0 &&
      c.close > 0
    ) {
      validBase.push(c);
    }
  }

  if (validBase.length === 0) return [];

  validBase.sort((a, b) => a.time - b.time);

  const unique: CandlestickData<UTCTimestamp>[] = [validBase[0]];
  let hasSubMinuteInput = false;

  for (let i = 1; i < validBase.length; i++) {
    const cur = validBase[i];
    const prev = unique[unique.length - 1];
    if (cur.time === prev.time) {
      prev.high = Math.max(prev.high, cur.high, prev.open, cur.close);
      prev.low = Math.min(prev.low, cur.low, prev.open, cur.close);
      prev.close = cur.close;
    } else if (cur.time > prev.time) {
      if (cur.time - prev.time < 60) {
        hasSubMinuteInput = true;
      }
      unique.push(cur);
    }
  }

  const stepSec = timeframeSeconds(timeframe);

  // Caso 1: 1m ou 5m (agregação por bucket temporal se for 5m ou se a entrada contiver barras sub-minuto)
  if (timeframe === '1m' && !hasSubMinuteInput) {
    return unique;
  }

  if (timeframe === '1m' || timeframe === '5m') {
    const bucketsMap = new Map<number, CandlestickData<UTCTimestamp>>();
    for (const c of unique) {
      const bucketTime = (Math.floor(c.time / stepSec) * stepSec) as UTCTimestamp;
      const existing = bucketsMap.get(bucketTime);
      if (!existing) {
        bucketsMap.set(bucketTime, {
          time: bucketTime,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });
      } else {
        existing.high = Math.max(existing.high, c.high, existing.open, c.close);
        existing.low = Math.min(existing.low, c.low, existing.open, c.close);
        existing.close = c.close; // Fechamento é o da última vela do período
      }
    }
    return Array.from(bucketsMap.values()).sort((a, b) => a.time - b.time);
  }

  // Caso 3: Sub-minuto ('5s', '15s', '30s')
  // Desmembra cada vela de 1m em fatias contíguas e matematicamente consistentes
  const result: CandlestickData<UTCTimestamp>[] = [];
  const slicesPerMinute = 60 / stepSec; // 5s -> 12, 15s -> 4, 30s -> 2

  for (const parent of unique) {
    const baseTime = parent.time;
    const { open, high, low, close } = parent;
    const isBullish = close >= open;

    for (let i = 0; i < slicesPerMinute; i++) {
      const sliceTime = (baseTime + i * stepSec) as UTCTimestamp;
      const t = (i + 0.5) / slicesPerMinute;

      let sliceOpen: number;
      let sliceClose: number;
      let sliceHigh: number;
      let sliceLow: number;

      if (slicesPerMinute === 2) {
        // 30 segundos: 2 fatias
        if (i === 0) {
          sliceOpen = open;
          sliceClose = isBullish ? (open + high) / 2 : (open + low) / 2;
          sliceHigh = isBullish ? high : open;
          sliceLow = isBullish ? open : low;
        } else {
          sliceOpen = isBullish ? (open + high) / 2 : (open + low) / 2;
          sliceClose = close;
          sliceHigh = isBullish ? close : high;
          sliceLow = isBullish ? low : close;
        }
      } else if (slicesPerMinute === 4) {
        // 15 segundos: 4 fatias
        if (i === 0) {
          sliceOpen = open;
          sliceClose = isBullish ? open + (high - open) * 0.4 : open - (open - low) * 0.4;
          sliceHigh = Math.max(sliceOpen, sliceClose);
          sliceLow = Math.min(sliceOpen, sliceClose);
        } else if (i === 1) {
          sliceOpen = isBullish ? open + (high - open) * 0.4 : open - (open - low) * 0.4;
          sliceClose = isBullish ? high : low;
          sliceHigh = Math.max(sliceOpen, high);
          sliceLow = Math.min(sliceOpen, low);
        } else if (i === 2) {
          sliceOpen = isBullish ? high : low;
          sliceClose = isBullish ? low + (close - low) * 0.5 : high - (high - close) * 0.5;
          sliceHigh = Math.max(sliceOpen, high);
          sliceLow = Math.min(sliceOpen, low);
        } else {
          sliceOpen = isBullish ? low + (close - low) * 0.5 : high - (high - close) * 0.5;
          sliceClose = close;
          sliceHigh = Math.max(sliceOpen, close);
          sliceLow = Math.min(sliceOpen, close);
        }
      } else {
        // 5 segundos: 12 fatias
        const firstExt = isBullish ? high : low;
        const secondExt = isBullish ? low : high;

        let curVal: number;
        let nxtVal: number;
        if (t < 0.35) {
          const ratio = t / 0.35;
          curVal = open + (firstExt - open) * ratio;
          nxtVal = open + (firstExt - open) * Math.min(1, ratio + 1 / 12);
        } else if (t < 0.70) {
          const ratio = (t - 0.35) / 0.35;
          curVal = firstExt + (secondExt - firstExt) * ratio;
          nxtVal = firstExt + (secondExt - firstExt) * Math.min(1, ratio + 1 / 12);
        } else {
          const ratio = (t - 0.70) / 0.30;
          curVal = secondExt + (close - secondExt) * ratio;
          nxtVal = secondExt + (close - secondExt) * Math.min(1, ratio + 1 / 12);
        }

        sliceOpen = Number(curVal.toFixed(5));
        sliceClose = Number(nxtVal.toFixed(5));
        const delta = Math.abs(sliceClose - sliceOpen) * 0.2;
        sliceHigh = Number((Math.max(sliceOpen, sliceClose) + delta).toFixed(5));
        sliceLow = Number((Math.min(sliceOpen, sliceClose) - delta).toFixed(5));

        // Respeitar fronteiras da vela pai
        sliceHigh = Math.min(high, sliceHigh);
        sliceLow = Math.max(low, sliceLow);
      }

      result.push({
        time: sliceTime,
        open: Number(sliceOpen.toFixed(5)),
        high: Number(Math.max(sliceOpen, sliceClose, sliceHigh).toFixed(5)),
        low: Number(Math.min(sliceOpen, sliceClose, sliceLow).toFixed(5)),
        close: Number(sliceClose.toFixed(5)),
      });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

/**
 * Atualiza ou inicializa a vela atual com base no tick recebido e no timeframe ativo.
 */
export function candleFromTick(
  tick: Tick,
  previous: CandlestickData<UTCTimestamp> | null,
  timeframe: Timeframe = '1m'
): CandlestickData<UTCTimestamp> | null {
  const tsSeconds = normalizeTimeSeconds(tick.ts);
  if (tsSeconds === null) return null;

  const stepSec = timeframeSeconds(timeframe);
  const bucket = (Math.floor(tsSeconds / stepSec) * stepSec) as UTCTimestamp;
  const price = Number(tick.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  if (!previous || bucket > previous.time) {
    return {
      time: bucket,
      open: price,
      high: price,
      low: price,
      close: price,
    };
  }

  if (bucket < previous.time) return null;

  return {
    time: bucket,
    open: previous.open,
    high: Math.max(previous.high, price),
    low: Math.min(previous.low, price),
    close: price,
  };
}
