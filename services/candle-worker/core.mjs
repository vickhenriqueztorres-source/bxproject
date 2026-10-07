import { isMarketOpen } from './calendar.mjs';

const durations = { m: 60_000, h: 3_600_000, d: 86_400_000 };

export function intervalMillis(interval) {
  const match = /^(\d+)([mhd])$/.exec(interval);
  if (!match) throw new RangeError('INVALID_CANDLE_INTERVAL');
  const amount = Number(match[1]);
  const millis = amount * durations[match[2]];
  if (!Number.isSafeInteger(millis) || millis <= 0) throw new RangeError('INVALID_CANDLE_INTERVAL');
  return millis;
}

export function bucketStart(timestamp, interval) {
  const instant = Date.parse(timestamp);
  if (!Number.isFinite(instant)) throw new RangeError('INVALID_TICK_TIMESTAMP');
  const millis = intervalMillis(interval);
  return new Date(Math.floor(instant / millis) * millis).toISOString();
}

export function deriveCandle(rows) {
  if (rows.length === 0) throw new RangeError('EMPTY_CANDLE');
  const sequence = (row) => Number(row.sequence);
  const parsePrice = (row) => {
    if (!/^\d+(?:\.\d{1,6})?$/.test(row.price)) throw new RangeError('INVALID_TICK_PRICE');
    const val = Number(row.price);
    if (!Number.isFinite(val) || val <= 0) throw new RangeError('INVALID_TICK_PRICE');
    return val;
  };
  let high = rows[0].price;
  let low = rows[0].price;
  let highVal = parsePrice(rows[0]);
  let lowVal = highVal;
  for (let index = 0; index < rows.length; index += 1) {
    if (!Number.isSafeInteger(sequence(rows[index])) ||
        (index && sequence(rows[index]) !== sequence(rows[index - 1]) + 1)) {
      throw new RangeError('CANDLE_SEQUENCE_GAP');
    }
    const candidateVal = parsePrice(rows[index]);
    if (candidateVal > highVal) { highVal = candidateVal; high = rows[index].price; }
    if (candidateVal < lowVal) { lowVal = candidateVal; low = rows[index].price; }
  }
  return {
    open: rows[0].price, high, low, close: rows.at(-1).price,
    volume: rows.length, first_seq: sequence(rows[0]), last_seq: sequence(rows.at(-1)),
  };
}

export function shouldCloseCandle(tick, symbol) {
  if (!symbol) return true;
  const time = tick.ts || tick.event_time || Date.now();
  return isMarketOpen(symbol, time);
}

export function aggregateCandleGapTolerant(ticks, bucketStartTs, bucketEndTs, symbol) {
  if (symbol && !isMarketOpen(symbol, bucketStartTs)) {
    return null; // Mercado fechado no bucket: gap legítimo, sem vela artificial
  }
  const inBucket = ticks.filter((t) => {
    const instant = Date.parse(t.ts || t.event_time);
    const bStart = Date.parse(bucketStartTs);
    const bEnd = Date.parse(bucketEndTs);
    return instant >= bStart && instant < bEnd;
  });

  if (inBucket.length === 0) {
    return null; // Sem ticks no bucket: gap legítimo
  }

  return deriveCandle(inBucket);
}

