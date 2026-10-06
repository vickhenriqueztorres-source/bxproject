import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../api/client';
import type { Tick } from '../feed/protocol';

export function candleData(row: Candle): CandlestickData<UTCTimestamp> {
  return { time: row.time as UTCTimestamp, open: Number(row.open),
    high: Number(row.high), low: Number(row.low), close: Number(row.close) };
}

export function candleFromTick(tick: Tick,
  previous: CandlestickData<UTCTimestamp> | null): CandlestickData<UTCTimestamp> | null {
  const epoch = Date.parse(tick.ts);
  if (!Number.isFinite(epoch)) return null;
  const bucket = Math.floor(epoch / 60_000) * 60 as UTCTimestamp;
  const price = Number(tick.price);
  if (!Number.isFinite(price)) return null;
  if (!previous || bucket > previous.time) return {
    time: bucket, open: price, high: price, low: price, close: price,
  };
  if (bucket < previous.time) return null;
  return { time: bucket, open: previous.open, high: Math.max(previous.high, price),
    low: Math.min(previous.low, price), close: price };
}
