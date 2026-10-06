import pg from "pg";
import Redis from "ioredis";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://synth_migrator:dev_secret_pw_123@postgres:5432/broker_platform",
  max: 5
});

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

async function processOutboxBatch() {
  const client = await pool.connect();
  try {
    const query = `
      SELECT id, event_type, payload
        FROM outbox_events
       WHERE status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT 50
         FOR UPDATE SKIP LOCKED;
    `;
    const res = await client.query(query);
    if (res.rows.length === 0) return 0;

    for (const row of res.rows) {
      const { id, event_type, payload } = row;

      if (event_type === "TICK_GENERATED") {
        const streamKey = `stream:ticks:${payload.symbol}`;
        const streamId = `${payload.sequence}-0`; // ID determinístico M-03

        try {
          // 1. Durabilidade e histórico: Redis Streams
          await redis.xadd(
            streamKey,
            streamId,
            "symbol", payload.symbol,
            "sequence", payload.sequence,
            "price", payload.price,
            "ts", payload.ts,
            "hash", payload.hash
          );
        } catch (xaddErr: unknown) {
          // Se o ID já existir no Redis Stream, o Redis rejeita com erro; ignoramos duplicata
          const message = xaddErr instanceof Error ? xaddErr.message : String(xaddErr);
          if (!message.includes("equal or smaller")) {
            throw xaddErr;
          }
        }

        // 2. Fan-out visual de baixa latência: Redis Pub/Sub (D-04)
        await redis.publish(
          `market:ticks:${payload.symbol}`,
          JSON.stringify(payload)
        );
      }

      // 3. Marca como processado
      await client.query(
        "UPDATE outbox_events SET status = 'PROCESSED', processed_at = NOW() WHERE id = $1",
        [id]
      );
    }

    return res.rows.length;
  } finally {
    client.release();
  }
}

async function startRelay() {
  console.log("[OutboxRelay] Worker started. Polling pending events...");

  while (true) {
    try {
      const processedCount = await processOutboxBatch();
      if (processedCount === 0) {
        await new Promise((resolve) => setTimeout(resolve, 50)); // Sleep curto quando ocioso
      }
    } catch (err) {
      console.error("[OutboxRelay] Error in relay processing cycle:", err);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Backoff em falhas de rede
    }
  }
}

startRelay().catch((err) => {
  console.error("[OutboxRelay] Fatal startup error:", err);
  process.exit(1);
});
