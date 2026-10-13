import { describe, it, expect } from "vitest";
import { SyntheticOUEngine, RandomSource, CSPRNGRandomSource } from "../src/engine/ou-generator.js";

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

describe("CSPRNGRandomSource (Entropia Criptográfica M-01 / B-06)", () => {
  it("deve gerar valores uniformes estritamente no intervalo aberto-fechado (0, 1]", () => {
    const rng = new CSPRNGRandomSource();
    for (let i = 0; i < 1000; i++) {
      const u = rng.nextUniform();
      expect(u).toBeGreaterThan(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(Number.isFinite(u)).toBe(true);
    }
  });

  it("deve gerar ruído gaussiano Box-Muller com média ~ 0 e variância ~ 1 sem NaN", () => {
    const rng = new CSPRNGRandomSource();
    const samples: number[] = [];
    const N = 5000;
    let sum = 0;

    for (let i = 0; i < N; i++) {
      const z = rng.nextGaussian();
      expect(Number.isNaN(z)).toBe(false);
      expect(Number.isFinite(z)).toBe(true);
      samples.push(z);
      sum += z;
    }

    const mean = sum / N;
    const variance = samples.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / N;

    // Intervalo de confiança a 99% para média de N=5000: |mean| < 2.58 / sqrt(5000) ~ 0.036
    expect(Math.abs(mean)).toBeLessThan(0.08);
    expect(variance).toBeGreaterThan(0.85);
    expect(variance).toBeLessThan(1.15);
  });

  it("deve operar sem invocar Math.random() garantindo CSPRNG puro do Node.js", () => {
    const rng = new CSPRNGRandomSource();
    const originalMathRandom = Math.random;
    let mathRandomCalled = false;
    Math.random = () => {
      mathRandomCalled = true;
      return 0.5;
    };

    try {
      for (let i = 0; i < 100; i++) {
        rng.nextUniform();
        rng.nextGaussian();
      }
      expect(mathRandomCalled).toBe(false);
    } finally {
      Math.random = originalMathRandom;
    }
  });
});

