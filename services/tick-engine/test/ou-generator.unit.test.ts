import { describe, it, expect } from "vitest";
import { SyntheticOUEngine, RandomSource } from "../src/engine/ou-generator.js";

class DeterministicRNG implements RandomSource {
  constructor(private readonly sequence: number[]) {
    this.index = 0;
  }
  private index: number;

  public nextUniform(): number {
    const val = this.sequence[this.index % this.sequence.length];
    this.index++;
    return val;
  }

  public nextGaussian(): number {
    return this.nextUniform();
  }
}

describe("SyntheticOUEngine (Ornstein-Uhlenbeck OTC Generator)", () => {
  it("deve reverter à média quando o preço estiver acima da ancoragem", () => {
    // Zero ruído (Z = 0) para testar apenas o drift de reversão à média
    const zeroRng = new DeterministicRNG([0.0]);
    const engine = new SyntheticOUEngine({
      symbol: "SYNTH_VOL_50",
      basePrice: 1000.0,
      currentPrice: 1050.0,
      theta: 0.1,
      dt: 1.0
    }, zeroRng);

    const next = engine.generateNextPrice();
    // drift = 0.1 * (1000 - 1050) * 1.0 = -5.0
    // next = 1050 - 5 = 1045.0
    expect(next.priceNumeric).toBe(1045.0);
    expect(next.priceString).toBe("1045.000000");
  });

  it("deve reverter à média quando o preço estiver abaixo da ancoragem", () => {
    const zeroRng = new DeterministicRNG([0.0]);
    const engine = new SyntheticOUEngine({
      symbol: "SYNTH_VOL_50",
      basePrice: 1000.0,
      currentPrice: 950.0,
      theta: 0.1,
      dt: 1.0
    }, zeroRng);

    const next = engine.generateNextPrice();
    // drift = 0.1 * (1000 - 950) * 1.0 = +5.0
    // next = 950 + 5 = 955.0
    expect(next.priceNumeric).toBe(955.0);
    expect(next.priceString).toBe("955.000000");
  });

  it("deve aplicar choque estocástico respeitando a volatilidade sigma", () => {
    const rng = new DeterministicRNG([1.0]); // Z = +1.0
    const engine = new SyntheticOUEngine({
      symbol: "SYNTH_VOL_50",
      basePrice: 1000.0,
      currentPrice: 1000.0,
      theta: 0.0, // sem drift
      sigma: 0.002, // 0.2%
      dt: 1.0
    }, rng);

    const next = engine.generateNextPrice();
    // diffusion = 0.002 * 1000 * 1 * 1.0 = +2.0
    expect(next.priceNumeric).toBe(1002.0);
  });
});
