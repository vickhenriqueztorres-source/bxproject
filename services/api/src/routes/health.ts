import { FastifyInstance } from "fastify";
import pg from "pg";
import Redis from "ioredis";

export async function healthRoutes(fastify: FastifyInstance) {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Service not ready";
      return reply.status(503).send({ status: "not_ready", error: message });
    }
  });
}
