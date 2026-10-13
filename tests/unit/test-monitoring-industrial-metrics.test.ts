import { describe, it, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { RegionalMetricsService } from "../../services/api/src/services/metrics.ts";

describe("Gate M-01 (Unit): Contrato OpenMetrics & Coletor Industrial de Métricas", () => {
  let metrics: RegionalMetricsService;

  beforeEach(() => {
    metrics = RegionalMetricsService.getInstance();
  });

  it("1. Deve registrar e exportar métricas do Tick Engine (is_leader, ticks_total, errors_total)", () => {
    metrics.setTickEngineLeader("SYNTH_VOL_50", true);
    metrics.incrementTickCount("SYNTH_VOL_50", 10);
    metrics.incrementTickError("SYNTH_VOL_50");

    const output = metrics.renderOpenMetrics();

    assert(output.includes('# HELP tick_engine_is_leader Lideranca ativa do motor de ticks por ativo (1=lider, 0=seguidor)'));
    assert(output.includes('# TYPE tick_engine_is_leader gauge'));
    assert(output.includes('tick_engine_is_leader{symbol="SYNTH_VOL_50"} 1'));

    assert(output.includes('# HELP tick_engine_ticks_total Total acumulado de ticks gerados pelo motor'));
    assert(output.includes('# TYPE tick_engine_ticks_total counter'));
    assert(output.includes('tick_engine_ticks_total{symbol="SYNTH_VOL_50"} 10'));

    assert(output.includes('# HELP tick_engine_errors_total Total de erros na geracao ou persistencia de ticks'));
    assert(output.includes('# TYPE tick_engine_errors_total counter'));
    assert(output.includes('tick_engine_errors_total{symbol="SYNTH_VOL_50"} 1'));
  });

  it("2. Deve registrar métricas operacionais de Contratos (created, open, settlement_failed)", () => {
    metrics.incrementContractCreated("SYNTH_VOL_50", "CALL");
    metrics.incrementContractCreated("SYNTH_VOL_50", "CALL");
    metrics.incrementContractCreated("SYNTH_VOL_50", "PUT");
    metrics.setContractOpenCount("SYNTH_VOL_50", 5);
    metrics.incrementSettlementFailed("SYNTH_VOL_50", "TICK_NOT_FOUND");

    const output = metrics.renderOpenMetrics();

    assert(output.includes('# HELP contract_created_total Total de contratos abertos por simbolo e direcao'));
    assert(output.includes('# TYPE contract_created_total counter'));
    assert(output.includes('contract_created_total{symbol="SYNTH_VOL_50",direction="CALL"} 2'));
    assert(output.includes('contract_created_total{symbol="SYNTH_VOL_50",direction="PUT"} 1'));

    assert(output.includes('# HELP contract_open_total Quantidade atual de contratos abertos e pendentes de expiracao'));
    assert(output.includes('# TYPE contract_open_total gauge'));
    assert(output.includes('contract_open_total{symbol="SYNTH_VOL_50"} 5'));

    assert(output.includes('# HELP contract_settlement_failed_total Total de falhas no settlement de contratos'));
    assert(output.includes('# TYPE contract_settlement_failed_total counter'));
    assert(output.includes('contract_settlement_failed_total{symbol="SYNTH_VOL_50",reason="TICK_NOT_FOUND"} 1'));
  });

  it("3. Deve monitorar erros 5xx de API e latência p95", () => {
    metrics.incrementHttp5xx("/api/v1/contracts", 500);
    metrics.recordApiLatency("/api/v1/contracts", 42);

    const output = metrics.renderOpenMetrics();

    assert(output.includes('# HELP api_http_5xx_total Total de respostas HTTP 5xx emitidas pela API'));
    assert(output.includes('# TYPE api_http_5xx_total counter'));
    assert(output.includes('api_http_5xx_total{path="/api/v1/contracts",status="500"} 1'));

    assert(output.includes('# HELP api_request_latency_p95_ms Estimativa de latencia p95 em milissegundos'));
    assert(output.includes('# TYPE api_request_latency_p95_ms gauge'));
    assert(output.includes('api_request_latency_p95_ms{path="/api/v1/contracts"} 42'));
  });

  it("4. Proteção contra Cardinality Explosion: Sanitiza símbolos e paths anômalos", () => {
    metrics.incrementTickCount("MALICIOUS_SYMBOL_WITH_VERY_LONG_INJECTION_SQL_ATTACK", 1);
    metrics.incrementHttp5xx("/very/weird/uuid/12345/67890/random/path", 500);

    const output = metrics.renderOpenMetrics();
    assert(output.includes('tick_engine_ticks_total{symbol="UNKNOWN"}'));
    assert(output.includes('api_http_5xx_total{path="/other",status="500"}'));
  });
});
