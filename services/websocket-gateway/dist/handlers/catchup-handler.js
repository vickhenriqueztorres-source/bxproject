"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatchupHandler = void 0;
class CatchupHandler {
    redis;
    MAX_CATCHUP_BUFFER = 1000;
    constructor(redis) {
        this.redis = redis;
    }
    async getCatchupTicks(symbol, clientLastSequence) {
        const streamKey = `stream:ticks:${symbol}`;
        // Busca o tick mais recente no stream para calcular o gap
        const latestEntries = await this.redis.xrevrange(streamKey, "+", "-", "COUNT", 1);
        if (!latestEntries || latestEntries.length === 0) {
            return { resyncRequired: false, ticks: [] };
        }
        const latestFields = latestEntries[0][1];
        let latestSequence = 0n;
        for (let i = 0; i < latestFields.length; i += 2) {
            if (latestFields[i] === "sequence") {
                latestSequence = BigInt(latestFields[i + 1]);
                break;
            }
        }
        const gap = latestSequence - clientLastSequence;
        if (gap <= 0n) {
            return { resyncRequired: false, ticks: [] };
        }
        if (gap > BigInt(this.MAX_CATCHUP_BUFFER)) {
            // Gap maior que 1.000 ticks: força resync completo via HTTP REST
            return { resyncRequired: true, ticks: [] };
        }
        // Lê os últimos N ticks do stream
        const rawEntries = await this.redis.xrevrange(streamKey, "+", "-", "COUNT", Number(gap));
        const ticks = [];
        for (const [_id, fields] of rawEntries.reverse()) {
            const data = {};
            for (let i = 0; i < fields.length; i += 2) {
                data[fields[i]] = fields[i + 1];
            }
            const seq = BigInt(data.sequence || "0");
            if (seq > clientLastSequence) {
                ticks.push({
                    symbol: data.symbol || symbol,
                    sequence: data.sequence,
                    price: data.price,
                    ts: data.ts
                });
            }
        }
        return { resyncRequired: false, ticks };
    }
}
exports.CatchupHandler = CatchupHandler;
