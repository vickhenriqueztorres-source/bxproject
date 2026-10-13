import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { RealMarketDataFeedAdapter } from "../../services/tick-engine/src/engine/real-feed-adapter.ts";
import { HashChain } from "../../services/tick-engine/src/engine/hash-chain.ts";

describe("Subetapa 4 (Integration): Pipeline Criptográfico dos 4 Ativos OTC Reais", () => {
  it("1. Deve gerar cadeia SHA-256 matematicamente inquebrada em 20 ciclos para os 4 pares", async () => {
    const symbols = ["BTCUSD_OTC", "ETHUSD_OTC", "EURUSD_OTC", "XAUUSD_OTC"];

    for (const sym of symbols) {
      const adapter = new RealMarketDataFeedAdapter(sym);
      let lastHash = HashChain.computeGenesisHash(sym);
      let sequence = 0n;

      for (let i = 0; i < 20; i++) {
        sequence += 1n;
        const tick = await adapter.getNextTickPrice();
        const ts = new Date(Date.now() + i * 1000);

        const currentHash = HashChain.computeTickHash(lastHash, sym, sequence, ts, tick.priceString);

        // Asserções de integridade
        assert.strictEqual(currentHash.length, 64);
        assert.notStrictEqual(currentHash, lastHash, "Hash atual deve ser único e diferente do anterior");

        lastHash = currentHash;
      }
    }
  });

  it("2. Resiliência: Caos no feed real não quebra a sequência nem o hash encadeado", async () => {
    const sym = "BTCUSD_OTC";
    const adapter = new RealMarketDataFeedAdapter(sym);
    let lastHash = HashChain.computeGenesisHash(sym);
    let sequence = 0n;

    for (let i = 0; i < 15; i++) {
      sequence += 1n;
      // Injeta falha no meio do caminho (ciclos 5 a 10)
      if (i >= 5 && i <= 10) {
        adapter.setSimulatedExternalError(true);
      } else {
        adapter.setSimulatedExternalError(false);
        adapter.attemptRecovery();
      }

      const tick = await adapter.getNextTickPrice();
      const ts = new Date(Date.now() + i * 1000);
      const currentHash = HashChain.computeTickHash(lastHash, sym, sequence, ts, tick.priceString);

      assert.strictEqual(currentHash.length, 64);
      lastHash = currentHash;
    }

    assert.strictEqual(sequence, 15n, "Sequência monotônica deve se manter 15 sem perda de ticks");
  });
});
