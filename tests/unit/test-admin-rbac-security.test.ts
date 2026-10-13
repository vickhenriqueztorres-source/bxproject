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

async function generateTestToken(userId: string, roles: string[]) {
  return await new SignJWT({ roles, email: `${userId}@broker.test` })
    .setProtectedHeader({ alg: "HS256", typ: "Bearer" })
    .setSubject(userId)
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

describe("Gate A-01 (Unit): Segurança RBAC e Autenticação de Endpoints Administrativos", () => {
  it("1. Acesso a /api/v1/admin/users sem token deve ser rejeitado com HTTP 401", async () => {
    const app = await buildTestAdminServer();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users"
    });

    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error, "UNAUTHORIZED");
  });

  it("2. Usuário com role 'trader' (não-admin) deve receber HTTP 403 FORBIDDEN", async () => {
    const traderToken = await generateTestToken("trader_user_123", ["trader"]);
    const app = await buildTestAdminServer();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: {
        authorization: `Bearer ${traderToken}`
      }
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error, "FORBIDDEN");
  });

  it("3. Usuário com role 'admin' deve receber HTTP 200 OK", async () => {
    const adminToken = await generateTestToken("admin_user_001", ["admin"]);
    const app = await buildTestAdminServer();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert(Array.isArray(body.users));
  });

  it("4. Invariante I-01: Proibido endpoint de alteração direta de saldo no Admin", async () => {
    const adminToken = await generateTestToken("admin_user_001", ["admin"]);
    const app = await buildTestAdminServer();

    // Qualquer tentativa de POST /api/v1/admin/wallet/set-balance ou similar não deve existir (404)
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/wallet/set-balance",
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: { userId: "user123", amount: 1000000 }
    });

    assert.strictEqual(res.statusCode, 404, "Endpoint de edição direta de saldo NUNCA deve existir");
  });
});
