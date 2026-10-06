import Redis from "ioredis";

export class LeaderElector {
  private readonly leaseKey: string;
  private isLeaderFlag = false;

  constructor(
    private readonly redis: Redis,
    public readonly symbol: string,
    public readonly instanceId: string,
    public readonly ttlMs: number = 600
  ) {
    this.leaseKey = `lease:tick_leader:${symbol}`;
  }

  public async acquireLease(): Promise<boolean> {
    const result = await this.redis.set(
      this.leaseKey,
      this.instanceId,
      "PX",
      this.ttlMs,
      "NX"
    );
    this.isLeaderFlag = result === "OK";
    return this.isLeaderFlag;
  }

  public async renewLease(): Promise<boolean> {
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

  public async releaseLease(): Promise<void> {
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

  public isLeader(): boolean {
    return this.isLeaderFlag;
  }
}
