import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { RealMarketDataFeedAdapter, OTC_REAL_ASSETS_CONFIG } from "../../services/tick-engine/src/engine/real-feed-adapter.ts";
import { HashChain } from "../../services/tick-engine/src/engine/hash-chain.ts";

describe("Subetapa 4 (Unit): RealMarketDataFeedAdapter & Circuit Breaker", () => {
  it("1. Deve configurar corretamente os 4 ativos OTC com suas respectivas precisões decimais", () => {
    assert.strictEqual(OTC_REAL_ASSETS_CONFIG.BTCUSD_OTC.decimals, 2);
    assert.strictEqual(OTC_REAL_ASSETS_CONFIG.ETHUSD_OTC.decimals, 2);
    assert.strictEqual(OTC_REAL_ASSETS_CONFIG.EURUSD_OTC.decimals, 5);
    assert.strictEqual(OTC_REAL_ASSETS_CONFIG.XAUUSD_OTC.decimals, 2);
  });

  it("2. Deve emitir preços com precisão decimal exata para EURUSD_OTC (5 decimais)", async () => {
    const adapter = new RealMarketDataFeedAdapter("EURUSD_OTC", 1.08540);
    const tick = await adapter.getNextTickPrice();
    assert.strictEqual(tick.isRealFeed, true);
    assert.strictEqual(tick.circuitState, "CLOSED");
    
    // Deve ter exatamente 5 casas decimais
    const parts = tick.priceString.split(".");
    assert.strictEqual(parts[1]?.length, 5, `EURUSD_OTC deve ter 5 decimais, recebido: ${tick.priceString}`);
  });

  it("3. Deve transicionar Circuit Breaker para OPEN em falhas consecutivas e assumir fallback estocástico", async () => {
    const adapter = new RealMarketDataFeedAdapter("BTCUSD_OTC", 64000.00);
    adapter.setSimulatedExternalError(true);

    // 1ª e 2ª falha: ainda em CLOSED tentando
    await adapter.getNextTickPrice();
    await adapter.getNextTickPrice();

    // 3ª falha: atinge o threshold e abre o circuito
    const tick3 = await adapter.getNextTickPrice();
    assert.strictEqual(adapter.getCircuitState(), "OPEN");
    assert.strictEqual(tick3.isRealFeed, false, "Deve marcar como fallback estocástico");
    assert.strictEqual(tick3.circuitState, "OPEN");

    // Próximo tick: mercado NUNCA congela, fallback emite tick válido com 2 casas
    const tick4 = await adapter.getNextTickPrice();
    assert.strictEqual(tick4.isRealFeed, false);
    const parts = tick4.priceString.split(".");
    assert.strictEqual(parts[1]?.length, 2, `BTCUSD_OTC deve manter 2 decimais no fallback: ${tick4.priceString}`);
  });

  it("4. Deve recuperar suavemente de OPEN para HALF_OPEN e restabelecer CLOSED após saúde confirmada", async () => {
    const adapter = new RealMarketDataFeedAdapter("ETHUSD_OTC", 3400.00);
    adapter.setSimulatedExternalError(true);
    for (let i = 0; i < 3; i++) await adapter.getNextTickPrice();
    assert.strictEqual(adapter.getCircuitState(), "OPEN");

    // Sinal externo volta a ficar saudável
    adapter.setSimulatedExternalError(false);
    adapter.attemptRecovery();
    assert.strictEqual(adapter.getCircuitState(), "HALF_OPEN");

    // 3 ticks com sucesso para restabelecer
    await adapter.getNextTickPrice();
    await adapter.getNextTickPrice();
    const recoveredTick = await adapter.getNextTickPrice();

    assert.strictEqual(adapter.getCircuitState(), "CLOSED", "Circuito deve voltar a CLOSED");
    assert.strictEqual(recoveredTick.isRealFeed, true);
  });

  it("5. Deve calcular hash SHA-256 encadeado compatível com o protocolo de auditoria", () => {
    const genesisHash = HashChain.computeGenesisHash("BTCUSD_OTC");
    const ts = new Date("2026-10-08T00:00:00.000Z");
    const tickHash = HashChain.computeTickHash(genesisHash, "BTCUSD_OTC", 1n, ts, "64250.00");

    assert.strictEqual(typeof tickHash, "string");
    assert.strictEqual(tickHash.length, 64, "Hash SHA-256 deve ter 64 caracteres hex");
  });
});
