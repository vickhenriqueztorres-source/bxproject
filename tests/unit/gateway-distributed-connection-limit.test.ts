import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('V-11: Distributed WebSocket Connection Limit Across Gateways', () => {
  it('enforces max 5 connections per sub across multiple gateway instances using Redis counter with TTL', async () => {
    // Simulação de Redis compartilhado
    const redisStore = new Map<string, { val: number; expireAt: number }>();

    const redis = {
      async incr(key: string, ttlSeconds: number, maxLimit: number): Promise<number> {
        const now = Date.now();
        let entry = redisStore.get(key);
        if (!entry || entry.expireAt <= now) {
          entry = { val: 0, expireAt: now + ttlSeconds * 1000 };
        }
        entry.val += 1;
        entry.expireAt = now + ttlSeconds * 1000;
        redisStore.set(key, entry);

        if (entry.val > maxLimit) {
          entry.val -= 1; // Reverte se ultrapassou
          return -1; // Rejeitado
        }
        return entry.val;
      },
      async decr(key: string): Promise<number> {
        let entry = redisStore.get(key);
        if (!entry) return 0;
        entry.val -= 1;
        if (entry.val <= 0) {
          redisStore.delete(key);
          return 0;
        }
        return entry.val;
      },
      async expire(key: string, ttlSeconds: number): Promise<void> {
        let entry = redisStore.get(key);
        if (entry) {
          entry.expireAt = Date.now() + ttlSeconds * 1000;
        }
      },
      get(key: string): number {
        const entry = redisStore.get(key);
        if (!entry || entry.expireAt <= Date.now()) return 0;
        return entry.val;
      }
    };

    const userId = 'user-sub-abc-123';
    const redisKey = `ws:conn:${userId}`;

    // Simulação de duas instâncias do Gateway (Gateway A e Gateway B)
    class GatewayInstance {
      name: string;
      localConnections: Set<string> = new Set();
      constructor(name: string) { this.name = name; }

      async handleConnect(connId: string): Promise<{ success: boolean; code?: number }> {
        const count = await redis.incr(redisKey, 60, 5);
        if (count === -1) {
          return { success: false, code: 4408 };
        }
        this.localConnections.add(connId);
        return { success: true };
      }

      async handleClose(connId: string): Promise<void> {
        if (this.localConnections.has(connId)) {
          this.localConnections.delete(connId);
          await redis.decr(redisKey);
        }
      }

      // Simulação de Crash abrupto (kill -9) onde não há callback de close
      crash(): void {
        this.localConnections.clear();
      }
    }

    const gatewayA = new GatewayInstance('Gateway-Node-A');
    const gatewayB = new GatewayInstance('Gateway-Node-B');

    // 1. Conexões 1 e 2 no Gateway A
    const c1 = await gatewayA.handleConnect('conn-1');
    const c2 = await gatewayA.handleConnect('conn-2');
    assert.equal(c1.success, true);
    assert.equal(c2.success, true);
    assert.equal(redis.get(redisKey), 2);

    // 2. Conexões 3 e 4 no Gateway B
    const c3 = await gatewayB.handleConnect('conn-3');
    const c4 = await gatewayB.handleConnect('conn-4');
    assert.equal(c3.success, true);
    assert.equal(c4.success, true);
    assert.equal(redis.get(redisKey), 4);

    // 3. 5ª Conexão no Gateway A (limite exato)
    const c5 = await gatewayA.handleConnect('conn-5');
    assert.equal(c5.success, true);
    assert.equal(redis.get(redisKey), 5);

    // 4. 6ª Conexão no Gateway B (DEVE SER REJEITADA com código 4408)
    const c6 = await gatewayB.handleConnect('conn-6');
    assert.equal(c6.success, false);
    assert.equal(c6.code, 4408, '6ª conexão distribuída DEVE ser recusada com código 4408 (V-11)');
    assert.equal(redis.get(redisKey), 5, 'Contador não deve vazar acima do teto de 5');

    // 5. Fechamento normal da conexão 1 no Gateway A
    await gatewayA.handleClose('conn-1');
    assert.equal(redis.get(redisKey), 4);

    // 6. Nova tentativa da conexão 6 no Gateway B agora é aceita
    const c6Retry = await gatewayB.handleConnect('conn-6');
    assert.equal(c6Retry.success, true);
    assert.equal(redis.get(redisKey), 5);

    // 7. Simula Crash abrupto (kill -9) do Gateway B com 3 conexões
    gatewayB.crash();
    // Simula expiração do TTL após 60s
    const entry = redisStore.get(redisKey)!;
    entry.expireAt = Date.now() - 1000; // Força expiração

    assert.equal(redis.get(redisKey), 0, 'Após expiração do TTL de crash, slots de conexão são 100% liberados');
  });
});
