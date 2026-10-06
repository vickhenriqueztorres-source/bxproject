import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PayoutCalculator } from "../src/settlement/payout-calculator.js";

describe("PayoutCalculator (Rule D-19 & Direction Logic)", () => {
  it("determines WIN, LOSS, DRAW correctly for UP contracts", () => {
    // UP: exit > entry => WIN
    assert.equal(PayoutCalculator.determineResult("UP", "1.485000", "1.485100"), "WIN");
    // UP: exit < entry => LOSS
    assert.equal(PayoutCalculator.determineResult("UP", "1.485000", "1.484900"), "LOSS");
    // UP: exit == entry => DRAW
    assert.equal(PayoutCalculator.determineResult("UP", "1.485000", "1.485000"), "DRAW");
  });

  it("determines WIN, LOSS, DRAW correctly for DOWN contracts", () => {
    // DOWN: exit < entry => WIN
    assert.equal(PayoutCalculator.determineResult("DOWN", "1.485000", "1.484900"), "WIN");
    // DOWN: exit > entry => LOSS
    assert.equal(PayoutCalculator.determineResult("DOWN", "1.485000", "1.485100"), "LOSS");
    // DOWN: exit == entry => DRAW
    assert.equal(PayoutCalculator.determineResult("DOWN", "1.485000", "1.485000"), "DRAW");
  });

  it("calculates integer payout in minor units (cents) according to Rule D-19", () => {
    // Cenário 1: US$ 10,00 (1000 centavos) no WIN (85% payout)
    const winCalc1 = PayoutCalculator.calculatePayout("WIN", 1000);
    assert.equal(winCalc1.profit_minor, 850);
    assert.equal(winCalc1.payout_minor, 1850);

    // Cenário 2: US$ 25,50 (2550 centavos) no WIN (85% payout) -> 2550 * 85 / 100 = 2167.5 => 2167 centavos
    const winCalc2 = PayoutCalculator.calculatePayout("WIN", 2550);
    assert.equal(winCalc2.profit_minor, 2167);
    assert.equal(winCalc2.payout_minor, 4717);

    // Cenário 3: LOSS sempre resulta em payout 0
    const lossCalc = PayoutCalculator.calculatePayout("LOSS", 1000);
    assert.equal(lossCalc.profit_minor, 0);
    assert.equal(lossCalc.payout_minor, 0);

    // Cenário 4: DRAW devolve o valor original do stake
    const drawCalc = PayoutCalculator.calculatePayout("DRAW", 1000);
    assert.equal(drawCalc.profit_minor, 0);
    assert.equal(drawCalc.payout_minor, 1000);
  });
});
