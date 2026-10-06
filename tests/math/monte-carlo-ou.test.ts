import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SyntheticOUEngine } from "../../services/tick-engine/src/engine/ou-generator.js";

describe("Monte Carlo Stochastic Simulation (Ornstein-Uhlenbeck Stability)", () => {
  it("guarantees strictly positive prices and mean reversion over 50,000 simulated ticks", () => {
    const basePrice = 100.0;
    const engine = new SyntheticOUEngine({
      symbol: "SYNTH_VOL_50",
      basePrice,
      theta: 0.05,
      sigma: 0.0015
    });

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let sumPrice = 0;
    const NUM_TICKS = 50_000;

    for (let i = 0; i < NUM_TICKS; i++) {
      const { priceNumeric } = engine.generateNextPrice();

      // Invariante: Preço nunca pode ser negativo ou zero (M-01)
      assert.ok(priceNumeric > 0, `Price became non-positive: ${priceNumeric}`);

      if (priceNumeric < minPrice) minPrice = priceNumeric;
      if (priceNumeric > maxPrice) maxPrice = priceNumeric;
      sumPrice += priceNumeric;
    }

    const meanPrice = sumPrice / NUM_TICKS;

    // A média empírica deve convergir próxima ao basePrice devido à reversão à média (theta = 0.05)
    assert.ok(
      Math.abs(meanPrice - basePrice) < 15.0,
      `Mean price ${meanPrice} deviated too far from base price ${basePrice}`
    );

    // Mínimo e máximo devem estar contidos em faixa razoável (sem divergência exponencial)
    assert.ok(minPrice > 20.0, `Min price too low: ${minPrice}`);
    assert.ok(maxPrice < 300.0, `Max price too high: ${maxPrice}`);
  });
});
