"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rebuildCandlesForSymbol = rebuildCandlesForSymbol;
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
const timeframe_aggregator_js_1 = require("../aggregator/timeframe-aggregator.js");
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/broker";
const SYMBOL = process.env.SYMBOL || "SYNTH_VOL_50";
const BATCH_SIZE = 2000;
async function rebuildCandlesForSymbol(pool, symbol) {
    console.log(`[RebuildCandles] Starting candle replay for symbol=${symbol}...`);
    let lastSequence = -1n;
    let totalProcessed = 0;
    let hasMore = true;
    // Mapa para acumular velas em memória durante o replay: `${interval}:${bucket_start_ms}` -> InMemoryBar
    const bars = new Map();
    while (hasMore) {
        const query = `
      SELECT sequence, price, ts
      FROM ticks
      WHERE symbol = $1 AND sequence > $2
      ORDER BY sequence ASC
      LIMIT $3;
    `;
        const res = await pool.query(query, [symbol, lastSequence.toString(), BATCH_SIZE]);
        if (res.rows.length === 0) {
            hasMore = false;
            break;
        }
        for (const row of res.rows) {
            const seq = BigInt(row.sequence);
            const priceStr = row.price.toString();
            const priceNum = parseFloat(priceStr);
            const ts = new Date(row.ts);
            if (seq > lastSequence) {
                lastSequence = seq;
            }
            // Agrega para cada intervalo suportado (1m, 5m)
            for (const [interval, intervalMs] of Object.entries(timeframe_aggregator_js_1.TIMEFRAMES)) {
                const bucketStart = timeframe_aggregator_js_1.TimeframeAggregator.calculateBucketStart(ts, intervalMs);
                const key = `${interval}:${bucketStart.getTime()}`;
                const existing = bars.get(key);
                if (!existing) {
                    bars.set(key, {
                        symbol,
                        interval,
                        bucket_start: bucketStart,
                        open: priceStr,
                        high: priceStr,
                        low: priceStr,
                        close: priceStr,
                        volume: 1
                    });
                }
                else {
                    const curHigh = parseFloat(existing.high);
                    const curLow = parseFloat(existing.low);
                    if (priceNum > curHigh)
                        existing.high = priceStr;
                    if (priceNum < curLow)
                        existing.low = priceStr;
                    existing.close = priceStr;
                    existing.volume += 1;
                }
            }
            totalProcessed++;
        }
        console.log(`[RebuildCandles] Processed batch up to sequence ${lastSequence} (Total ticks: ${totalProcessed})`);
    }
    console.log(`[RebuildCandles] Rebuilt ${bars.size} candle bars across all timeframes. Persisting to database...`);
    // Persiste em lotes no Postgres
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const upsertSql = `
      INSERT INTO candles (symbol, interval, bucket_start, open, high, low, close, volume)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (symbol, interval, bucket_start)
      DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume;
    `;
        for (const bar of bars.values()) {
            await client.query(upsertSql, [
                bar.symbol,
                bar.interval,
                bar.bucket_start,
                bar.open,
                bar.high,
                bar.low,
                bar.close,
                bar.volume
            ]);
        }
        await client.query("COMMIT");
        console.log(`[RebuildCandles] Successfully persisted ${bars.size} candles for ${symbol}`);
    }
    catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
    finally {
        client.release();
    }
    return totalProcessed;
}
if (process.argv[1]?.endsWith("rebuild-candles.ts") || process.argv[1]?.endsWith("rebuild-candles.js")) {
    const pool = new Pool({ connectionString: DATABASE_URL });
    rebuildCandlesForSymbol(pool, SYMBOL)
        .then(count => {
        console.log(`[RebuildCandles] Finished! Processed ${count} ticks.`);
        pool.end();
        process.exit(0);
    })
        .catch(err => {
        console.error("[RebuildCandles] Failed:", err);
        pool.end();
        process.exit(1);
    });
}
