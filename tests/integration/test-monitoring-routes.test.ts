import { describe, it } from "vitest";
import assert from "node:assert/strict";
import Fastify from "../../services/api/node_modules/fastify/fastify.js";
import { healthRoutes } from "../../services/api/src/routes/health.ts";
import { RegionalMetricsService } from "../../services/api/src/services/metrics.ts";

async function buildTestHealthServer() {
  const app = Fastify();
  await app.register(healthRoutes);
  return app;
}

describe("Gate M-02 (Integration): Endpoint Real Fastify GET /metrics e GET /healthz", () => {
  it("1. GET /healthz deve responder HTTP 200 { status: 'ok' } com timestamp ISO", async () => {
    const app = await buildTestHealthServer();
    const res = await app.inject({
      method: "GET",
      url: "/healthz"
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, "ok");
    assert(typeof body.timestamp === "string");
  });

  it("2. GET /metrics deve responder com Content-Type OpenMetrics e métricas formatadas", async () => {
    const metrics = RegionalMetricsService.getInstance();
    metrics.incrementRequest("BR", "/api/v1/contracts", 200);
    metrics.setTickEngineLeader("SYNTH_VOL_50", true);
    metrics.incrementContractCreated("SYNTH_VOL_50", "CALL");

    const app = await buildTestHealthServer();
    const t0 = performance.now();
    const res = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const latency = performance.now() - t0;

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers["content-type"], "text/plain; version=0.0.4; charset=utf-8");

    const body = res.body;
    assert(body.includes("broker_http_requests_total"));
    assert(body.includes("tick_engine_is_leader"));
    assert(body.includes("contract_created_total"));
    // SLA de latência: a rota deve renderizar em menos de 100ms
    assert(latency < 100, `Latência de /metrics (${latency}ms) deve ser inferior a 100ms`);
  });

  it("3. GET /readyz deve responder status de prontidão da infraestrutura", async () => {
    const app = await buildTestHealthServer();
    const res = await app.inject({
      method: "GET",
      url: "/readyz"
    });

    // Se serviços externos não estiverem conectados no runner de CI, readyz deve retornar 503 com status 'not_ready' de forma segura
    // Ou 200 se estiverem prontos. Nunca 500 não tratado.
    assert([200, 503].includes(res.statusCode), `Status deve ser 200 ou 503 tratado, recebido ${res.statusCode}`);
    const body = JSON.parse(res.body);
    assert(["ready", "not_ready"].includes(body.status));
  });
});
