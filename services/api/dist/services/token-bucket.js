/**
 * Token Bucket Rate Limiter (Padrão de Resiliência contra Reconnect Storm & Throttling)
 */
export class TokenBucketRateLimiter {
    timeFn;
    capacity;
    refillRatePerSecond;
    tokens;
    lastRefillTime;
    constructor(config = {}, timeFn = Date.now) {
        this.timeFn = timeFn;
        this.capacity = config.capacity ?? 10;
        this.refillRatePerSecond = config.refillRatePerSecond ?? 1;
        this.tokens = this.capacity;
        this.lastRefillTime = this.timeFn();
    }
    refill() {
        const now = this.timeFn();
        const elapsedSeconds = (now - this.lastRefillTime) / 1000;
        if (elapsedSeconds > 0) {
            const addedTokens = elapsedSeconds * this.refillRatePerSecond;
            this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
            this.lastRefillTime = now;
        }
    }
    tryConsume(tokens = 1) {
        this.refill();
        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }
        return false;
    }
    async waitForToken(tokens = 1) {
        while (!this.tryConsume(tokens)) {
            this.refill();
            const needed = tokens - this.tokens;
            const waitSeconds = Math.max(0.1, needed / this.refillRatePerSecond);
            const waitMs = Math.ceil(waitSeconds * 1000);
            await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 1000)));
        }
    }
    getAvailableTokens() {
        this.refill();
        return Math.floor(this.tokens);
    }
    reset() {
        this.tokens = this.capacity;
        this.lastRefillTime = this.timeFn();
    }
}
