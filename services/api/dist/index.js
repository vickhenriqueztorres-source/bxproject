"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const auth_js_1 = require("./plugins/auth.js");
const db_js_1 = require("./plugins/db.js");
const redis_js_1 = require("./plugins/redis.js");
const health_js_1 = require("./routes/health.js");
const chart_js_1 = require("./routes/chart.js");
const contracts_js_1 = require("./routes/contracts.js");
const wallet_js_1 = require("./routes/wallet.js");
const server = (0, fastify_1.default)({
    logger: {
        level: process.env.LOG_LEVEL || "info",
        redact: ["req.headers.authorization"] // B-12: Nunca logar tokens ou segredos
    }
});
async function main() {
    await server.register(helmet_1.default, { contentSecurityPolicy: false });
    await server.register(cors_1.default, {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
        credentials: true
    });
    await server.register(rate_limit_1.default, {
        max: 120, // 120 req/min
        timeWindow: "1 minute"
    });
    await server.register(db_js_1.dbPlugin);
    await server.register(redis_js_1.redisPlugin);
    await server.register(auth_js_1.authPlugin);
    await server.register(health_js_1.healthRoutes);
    await server.register(chart_js_1.chartRoutes);
    await server.register(contracts_js_1.contractRoutes);
    await server.register(wallet_js_1.walletRoutes);
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
