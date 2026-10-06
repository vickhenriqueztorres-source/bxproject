"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamConsumerGroup = void 0;
class StreamConsumerGroup {
    redis;
    streamKey;
    groupName;
    consumerName;
    constructor(redis, streamKey, groupName, consumerName) {
        this.redis = redis;
        this.streamKey = streamKey;
        this.groupName = groupName;
        this.consumerName = consumerName;
    }
    async init() {
        try {
            // Cria group iniciando do último id ($) com MKSTREAM para criar se não existir
            await this.redis.xgroup("CREATE", this.streamKey, this.groupName, "$", "MKSTREAM");
        }
        catch (err) {
            if (!err.message?.includes("BUSYGROUP")) {
                throw err;
            }
            // BUSYGROUP significa que o grupo já existe, o que é esperado e idempotente
        }
    }
    async readMessages(count = 50, blockMs = 1000) {
        const raw = await this.redis.xreadgroup("GROUP", this.groupName, this.consumerName, "COUNT", count, "BLOCK", blockMs, "STREAMS", this.streamKey, ">");
        if (!raw || !Array.isArray(raw))
            return [];
        const messages = [];
        for (const [_stream, entries] of raw) {
            for (const [id, fields] of entries) {
                const data = {};
                for (let i = 0; i < fields.length; i += 2) {
                    data[fields[i]] = fields[i + 1];
                }
                messages.push({ id, data });
            }
        }
        return messages;
    }
    async autoClaimPending(minIdleTimeMs = 5000, count = 50) {
        try {
            // XAUTOCLAIM stream group consumer min-idle-time start COUNT count
            const res = await this.redis.xautoclaim(this.streamKey, this.groupName, this.consumerName, minIdleTimeMs, "0-0", "COUNT", count);
            if (!res || !Array.isArray(res) || res.length < 2)
                return [];
            const entries = res[1];
            const messages = [];
            for (const [id, fields] of entries) {
                if (!fields)
                    continue;
                const data = {};
                for (let i = 0; i < fields.length; i += 2) {
                    data[fields[i]] = fields[i + 1];
                }
                messages.push({ id, data });
            }
            return messages;
        }
        catch (err) {
            return [];
        }
    }
    async ack(messageId) {
        return this.redis.xack(this.streamKey, this.groupName, messageId);
    }
    async ackBatch(messageIds) {
        if (messageIds.length === 0)
            return 0;
        return this.redis.xack(this.streamKey, this.groupName, ...messageIds);
    }
}
exports.StreamConsumerGroup = StreamConsumerGroup;
