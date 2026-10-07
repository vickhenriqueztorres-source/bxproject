"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = healthRoutes;
const pg_1 = __importDefault(require("pg"));
const ioredis_1 = __importDefault(require("ioredis"));
async function healthRoutes(fastify) {
    const pool = new pg_1.default.Pool({
        connectionString: process.env.DATABASE_URL || "postgres://synth_migrator:dev_secret_pw_123@postgres:5432/broker_platform",
        max: 2,
        connectionTimeoutMillis: 2000
    });
    const redis = new ioredis_1.default(process.env.REDIS_URL || "redis://redis:6379", {
        lazyConnect: true,
        connectTimeout: 2000
    });
    fastify.get("/healthz", async () => {
        return { status: "ok", timestamp: new Date().toISOString() };
    });
    fastify.get("/readyz", async (_request, reply) => {
        try {
            // 1. Check PostgreSQL
            await pool.query("SELECT 1");
            // 2. Check Redis
            if (redis.status !== "ready") {
                await redis.connect();
            }
            await redis.ping();
            return { status: "ready", timestamp: new Date().toISOString() };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Service not ready";
            return reply.status(503).send({ status: "not_ready", error: message });
        }
    });
    // 3. GET /metrics (Prometheus / OpenMetrics - Subetapa 6)
    fastify.get("/metrics", async (_request, reply) => {
        try {
            const res = await pool.query(`
        SELECT symbol, updated_at, last_sequence 
        FROM index_state;
      `);
            const now = Date.now();
            const lines = [];
            lines.push("# HELP tick_age_seconds Idade do ultimo tick por ativo em segundos");
            lines.push("# TYPE tick_age_seconds gauge");
            for (const row of res.rows) {
                const ageSec = ((now - new Date(row.updated_at).getTime()) / 1000).toFixed(3);
                lines.push(`tick_age_seconds{symbol="${row.symbol}"} ${ageSec}`);
            }
            lines.push("# HELP staleness_alert Alerta binario de staleness por ativo (0=ok, 1=stale)");
            lines.push("# TYPE staleness_alert gauge");
            for (const row of res.rows) {
                const ageSec = (now - new Date(row.updated_at).getTime()) / 1000;
                lines.push(`staleness_alert{symbol="${row.symbol}"} ${ageSec > 4 ? 1 : 0}`);
            }
            reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
            return lines.join("\n") + "\n";
        }
        catch {
            reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
            return "# Erro ao consultar index_state\n";
        }
    });
}
