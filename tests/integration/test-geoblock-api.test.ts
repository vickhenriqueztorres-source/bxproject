import { describe, it } from "vitest";
import assert from "node:assert/strict";
import Fastify from "../../services/api/node_modules/fastify/fastify.js";
import { geoblockPlugin } from "../../services/api/src/plugins/geoblock.ts";
import { geoRoutes } from "../../services/api/src/routes/geo.ts";

// Helper para construir servidor Fastify com plugins de teste
async function buildTestServer() {
  const app = Fastify();

  // Mock do pool Postgres
  const dbFlags = new Map<string, boolean>();
  dbFlags.set("BR:trading_enabled", true);
  dbFlags.set("BR:otc_real_feed", true);
  dbFlags.set("MX:trading_enabled", true);

  const mockPg: any = {
    query: async (sql: string, params?: any[]) => {
      if (sql.includes("FROM countries ORDER BY")) {
        return {
          rows: [
            { code: "BR", name: "Brasil", default_currency: "BRL", default_locale: "pt-BR", is_active: true },
            { code: "MX", name: "México", default_currency: "MXN", default_locale: "es-MX", is_active: true },
            { code: "CO", name: "Colômbia", default_currency: "COP", default_locale: "es-CO", is_active: true },
            { code: "AR", name: "Argentina", default_currency: "ARS", default_locale: "es-AR", is_active: true },
            { code: "CL", name: "Chile", default_currency: "CLP", default_locale: "es-CL", is_active: true },
            { code: "PE", name: "Peru", default_currency: "PEN", default_locale: "es-PE", is_active: true }
          ]
        };
      }
      if (sql.includes("SELECT is_active FROM countries WHERE code")) {
        return { rows: [{ is_active: true }] };
      }
      if (sql.includes("FROM country_feature_flags WHERE country_code")) {
        const country = params?.[0];
        const rows = [];
        for (const [key, val] of dbFlags.entries()) {
          if (key.startsWith(`${country}:`)) {
            rows.push({ flag_key: key.split(":")[1], enabled: val });
          }
        }
        return { rows };
      }
      if (sql.includes("INSERT INTO country_feature_flags")) {
        const country = params?.[0];
        const flagKey = params?.[1];
        const enabled = params?.[2];
        dbFlags.set(`${country}:${flagKey}`, enabled);
        return { rowCount: 1 };
      }
      return { rows: [] };
    }
  };

  const redisMap = new Map<string, string>();
  const mockRedis: any = {
    get: async (k: string) => redisMap.get(k) || null,
    set: async (k: string, v: string) => { redisMap.set(k, v); return "OK"; },
    del: async (k: string) => { redisMap.delete(k); return 1; },
    publish: async () => 1
  };

  app.decorate("pg", mockPg);
  app.decorate("redis", mockRedis);

  // Mocks de autenticação RBAC
  app.decorate("authenticate", async (req: any, reply: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Missing token" });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token === "admin-token") {
      req.user = { id: "admin-1", roles: ["ADMIN"] };
    } else if (token === "user-token") {
      req.user = { id: "user-1", roles: ["USER"] };
    } else {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Invalid token" });
    }
  });

  app.decorate("requireRole", (role: string) => {
    return async (req: any, reply: any) => {
      if (!req.user || !req.user.roles.includes(role)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: "Missing required role" });
      }
    };
  });

  await app.register(geoblockPlugin);
  await app.register(geoRoutes);

  // Rota de teste protegida por enforceGeoblock
  app.get("/api/v1/test-protected", { preHandler: [app.enforceGeoblock] }, async () => {
    return { ok: true };
  });

  return app;
}

describe("Subetapa 2 (Integration): Rotas da API de Geoblocking e Feature Flags", () => {
  it("1. GET /api/v1/geo/detect detecta Brasil com CF-IPCountry: BR", async () => {
    const app = await buildTestServer();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/geo/detect",
      headers: { "cf-ipcountry": "BR" }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.country, "BR");
    assert.strictEqual(body.allowed, true);
    assert.strictEqual(body.default_currency, "BRL");
    assert.strictEqual(body.default_locale, "pt-BR");
    assert.strictEqual(body.flags.trading_enabled, true);
  });

  it("2. GET /api/v1/geo/detect intercepta país não autorizado com allowed: false", async () => {
    const app = await buildTestServer();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/geo/detect",
      headers: { "cf-ipcountry": "US" }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.country, "US");
    assert.strictEqual(body.allowed, false, "EUA não pode ser permitido");
  });

  it("3. enforceGeoblock bloqueia com HTTP 403 GEO_BLOCKED rotas sensíveis", async () => {
    const app = await buildTestServer();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/test-protected",
      headers: { "cf-ipcountry": "DE" } // Alemanha
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error, "GEO_BLOCKED");
  });

  it("4. GET /api/v1/geo/countries retorna os 6 países da Fase 2", async () => {
    const app = await buildTestServer();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/geo/countries"
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.countries.length, 6);
    const codes = body.countries.map((c: any) => c.code);
    assert.deepStrictEqual(codes.sort(), ["AR", "BR", "CL", "CO", "MX", "PE"].sort());
  });

  it("5. Segurança RBAC: Bloqueia acesso admin sem token e com role USER", async () => {
    const app = await buildTestServer();
    
    // Sem token -> 401
    const unauth = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/countries/BR/flags",
      payload: { flag_key: "trading_enabled", enabled: false }
    });
    assert.strictEqual(unauth.statusCode, 401);

    // Com token de USER -> 403
    const forbidden = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/countries/BR/flags",
      headers: { authorization: "Bearer user-token" },
      payload: { flag_key: "trading_enabled", enabled: false }
    });
    assert.strictEqual(forbidden.statusCode, 403);
  });

  it("6. Sucesso Admin: Atualização de flag em runtime com token ADMIN", async () => {
    const app = await buildTestServer();
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/countries/BR/flags",
      headers: { authorization: "Bearer admin-token" },
      payload: { flag_key: "trading_enabled", enabled: false }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.country, "BR");
    assert.strictEqual(body.enabled, false);

    // Consulta imediata na rota pública reflete a nova flag
    const checkRes = await app.inject({
      method: "GET",
      url: "/api/v1/flags/BR"
    });
    const checkBody = JSON.parse(checkRes.body);
    assert.strictEqual(checkBody.flags.trading_enabled, false);
  });
});
