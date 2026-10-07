/**
 * Token Bucket Rate Limiter para WebSocket Gateway
 */

export interface TokenBucketConfig {
  capacity?: number;
  refillRatePerSecond?: number;
}

export class TokenBucketRateLimiter {
  private readonly capacity: number;
  private readonly refillRatePerSecond: number;
  private tokens: number;
  private lastRefillTime: number;

  constructor(
    config: TokenBucketConfig = {},
    private readonly timeFn: () => number = Date.now
  ) {
    this.capacity = config.capacity ?? 10;
    this.refillRatePerSecond = config.refillRatePerSecond ?? 1;
    this.tokens = this.capacity;
    this.lastRefillTime = this.timeFn();
  }

  private refill(): void {
    const now = this.timeFn();
    const elapsedSeconds = (now - this.lastRefillTime) / 1000;
    if (elapsedSeconds > 0) {
      const addedTokens = elapsedSeconds * this.refillRatePerSecond;
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefillTime = now;
    }
  }

  public tryConsume(tokens = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  public async waitForToken(tokens = 1): Promise<void> {
    while (!this.tryConsume(tokens)) {
      this.refill();
      const needed = tokens - this.tokens;
      const waitSeconds = Math.max(0.1, needed / this.refillRatePerSecond);
      const waitMs = Math.ceil(waitSeconds * 1000);
      await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 1000)));
    }
  }

  public getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  public reset(): void {
    this.tokens = this.capacity;
    this.lastRefillTime = this.timeFn();
  }
}
