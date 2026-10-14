import { describe, it, afterEach } from "vitest";
import assert from "node:assert/strict";
import Fastify from "../../services/api/node_modules/fastify/fastify.js";
import { geoblockPlugin } from "../../services/api/src/plugins/geoblock.ts";
import { geoRoutes } from "../../services/api/src/routes/geo.ts";
import { GeoBlockService } from "../../services/api/src/services/geoblock.ts";
import { RegionalMetricsService } from "../../services/api/src/services/metrics.ts";

afterEach(() => {
  GeoBlockService.setSimulatedFailure(false);
  GeoBlockService.setCustomGeoProvider(null);
});

// Helper para construir servidor Fastify com plugins de teste
async function buildTestServer() {
  const app = Fastify();

  // Mock do pool Postgres
  const dbFlags = new Map<string, boolean>();
  dbFlags.set("BR:trading_enabled", true);
  dbFlags.set("BR:otc_real_feed", true);
  dbFlags.set("MX:trading_enabled", true);
  dbFlags.set("AR:trading_enabled", true);

  const systemFlags = new Map<string, boolean>([
    ["payments_enabled", false],
    ["kyc_required", false],
    ["otc_enabled", true],
    ["synthetic_enabled", true],
    ["country_br_enabled", true],
    ["country_mx_enabled", true],
    ["country_co_enabled", true],
    ["country_ar_enabled", true],
    ["country_cl_enabled", true],
    ["country_pe_enabled", true]
  ]);

  const mockPg: any = {
    query: async (sql: string, params?: any[]) => {
      if (sql.includes("FROM system_feature_flags")) {
        const rows = [];
        for (const [flag_key, enabled] of systemFlags.entries()) {
          rows.push({ flag_key, enabled });
        }
        return { rows };
      }
      if (sql.includes("INSERT INTO system_feature_flags")) {
        const [flagKey, enabled] = params || [];
        systemFlags.set(flagKey, Boolean(enabled));
        return { rowCount: 1 };
      }
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

  it("7. Teste de Integração HTTP dos 8 Passos: País X ligado, País Y desligado, Inconsistência entre nós e Falha de Geoblocking (Fail-Closed)", async () => {
    const app = await buildTestServer();
    const metrics = RegionalMetricsService.getInstance();

    // Desliga todas as flags de países, exceto X = MX e Y = AR inicialmente
    await app.featureFlagsService.setSystemFlag("country_br_enabled", false);
    await app.featureFlagsService.setSystemFlag("country_co_enabled", false);
    await app.featureFlagsService.setSystemFlag("country_cl_enabled", false);
    await app.featureFlagsService.setSystemFlag("country_pe_enabled", false);
    await app.featureFlagsService.setSystemFlag("country_ar_enabled", true);

    // PASSO 1: Liga flag de país X (MX)
    await app.featureFlagsService.setSystemFlag("country_mx_enabled", true);

    // PASSO 2: Verifica se usuários de X (MX) acessam (HTTP 200), enquanto país desligado (CO) ou não-listado (US) é bloqueado (HTTP 403)
    const resMX = await app.inject({
      method: "GET",
      url: "/api/v1/test-protected",
      headers: { "cf-ipcountry": "MX" }
    });
    assert.strictEqual(resMX.statusCode, 200, "Passo 2: Usuários de MX (X) devem acessar");

    const resCO = await app.inject({
      method: "GET",
      url: "/api/v1/test-protected",
      headers: { "cf-ipcountry": "CO" }
    });
    assert.strictEqual(resCO.statusCode, 403, "Passo 2: País com flag desligada deve receber HTTP 403");

    // PASSO 3: Desliga flag de país Y (AR)
    await app.featureFlagsService.setSystemFlag("country_ar_enabled", false);

    // PASSO 4: Verifica se usuários de Y (AR) são bloqueados imediatamente (HTTP 403 COUNTRY_DISABLED)
    const resAR = await app.inject({
      method: "GET",
      url: "/api/v1/test-protected",
      headers: { "cf-ipcountry": "AR" }
    });
    assert.strictEqual(resAR.statusCode, 403, "Passo 4: Usuários de AR (Y) devem ser bloqueados com HTTP 403");
    assert.strictEqual(JSON.parse(resAR.body).error, "COUNTRY_DISABLED");

    // PASSO 5: Simula flag inconsistente entre 2 nós (node-1 e node-2)
    app.featureFlagsService.reportNodeFlagState("node-1", { country_mx_enabled: true, country_ar_enabled: false }, 1);
    app.featureFlagsService.reportNodeFlagState("node-2", { country_mx_enabled: true, country_ar_enabled: true }, 1);

    // PASSO 6: Verifica se alerta dispara
    const consistencyReport = app.featureFlagsService.checkFleetConsistency();
    assert.strictEqual(consistencyReport.consistent, false);
    assert.strictEqual(consistencyReport.alertTriggered, true, "Passo 6: Alerta de inconsistência deve disparar");
    assert.strictEqual(metrics.isFlagInconsistencyActive(), true);

    // PASSO 7: Simula geoblocking falhando (provedor GeoIP falha / header de erro / IP público externo sem geo header)
    GeoBlockService.setSimulatedFailure(true);
    const resGeoFailSimulated = await app.inject({
      method: "GET",
      url: "/api/v1/test-protected",
      headers: { "cf-ipcountry": "MX" }
    });

    GeoBlockService.setSimulatedFailure(false);
    const resGeoErrorHeader = await app.inject({
      method: "GET",
      url: "/api/v1/test-protected",
      headers: { "cf-ipcountry": "MX", "x-geo-error": "lookup_timeout" }
    });

    const resExternalIp = await app.inject({
      method: "GET",
      url: "/api/v1/test-protected",
      headers: { "x-forwarded-for": "8.8.8.8" }
    });

    // PASSO 8: Verifica se país bloqueado / falha de geoblocking resulta em bloqueio estrito (HTTP 403 GEO_BLOCKED)
    assert.strictEqual(resGeoFailSimulated.statusCode, 403, "Passo 8: Falha do GeoBlockService deve bloquear com HTTP 403 (Fail-Closed)");
    assert.strictEqual(JSON.parse(resGeoFailSimulated.body).error, "GEO_BLOCKED");

    assert.strictEqual(resGeoErrorHeader.statusCode, 403, "Passo 8: Header x-geo-error deve bloquear com HTTP 403 (Fail-Closed)");
    assert.strictEqual(JSON.parse(resGeoErrorHeader.body).error, "GEO_BLOCKED");

    assert.strictEqual(resExternalIp.statusCode, 403, "Passo 8: IP externo sem geo header válido deve bloquear com HTTP 403 (Fail-Closed)");
    assert.strictEqual(JSON.parse(resExternalIp.body).error, "GEO_BLOCKED");
  });
});

