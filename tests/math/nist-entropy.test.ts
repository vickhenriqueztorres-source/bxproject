import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CSPRNGRandomSource } from "../../services/tick-engine/src/engine/ou-generator.js";

describe("NIST SP 800-22 Entropy & Randomness Tests", () => {
  it("passes Frequency Monobit Test for CSPRNG Box-Muller increments (p-value > 0.01)", () => {
    const rng = new CSPRNGRandomSource();

    const SAMPLE_SIZE = 50_000;
    let positiveCount = 0;
    let negativeCount = 0;

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const inc = rng.nextGaussian();
      if (inc >= 0) positiveCount++;
      else negativeCount++;
    }

    // Proporção esperada: 0.50 (50% positivos, 50% negativos)
    const proportion = positiveCount / SAMPLE_SIZE;
    const zScore = Math.abs((positiveCount - SAMPLE_SIZE / 2) / Math.sqrt(SAMPLE_SIZE / 4));

    // Para p-value > 0.01, zScore deve ser < 2.576
    assert.ok(zScore < 2.576, `Z-Score ${zScore} exceeds 2.576 (significant bias detected)`);
    assert.ok(proportion > 0.48 && proportion < 0.52, `Proportion ${proportion} outside expected range [0.48, 0.52]`);
  });

  it("passes Runs Test for sign sequence (detects clustering/cycles)", () => {
    const rng = new CSPRNGRandomSource();

    const SAMPLE_SIZE = 20_000;
    const signs: number[] = [];

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const inc = rng.nextGaussian();
      signs.push(inc >= 0 ? 1 : 0);
    }

    let runs = 1;
    let ones = signs[0] === 1 ? 1 : 0;
    for (let i = 1; i < SAMPLE_SIZE; i++) {
      if (signs[i] !== signs[i - 1]) runs++;
      if (signs[i] === 1) ones++;
    }

    const pi = ones / SAMPLE_SIZE;
    const expectedRuns = 2 * SAMPLE_SIZE * pi * (1 - pi) + 1;
    const stdDevRuns = Math.sqrt(
      (2 * SAMPLE_SIZE * pi * (1 - pi) * (2 * SAMPLE_SIZE * pi * (1 - pi) - 1)) / (SAMPLE_SIZE - 1)
    );

    const zScore = Math.abs((runs - expectedRuns) / stdDevRuns);
    assert.ok(zScore < 2.576, `Runs Z-Score ${zScore} exceeds 2.576`);
  });
});
