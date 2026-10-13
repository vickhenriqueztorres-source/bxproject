import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { contractRoutes } from "../src/routes/contracts.js";

describe("Contract Routes & Risk Cap Tests", () => {
  const mockUserA = { id: "user-1111", roles: ["USER"] };
  const mockUserB = { id: "user-2222", roles: ["USER"] };

  function buildTestApp(customPg?: any, customRedis?: any, currentUser = mockUserA) {
    const app = Fastify();

    // Mock autenticação e trading enabled
    (app as any).decorate("authenticate", async (req: any) => {
      req.user = currentUser;
    });
    (app as any).decorate("enforceTradingEnabled", async () => {});

    const defaultPg = {
      query: async (sql: string, params: any[]) => {
        if (sql.includes("FROM contracts WHERE user_id = $1 AND idempotency_key = $2")) {
          return { rows: [] };
        }
        if (sql.includes("FROM index_state") || sql.includes("FROM ticks WHERE symbol = $1")) {
          return {
            rows: [
              {
                last_sequence: "100",
                last_price: "1.48520",
                last_ts: new Date(),
                price: "1.48520",
                ts: new Date()
              }
            ]
          };
        }
        return { rows: [] };
      },
      connect: async () => ({
        query: async (sql: string, params: any[]) => {
          if (sql.includes("INSERT INTO contracts")) {
            return {
              rows: [
                {
                  id: "contract-uuid-1",
                  user_id: params[0],
                  symbol: params[1],
                  direction: params[2],
                  status: "OPEN",
                  stake_minor: params[3],
                  payout_minor: params[4],
                  entry_price: params[5],
                  opened_at: params[6],
                  expires_at: params[7],
                  idempotency_key: params[8]
                }
              ]
            };
          }
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const defaultRedis = {
      exists: async () => 1,
      get: async (key: string) => (key?.includes("deposit_float") ? "100000000" : null),
      set: async () => "OK",
      eval: async () => [1, "APPROVED", 850],
      zadd: async () => 1
    };

    app.decorate("pg", customPg || defaultPg);
    app.decorate("redis", customRedis || defaultRedis);

    return app;
  }

  it("POST /api/v1/contracts rejects requests without Idempotency-Key header with 400", async () => {
    const app = buildTestApp();
    await app.register(contractRoutes);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/contracts",
      payload: {
        symbol: "SYNTH_VOL_50",
        direction: "UP",
        stake_minor: 1000
      }
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.error, "BAD_REQUEST");
    await app.close();
  });

  it("POST /api/v1/contracts rejects invalid stake (< 100 cents) with 400", async () => {
    const app = buildTestApp();
    await app.register(contractRoutes);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/contracts",
      headers: { "idempotency-key": "uuid-test-1" },
      payload: {
        symbol: "SYNTH_VOL_50",
        direction: "UP",
        stake_minor: 50 // Menor que o mínimo de 100 centavos
      }
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.error, "VALIDATION_ERROR");
    await app.close();
  });

  it("POST /api/v1/contracts successfully opens contract when risk cap is respected", async () => {
    const app = buildTestApp();
    await app.register(contractRoutes);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/contracts",
      headers: { "idempotency-key": "uuid-valid-1" },
      payload: {
        symbol: "SYNTH_VOL_50",
        direction: "UP",
        stake_minor: 1000 // US$ 10,00
      }
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.is_duplicate, false);
    assert.equal(body.contract.symbol, "SYNTH_VOL_50");
    assert.equal(body.contract.stake_minor, 1000);
    assert.equal(body.contract.payout_minor, 1850); // 1000 + 85% = 1850 centavos
    await app.close();
  });

  it("POST /api/v1/contracts rejects with 422 when risk cap exceeds 3% of float", async () => {
    const rejectingRedis = {
      exists: async () => 1,
      get: async (key: string) => (key?.includes("deposit_float") ? "100000000" : null),
      set: async () => "OK",
      eval: async () => [-2, "ERR_RISK_CAP_EXCEEDED"],
      zadd: async () => 1
    };

    const app = buildTestApp(undefined, rejectingRedis);
    await app.register(contractRoutes);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/contracts",
      headers: { "idempotency-key": "uuid-risk-cap-1" },
      payload: {
        symbol: "SYNTH_VOL_50",
        direction: "UP",
        stake_minor: 1000
      }
    });

    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.payload);
    assert.equal(body.error, "RISK_LIMIT_EXCEEDED");
    await app.close();
  });

  it("GET /api/v1/contracts/:id returns 404 for contract belonging to another user (BOLA protection)", async () => {
    const mockPg = {
      query: async (sql: string, params: any[]) => {
        // Simula query com WHERE id = $1 AND user_id = $2 não encontrando registro
        return { rows: [] };
      }
    };

    const app = buildTestApp(mockPg, undefined, mockUserB);
    await app.register(contractRoutes);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/contracts/contract-of-user-a"
    });

    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.payload);
    assert.equal(body.error, "NOT_FOUND");
    await app.close();
  });
});
