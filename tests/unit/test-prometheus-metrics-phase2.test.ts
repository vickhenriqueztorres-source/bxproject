import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { RegionalMetricsService } from "../../services/api/src/services/metrics.ts";

describe("Subetapa 7 (Unit): Telemetria e Métricas Prometheus Segmentadas por País", () => {
  const metrics = RegionalMetricsService.getInstance();

  it("1. Deve registrar e incrementar requisições por país", () => {
    metrics.incrementRequest("BR", "/api/v1/contracts", 200);
    metrics.incrementRequest("BR", "/api/v1/contracts", 200);
    metrics.incrementRequest("MX", "/api/v1/contracts", 200);

    const output = metrics.renderOpenMetrics();
    assert(output.includes('broker_http_requests_total{country="BR",path="/api/v1/contracts",status="200"} 2'));
    assert(output.includes('broker_http_requests_total{country="MX",path="/api/v1/contracts",status="200"} 1'));
  });

  it("2. Deve registrar conexões bloqueadas por Geoblocking", () => {
    metrics.incrementGeoblockRejection("US", "UNSUPPORTED_REGION");
    metrics.incrementGeoblockRejection("US", "UNSUPPORTED_REGION");
    metrics.incrementGeoblockRejection("DE", "UNSUPPORTED_REGION");

    const output = metrics.renderOpenMetrics();
    assert(output.includes('broker_geoblock_rejections_total{country="US",reason="UNSUPPORTED_REGION"} 2'));
    assert(output.includes('broker_geoblock_rejections_total{country="DE",reason="UNSUPPORTED_REGION"} 1'));
  });

  it("3. Deve exportar status de Feature Flags e Feeds OTC Reais", () => {
    metrics.setFlagStatus("CO", "trading_enabled", true);
    metrics.setFlagStatus("CL", "trading_enabled", false);
    metrics.setOtcFeedStatus("BTCUSD_OTC", "CLOSED", 22);
    metrics.setOtcFeedStatus("EURUSD_OTC", "OPEN", 1200);

    const output = metrics.renderOpenMetrics();
    assert(output.includes('broker_feature_flags_status{country="CO",flag="trading_enabled"} 1'));
    assert(output.includes('broker_feature_flags_status{country="CL",flag="trading_enabled"} 0'));
    assert(output.includes('broker_otc_real_feed_status{symbol="BTCUSD_OTC"} 0'));
    assert(output.includes('broker_otc_real_feed_status{symbol="EURUSD_OTC"} 1'));
  });

  it("4. Proteção contra Cardinality Explosion: Sanitiza códigos inválidos para UNKNOWN", () => {
    metrics.incrementRequest("INVALID_VERY_LONG_STRING_ATTACK", "/api/test", 500);
    const output = metrics.renderOpenMetrics();
    assert(output.includes('broker_http_requests_total{country="UNKNOWN"'));
  });
});
