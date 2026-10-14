import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { authPlugin } from "./plugins/auth.js";
import { dbPlugin } from "./plugins/db.js";
import { redisPlugin } from "./plugins/redis.js";
import { geoblockPlugin } from "./plugins/geoblock.js";
import { regulatoryRoutingPlugin } from "./plugins/regulatory-routing.js";
import { healthRoutes } from "./routes/health.js";
import { chartRoutes } from "./routes/chart.js";
import { contractRoutes } from "./routes/contracts.js";
import { walletRoutes } from "./routes/wallet.js";
import { geoRoutes } from "./routes/geo.js";
import { currencyRoutes } from "./routes/currencies.js";
import { mirrorRoutes } from "./routes/mirrors.js";
import { kycRoutes } from "./routes/kyc.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { arenaRoutes } from "./routes/arena.js";
const server = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || "info",
        redact: ["req.headers.authorization"] // B-12: Nunca logar tokens ou segredos
    }
});
async function main() {
    await server.register(helmet, { contentSecurityPolicy: false });
    await server.register(cors, {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
        credentials: true
    });
    await server.register(rateLimit, {
        max: 120, // 120 req/min
        timeWindow: "1 minute"
    });
    await server.register(dbPlugin);
    await server.register(redisPlugin);
    await server.register(authPlugin);
    await server.register(regulatoryRoutingPlugin);
    await server.register(geoblockPlugin);
    await server.register(healthRoutes);
    await server.register(chartRoutes);
    await server.register(contractRoutes);
    await server.register(walletRoutes);
    await server.register(arenaRoutes);
    await server.register(geoRoutes);
    await server.register(currencyRoutes);
    await server.register(mirrorRoutes);
    await server.register(kycRoutes);
    await server.register(authRoutes);
    await server.register(adminRoutes, { prefix: "/api/v1/admin" });
    const port = parseInt(process.env.PORT || "3000", 10);
    const host = process.env.HOST || "0.0.0.0";
    try {
        await server.listen({ port, host });
        server.log.info(`API Gateway listening on ${host}:${port}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}
main();
