import { Redis } from "ioredis";

export class ExpiryDispatcher {
  private redis: Redis;
  private isRunning: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  readonly STREAM_KEY = "stream:contracts:expiring";
  readonly GROUP_NAME = "cg:settlement";

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async init(): Promise<void> {
    try {
      await this.redis.xgroup("CREATE", this.STREAM_KEY, this.GROUP_NAME, "$", "MKSTREAM");
    } catch (err: any) {
      if (!err.message?.includes("BUSYGROUP")) {
        throw err;
      }
    }
  }

  start(intervalMs: number = 50): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalTimer = setInterval(async () => {
      try {
        await this.dispatchExpiredContracts();
      } catch (err) {
        console.error("[ExpiryDispatcher] Error dispatching contracts:", err);
      }
    }, intervalMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  async dispatchExpiredContracts(limit: number = 100): Promise<number> {
    const nowMs = Date.now();
    // Busca contratos com expiração <= agora
    const expiredContractIds = await this.redis.zrangebyscore("contracts:pending", 0, nowMs, "LIMIT", 0, limit);

    if (expiredContractIds.length === 0) return 0;

    for (const contractId of expiredContractIds) {
      // Envia para o stream de liquidação (não remove do Sorted Set ainda!)
      await this.redis.xadd(
        this.STREAM_KEY,
        "*",
        "contract_id",
        contractId,
        "dispatched_at",
        nowMs.toString()
      );
    }

    return expiredContractIds.length;
  }
}
