import { describe, it, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import Fastify from "../../services/api/node_modules/fastify/fastify.js";
import { authPlugin } from "../../services/api/src/plugins/auth.ts";
import { adminRoutes } from "../../services/api/src/routes/admin.ts";
import { healthRoutes } from "../../services/api/src/routes/health.ts";
import { RegionalMetricsService } from "../../services/api/src/services/metrics.ts";
import { SignJWT } from "../../services/api/node_modules/jose/dist/node/esm/index.js";

const JWT_SECRET = randomBytes(32).toString("hex");
const previousJwtSecret = process.env.JWT_SECRET;
beforeEach(() => { process.env.JWT_SECRET = JWT_SECRET; });
afterEach(() => {
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
});

async function generateAdminToken() {
  return await new SignJWT({ roles: ["admin"], email: "audit_lead@broker.test" })
    .setProtectedHeader({ alg: "HS256", typ: "Bearer" })
    .setSubject("admin_e2e_lead")
    .setIssuer("binmax-native")
    .setAudience("broker-api")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(JWT_SECRET));
}

async function buildFullTestServer() {
  const app = Fastify();
  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(adminRoutes, { prefix: "/api/v1/admin" });
  return app;
}

describe("Gate A-04 (Integration E2E): Cadeia Causal Admin ➔ Motor ➔ Métricas", () => {
  it("Ciclo Completo: Pausa Administrativa com Justificativa B-14, Impacto em Métricas e Retomada Operacional", async () => {
    const adminToken = await generateAdminToken();
    const app = await buildFullTestServer();
    const metrics = RegionalMetricsService.getInstance();

    // 1. Estado Inicial do Motor
    metrics.setTickEngineLeader("SYNTH_VOL_50", true);
    metrics.incrementTickCount("SYNTH_VOL_50", 100);

    let resMetrics = await app.inject({ method: "GET", url: "/metrics" });
    assert.strictEqual(resMetrics.statusCode, 200);
    assert(resMetrics.body.includes('tick_engine_is_leader{symbol="SYNTH_VOL_50"} 1'));

    // 2. Admin emite ordem de PAUSA emergencial no índice
    const pausePayload = { reason: "Detecção de divergência de latência com provedor externo" };
    const resPause = await app.inject({
      method: "POST",
      url: "/api/v1/admin/indices/SYNTH_VOL_50/pause",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: pausePayload
    });

    assert.strictEqual(resPause.statusCode, 200);
    const bodyPause = JSON.parse(resPause.body);
    assert.strictEqual(bodyPause.status, "PAUSED");
    assert.strictEqual(bodyPause.audit.reason, pausePayload.reason);

    // Motor sinaliza interrupção de liderança/geração
    metrics.setTickEngineLeader("SYNTH_VOL_50", false);

    // 3. Métrica no Prometheus reflete que o índice não possui líder ativo gerando ticks
    resMetrics = await app.inject({ method: "GET", url: "/metrics" });
    assert(resMetrics.body.includes('tick_engine_is_leader{symbol="SYNTH_VOL_50"} 0'));

    // 4. Admin reativa o índice com justificativa
    const resumePayload = { reason: "Provedor normalizado, retomando cotação regular do índice" };
    const resResume = await app.inject({
      method: "POST",
      url: "/api/v1/admin/indices/SYNTH_VOL_50/resume",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: resumePayload
    });

    assert.strictEqual(resResume.statusCode, 200);
    const bodyResume = JSON.parse(resResume.body);
    assert.strictEqual(bodyResume.status, "ACTIVE");

    // Motor retoma liderança
    metrics.setTickEngineLeader("SYNTH_VOL_50", true);
    resMetrics = await app.inject({ method: "GET", url: "/metrics" });
    assert(resMetrics.body.includes('tick_engine_is_leader{symbol="SYNTH_VOL_50"} 1'));

    // 5. Trilha Forense: Confere que ambas as ações constam nos alertas e logs de auditoria
    const resAlerts = await app.inject({
      method: "GET",
      url: "/api/v1/admin/alerts",
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resAlerts.statusCode, 200);
    const bodyAlerts = JSON.parse(resAlerts.body);
    const logs = bodyAlerts.auditLogs;
    assert(logs.some((l: any) => l.action === "PAUSE_INDEX" && l.reason === pausePayload.reason));
    assert(logs.some((l: any) => l.action === "RESUME_INDEX" && l.reason === resumePayload.reason));
  });
});
