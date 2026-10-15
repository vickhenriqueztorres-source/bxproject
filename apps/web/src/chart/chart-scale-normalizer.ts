import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../api/client';
import type { Tick } from '../feed/protocol';
import { normalizeTimeSeconds, timeframeSeconds, type Timeframe } from './candle-adapter';

/**
 * Bounds de validação e métricas de integridade de uma vela OHLC.
 */
export interface CandleBoundsValidation {
  isValid: boolean;
  spreadPercent: number;
}

/**
 * Calcula a integridade e dispersão de uma vela OHLC, garantindo que high >= max(open, close)
 * e low <= min(open, close), e que os valores sejam finitos e estritamente positivos.
 */
export function calculateSafeCandleBounds(
  candle: CandlestickData<UTCTimestamp>
): CandleBoundsValidation {
  const { open, high, low, close } = candle;
  if (
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0 ||
    high < Math.max(open, close) ||
    low > Math.min(open, close)
  ) {
    return { isValid: false, spreadPercent: Infinity };
  }

  const mid = (open + close) / 2;
  const spreadPercent = mid > 0 ? ((high - low) / mid) * 100 : 0;
  return { isValid: true, spreadPercent };
}

/**
 * Detecta mudança extrema de ordem de magnitude entre preços consecutivos
 * (ex: transição entre BTCUSD e EURUSD ou erro de escala de casas decimais).
 */
export function detectPriceScaleAnomaly(lastPrice: number, nextPrice: number): boolean {
  if (!Number.isFinite(lastPrice) || !Number.isFinite(nextPrice) || lastPrice <= 0 || nextPrice <= 0) {
    return true;
  }
  const ratio = nextPrice / lastPrice;
  // Se o preço saltar mais de 5x ou cair para menos de 1/5, caracteriza salto de magnitude
  return ratio > 5.0 || ratio < 0.2;
}

/**
 * Normaliza velas semente para ancorarem perfeitamente no primeiro tick de mercado disponível.
 * Elimina completamente o problema de vela gigante e gaps temporais na abertura do gráfico (#1344).
 */
export function normalizeSeedWithTick(candles: Candle[], tick: Tick | null): Candle[] {
  if (!candles || candles.length === 0) return [];
  if (!tick) return candles;

  const tickPrice = Number(tick.price);
  const tickSeconds = normalizeTimeSeconds(tick.ts);
  if (!Number.isFinite(tickPrice) || tickPrice <= 0 || tickSeconds === null) {
    return candles;
  }

  const result: Candle[] = candles.map((c) => ({ ...c }));
  const lastIndex = result.length - 1;
  const lastCandle = result[lastIndex];
  const lastClose = Number(lastCandle.close);

  if (!Number.isFinite(lastClose) || lastClose <= 0) {
    return candles;
  }

  const deviation = Math.abs(tickPrice - lastClose) / lastClose;

  // Caso 1: Salto estocástico grande (> 3%) — Renormaliza toda a semente com fator proporcional
  // para que o gráfico mantenha seu formato de onda/tendência mas ancore exatamente no nível real
  if (deviation > 0.03) {
    const scaleFactor = tickPrice / lastClose;
    for (let i = 0; i < result.length; i++) {
      const o = Number(result[i].open) * scaleFactor;
      const h = Number(result[i].high) * scaleFactor;
      const l = Number(result[i].low) * scaleFactor;
      const c = Number(result[i].close) * scaleFactor;

      result[i] = {
        ...result[i],
        open: o.toFixed(5),
        high: Math.max(o, c, h).toFixed(5),
        low: Math.min(o, c, l).toFixed(5),
        close: c.toFixed(5),
      };
    }
  }

  // Caso 2: Ancoragem fina na última vela
  const updatedLast = result[lastIndex];
  const currentOpen = Number(updatedLast.open);
  const currentHigh = Number(updatedLast.high);
  const currentLow = Number(updatedLast.low);

  result[lastIndex] = {
    ...updatedLast,
    close: tickPrice.toFixed(5),
    high: Math.max(currentOpen, tickPrice, currentHigh).toFixed(5),
    low: Math.min(currentOpen, tickPrice, currentLow).toFixed(5),
  };

  // Caso 3: Alinhamento de gap temporal estritamente em múltiplos de 60s (#1344)
  // Nunca atribui segundo quebrado (ex: :23s) à vela de 1m para não desalinhar mergeObservedCandles
  const lastTime = normalizeTimeSeconds(updatedLast.time) ?? 0;

  if (lastTime > 0 && tickSeconds >= lastTime + 60) {
    const minutesDelta = Math.floor((tickSeconds - lastTime) / 60);
    result[lastIndex].time = lastTime + minutesDelta * 60;
  }

  return result;
}

/**
 * Atualiza ou gera a vela corrente a partir de um tick, com blindagem defensiva rigorosa.
 */
export type ObservedCandlestick = CandlestickData<UTCTimestamp> & {
  last_sequence?: number;
};

let candleMismatchTotal = 0;

export function getCandleMismatchTotal(): number {
  return candleMismatchTotal;
}

export function resetCandleMismatchTotal(): void {
  candleMismatchTotal = 0;
}

/**
 * Atualiza ou gera a vela corrente a partir de um tick, com blindagem defensiva rigorosa.
 */
export function safeCandleFromTick(
  tick: Tick,
  previous: ObservedCandlestick | null,
  timeframe: Timeframe = '1m'
): ObservedCandlestick | null {
  if (!tick) return null;

  const tsSeconds = normalizeTimeSeconds(tick.ts);
  if (tsSeconds === null) return null;

  const price = Number(tick.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const stepSec = timeframeSeconds(timeframe);
  const bucket = (Math.floor(tsSeconds / stepSec) * stepSec) as UTCTimestamp;
  const tickSeq =
    typeof tick.sequence === 'number' && Number.isFinite(tick.sequence) ? tick.sequence : undefined;

  if (!previous) {
    const out: ObservedCandlestick = {
      time: bucket,
      open: price,
      high: price,
      low: price,
      close: price,
    };
    if (tickSeq !== undefined) out.last_sequence = tickSeq;
    return out;
  }

  // Se o tick estiver no passado em relação à vela atual já processada, descarta
  if (bucket < previous.time) {
    return null;
  }

  // Se iniciou um novo bucket (novo minuto/timeframe)
  if (bucket > previous.time) {
    const out: ObservedCandlestick = {
      time: bucket,
      open: price,
      high: price,
      low: price,
      close: price,
    };
    if (tickSeq !== undefined) out.last_sequence = tickSeq;
    return out;
  }

  // Atualização da mesma vela em andamento (open = 1º tick, close = maior sequence)
  const prevSeq = previous.last_sequence;
  const isNewerOrEqualSeq =
    tickSeq === undefined || prevSeq === undefined || tickSeq >= prevSeq;
  const out: ObservedCandlestick = {
    time: previous.time,
    open: previous.open,
    high: Math.max(previous.high, price),
    low: Math.min(previous.low, price),
    close: isNewerOrEqualSeq ? price : previous.close,
  };
  if (tickSeq !== undefined || prevSeq !== undefined) {
    out.last_sequence =
      tickSeq !== undefined && prevSeq !== undefined
        ? Math.max(tickSeq, prevSeq)
        : (tickSeq ?? prevSeq);
  }
  return out;
}

export function mergeObservedCandles(
  history: ObservedCandlestick[],
  observed: ObservedCandlestick[],
  timeframe: Timeframe,
  preserveClosedHistory = true
): ObservedCandlestick[] {
  const step = timeframeSeconds(timeframe);
  const merged = new Map<UTCTimestamp, ObservedCandlestick>();
  const maxRawTimeByBucket = new Map<UTCTimestamp, number>();

  // 1. Garante ordenação ascendente e fusão de duplicatas no histórico base (#1344)
  const sortedHistory = [...history].sort((a, b) => Number(a.time) - Number(b.time));
  for (const bar of sortedHistory) {
    const t = Number(bar.time) as UTCTimestamp;
    if (!Number.isFinite(t) || t <= 0) continue;
    const prev = merged.get(t);
    if (prev) {
      const nextBar: ObservedCandlestick = {
        time: t,
        open: prev.open,
        high: Math.max(prev.high, bar.high, prev.open, bar.close),
        low: Math.min(prev.low, bar.low, prev.open, bar.close),
        close: bar.close,
      };
      if (typeof bar.last_sequence === 'number' || typeof prev.last_sequence === 'number') {
        nextBar.last_sequence = Math.max(prev.last_sequence ?? -1, bar.last_sequence ?? -1);
      }
      merged.set(t, nextBar);
    } else {
      const nextBar: ObservedCandlestick = {
        time: t,
        open: bar.open,
        high: Math.max(bar.high, bar.open, bar.close),
        low: Math.min(bar.low, bar.open, bar.close),
        close: bar.close,
      };
      if (typeof bar.last_sequence === 'number') {
        nextBar.last_sequence = bar.last_sequence;
      }
      merged.set(t, nextBar);
    }
    maxRawTimeByBucket.set(t, t);
  }

  const lastHistoryTime = sortedHistory.at(-1)?.time ?? -Infinity;
  const lastObservedTime =
    observed.length > 0
      ? Math.floor(Math.max(-Infinity, ...observed.map((bar) => Number(bar.time))) / step) * step
      : -Infinity;

  for (const bar of [...observed].sort((a, b) => Number(a.time) - Number(b.time))) {
    const rawTime = Number(bar.time);
    if (!Number.isFinite(rawTime) || rawTime <= 0) continue;

    // Alinha estritamente ao bucket canônico de `step`, exceto quando `lastHistoryTime` sintético
    // possui offset intra-minuto e `rawTime` é posterior a `lastHistoryTime` dentro do mesmo minuto
    let time = (Math.floor(rawTime / step) * step) as UTCTimestamp;
    if (Number.isFinite(lastHistoryTime) && time < lastHistoryTime && rawTime >= lastHistoryTime) {
      time = lastHistoryTime as UTCTimestamp;
    }

    // Velas fechadas: vale a do servidor (Relatório #11 — Item 4)
    if (
      time < lastHistoryTime ||
      (preserveClosedHistory && time === lastHistoryTime && time < lastObservedTime)
    ) {
      continue;
    }

    const previous = merged.get(time);
    const prevMaxRaw = maxRawTimeByBucket.get(time) ?? -Infinity;
    const isNewerOrEqualSubBar = rawTime >= prevMaxRaw;
    if (isNewerOrEqualSubBar) {
      maxRawTimeByBucket.set(time, rawTime);
    }

    if (previous) {
      // Reconciliação da vela corrente por last_sequence quando ambos os lados informam sequence (#11 Item 4)
      const prevSeq =
        typeof previous.last_sequence === 'number' && Number.isFinite(previous.last_sequence)
          ? previous.last_sequence
          : null;
      const obsSeq =
        typeof bar.last_sequence === 'number' && Number.isFinite(bar.last_sequence)
          ? bar.last_sequence
          : null;

      let resolvedClose: number;
      if (prevSeq !== null && obsSeq !== null) {
        resolvedClose = obsSeq >= prevSeq ? bar.close : previous.close;
      } else {
        resolvedClose = isNewerOrEqualSubBar ? bar.close : previous.close;
      }

      const nextBar: ObservedCandlestick = {
        time,
        open: previous.open,
        high: Math.max(previous.high, bar.high, previous.open, bar.close),
        low: Math.min(previous.low, bar.low, previous.open, bar.close),
        close: resolvedClose,
      };
      if (prevSeq !== null || obsSeq !== null) {
        nextBar.last_sequence =
          prevSeq !== null && obsSeq !== null ? Math.max(prevSeq, obsSeq) : (obsSeq ?? prevSeq)!;
      }
      merged.set(time, nextBar);
    } else {
      const nextBar: ObservedCandlestick = {
        ...bar,
        time,
        high: Math.max(bar.high, bar.open, bar.close),
        low: Math.min(bar.low, bar.open, bar.close),
      };
      merged.set(time, nextBar);
    }
  }

  return [...merged.values()].sort((a, b) => Number(a.time) - Number(b.time));
}
