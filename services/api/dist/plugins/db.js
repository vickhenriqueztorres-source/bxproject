import fp from "fastify-plugin";
import pg from "pg";
const { Pool } = pg;
export const dbPlugin = fp(async (server) => {
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
