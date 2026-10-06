import { Redis } from "ioredis";
import pg from "pg";
const { Pool } = pg;
import { ExpiryDispatcher } from "./scheduler/expiry-dispatcher.js";
import { ContractSettler } from "./settlement/settler.js";
import { FinancialReconciler } from "./reconciliation/financial-reconciler.js";
import { BlnkClient } from "@broker/wallet-adapter";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/broker";
const BLNK_URL = process.env.BLNK_URL || "http://localhost:5001";
const WORKER_ID = process.env.WORKER_ID || `settlement-worker-${process.pid}`;

async function main() {
  console.log(`[SettlementWorker] Starting settlement service worker=${WORKER_ID}...`);

  const redis = new Redis(REDIS_URL);
  const pool = new Pool({ connectionString: DATABASE_URL, max: 15 });
  const blnkClient = new BlnkClient(BLNK_URL);

  const dispatcher = new ExpiryDispatcher(redis);
  await dispatcher.init();
  dispatcher.start(50);
  console.log("[SettlementWorker] ExpiryDispatcher started (50ms interval)");

  const settler = new ContractSettler(pool, redis, blnkClient, WORKER_ID);
  const reconciler = new FinancialReconciler(pool, blnkClient);

  let isRunning = true;

  // Reconciliação Contínua de 1 minuto (I-05, I-06)
  const auditTimer = setInterval(async () => {
    if (!isRunning) return;
    try {
      const report = await reconciler.runAudit();
      if (report.status === "CRITICAL_ALERT") {
        console.error("[FinancialReconciler] ALERT: Discrepancies found:", report.discrepancies);
      } else {
        console.log(`[FinancialReconciler] Audit PASS: 0 discrepancies at ${report.timestamp}`);
      }
    } catch (err) {
      console.error("[FinancialReconciler] Audit error:", err);
    }
  }, 60000);

  const shutdown = async () => {
    console.log("[SettlementWorker] Shutting down gracefully...");
    isRunning = false;
    dispatcher.stop();
    clearInterval(auditTimer);
    await redis.quit();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Loop principal de liquidação
  console.log("[SettlementWorker] Listening for expiring contracts on stream...");
  while (isRunning) {
    try {
      await settler.processBatch(20, 1000);
    } catch (err) {
      if (!isRunning) break;
      console.error("[SettlementWorker] Error in processing batch:", err);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

main().catch(err => {
  console.error("[SettlementWorker] Fatal startup error:", err);
  process.exit(1);
});
