import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FinancialReconciler } from "../src/reconciliation/financial-reconciler.js";

describe("FinancialReconciler (Continuous Audit & Hash Integrity)", () => {
  it("reports HEALTHY when ticks and contracts are consistent", async () => {
    const mockPool = {
      query: async (sql: string, params: any[]) => {
        const clean = sql.replace(/\s+/g, " ");
        if (clean.includes("INTERVAL '30 seconds'")) {
          return { rows: [] }; // Nenhum preso
        }
        if (clean.includes("COALESCE(SUM(stake_minor), 0)")) {
          return { rows: [{ count: "0", total_stake: "0" }] };
        }
        if (clean.includes("FROM outbox_events")) {
          return { rows: [] }; // Nenhuma falha
        }
        if (clean.includes("FROM ticks")) {
          return {
            rows: [
              { sequence: "100", prev_hash: "hash-99", hash: "hash-100" },
              { sequence: "99", prev_hash: "hash-98", hash: "hash-99" }
            ]
          };
        }
        return { rows: [] };
      }
    };

    const mockBlnk = {} as any;
    const reconciler = new FinancialReconciler(mockPool as any, mockBlnk);
    const report = await reconciler.runAudit();

    assert.equal(report.status, "HEALTHY");
    assert.equal(report.discrepancies.length, 0);
    assert.equal(report.checks.tick_sequence_continuous, true);
    assert.equal(report.checks.hash_chain_valid, true);
  });

  it("triggers CRITICAL_ALERT when sequence has gaps or hash chain is broken", async () => {
    const mockPool = {
      query: async (sql: string, params: any[]) => {
        const clean = sql.replace(/\s+/g, " ");
        if (clean.includes("INTERVAL '30 seconds'")) {
          return { rows: [] };
        }
        if (clean.includes("COALESCE(SUM(stake_minor), 0)")) {
          return { rows: [{ count: "0", total_stake: "0" }] };
        }
        if (clean.includes("FROM outbox_events")) {
          return { rows: [] };
        }
        if (clean.includes("FROM ticks")) {
          return {
            rows: [
              { sequence: "105", prev_hash: "hash-104", hash: "hash-105" },
              // Gap de 100 para 105!
              { sequence: "100", prev_hash: "hash-99", hash: "hash-100" }
            ]
          };
        }
        return { rows: [] };
      }
    };

    const mockBlnk = {} as any;
    const reconciler = new FinancialReconciler(mockPool as any, mockBlnk);
    const report = await reconciler.runAudit();

    assert.equal(report.status, "CRITICAL_ALERT");
    assert.equal(report.checks.tick_sequence_continuous, false);
    assert.ok(report.discrepancies.some(d => d.includes("Gap in tick sequence")));
  });

  it("triggers CRITICAL_ALERT when contracts are stuck past expiration", async () => {
    const mockPool = {
      query: async (sql: string, params: any[]) => {
        const clean = sql.replace(/\s+/g, " ");
        if (clean.includes("INTERVAL '30 seconds'")) {
          return { rows: [{ id: "stuck-1", expires_at: new Date() }] };
        }
        if (clean.includes("COALESCE(SUM(stake_minor), 0)")) {
          return { rows: [{ count: "1", total_stake: "1000" }] };
        }
        if (clean.includes("FROM outbox_events")) {
          return { rows: [] };
        }
        if (clean.includes("FROM ticks")) {
          return { rows: [] };
        }
        return { rows: [] };
      }
    };

    const mockBlnk = {} as any;
    const reconciler = new FinancialReconciler(mockPool as any, mockBlnk);
    const report = await reconciler.runAudit();

    assert.equal(report.status, "CRITICAL_ALERT");
    assert.equal(report.checks.stuck_settling_contracts, false);
    assert.ok(report.discrepancies.some(d => d.includes("contracts stuck past expiration")));
  });
});
