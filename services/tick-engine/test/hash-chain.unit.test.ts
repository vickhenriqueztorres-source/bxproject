import { describe, it, expect } from "vitest";
import { HashChain } from "../src/engine/hash-chain.js";

describe("HashChain (Integridade de Ticks M-04)", () => {
  it("deve gerar hash gênese determinístico por símbolo", () => {
    const hash1 = HashChain.computeGenesisHash("SYNTH_VOL_50");
    const hash2 = HashChain.computeGenesisHash("SYNTH_VOL_50");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it("deve gerar hashes de gênese determinísticos para todos os 6 símbolos canônicos", () => {
    const canonicalSymbols = ["VOL_10", "VOL_25", "VOL_50", "VOL_75", "VOL_100", "CRASH_BOOM_100"];
    for (const sym of canonicalSymbols) {
      const h1 = HashChain.computeGenesisHash(sym);
      const h2 = HashChain.computeGenesisHash(sym);
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    }
  });

  it("deve detectar adulteração em qualquer parâmetro do tick para símbolos canônicos", () => {
    const prev = HashChain.computeGenesisHash("VOL_50");
    const ts = new Date("2026-10-06T12:00:00.000Z");

    const officialHash = HashChain.computeTickHash(prev, "VOL_50", 1n, ts, "125.0000");

    // Adulteração no preço
    const tamperedPrice = HashChain.computeTickHash(prev, "VOL_50", 1n, ts, "125.0001");
    expect(tamperedPrice).not.toBe(officialHash);

    // Adulteração na sequence
    const tamperedSeq = HashChain.computeTickHash(prev, "VOL_50", 2n, ts, "125.0000");
    expect(tamperedSeq).not.toBe(officialHash);
  });
});
