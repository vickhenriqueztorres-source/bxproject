import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { RegionalMetricsService } from "../../services/api/src/services/metrics.ts";

describe("Gate M-04 (Unit): Detecção e Disparo de Alertas de Degradação", () => {
  const metrics = RegionalMetricsService.getInstance();

  it("1. Disparo de alerta de queda de conector de feed (Circuit Breaker OPEN)", () => {
    // Quando o feed cai, o conector transita para OPEN (código 1)
    metrics.setOtcFeedStatus("BTCUSD_OTC", "OPEN", 2500);

    const output = metrics.renderOpenMetrics();
    assert(output.includes('broker_otc_real_feed_status{symbol="BTCUSD_OTC"} 1'));
    assert(output.includes('broker_otc_real_feed_latency_ms{symbol="BTCUSD_OTC"} 2500'));
  });

  it("2. Recuperação de conector de feed para HALF_OPEN e CLOSED", () => {
    // Em teste de sonda (HALF_OPEN -> 2)
    metrics.setOtcFeedStatus("BTCUSD_OTC", "HALF_OPEN", 120);
    let output = metrics.renderOpenMetrics();
    assert(output.includes('broker_otc_real_feed_status{symbol="BTCUSD_OTC"} 2'));

    // Recuperado (CLOSED -> 0)
    metrics.setOtcFeedStatus("BTCUSD_OTC", "CLOSED", 22);
    output = metrics.renderOpenMetrics();
    assert(output.includes('broker_otc_real_feed_status{symbol="BTCUSD_OTC"} 0'));
  });

  it("3. Detecção de ataque de requisições ou anomalia com pico de 5xx", () => {
    for (let i = 0; i < 15; i++) {
      metrics.incrementHttp5xx("/api/v1/alerts_test", 500);
    }
    const output = metrics.renderOpenMetrics();
    assert(output.includes('api_http_5xx_total{path="/api/v1/alerts_test",status="500"} 15'));
  });

  it("4. Monitoramento do estado de liderança de motor de ticks (Failover)", () => {
    // Instância primária perde liderança
    metrics.setTickEngineLeader("SYNTH_VOL_50", false);
    let output = metrics.renderOpenMetrics();
    assert(output.includes('tick_engine_is_leader{symbol="SYNTH_VOL_50"} 0'));

    // Nova instância assume como líder
    metrics.setTickEngineLeader("SYNTH_VOL_50", true);
    output = metrics.renderOpenMetrics();
    assert(output.includes('tick_engine_is_leader{symbol="SYNTH_VOL_50"} 1'));
  });
});
