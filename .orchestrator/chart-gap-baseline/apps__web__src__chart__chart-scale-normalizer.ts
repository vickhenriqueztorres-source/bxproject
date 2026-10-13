import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../api/client';
import type { Tick } from '../feed/protocol';
import { timeframeSeconds, type Timeframe } from './candle-adapter';

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
 * Elimina completamente o problema de vela gigante e gaps temporais na abertura do gráfico.
 */
export function normalizeSeedWithTick(candles: Candle[], tick: Tick | null): Candle[] {
  if (!candles || candles.length === 0) return [];
  if (!tick) return candles;

  const tickPrice = Number(tick.price);
  const tickEpoch = Date.parse(tick.ts);
  if (!Number.isFinite(tickPrice) || tickPrice <= 0 || !Number.isFinite(tickEpoch)) {
    return candles;
  }

  const tickSeconds = Math.floor(tickEpoch / 1000);
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

  // Caso 3: Alinhamento de gap temporal se o tick for posterior ao último candle
  const lastTime = typeof updatedLast.time === 'number'
    ? updatedLast.time
    : Math.floor(Date.parse(String(updatedLast.time)) / 1000);

  if (tickSeconds > lastTime) {
    result[lastIndex].time = tickSeconds;
  }

  return result;
}

/**
 * Atualiza ou gera a vela corrente a partir de um tick, com blindagem defensiva rigorosa.
 */
export function safeCandleFromTick(
  tick: Tick,
  previous: CandlestickData<UTCTimestamp> | null,
  timeframe: Timeframe = '1m'
): CandlestickData<UTCTimestamp> | null {
  if (!tick) return null;

  const epoch = Date.parse(tick.ts);
  if (!Number.isFinite(epoch)) return null;

  const price = Number(tick.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const stepSec = timeframeSeconds(timeframe);
  const tsSeconds = Math.floor(epoch / 1000);
  const bucket = (Math.floor(tsSeconds / stepSec) * stepSec) as UTCTimestamp;

  if (!previous) {
    return {
      time: bucket,
      open: price,
      high: price,
      low: price,
      close: price,
    };
  }

  // Se o tick estiver no passado em relação à vela atual já processada, descarta
  if (bucket < previous.time) {
    return null;
  }

  // Se iniciou um novo bucket (novo minuto/timeframe)
  if (bucket > previous.time) {
    return {
      time: bucket,
      open: previous.close, // Continuidade física entre velas consecutivas
      high: Math.max(previous.close, price),
      low: Math.min(previous.close, price),
      close: price,
    };
  }

  // Atualização da mesma vela em andamento
  return {
    time: previous.time,
    open: previous.open,
    high: Math.max(previous.high, price),
    low: Math.min(previous.low, price),
    close: price,
  };
}
