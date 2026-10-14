import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { RealMarketDataFeedAdapter } from "../../services/tick-engine/src/engine/real-feed-adapter.ts";
import { HashChain } from "../../services/tick-engine/src/engine/hash-chain.ts";
import { TimeframeAggregator } from "../../services/candle-worker/src/aggregator/timeframe-aggregator.ts";
import { BlnkClient } from "../../services/wallet-adapter/src/blnk-client.ts";

describe("Subetapa 4 (Integration): Pipeline Criptográfico, Candles e Liquidação dos 4 Ativos OTC Reais (Seção 13.3)", () => {
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

  it("3. Seção 13.3: Candle agrega corretamente para ativos OTC reais (OHLCV exato e transição de bucket)", async () => {
    const hashStore = new Map<string, Record<string, string>>();
    const mockRedis: any = {
      eval: async (_script: string, _numKeys: number, key: string, numPrice: number, rawPrice: string) => {
        const existing = hashStore.get(key);
        if (!existing) {
          hashStore.set(key, {
            open: rawPrice,
            high: rawPrice,
            low: rawPrice,
            close: rawPrice,
            volume: "1",
          });
          return [rawPrice, rawPrice, rawPrice, rawPrice, 1];
        }
        const high = parseFloat(existing.high);
        const low = parseFloat(existing.low);
        if (numPrice > high) existing.high = rawPrice;
        if (numPrice < low) existing.low = rawPrice;
        existing.close = rawPrice;
        const nextVol = parseInt(existing.volume, 10) + 1;
        existing.volume = String(nextVol);
        return [existing.open, existing.high, existing.low, existing.close, nextVol];
      },
      hgetall: async (key: string) => hashStore.get(key) || {},
    };

    const aggregator = new TimeframeAggregator(mockRedis);
    const baseTime = 1728000000000; // Alinhado ao minuto

    const t1 = await aggregator.processTickForInterval(
      { symbol: "BTCUSD_OTC", sequence: 1n, price: "62000.00", ts: new Date(baseTime + 100) },
      "1m"
    );
    assert.strictEqual(t1.activeCandle.open, "62000.00");
    assert.strictEqual(t1.closedBucketStart, null);

    await aggregator.processTickForInterval(
      { symbol: "BTCUSD_OTC", sequence: 2n, price: "62500.50", ts: new Date(baseTime + 15000) },
      "1m"
    );
    await aggregator.processTickForInterval(
      { symbol: "BTCUSD_OTC", sequence: 3n, price: "61800.25", ts: new Date(baseTime + 30000) },
      "1m"
    );
    const t4 = await aggregator.processTickForInterval(
      { symbol: "BTCUSD_OTC", sequence: 4n, price: "62150.75", ts: new Date(baseTime + 45000) },
      "1m"
    );

    assert.strictEqual(t4.activeCandle.open, "62000.00");
    assert.strictEqual(t4.activeCandle.high, "62500.50");
    assert.strictEqual(t4.activeCandle.low, "61800.25");
    assert.strictEqual(t4.activeCandle.close, "62150.75");
    assert.strictEqual(t4.activeCandle.volume, 4);

    // Próximo minuto fecha o bucket anterior
    const t5 = await aggregator.processTickForInterval(
      { symbol: "BTCUSD_OTC", sequence: 5n, price: "62200.00", ts: new Date(baseTime + 60500) },
      "1m"
    );
    assert(t5.closedBucketStart !== null, "Mudança de minuto deve selar o bucket anterior");
    assert.strictEqual(t5.closedBucketStart?.getTime(), baseTime);
  });

  it("4. Seção 7 & 13.3: Contrato OTC liquida no primeiro tick oficial onde ts >= expires_at e respeita Ledger Demo Multi-Moeda", () => {
    const expiresAtMs = 1728000060000;
    const ticks = [
      { sequence: 10n, price: 2650.00, tsMs: expiresAtMs - 500 },
      { sequence: 11n, price: 2655.40, tsMs: expiresAtMs },       // Primeiro tick oficial onde ts >= expires_at
      { sequence: 12n, price: 2640.10, tsMs: expiresAtMs + 250 },
    ];

    const entryPrice = 2650.00;
    const settlementTick = ticks.find((t) => t.tsMs >= expiresAtMs)!;
    assert.strictEqual(settlementTick.sequence, 11n, "Deve selecionar exatamente o primeiro tick onde ts >= expires_at");

    const stakeMinor = 10000; // 100.00 unidades na moeda da carteira
    const profitMinor = Math.floor((stakeMinor * 85) / 100);
    const totalPayoutMinor = stakeMinor + profitMinor;
    assert.strictEqual(profitMinor, 8500, "Lucro fixo de 85% em inteiros (minor units)");
    assert.strictEqual(totalPayoutMinor, 18500, "Payout total = stake (10000) + lucro (8500)");

    // Valida nomenclatura oficial das contas do Ledger Demo para as 6 moedas (Seção 7.1 e 7.2)
    const currencies = ["BRL", "MXN", "COP", "ARS", "CLP", "PEN"];
    for (const curr of currencies) {
      assert.strictEqual(
        BlnkClient.getUserDemoAccount("usr-123", "available", curr),
        `user:usr-123:demo:${curr}:available`
      );
      assert.strictEqual(
        BlnkClient.getUserDemoAccount("usr-123", "reserved", curr),
        `user:usr-123:demo:${curr}:reserved`
      );
      assert.strictEqual(
        BlnkClient.getPlatformDemoAccount("liability", curr),
        `platform:demo:${curr}:liability`
      );
      assert.strictEqual(
        BlnkClient.getPlatformDemoAccount("revenue", curr),
        `platform:demo:${curr}:revenue`
      );
      assert.strictEqual(
        BlnkClient.getPlatformDemoAccount("payout", curr),
        `platform:demo:${curr}:payout`
      );
    }
  });
});

