import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BlnkClient } from "../../services/wallet-adapter/src/blnk-client.ts";
import { ContractService } from "../../services/api/src/services/contract-service.ts";
import { PayoutCalculator } from "../../services/settlement-worker/src/settlement/payout-calculator.ts";
import { FinancialReconciler } from "../../services/settlement-worker/src/reconciliation/financial-reconciler.ts";
import {
  startBlnkTestServer,
  createStatefulDbAndRedis
} from "./blnk-ledger-vulnerabilities-audit.test.ts";

describe("Blnk Ledger Double-Entry Accounting Audit (Rules I-01, I-02, I-03, I-05)", () => {
  it("[I-01][I-02][I-03][I-05] maintains zero-sum balance across 300 WIN, LOSS and DRAW contracts using real BlnkClient, ContractService, PayoutCalculator and FinancialReconciler", async () => {
    const blnkServer = await startBlnkTestServer();
    process.env.BLNK_URL = blnkServer.baseUrl;

    const blnkClient = new BlnkClient(blnkServer.baseUrl);
    await blnkClient.initializeLedgerAndHouseAccounts();

    const userId = "trader-300-audit";
    await blnkClient.onboardUser(userId);

    const { pool, redis, contracts } = createStatefulDbAndRedis();
    const contractService = new ContractService(pool as any, redis as any, blnkClient);

    try {
      const stakeMinor = 1_000; // US$ 10,00 (1.000 centavos)

      // 1. 100 contratos WIN (stake 1.000, lucro 850, payout total 1.850)
      for (let i = 0; i < 100; i++) {
        const { contract, isDuplicate } = await contractService.openContract(
          userId,
          `audit-win-${i + 1}`,
          { symbol: "SYNTH_VOL_50", direction: "UP", stake_minor: stakeMinor }
        );
        assert.equal(isDuplicate, false);

        const result = PayoutCalculator.determineResult("UP", "100.000000", "101.000000");
        assert.equal(result, "WIN");
        const calc = PayoutCalculator.calculatePayout(result, stakeMinor);
        assert.equal(calc.payout_minor, 1_850);
        assert.equal(calc.profit_minor, 850);

        await blnkClient.settleContract(contract.id, userId, "WIN", stakeMinor, calc.payout_minor);
        const dbRow = contracts.get(contract.id);
        dbRow.status = "SETTLED";
        dbRow.result = "WIN";
        dbRow.payout_minor = calc.payout_minor;
      }

      // 2. 100 contratos LOSS (stake 1.000 transferida para @house_revenue)
      for (let i = 0; i < 100; i++) {
        const { contract, isDuplicate } = await contractService.openContract(
          userId,
          `audit-loss-${i + 1}`,
          { symbol: "SYNTH_VOL_50", direction: "UP", stake_minor: stakeMinor }
        );
        assert.equal(isDuplicate, false);

        const result = PayoutCalculator.determineResult("UP", "100.000000", "99.000000");
        assert.equal(result, "LOSS");
        const calc = PayoutCalculator.calculatePayout(result, stakeMinor);
        assert.equal(calc.payout_minor, 0);

        await blnkClient.settleContract(contract.id, userId, "LOSS", stakeMinor, calc.payout_minor);
        const dbRow = contracts.get(contract.id);
        dbRow.status = "SETTLED";
        dbRow.result = "LOSS";
        dbRow.payout_minor = 0;
      }

      // 3. 100 contratos DRAW (stake 1.000 devolvida integralmente)
      for (let i = 0; i < 100; i++) {
        const { contract, isDuplicate } = await contractService.openContract(
          userId,
          `audit-draw-${i + 1}`,
          { symbol: "SYNTH_VOL_50", direction: "UP", stake_minor: stakeMinor }
        );
        assert.equal(isDuplicate, false);

        const result = PayoutCalculator.determineResult("UP", "100.000000", "100.000000");
        assert.equal(result, "DRAW");
        const calc = PayoutCalculator.calculatePayout(result, stakeMinor);
        assert.equal(calc.payout_minor, 1_000);

        await blnkClient.settleContract(contract.id, userId, "DRAW", stakeMinor, calc.payout_minor);
        const dbRow = contracts.get(contract.id);
        dbRow.status = "SETTLED";
        dbRow.result = "DRAW";
        dbRow.payout_minor = 1_000;
      }

      // Invariante Fundamental I-02: Soma algébrica de todas as contas do ledger === 0
      assert.equal(blnkServer.getAlgebraicTotalSum(), 0, "Ledger algebraic sum across all accounts must be strictly 0");

      const finalBalance = await blnkClient.getBalance(userId);
      // Saldo em reserva deve ter zerado (todos os 300 contratos foram liquidados)
      assert.equal(finalBalance.reserved_minor, 0, "All reserved stakes must be resolved");

      // Saldo disponível do trader: 1.000.000 + (100 * 850) - (100 * 1.000) = 985.000 centavos
      assert.equal(finalBalance.available_minor, 985_000);

      const houseRevenue = blnkServer.accounts.get("@house_revenue")!.balance;
      const housePayout = blnkServer.accounts.get("@house_payout")!.balance;
      assert.equal(houseRevenue, 100_000);
      assert.equal(housePayout, -85_000);

      // Lucro líquido da corretora = 100.000 - 85.000 = +15.000 centavos (+US$ 150,00)
      const netHouseProfit = houseRevenue + housePayout;
      assert.equal(netHouseProfit, 15_000);

      // Reconciliação linha por linha (FinancialReconciler)
      const reconcileReport = FinancialReconciler.reconcileUserLedgerVsUi({
        userId,
        transactions: blnkServer.transactions,
        contracts: Array.from(contracts.values()),
        uiWallet: {
          user_id: userId,
          currency: "USD",
          precision: 100,
          available_minor: finalBalance.available_minor,
          reserved_minor: finalBalance.reserved_minor,
          total_equity_minor: finalBalance.available_minor + finalBalance.reserved_minor
        }
      });

      assert.equal(reconcileReport.status, "RECONCILED");
      assert.equal(reconcileReport.discrepancies.length, 0);
    } finally {
      await blnkServer.close();
    }
  });
});
