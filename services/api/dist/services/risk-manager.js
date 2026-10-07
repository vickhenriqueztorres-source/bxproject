"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskManager = void 0;
class RiskManager {
    redis;
    checkScript;
    releaseScript;
    DEFAULT_FLOAT_MINOR = 100_000_000; // US$ 1.000.000,00 inicial (100 traders demo)
    PAYOUT_PERCENTAGE = 85;
    constructor(redis) {
        this.redis = redis;
        this.checkScript = `
      local deposit_float = tonumber(redis.call('GET', KEYS[1]) or '0')
      if deposit_float <= 0 then
        return {-1, 'ERR_NO_DEPOSIT_FLOAT'}
      end

      local max_risk_cap = math.floor(deposit_float * 0.03)
      local stake_minor = tonumber(ARGV[1])
      local payout_pct = tonumber(ARGV[2])
      local additional_risk = math.floor(stake_minor * payout_pct / 100)

      local current_exposure = tonumber(redis.call('GET', KEYS[2]) or '0')
      if (current_exposure + additional_risk) > max_risk_cap then
        return {-2, 'ERR_RISK_CAP_EXCEEDED'}
      end

      local new_exposure = redis.call('INCRBY', KEYS[2], additional_risk)
      redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))

      return {1, 'APPROVED', new_exposure}
    `;
        this.releaseScript = `
      local current_exposure = tonumber(redis.call('GET', KEYS[1]) or '0')
      local amount_to_release = tonumber(ARGV[1])

      if current_exposure > 0 and amount_to_release > 0 then
        local to_decr = math.min(current_exposure, amount_to_release)
        redis.call('DECRBY', KEYS[1], to_decr)
      end

      return 1
    `;
    }
    async ensureDepositFloat() {
        const floatKey = "broker:deposit_float_minor";
        const exists = await this.redis.exists(floatKey);
        if (!exists) {
            await this.redis.set(floatKey, this.DEFAULT_FLOAT_MINOR.toString());
        }
    }
    async activateKillSwitch(symbol, reason = "STALE_FEED", ttlSeconds = 10) {
        const key = `risk:killswitch:${symbol}`;
        await this.redis.set(key, reason, "EX", ttlSeconds);
    }
    async isKillSwitchActive(symbol) {
        const key = `risk:killswitch:${symbol}`;
        const val = await this.redis.get(key);
        return Boolean(val);
    }
    getRiskKey(symbol, expiryBucket, direction) {
        const bucketStartMs = Math.floor(expiryBucket.getTime() / 60000) * 60000;
        return `risk:candle:${symbol}:${bucketStartMs}:${direction}`;
    }
    async checkAndReserveRisk(params) {
        // 1. Verificação preliminar ultrarrápida de Kill Switch no Redis (<1ms) - Subetapa 5
        if (await this.isKillSwitchActive(params.symbol)) {
            return { approved: false, reason: "KILLSWITCH_ACTIVE" };
        }
        await this.ensureDepositFloat();
        const floatKey = "broker:deposit_float_minor";
        const riskKey = this.getRiskKey(params.symbol, params.expiryBucket, params.direction);
        const payoutPct = params.payoutPercentage || this.PAYOUT_PERCENTAGE;
        const ttlSeconds = 600;
        const result = (await this.redis.eval(this.checkScript, 2, floatKey, riskKey, params.stakeMinor, payoutPct, ttlSeconds));
        const statusCode = result[0];
        if (statusCode === 1) {
            return { approved: true };
        }
        return {
            approved: false,
            reason: result[1] || "RISK_CAP_EXCEEDED"
        };
    }
    async releaseRisk(params) {
        const riskKey = this.getRiskKey(params.symbol, params.expiryBucket, params.direction);
        const payoutPct = params.payoutPercentage || this.PAYOUT_PERCENTAGE;
        const riskAmount = Math.floor((params.stakeMinor * payoutPct) / 100);
        await this.redis.eval(this.releaseScript, 1, riskKey, riskAmount);
    }
}
exports.RiskManager = RiskManager;
