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
}
