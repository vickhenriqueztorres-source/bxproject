import { Redis } from "ioredis";
import { isMarketOpen, shouldCloseCandle, aggregateCandleGapTolerant } from "./trading-calendar.js";

export { isMarketOpen, shouldCloseCandle, aggregateCandleGapTolerant };

export interface TickInput {
  symbol: string;
  sequence: bigint;
  price: string;
  ts: Date;
}

export interface CandleData {
  symbol: string;
  interval: string;
  bucket_start: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
}

export const TIMEFRAMES: Record<string, number> = {
  "1s": 1000,
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000
};

// Lua Script atômico para manter o candle ativo no Redis
const UPDATE_ACTIVE_CANDLE_LUA = `
local key = KEYS[1]
local price = tonumber(ARGV[1])
local raw_price = ARGV[2]
local exists = redis.call('EXISTS', key)

if exists == 0 then
  redis.call('HSET', key, 
    'open', raw_price, 
    'high', raw_price, 
    'low', raw_price, 
    'close', raw_price, 
    'volume', 1
  )
  redis.call('EXPIRE', key, 600) -- TTL de 10 minutos
  return {raw_price, raw_price, raw_price, raw_price, 1}
else
  local high = tonumber(redis.call('HGET', key, 'high'))
  local low = tonumber(redis.call('HGET', key, 'low'))
  local current_open = redis.call('HGET', key, 'open')
  local new_high = redis.call('HGET', key, 'high')
  local new_low = redis.call('HGET', key, 'low')

  if price > high then 
    new_high = raw_price
    redis.call('HSET', key, 'high', raw_price) 
  end
  if price < low then 
    new_low = raw_price
    redis.call('HSET', key, 'low', raw_price) 
  end
  redis.call('HSET', key, 'close', raw_price)
  local new_vol = redis.call('HINCRBY', key, 'volume', 1)

  return {current_open, new_high, new_low, raw_price, new_vol}
end
`;

export class TimeframeAggregator {
  private redis: Redis;
  private currentBuckets: Map<string, number> = new Map(); // key: `${symbol}:${interval}` -> bucket_start_ms

  constructor(redis: Redis) {
    this.redis = redis;
    // Registra comando Lua customizado se necessário, ou executa com eval
  }

  static calculateBucketStart(ts: Date, intervalMs: number): Date {
    const timeMs = ts.getTime();
    const bucketStartMs = Math.floor(timeMs / intervalMs) * intervalMs;
    return new Date(bucketStartMs);
  }

  /**
   * Processa um tick para um determinado intervalo.
   * Valida sessão de trading por símbolo (Perigo 7 — Técnica 3) antes de agregar/fechar candle.
   * Se o tick cruzar para um novo bucket, retorna o bucket_start do anterior que foi fechado.
   */
  async processTickForInterval(
    tick: TickInput,
    interval: string
  ): Promise<{ activeCandle: CandleData | null; closedBucketStart: Date | null }> {
    const intervalMs = TIMEFRAMES[interval];
    if (!intervalMs) throw new Error(`Intervalo desconhecido: ${interval}`);

    // Perigo 7 (Técnica 3): Se o mercado estiver fechado para o símbolo neste timestamp UTC, ignora o tick sem criar candle espúrio
    if (!shouldCloseCandle(tick, tick.symbol)) {
      return { activeCandle: null, closedBucketStart: null };
    }

    const bucketStart = TimeframeAggregator.calculateBucketStart(tick.ts, intervalMs);
    const bucketStartMs = bucketStart.getTime();
    const mapKey = `${tick.symbol}:${interval}`;

    let closedBucketStart: Date | null = null;
    const lastBucketMs = this.currentBuckets.get(mapKey);

    if (lastBucketMs !== undefined && bucketStartMs > lastBucketMs) {
      // Cruzou o limite do bucket anterior! O anterior está selado
      closedBucketStart = new Date(lastBucketMs);
    }
    this.currentBuckets.set(mapKey, bucketStartMs);

    const redisKey = `candle:active:${tick.symbol}:${interval}:${bucketStartMs}`;
    const result = (await this.redis.eval(
      UPDATE_ACTIVE_CANDLE_LUA,
      1,
      redisKey,
      parseFloat(tick.price),
      tick.price
    )) as [string, string, string, string, number];

    const activeCandle: CandleData = {
      symbol: tick.symbol,
      interval,
      bucket_start: bucketStart,
      open: result[0],
      high: result[1],
      low: result[2],
      close: result[3],
      volume: Number(result[4])
    };

    return { activeCandle, closedBucketStart };
  }

  /**
   * Recupera o candle ativo de um bucket no Redis (útil para finalizar a vela anterior)
   */
  async getActiveCandle(symbol: string, interval: string, bucketStart: Date): Promise<CandleData | null> {
    const redisKey = `candle:active:${symbol}:${interval}:${bucketStart.getTime()}`;
    const data = await this.redis.hgetall(redisKey);
    if (!data || !data.open) return null;

    return {
      symbol,
      interval,
      bucket_start: bucketStart,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
      volume: parseInt(data.volume, 10) || 1
    };
  }
}
