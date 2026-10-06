import { describe, it, expect } from "vitest";
import { HashChain } from "../src/engine/hash-chain.js";

describe("HashChain (Integridade de Ticks M-04)", () => {
  it("deve gerar hash gênese determinístico por símbolo", () => {
    const hash1 = HashChain.computeGenesisHash("SYNTH_VOL_50");
    const hash2 = HashChain.computeGenesisHash("SYNTH_VOL_50");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it("deve detectar adulteração em qualquer parâmetro do tick", () => {
    const prev = HashChain.computeGenesisHash("SYNTH_VOL_50");
    const ts = new Date("2026-10-06T12:00:00.000Z");

    const officialHash = HashChain.computeTickHash(prev, "SYNTH_VOL_50", 1n, ts, "1000.500000");

    // Adulteração no preço
    const tamperedPrice = HashChain.computeTickHash(prev, "SYNTH_VOL_50", 1n, ts, "1000.500001");
    expect(tamperedPrice).not.toBe(officialHash);

    // Adulteração na sequence
    const tamperedSeq = HashChain.computeTickHash(prev, "SYNTH_VOL_50", 2n, ts, "1000.500000");
    expect(tamperedSeq).not.toBe(officialHash);
  });
});
