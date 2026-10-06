"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbPlugin = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
exports.dbPlugin = (0, fastify_plugin_1.default)(async (server) => {
    const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/broker";
    const pool = new Pool({
        connectionString,
        max: 20
    });
    server.decorate("pg", pool);
    server.addHook("onClose", async () => {
        await pool.end();
    });
});
