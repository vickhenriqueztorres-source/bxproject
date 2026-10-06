import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export const redisPlugin: FastifyPluginAsync = fp(async (server) => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const redis = new Redis(redisUrl);

  server.decorate("redis", redis);

  server.addHook("onClose", async () => {
    await redis.quit();
  });
});
