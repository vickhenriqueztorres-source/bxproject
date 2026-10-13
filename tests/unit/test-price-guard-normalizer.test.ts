import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { PriceNormalizer } from "../../services/tick-engine/src/engine/price-normalizer.ts";
import { PriceGuard } from "../../services/tick-engine/src/engine/price-guard.ts";
import { RealMarketDataFeedAdapter } from "../../services/tick-engine/src/engine/real-feed-adapter.ts";

describe("Subetapa 3 (Unit): Price Normalizer & Sanitização de Cotações", () => {
  it("1. Deve normalizar corretamente diferentes formatos de símbolos para o padrão canônico OTC", () => {
    assert.strictEqual(PriceNormalizer.normalizeSymbol("btc-usd"), "BTCUSD_OTC");
    assert.strictEqual(PriceNormalizer.normalizeSymbol("BTCUSDT"), "BTCUSD_OTC");
    assert.strictEqual(PriceNormalizer.normalizeSymbol("ETH/USD"), "ETHUSD_OTC");
    assert.strictEqual(PriceNormalizer.normalizeSymbol("eur_usd"), "EURUSD_OTC");
    assert.strictEqual(PriceNormalizer.normalizeSymbol("XAUUSD"), "XAUUSD_OTC");
    assert.strictEqual(PriceNormalizer.normalizeSymbol("GOLD"), "XAUUSD_OTC");
    assert.strictEqual(PriceNormalizer.normalizeSymbol("BTCUSD_OTC"), "BTCUSD_OTC");
    assert.strictEqual(PriceNormalizer.normalizeSymbol("UNKNOWN_TOKEN"), null);
  });

  it("2. Deve validar timestamp e converter para milissegundos UTC", () => {
    const parsedIso = PriceNormalizer.parseTimestamp("2026-10-10T12:00:00.000Z");
    assert(parsedIso !== null);
    assert.strictEqual(parsedIso.timestampMs, 1791633600000);

    const parsedEpochSec = PriceNormalizer.parseTimestamp(1791633600);
    assert(parsedEpochSec !== null);
    assert.strictEqual(parsedEpochSec.timestampMs, 1791633600000);

    const parsedInvalid = PriceNormalizer.parseTimestamp("data_invalida");
    assert.strictEqual(parsedInvalid, null);
  });

  it("3. Deve detectar e rejeitar outliers grosseiros fora da faixa de sanidade", () => {
    // BTC normal (65.000) -> válido
    const validBtc = PriceNormalizer.normalizeQuote("BTC/USD", 65420.50, Date.now());
    assert.strictEqual(validBtc.isValid, true);
    assert.strictEqual(validBtc.canonicalSymbol, "BTCUSD_OTC");

    // BTC absurdo (10 dólares) -> rejeitado por outlier
    const outlierLowBtc = PriceNormalizer.normalizeQuote("BTC/USD", 10.0, Date.now());
    assert.strictEqual(outlierLowBtc.isValid, false);
    assert(outlierLowBtc.rejectReason?.includes("Outlier detectado"));

    // BTC absurdo (1.000.000 dólares) -> rejeitado por outlier
    const outlierHighBtc = PriceNormalizer.normalizeQuote("BTC/USD", 1_000_000.0, Date.now());
    assert.strictEqual(outlierHighBtc.isValid, false);

    // Preço negativo -> inválido
    const negativePrice = PriceNormalizer.normalizeQuote("ETH/USD", -500, Date.now());
    assert.strictEqual(negativePrice.isValid, false);
  });
});

describe("Subetapa 3 (Unit): Price Guard — Rejeição de Preço Velho (>5s) e Salto Absurdo (>10%)", () => {
  it("4. Deve aceitar cotação fresca dentro da tolerância de tempo e variação", () => {
    const guard = new PriceGuard(60_000);
    const now = Date.now();

    const freshQuote = PriceNormalizer.normalizeQuote("BTCUSD_OTC", 60_500, now - 1000); // 1s de idade
    const result = guard.evaluate(freshQuote, now);

    assert.strictEqual(result.accepted, true);
    assert.strictEqual(result.price, 60500);
  });

  it("5. Deve rejeitar preço velho com atraso superior a 5 segundos (> 5.000ms)", () => {
    const guard = new PriceGuard(60_000);
    const now = Date.now();

    // Cotação com 6 segundos no passado (6.000ms de idade)
    const oldQuote = PriceNormalizer.normalizeQuote("BTCUSD_OTC", 60_100, now - 6000);
    const result = guard.evaluate(oldQuote, now);

    assert.strictEqual(result.accepted, false);
    assert.strictEqual(result.rejectReason, "OLD_PRICE");
    assert(result.message?.includes("obsolescência"));
  });

  it("6. Deve rejeitar salto absurdo de preço superior a 10%", () => {
    const initialPrice = 60_000;
    const guard = new PriceGuard(initialPrice);
    const now = Date.now();

    // Salto de +15% instantâneo (60.000 -> 69.000)
    const jumpQuote = PriceNormalizer.normalizeQuote("BTCUSD_OTC", 69_500, now);
    const result = guard.evaluate(jumpQuote, now);

    assert.strictEqual(result.accepted, false);
    assert.strictEqual(result.rejectReason, "ABSURD_JUMP");
    assert(result.message?.includes("Salto de preço rejeitado"));
  });

  it("7. Deve aceitar variação razoável de mercado (< 10%) e atualizar a âncora", () => {
    const guard = new PriceGuard(60_000);
    const now = Date.now();

    // Variação de +2% (60.000 -> 61.200)
    const normalQuote = PriceNormalizer.normalizeQuote("BTCUSD_OTC", 61_200, now);
    const result = guard.evaluate(normalQuote, now);

    assert.strictEqual(result.accepted, true);
    assert.strictEqual(guard.getLastAcceptedPrice(), 61200);
  });
});

describe("Subetapa 3 (Unit): RealMarketDataFeedAdapter com Pipeline Integrado e Resiliência", () => {
  it("8. Deve gerar cotação com precisão decimal adaptativa para os 4 ativos OTC", async () => {
    const btcAdapter = new RealMarketDataFeedAdapter("BTCUSD_OTC");
    const ethAdapter = new RealMarketDataFeedAdapter("ETHUSD_OTC");
    const eurAdapter = new RealMarketDataFeedAdapter("EURUSD_OTC");
    const xauAdapter = new RealMarketDataFeedAdapter("XAUUSD_OTC");

    const btcTick = await btcAdapter.getNextTickPrice();
    const ethTick = await ethAdapter.getNextTickPrice();
    const eurTick = await eurAdapter.getNextTickPrice();
    const xauTick = await xauAdapter.getNextTickPrice();

    assert(btcTick.priceString.includes("."));
    assert.strictEqual(btcTick.priceString.split(".")[1].length, 2, "BTC deve ter 2 casas decimais");
    assert.strictEqual(ethTick.priceString.split(".")[1].length, 2, "ETH deve ter 2 casas decimais");
    assert.strictEqual(eurTick.priceString.split(".")[1].length, 5, "EURUSD deve ter 5 casas decimais");
    assert.strictEqual(xauTick.priceString.split(".")[1].length, 2, "XAUUSD deve ter 2 casas decimais");
  });

  it("9. Circuit Breaker abre após falhas e aciona fallback estocástico sem interrupção de tick", async () => {
    const adapter = new RealMarketDataFeedAdapter("BTCUSD_OTC", 60_000);
    adapter.setSimulatedExternalError(true);

    // 3 falhas consecutivas disparam a abertura do circuito
    await adapter.getNextTickPrice();
    await adapter.getNextTickPrice();
    const thirdTick = await adapter.getNextTickPrice();

    assert.strictEqual(adapter.getCircuitState(), "OPEN");
    assert.strictEqual(thirdTick.isRealFeed, false);
    assert(parseFloat(thirdTick.priceString) > 0, "Fallback estocástico deve continuar emitindo preços válidos");

    // Restabelecimento do circuito
    adapter.setSimulatedExternalError(false);
    adapter.attemptRecovery();
    assert.strictEqual(adapter.getCircuitState(), "HALF_OPEN");
  });
});
