import { describe, it, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import Fastify from "../../services/api/node_modules/fastify/fastify.js";
import { authPlugin } from "../../services/api/src/plugins/auth.ts";
import { adminRoutes } from "../../services/api/src/routes/admin.ts";
import { SignJWT } from "../../services/api/node_modules/jose/dist/node/esm/index.js";

const JWT_SECRET = randomBytes(32).toString("hex");
const previousJwtSecret = process.env.JWT_SECRET;
beforeEach(() => { process.env.JWT_SECRET = JWT_SECRET; });
afterEach(() => {
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
});

async function generateAdminToken() {
  return await new SignJWT({ roles: ["admin"], email: "superadmin@broker.test" })
    .setProtectedHeader({ alg: "HS256", typ: "Bearer" })
    .setSubject("admin_master_001")
    .setIssuer("binmax-native")
    .setAudience("broker-api")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(JWT_SECRET));
}

async function buildTestAdminServer() {
  const app = Fastify();
  await app.register(authPlugin);
  await app.register(adminRoutes, { prefix: "/api/v1/admin" });
  return app;
}

describe("Gate A-02 (Integration): Endpoints Administrativos Reais da API", () => {
  it("1. Bloqueio de usuário exige justificativa de auditoria (B-14)", async () => {
    const adminToken = await generateAdminToken();
    const app = await buildTestAdminServer();

    // Sem justificativa -> 400 VALIDATION_ERROR
    const resFail = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users/usr_br_001/block",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { blocked: true, reason: "" }
    });
    assert.strictEqual(resFail.statusCode, 400);
    const bodyFail = JSON.parse(resFail.body);
    assert.strictEqual(bodyFail.error, "VALIDATION_ERROR");

    // Com justificativa válida -> 200 OK
    const resOk = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users/usr_br_001/block",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { blocked: true, reason: "Suspeita de abuso de latência em arbitragem" }
    });
    assert.strictEqual(resOk.statusCode, 200);
    const bodyOk = JSON.parse(resOk.body);
    assert.strictEqual(bodyOk.status, "BLOCKED");
    assert.strictEqual(bodyOk.audit.target, "usr_br_001");
    assert.strictEqual(bodyOk.audit.reason, "Suspeita de abuso de latência em arbitragem");
  });

  it("2. Consulta de contratos retorna histórico estruturado", async () => {
    const adminToken = await generateAdminToken();
    const app = await buildTestAdminServer();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/contracts",
      headers: { authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert(Array.isArray(body.contracts));
    assert(body.contracts.length > 0);
    const contract = body.contracts[0];
    assert(contract.symbol);
    assert(contract.direction);
    assert(typeof contract.payoutPct === "number");
  });

  it("3. Consulta de integridade do Ledger Blnk sem alteração direta de saldo", async () => {
    const adminToken = await generateAdminToken();
    const app = await buildTestAdminServer();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/ledger/summary",
      headers: { authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.reconciliationStatus, "BALANCED");
    assert.strictEqual(body.canDirectlyEditBalance, false, "Invariante I-01: Admin nunca edita saldo direto");
  });

  it("4. Pausa e retomada de índice sintético exige justificativa B-14 e audita operação", async () => {
    const adminToken = await generateAdminToken();
    const app = await buildTestAdminServer();

    // Pausa com justificativa
    const resPause = await app.inject({
      method: "POST",
      url: "/api/v1/admin/indices/SYNTH_VOL_50/pause",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: "Manutenção preventiva emergencial no motor de preços" }
    });
    assert.strictEqual(resPause.statusCode, 200);
    const bodyPause = JSON.parse(resPause.body);
    assert.strictEqual(bodyPause.status, "PAUSED");

    // Retomada com justificativa
    const resResume = await app.inject({
      method: "POST",
      url: "/api/v1/admin/indices/SYNTH_VOL_50/resume",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: "Manutenção concluída, restaurando operações do índice" }
    });
    assert.strictEqual(resResume.statusCode, 200);
    const bodyResume = JSON.parse(resResume.body);
    assert.strictEqual(bodyResume.status, "ACTIVE");

    // Consulta de alertas e trilha de auditoria
    const resAlerts = await app.inject({
      method: "GET",
      url: "/api/v1/admin/alerts",
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resAlerts.statusCode, 200);
    const bodyAlerts = JSON.parse(resAlerts.body);
    assert(bodyAlerts.auditLogs.some((l: any) => l.action === "PAUSE_INDEX" && l.target === "SYNTH_VOL_50"));
    assert(bodyAlerts.auditLogs.some((l: any) => l.action === "RESUME_INDEX" && l.target === "SYNTH_VOL_50"));
  });
});
