"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = __importDefault(require("pg"));
const ioredis_1 = __importDefault(require("ioredis"));
const node_crypto_1 = require("node:crypto");
const ou_generator_js_1 = require("./engine/ou-generator.js");
const hash_chain_js_1 = require("./engine/hash-chain.js");
const leader_elector_js_1 = require("./cluster/leader-elector.js");
const tick_repository_js_1 = require("./persistence/tick-repository.js");
const symbol = process.env.INDEX_SYMBOL || "VOL_50";
const instanceId = `tick_worker_${(0, node_crypto_1.randomUUID)()}`;
const pool = new pg_1.default.Pool({
    connectionString: process.env.DATABASE_URL || "postgres://app_tick:app_tick_dev_pass@postgres:5432/broker_platform",
    max: 5
});
const redis = new ioredis_1.default(process.env.REDIS_URL || "redis://redis:6379");
async function main() {
    console.log(`[TickEngine] Starting instance ${instanceId} for symbol ${symbol}...`);
    const elector = new leader_elector_js_1.LeaderElector(redis, symbol, instanceId, 600);
    const repository = new tick_repository_js_1.TickRepository(pool);
    // Carrega estado inicial do banco
    const state = await repository.fetchIndexState(symbol);
    console.log(`[TickEngine] Loaded initial state for ${symbol}: sequence=${state.lastSequence}, price=${state.lastPrice}`);
    const engine = new ou_generator_js_1.SyntheticOUEngine({
        symbol,
        basePrice: state.basePrice,
        currentPrice: parseFloat(state.lastPrice),
        theta: state.meanReversionSpeed,
        sigma: state.volatility,
        dt: 1.0
    });
    let lastHash = state.lastHash;
    let lastSeq = state.lastSequence;
    // 1. Loop de Eleição e Renovação de Liderança (a cada 200ms)
    setInterval(async () => {
        try {
            if (elector.isLeader()) {
                const renewed = await elector.renewLease();
                if (!renewed) {
                    console.warn(`[TickEngine] Lost leadership lease for ${symbol}`);
                }
            }
            else {
                const acquired = await elector.acquireLease();
                if (acquired) {
                    console.log(`[TickEngine] Acquired leadership lease for ${symbol}!`);
                    // Re-sincroniza estado mais recente do banco ao virar líder
                    const fresh = await repository.fetchIndexState(symbol);
                    lastSeq = fresh.lastSequence;
                    lastHash = fresh.lastHash;
                    engine.currentPrice = parseFloat(fresh.lastPrice);
                }
            }
        }
        catch (err) {
            console.error("[TickEngine] Error in lease election loop:", err);
        }
    }, 200);
    // 2. Loop de Emissão de Ticks (alinhado a 1s)
    setInterval(async () => {
        if (!elector.isLeader())
            return;
        try {
            const next = engine.generateNextPrice();
            const ts = new Date();
            const nextSeq = lastSeq + 1n;
            const nextHash = hash_chain_js_1.HashChain.computeTickHash(lastHash, symbol, nextSeq, ts, next.priceString);
            // Persistência Atômica no PostgreSQL + Outbox
            const res = await repository.persistTickAndOutbox(symbol, next.priceString, ts, lastHash, nextHash);
            lastSeq = res.sequence;
            lastHash = nextHash;
            // Log informativo
            console.log(`[TickEngine] Emitted tick seq=${lastSeq} price=${next.priceString} at ${ts.toISOString()}`);
        }
        catch (err) {
            console.error("[TickEngine] Error emitting tick:", err);
        }
    }, 1000);
}
main().catch((err) => {
    console.error("[TickEngine] Fatal startup error:", err);
    process.exit(1);
});
