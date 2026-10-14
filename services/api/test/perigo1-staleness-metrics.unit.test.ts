import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RegionalMetricsService } from "../src/services/metrics.js";
import {
  getSymbolStalenessThresholdMs,
  setSymbolStalenessThreshold,
  ContractService,
} from "../src/services/contract-service.js";

describe("[Subetapa 02 — Perigo 1] Staleness Timer por Símbolo e Exportação das 5 Métricas de Feed no Prometheus", () => {
  it("[MÉTODO 3] getSymbolStalenessThresholdMs diferencia instrumentos por classe e respeita override explícito", () => {
    assert.equal(getSymbolStalenessThresholdMs("R_100"), 5000);
    assert.equal(getSymbolStalenessThresholdMs("EURUSD-OTC"), 5000);
    assert.equal(getSymbolStalenessThresholdMs("BTCUSDT"), 5000);
    assert.equal(getSymbolStalenessThresholdMs("XAUUSD"), 8000);
    assert.equal(getSymbolStalenessThresholdMs("AAPL-OTC"), 8000);

    setSymbolStalenessThreshold("R_10", 2000);
    assert.equal(getSymbolStalenessThresholdMs("R_10"), 2000);
    // Restaura padrão
    setSymbolStalenessThreshold("R_10", 5000);
  });

  it("[MÉTODO 7] RegionalMetricsService exporta as 5 métricas obrigatórias por símbolo no OpenMetrics (/metrics)", () => {
    const metrics = RegionalMetricsService.getInstance();
    metrics.recordTickAgeSeconds("R_100", 1.245);
    metrics.incrementFeedGapCount("R_100", 2);
    metrics.recordFeedLatencyMs("R_100", 18.4);
    metrics.setStalenessAlert("R_100", false);
    metrics.incrementReconnectCount("R_100", 1);

    metrics.recordTickAgeSeconds("EURUSD-OTC", 6.5);
    metrics.setStalenessAlert("EURUSD-OTC", true);

    const output = metrics.renderOpenMetrics();

    assert.equal(output.includes('tick_age_seconds{symbol="R_100"} 1.245'), true);
    assert.equal(output.includes('feed_gap_count{symbol="R_100"}'), true);
    assert.equal(output.includes('feed_latency_ms{symbol="R_100"} 18.4'), true);
    assert.equal(output.includes('staleness_alert{symbol="R_100"} 0'), true);
    assert.equal(output.includes('reconnect_count{symbol="R_100"}'), true);
    assert.equal(output.includes('staleness_alert{symbol="EURUSD-OTC"} 1'), true);
  });

  it("[CAOS / SEGURANÇA] ContractService.openContract bloqueia abertura quando tick_age > threshold(symbol), ativa Kill Switch e registra staleness_alert=1", async () => {
    setSymbolStalenessThreshold("R_25", 2500);

    let killSwitchTriggered = false;
    const mockPool = {
      query: async (sql: string) => {
        if (sql.includes("FROM contracts")) return { rows: [] };
        if (sql.includes("FROM index_state")) {
          return {
            rows: [
              {
                last_sequence: "50",
                last_price: "1500.00",
                // Tick com 3200ms de idade (> 2500ms do R_25, mas < 5000ms global antigo!)
                last_ts: new Date(Date.now() - 3200),
              },
            ],
          };
        }
        return { rows: [] };
      },
    };

    const mockRedis = {
      exists: async () => 0,
      get: async () => null,
      set: async (key: string) => {
        if (key.includes("killswitch")) killSwitchTriggered = true;
        return "OK";
      },
    };

    const service = new ContractService(mockPool as any, mockRedis as any);
    await assert.rejects(
      async () => {
        await service.openContract("user-1", "idem-stale-r25", {
          symbol: "R_25",
          direction: "UP",
          stake_minor: 1000,
          duration_seconds: 60,
        });
      },
      /KILLSWITCH_ACTIVE: Cotação para R_25 desatualizada/
    );

    assert.equal(killSwitchTriggered, true, "Kill switch deve ser disparado quando excede threshold do símbolo");
    const metricsOutput = RegionalMetricsService.getInstance().renderOpenMetrics();
    assert.equal(metricsOutput.includes('staleness_alert{symbol="R_25"} 1'), true);

    setSymbolStalenessThreshold("R_25", 5000);
  });
});
