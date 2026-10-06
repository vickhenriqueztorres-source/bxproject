import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PayoutCalculator } from "../../services/settlement-worker/src/settlement/payout-calculator.js";

describe("Arithmetic Precision & Fixed Minor Units (Rules D-18, D-19)", () => {
  it("detects exact DRAW without IEEE-754 floating point artifacts across 50,000 cases", () => {
    for (let i = 0; i < 50_000; i++) {
      const p = (1.0 + i * 0.000001).toFixed(6);
      const resUp = PayoutCalculator.determineResult("UP", p, p);
      const resDown = PayoutCalculator.determineResult("DOWN", p, p);

      assert.equal(resUp, "DRAW");
      assert.equal(resDown, "DRAW");
    }
  });

  it("calculates exact payout in integer cents without rounding anomalies", () => {
    // Para todas as apostas possíveis de US$ 1,00 a US$ 100,00 (100 a 10000 centavos)
    for (let stake = 100; stake <= 10000; stake++) {
      const calcWin = PayoutCalculator.calculatePayout("WIN", stake);
      const expectedProfit = Math.floor((stake * 85) / 100);
      const expectedTotal = stake + expectedProfit;

      assert.equal(calcWin.profit_minor, expectedProfit);
      assert.equal(calcWin.payout_minor, expectedTotal);
      assert.ok(Number.isInteger(calcWin.payout_minor));
      assert.ok(Number.isInteger(calcWin.profit_minor));
    }
  });
});
