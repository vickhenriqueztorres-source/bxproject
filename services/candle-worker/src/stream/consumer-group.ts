import { Redis } from "ioredis";

export interface StreamMessage {
  id: string;
  data: Record<string, string>;
}

export class StreamConsumerGroup {
  private redis: Redis;
  private streamKey: string;
  private groupName: string;
  private consumerName: string;

  constructor(redis: Redis, streamKey: string, groupName: string, consumerName: string) {
    this.redis = redis;
    this.streamKey = streamKey;
    this.groupName = groupName;
    this.consumerName = consumerName;
  }

  async init(): Promise<void> {
    try {
      // Cria group iniciando do último id ($) com MKSTREAM para criar se não existir
      await this.redis.xgroup("CREATE", this.streamKey, this.groupName, "$", "MKSTREAM");
    } catch (err: any) {
      if (!err.message?.includes("BUSYGROUP")) {
        throw err;
      }
      // BUSYGROUP significa que o grupo já existe, o que é esperado e idempotente
    }
  }

  async readMessages(count: number = 50, blockMs: number = 1000): Promise<StreamMessage[]> {
    const raw = await this.redis.xreadgroup(
      "GROUP",
      this.groupName,
      this.consumerName,
      "COUNT",
      count,
      "BLOCK",
      blockMs,
      "STREAMS",
      this.streamKey,
      ">"
    );

    if (!raw || !Array.isArray(raw)) return [];

    const messages: StreamMessage[] = [];
    for (const [_stream, entries] of raw as any[]) {
      for (const [id, fields] of entries) {
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1];
        }
        messages.push({ id, data });
      }
    }
    return messages;
  }

  async autoClaimPending(minIdleTimeMs: number = 5000, count: number = 50): Promise<StreamMessage[]> {
    try {
      // XAUTOCLAIM stream group consumer min-idle-time start COUNT count
      const res = await this.redis.xautoclaim(
        this.streamKey,
        this.groupName,
        this.consumerName,
        minIdleTimeMs,
        "0-0",
        "COUNT",
        count
      );

      if (!res || !Array.isArray(res) || res.length < 2) return [];

      const entries = res[1] as any[];
      const messages: StreamMessage[] = [];
      for (const [id, fields] of entries) {
        if (!fields) continue;
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1];
        }
        messages.push({ id, data });
      }
      return messages;
    } catch (err) {
      return [];
    }
  }

  async ack(messageId: string): Promise<number> {
    return this.redis.xack(this.streamKey, this.groupName, messageId);
  }

  async ackBatch(messageIds: string[]): Promise<number> {
    if (messageIds.length === 0) return 0;
    return this.redis.xack(this.streamKey, this.groupName, ...messageIds);
  }
}
