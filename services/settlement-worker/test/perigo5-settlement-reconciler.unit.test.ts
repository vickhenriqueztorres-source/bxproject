import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ContractSettler } from "../src/settlement/settler.js";
import { FinancialReconciler } from "../src/reconciliation/financial-reconciler.js";

describe("[Subetapa 03 — Perigo 5] Settlement com Validação Estrita por Ativo e Reconciliador Multi-Símbolo", () => {
  it("[SEGURANÇA ANTI-CROSS-ASSET] Rejeita liquidação se o tick retornado pertencer a outro símbolo (BTCUSDT vs EURUSD-OTC)", async () => {
    let rolledBack = false;
    const now = Date.now();
    const mockPool = {
      connect: async () => ({
        query: async (sql: string) => {
          if (sql === "BEGIN") return {};
          if (sql === "ROLLBACK") {
            rolledBack = true;
            return {};
          }
          if (sql.includes("FROM contracts")) {
            return {
              rows: [
                {
                  id: "c-cross-1",
                  user_id: "u-1",
                  symbol: "BTCUSDT",
                  direction: "UP",
                  status: "OPEN",
                  stake_minor: 1000,
                  entry_price: "65000.00",
                  entry_tick_sequence: "100",
                  opened_at: new Date(now - 60000),
                  expires_at: new Date(now),
                },
              ],
            };
          }
          if (sql.includes("FROM ticks")) {
            return {
              rows: [
                {
                  symbol: "EURUSD-OTC", // Símbolo incorreto!
                  sequence: "105",
                  price: "1.08500",
                  ts: new Date(now + 100),
                },
              ],
            };
          }
          return { rows: [] };
        },
        release: () => {},
      }),
    };

    const settler = new ContractSettler(mockPool as any, { zrem: async () => 1 } as any, {} as any, "w-1");
    const res = await settler.settleContract("c-cross-1");

    assert.equal(res.success, false);
    assert.equal(res.reason, "CROSS_ASSET_TICK_MISMATCH");
    assert.equal(rolledBack, true);
  });

  it("[SEGURANÇA DE SEQUÊNCIA E STALENESS] Rejeita tick com sequence < entry_tick_sequence ou atrasado além de maxExitTickLagMs", async () => {
    const now = Date.now();

    // Caso A: Regressão de sequence (exitSeq 90 < entrySeq 100)
    const mockPoolSeqRegression = {
      connect: async () => ({
        query: async (sql: string) => {
          if (sql.includes("FROM contracts")) {
            return {
              rows: [
                {
                  id: "c-seq-1",
                  user_id: "u-1",
                  symbol: "R_100",
                  direction: "UP",
                  status: "OPEN",
                  stake_minor: 1000,
                  entry_price: "1500.00",
                  entry_tick_sequence: "100",
                  opened_at: new Date(now - 60000),
                  expires_at: new Date(now),
                },
              ],
            };
          }
          if (sql.includes("FROM ticks")) {
            return {
              rows: [
                {
                  symbol: "R_100",
                  sequence: "90", // Menor que entry_tick_sequence (100)!
                  price: "1505.00",
                  ts: new Date(now + 200),
                },
              ],
            };
          }
          return { rows: [] };
        },
        release: () => {},
      }),
    };

    const settlerA = new ContractSettler(mockPoolSeqRegression as any, { zrem: async () => 1 } as any, {} as any, "w-1");
    const resA = await settlerA.settleContract("c-seq-1");
    assert.equal(resA.success, false);
    assert.equal(resA.reason, "EXIT_TICK_SEQUENCE_REGRESSION");

    // Caso B: Tick de saída stale (chegou 45s após expires_at, acima do limite de 30s)
    const mockPoolStaleExit = {
      connect: async () => ({
        query: async (sql: string) => {
          if (sql.includes("FROM contracts")) {
            return {
              rows: [
                {
                  id: "c-stale-exit",
                  user_id: "u-1",
                  symbol: "R_100",
                  direction: "UP",
                  status: "OPEN",
                  stake_minor: 1000,
                  entry_price: "1500.00",
                  entry_tick_sequence: "100",
                  opened_at: new Date(now - 60000),
                  expires_at: new Date(now),
                },
              ],
            };
          }
          if (sql.includes("FROM ticks")) {
            return {
              rows: [
                {
                  symbol: "R_100",
                  sequence: "145",
                  price: "1505.00",
                  ts: new Date(now + 45_000), // 45s atrasado (> 30s maxExitTickLagMs)
                },
              ],
            };
          }
          return { rows: [] };
        },
        release: () => {},
      }),
    };

    const settlerB = new ContractSettler(
      mockPoolStaleExit as any,
      { zrem: async () => 1 } as any,
      {} as any,
      "w-1",
      { maxExitTickLagMs: 30_000 }
    );
    const resB = await settlerB.settleContract("c-stale-exit");
    assert.equal(resB.success, false);
    assert.equal(resB.reason, "STALE_EXIT_TICK");
  });

  it("[RECONCILIAÇÃO MULTI-SÍMBOLO] Valida sequência e cadeia de hash particionando por símbolo sem falso-positivo entre ativos", async () => {
    const mockPoolHealthyMultiSymbol = {
      query: async (sql: string) => {
        const clean = sql.replace(/\s+/g, " ");
        if (clean.includes("INTERVAL '30 seconds'")) return { rows: [] };
        if (clean.includes("COALESCE(SUM(stake_minor), 0)")) return { rows: [{ count: "0", total_stake: "0" }] };
        if (clean.includes("FROM outbox_events")) return { rows: [] };
        if (clean.includes("FROM ticks")) {
          // 3 ativos diferentes com faixas de sequence distintas (1000+, 500+, 50+) intercalados
          return {
            rows: [
              { symbol: "R_100", sequence: "1002", prev_hash: "r100-h1001", hash: "r100-h1002" },
              { symbol: "BTCUSDT", sequence: "502", prev_hash: "btc-h501", hash: "btc-h502" },
              { symbol: "R_100", sequence: "1001", prev_hash: "r100-h1000", hash: "r100-h1001" },
              { symbol: "EURUSD-OTC", sequence: "52", prev_hash: "eur-h51", hash: "eur-h52" },
              { symbol: "BTCUSDT", sequence: "501", prev_hash: "btc-h500", hash: "btc-h501" },
              { symbol: "EURUSD-OTC", sequence: "51", prev_hash: "eur-h50", hash: "eur-h51" },
            ],
          };
        }
        return { rows: [] };
      },
    };

    const reconciler = new FinancialReconciler(mockPoolHealthyMultiSymbol as any, {} as any);
    const report = await reconciler.runAudit();

    assert.equal(report.status, "HEALTHY", "Não deve gerar falso-positivo ao auditar múltiplos ativos");
    assert.equal(report.checks.tick_sequence_continuous, true);
    assert.equal(report.checks.hash_chain_valid, true);
    assert.equal(report.discrepancies.length, 0);
  });
});
