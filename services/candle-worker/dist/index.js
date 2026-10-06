"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = require("ioredis");
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
const consumer_group_js_1 = require("./stream/consumer-group.js");
const timeframe_aggregator_js_1 = require("./aggregator/timeframe-aggregator.js");
const candle_repository_js_1 = require("./persistence/candle-repository.js");
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/broker";
const SYMBOL = process.env.SYMBOL || "SYNTH_VOL_50";
const CONSUMER_ID = process.env.CONSUMER_ID || `candle-worker-${process.pid}`;
async function main() {
    console.log(`[CandleWorker] Starting candle worker consumer=${CONSUMER_ID} symbol=${SYMBOL}...`);
    const redis = new ioredis_1.Redis(REDIS_URL);
    const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
    const streamKey = `stream:ticks:${SYMBOL}`;
    const groupName = "cg:candles";
    const consumer = new consumer_group_js_1.StreamConsumerGroup(redis, streamKey, groupName, CONSUMER_ID);
    await consumer.init();
    console.log(`[CandleWorker] Consumer group '${groupName}' initialized on stream '${streamKey}'`);
    const aggregator = new timeframe_aggregator_js_1.TimeframeAggregator(redis);
    const repository = new candle_repository_js_1.CandleRepository(pool);
    let isRunning = true;
    const shutdown = async () => {
        console.log("[CandleWorker] Shutting down gracefully...");
        isRunning = false;
        await redis.quit();
        await pool.end();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    // Loop de auto-claim a cada 5 segundos em segundo plano
    setInterval(async () => {
        if (!isRunning)
            return;
        try {
            const claimed = await consumer.autoClaimPending(5000, 20);
            if (claimed.length > 0) {
                console.log(`[CandleWorker] Auto-claimed ${claimed.length} pending messages`);
                for (const msg of claimed) {
                    await processMessage(msg.id, msg.data);
                }
            }
        }
        catch (err) {
            console.error("[CandleWorker] Error in autoClaimPending:", err);
        }
    }, 5000);
    async function processMessage(msgId, data) {
        if (!data.price || !data.ts) {
            await consumer.ack(msgId);
            return;
        }
        const tick = {
            symbol: data.symbol || SYMBOL,
            sequence: BigInt(data.sequence || "0"),
            price: data.price,
            ts: new Date(data.ts)
        };
        // Processa agregação para todos os intervalos configurados (1s, 1m, 5m)
        for (const interval of Object.keys(timeframe_aggregator_js_1.TIMEFRAMES)) {
            const { activeCandle, closedBucketStart } = await aggregator.processTickForInterval(tick, interval);
            // Se um bucket foi selado, salva a vela definitiva no Postgres com outbox CANDLE_CLOSED
            if (closedBucketStart) {
                const closedCandle = await aggregator.getActiveCandle(tick.symbol, interval, closedBucketStart);
                if (closedCandle) {
                    await repository.upsertCandle(closedCandle, true);
                }
            }
            // Para intervalo '1s', persistimos continuamente cada candle finalizado no Postgres
            if (interval === "1s") {
                await repository.upsertCandle(activeCandle, false);
            }
        }
        await consumer.ack(msgId);
    }
    // Loop principal de consumo
    while (isRunning) {
        try {
            const messages = await consumer.readMessages(50, 1000);
            for (const msg of messages) {
                await processMessage(msg.id, msg.data);
            }
        }
        catch (err) {
            if (!isRunning)
                break;
            console.error("[CandleWorker] Error reading stream:", err);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}
main().catch(err => {
    console.error("[CandleWorker] Fatal startup error:", err);
    process.exit(1);
});
