"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderElector = void 0;
class LeaderElector {
    redis;
    symbol;
    instanceId;
    ttlMs;
    leaseKey;
    isLeaderFlag = false;
    constructor(redis, symbol, instanceId, ttlMs = 600) {
        this.redis = redis;
        this.symbol = symbol;
        this.instanceId = instanceId;
        this.ttlMs = ttlMs;
        this.leaseKey = `lease:tick_leader:${symbol}`;
    }
    async acquireLease() {
        const result = await this.redis.set(this.leaseKey, this.instanceId, "PX", this.ttlMs, "NX");
        this.isLeaderFlag = result === "OK";
        return this.isLeaderFlag;
    }
    async renewLease() {
        const lua = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('pexpire', KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
        const result = await this.redis.eval(lua, 1, this.leaseKey, this.instanceId, this.ttlMs);
        this.isLeaderFlag = result === 1;
        return this.isLeaderFlag;
    }
    async releaseLease() {
        const lua = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;
        await this.redis.eval(lua, 1, this.leaseKey, this.instanceId);
        this.isLeaderFlag = false;
    }
    isLeader() {
        return this.isLeaderFlag;
    }
}
exports.LeaderElector = LeaderElector;
