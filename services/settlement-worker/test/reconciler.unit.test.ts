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

  it("reconcileTournamentEscrowAndRealWallet reports HEALTHY when escrow, withdrawal holds, and bonus margin isolation hold", () => {
    const report = FinancialReconciler.reconcileTournamentEscrowAndRealWallet({
      tournaments: [
        {
          tournamentId: "tourney-active-1",
          status: "RUNNING",
          escrowBalanceMinor: 50000,
          entries: [
            { id: "e1", entry_type: "BUY_IN", escrow_amount_minor: 800 },
            { id: "e2", entry_type: "REBUY", escrow_amount_minor: 400 },
            { id: "e3", entry_type: "OVERLAY_INJECTION", escrow_amount_minor: 48800 }
          ]
        },
        {
          tournamentId: "tourney-settled-1",
          status: "SETTLED",
          escrowBalanceMinor: 0,
          entries: [
            { id: "e4", entry_type: "BUY_IN", escrow_amount_minor: 50000 }
          ]
        }
      ],
      realWalletHolds: [
        {
          userId: "user-1",
          reservedBalanceMinor: 5000,
          walletTransactions: [
            { id: "w1", type: "WITHDRAWAL", status: "PENDING", amount_minor: 3000 },
            { id: "w2", type: "WITHDRAWAL", status: "PENDING", amount_minor: 2000 },
            { id: "w3", type: "WITHDRAWAL", status: "COMPLETED", amount_minor: 10000 }
          ]
        }
      ],
      bonusMargins: [
        {
          userId: "user-1",
          ledgerTransactions: [
            {
              reference: "bonus-unlock-1",
              source: "@user_user-1:bonus_margin",
              destination: "@user_user-1:real:available",
              amount: 2500,
              currency: "USD"
            }
          ],
          bonusGrants: [
            {
              id: "bg-1",
              amount_minor: 2500,
              required_rollover_minor: 75000,
              completed_volume_minor: 80000,
              status: "UNLOCKED"
            }
          ]
        }
      ]
    });

    assert.equal(report.status, "HEALTHY");
    assert.equal(report.checks.tournament_escrow_conservation, true);
    assert.equal(report.checks.real_wallet_withdrawals_hold_check, true);
    assert.equal(report.checks.bonus_margin_isolation_check, true);
    assert.equal(report.discrepancies.length, 0);
  });

  it("reconcileTournamentEscrowAndRealWallet detects violations across escrow, withdrawal holds, and bonus margin isolation", () => {
    const reconciler = new FinancialReconciler({} as any, {} as any);
    const report = reconciler.reconcileTournamentEscrowAndRealWallet({
      tournaments: [
        {
          tournamentId: "tourney-settled-leak",
          status: "SETTLED",
          escrowBalanceMinor: 1 // Residual cent in SETTLED tournament!
        }
      ],
      realWalletHolds: [
        {
          userId: "user-overdrawn-hold",
          reservedBalanceMinor: 2000,
          walletTransactions: [
            { id: "w-pending-1", type: "WITHDRAWAL", status: "PENDING", amount_minor: 2500 }
          ]
        }
      ],
      bonusMargins: [
        {
          userId: "user-bonus-exploit",
          ledgerTransactions: [
            {
              reference: "unauthorized-bonus-transfer",
              source: "@user_user-bonus-exploit:bonus_margin",
              destination: "@user_user-bonus-exploit:real:available",
              amount: 2500,
              currency: "USD"
            }
          ],
          bonusGrants: [
            {
              id: "bg-active",
              amount_minor: 2500,
              required_rollover_minor: 75000,
              completed_volume_minor: 10000,
              status: "ACTIVE"
            }
          ]
        }
      ]
    });

    assert.equal(report.status, "DISCREPANCY_DETECTED");
    assert.equal(report.checks.tournament_escrow_conservation, false);
    assert.equal(report.checks.real_wallet_withdrawals_hold_check, false);
    assert.equal(report.checks.bonus_margin_isolation_check, false);
    assert.equal(report.discrepancies.length, 3);
  });
});

