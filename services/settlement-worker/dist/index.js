"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = require("ioredis");
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
const expiry_dispatcher_js_1 = require("./scheduler/expiry-dispatcher.js");
const settler_js_1 = require("./settlement/settler.js");
const financial_reconciler_js_1 = require("./reconciliation/financial-reconciler.js");
const wallet_adapter_1 = require("@broker/wallet-adapter");
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/broker";
const BLNK_URL = process.env.BLNK_URL || "http://localhost:5001";
const WORKER_ID = process.env.WORKER_ID || `settlement-worker-${process.pid}`;
async function main() {
    console.log(`[SettlementWorker] Starting settlement service worker=${WORKER_ID}...`);
    const redis = new ioredis_1.Redis(REDIS_URL);
    const pool = new Pool({ connectionString: DATABASE_URL, max: 15 });
    const blnkClient = new wallet_adapter_1.BlnkClient(BLNK_URL);
    const dispatcher = new expiry_dispatcher_js_1.ExpiryDispatcher(redis);
    await dispatcher.init();
    dispatcher.start(50);
    console.log("[SettlementWorker] ExpiryDispatcher started (50ms interval)");
    const settler = new settler_js_1.ContractSettler(pool, redis, blnkClient, WORKER_ID);
    const reconciler = new financial_reconciler_js_1.FinancialReconciler(pool, blnkClient);
    let isRunning = true;
    // Reconciliação Contínua de 1 minuto (I-05, I-06)
    const auditTimer = setInterval(async () => {
        if (!isRunning)
            return;
        try {
            const report = await reconciler.runAudit();
            if (report.status === "CRITICAL_ALERT") {
                console.error("[FinancialReconciler] ALERT: Discrepancies found:", report.discrepancies);
            }
            else {
                console.log(`[FinancialReconciler] Audit PASS: 0 discrepancies at ${report.timestamp}`);
            }
        }
        catch (err) {
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
        }
        catch (err) {
            if (!isRunning)
                break;
            console.error("[SettlementWorker] Error in processing batch:", err);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}
main().catch(err => {
    console.error("[SettlementWorker] Fatal startup error:", err);
    process.exit(1);
});
