import pg from "pg";
import { Redis } from "ioredis";
export async function healthRoutes(fastify) {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL || "postgres://synth_migrator:dev_secret_pw_123@postgres:5432/broker_platform",
        max: 2,
        connectionTimeoutMillis: 2000
    });
    const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379", {
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
        const lines = [];
        // 1. Métricas de banco (index_state) isoladas
        try {
            const activePool = fastify.pg || pool;
            const res = await activePool.query(`
        SELECT symbol, updated_at, last_sequence 
        FROM index_state;
      `);
            const now = Date.now();
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
        }
        catch {
            lines.push("# AVISO: index_state temporariamente inacessivel via pool");
        }
        // 2. Métricas Industriais, Motor, Contratos e Regionais (sempre exportadas)
        try {
            const { RegionalMetricsService } = await import("../services/metrics.js");
            const appMetrics = RegionalMetricsService.getInstance().renderOpenMetrics();
            if (appMetrics) {
                if (lines.length > 0)
                    lines.push("");
                lines.push(appMetrics);
            }
        }
        catch (err) {
            lines.push("# Erro ao renderizar metricas de aplicacao");
        }
        reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
        return lines.join("\n") + "\n";
    });
}
