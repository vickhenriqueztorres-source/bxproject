import pg from "pg";
import Redis from "ioredis";
import { fileURLToPath } from "node:url";
import { BlnkClient } from "../../wallet-adapter/src/blnk-client.js";

let defaultPool: pg.Pool | null = null;
let defaultRedis: Redis | null = null;
let defaultBlnkClient: BlnkClient | null = null;

function getDefaultPool(): pg.Pool {
  if (!defaultPool) {
    defaultPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || "postgres://synth_migrator:dev_secret_pw_123@postgres:5432/broker_platform",
      max: 5
    });
  }
  return defaultPool;
}

function getDefaultRedis(): Redis {
  if (!defaultRedis) {
    defaultRedis = new Redis(process.env.REDIS_URL || "redis://redis:6379");
  }
  return defaultRedis;
}

function getDefaultBlnkClient(): BlnkClient {
  if (!defaultBlnkClient) {
    defaultBlnkClient = new BlnkClient(process.env.BLNK_URL || "http://localhost:5001");
  }
  return defaultBlnkClient;
}

function isIdempotentConflictError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("409") || msg.toLowerCase().includes("conflict");
}

export async function processOutboxBatch(
  customPool?: Pick<pg.Pool, "connect">,
  customRedis?: Pick<Redis, "xadd" | "publish">,
  customBlnkClient?: Pick<BlnkClient, "reserveStake" | "settleContract">
): Promise<number> {
  const activePool = customPool || getDefaultPool();
  const activeRedis = customRedis || getDefaultRedis();
  const activeBlnk = customBlnkClient || getDefaultBlnkClient();

  const client = await activePool.connect();
  try {
    const query = `
      SELECT id, event_type, payload, COALESCE(retry_count, 0) as retry_count
        FROM outbox_events
       WHERE status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT 500
         FOR UPDATE SKIP LOCKED;
    `;
    const res = await client.query(query);
    if (res.rows.length === 0) return 0;

    for (const row of res.rows) {
      const { id, event_type } = row;
      const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;

      try {
        if (event_type === "TICK_GENERATED") {
          const streamKey = `stream:ticks:${payload.symbol}`;
          const streamId = `${payload.sequence}-0`; // ID determinístico M-03

          try {
            // 1. Durabilidade e histórico: Redis Streams
            await activeRedis.xadd(
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
          await activeRedis.publish(
            `market:ticks:${payload.symbol}`,
            JSON.stringify(payload)
          );
        } else if (event_type === "RESERVE_STAKE") {
          try {
            await activeBlnk.reserveStake(
              payload.user_id,
              payload.contract_id,
              Number(payload.stake_minor)
            );
          } catch (blnkErr: unknown) {
            if (!isIdempotentConflictError(blnkErr)) {
              throw blnkErr;
            }
          }
        } else if (event_type === "CONTRACT_SETTLED") {
          try {
            await activeBlnk.settleContract(
              payload.contract_id,
              payload.user_id,
              payload.result,
              Number(payload.stake_minor),
              Number(payload.payout_minor)
            );
          } catch (blnkErr: unknown) {
            if (!isIdempotentConflictError(blnkErr)) {
              throw blnkErr;
            }
          }
        }

        // 3. Marca como processado somente após sucesso
        await client.query(
          "UPDATE outbox_events SET status = 'PROCESSED', processed_at = NOW() WHERE id = $1",
          [id]
        );
      } catch (eventErr) {
        const nextRetryCount = Number(row.retry_count ?? 0) + 1;
        const nextStatus = nextRetryCount >= 5 ? "FAILED" : "PENDING";
        await client.query(
          "UPDATE outbox_events SET retry_count = $1, status = $2 WHERE id = $3",
          [nextRetryCount, nextStatus, id]
        );
      }
    }

    return res.rows.length;
  } finally {
    client.release();
  }
}

export async function startRelay() {
  console.log("[OutboxRelay] Worker started. Polling pending events (LIMIT 500, FOR UPDATE SKIP LOCKED)...");
  let consecutiveFailures = 0;

  while (true) {
    try {
      const processedCount = await processOutboxBatch();
      consecutiveFailures = 0;
      if (processedCount === 0) {
        await new Promise((resolve) => setTimeout(resolve, 50)); // Sleep curto quando ocioso
      }
    } catch (err) {
      consecutiveFailures = Math.min(consecutiveFailures + 1, 6);
      const baseDelayMs = Math.min(30_000, 500 * Math.pow(2, consecutiveFailures - 1));
      const jitterMs = Math.floor((Date.now() % 250));
      console.error("[OutboxRelay] Error in relay processing cycle:", err);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs + jitterMs)); // Backoff exponencial em falhas
    }
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain && process.env.NODE_ENV !== "test") {
  startRelay().catch((err) => {
    console.error("[OutboxRelay] Fatal startup error:", err);
    process.exit(1);
  });
}
