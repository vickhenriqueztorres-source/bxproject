import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ContractSettler } from "../src/settlement/settler.js";

describe("ContractSettler (ACID & Exit Tick Capture)", () => {
  it("rolls back and does not settle if exit tick is not yet available in PostgreSQL", async () => {
    let rolledBack = false;

    const mockPool = {
      connect: async () => ({
        query: async (sql: string, params: any[]) => {
          if (sql === "BEGIN") return {};
          if (sql === "ROLLBACK") {
            rolledBack = true;
            return {};
          }
          if (sql.includes("FROM contracts")) {
            return {
              rows: [
                {
                  id: "contract-123",
                  user_id: "user-abc",
                  symbol: "SYNTH_VOL_50",
                  direction: "UP",
                  status: "OPEN",
                  stake_minor: 1000,
                  entry_price: "1.485000",
                  opened_at: new Date(Date.now() - 60000),
                  expires_at: new Date(Date.now())
                }
              ]
            };
          }
          if (sql.includes("FROM ticks")) {
            // Tick ainda não foi gravado!
            return { rows: [] };
          }
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const mockRedis = {
      zrem: async () => 1
    };

    const mockBlnk = {
      settleContract: async () => {}
    };

    const settler = new ContractSettler(mockPool as any, mockRedis as any, mockBlnk as any, "test-worker");
    const result = await settler.settleContract("contract-123");

    assert.equal(result.success, false);
    assert.equal(result.reason, "EXIT_TICK_NOT_YET_AVAILABLE");
    assert.equal(rolledBack, true);
  });

  it("settles contract when official exit tick is available in PostgreSQL", async () => {
    let committed = false;
    let updatedStatus = "";
    let removedFromRedis = false;

    const mockPool = {
      connect: async () => ({
        query: async (sql: string, params: any[]) => {
          if (sql === "BEGIN") return {};
          if (sql === "COMMIT") {
            committed = true;
            return {};
          }
          if (sql.includes("FROM contracts")) {
            return {
              rows: [
                {
                  id: "contract-123",
                  user_id: "user-abc",
                  symbol: "SYNTH_VOL_50",
                  direction: "UP",
                  status: "OPEN",
                  stake_minor: 1000,
                  entry_price: "1.485000",
                  opened_at: new Date(Date.now() - 60000),
                  expires_at: new Date(Date.now())
                }
              ]
            };
          }
          if (sql.includes("FROM ticks")) {
            return {
              rows: [
                {
                  sequence: "1050",
                  price: "1.485600", // Preço subiu => UP ganha (WIN)
                  ts: new Date()
                }
              ]
            };
          }
          if (sql.includes("UPDATE contracts")) {
            updatedStatus = params[0]; // Result WIN
            return {};
          }
          if (sql.includes("INSERT INTO outbox_events")) {
            return {};
          }
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const mockRedis = {
      zrem: async () => {
        removedFromRedis = true;
        return 1;
      },
      publish: async () => 1
    };

    const mockBlnk = {
      settleContract: async () => {}
    };

    const settler = new ContractSettler(mockPool as any, mockRedis as any, mockBlnk as any, "test-worker");
    const result = await settler.settleContract("contract-123");

    assert.equal(result.success, true);
    assert.equal(updatedStatus, "WIN");
    assert.equal(committed, true);
    assert.equal(removedFromRedis, true);
  });
});
