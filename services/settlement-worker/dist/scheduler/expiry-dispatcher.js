"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpiryDispatcher = void 0;
class ExpiryDispatcher {
    redis;
    isRunning = false;
    intervalTimer = null;
    STREAM_KEY = "stream:contracts:expiring";
    GROUP_NAME = "cg:settlement";
    constructor(redis) {
        this.redis = redis;
    }
    async init() {
        try {
            await this.redis.xgroup("CREATE", this.STREAM_KEY, this.GROUP_NAME, "$", "MKSTREAM");
        }
        catch (err) {
            if (!err.message?.includes("BUSYGROUP")) {
                throw err;
            }
        }
    }
    start(intervalMs = 50) {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.intervalTimer = setInterval(async () => {
            try {
                await this.dispatchExpiredContracts();
            }
            catch (err) {
                console.error("[ExpiryDispatcher] Error dispatching contracts:", err);
            }
        }, intervalMs);
    }
    stop() {
        this.isRunning = false;
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }
    async dispatchExpiredContracts(limit = 100) {
        const nowMs = Date.now();
        // Busca contratos com expiração <= agora
        const expiredContractIds = await this.redis.zrangebyscore("contracts:pending", 0, nowMs, "LIMIT", 0, limit);
        if (expiredContractIds.length === 0)
            return 0;
        for (const contractId of expiredContractIds) {
            // Envia para o stream de liquidação (não remove do Sorted Set ainda!)
            await this.redis.xadd(this.STREAM_KEY, "*", "contract_id", contractId, "dispatched_at", nowMs.toString());
        }
        return expiredContractIds.length;
    }
}
exports.ExpiryDispatcher = ExpiryDispatcher;
