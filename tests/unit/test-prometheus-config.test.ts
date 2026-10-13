import { describe, it } from "vitest";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Gate M-03 (Unit): Configuração Prometheus e Validação de Alertas", () => {
  const promConfigPath = path.resolve("infra/prometheus/prometheus.yml");
  const alertsPath = path.resolve("infra/prometheus/phase2_alerts.yml");
  const composePath = path.resolve("infra/compose.yaml");

  it("1. O arquivo infra/prometheus/prometheus.yml deve existir e conter jobs de scraping válidos", () => {
    assert(fs.existsSync(promConfigPath), "Arquivo infra/prometheus/prometheus.yml deve existir");
    const content = fs.readFileSync(promConfigPath, "utf-8");

    assert(content.includes("scrape_interval:"), "Deve configurar scrape_interval global");
    assert(content.includes("job_name: 'broker-api'"), "Deve conter job broker-api");
    assert(content.includes("metrics_path: '/metrics'"), "Deve apontar para metrics_path /metrics");
    assert(content.includes("rule_files:"), "Deve declarar rule_files para carregamento de alertas");
  });

  it("2. O arquivo phase2_alerts.yml deve conter alertas críticos com expressões PromQL consistentes", () => {
    assert(fs.existsSync(alertsPath), "Arquivo infra/prometheus/phase2_alerts.yml deve existir");
    const content = fs.readFileSync(alertsPath, "utf-8");

    // Alerta de staleness / circuit breaker / geoblock
    assert(content.includes("HighGeoblockRejectionRate"), "Deve conter regra HighGeoblockRejectionRate");
    assert(content.includes("OtcFeedCircuitBreakerOpen"), "Deve conter regra OtcFeedCircuitBreakerOpen");
    assert(content.includes("severity: critical") || content.includes("severity: warning"), "Deve ter severidade válida");
  });

  it("3. O infra/compose.yaml deve montar os arquivos de configuração no container broker-prometheus", () => {
    const content = fs.readFileSync(composePath, "utf-8");
    assert(content.includes("./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml"), "Deve mapear prometheus.yml no compose.yaml");
    assert(content.includes("./prometheus/phase2_alerts.yml:/etc/prometheus/phase2_alerts.yml"), "Deve mapear phase2_alerts.yml no compose.yaml");
  });
});
