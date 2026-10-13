import { describe, it, expect } from "vitest";
import assert from "node:assert/strict";
import { GeoBlockService } from "../../services/api/src/services/geoblock.ts";
import { FeatureFlagsService } from "../../services/api/src/services/feature-flags.ts";

describe("Subetapa 2 (Unit): GeoBlockService & Header Anti-Spoofing", () => {
  it("1. Deve extrair país priorizando CF-IPCountry sanitizado", () => {
    const mockReq: any = {
      headers: {
        "cf-ipcountry": "br",
        "x-country-code": "us"
      }
    };
    const country = GeoBlockService.extractCountry(mockReq);
    assert.strictEqual(country, "BR", "Deve normalizar para maiúsculo e respeitar prioridade");
  });

  it("2. Deve sanitizar e rejeitar caracteres espúrios ou ataques de injeção no header", () => {
    const mockReqMalicious: any = {
      headers: {
        "cf-ipcountry": "BR' OR '1'='1"
      }
    };
    const country = GeoBlockService.extractCountry(mockReqMalicious);
    assert.strictEqual(country, "UNKNOWN", "Header malformado deve resultar em UNKNOWN");
  });

  it("3. Deve validar estritamente a allowlist dos 6 países da Fase 2", () => {
    const allowed = ["BR", "MX", "CO", "AR", "CL", "PE"];
    for (const c of allowed) {
      assert.strictEqual(GeoBlockService.isAllowed(c), true, `País ${c} deve ser permitido`);
    }

    const blocked = ["US", "GB", "DE", "FR", "RU", "CN", "CA", "ES", "IT"];
    for (const c of blocked) {
      assert.strictEqual(GeoBlockService.isAllowed(c), false, `País ${c} deve ser bloqueado`);
    }
  });

  it("4. Deve resolver o contexto geográfico completo e metadados para cada país", () => {
    const reqBR: any = { headers: { "cf-ipcountry": "BR" } };
    const ctxBR = GeoBlockService.resolveGeoContext(reqBR);
    assert.strictEqual(ctxBR.country, "BR");
    assert.strictEqual(ctxBR.allowed, true);
    assert.strictEqual(ctxBR.defaultCurrency, "BRL");
    assert.strictEqual(ctxBR.defaultLocale, "pt-BR");

    const reqMX: any = { headers: { "cf-ipcountry": "MX" } };
    const ctxMX = GeoBlockService.resolveGeoContext(reqMX);
    assert.strictEqual(ctxMX.country, "MX");
    assert.strictEqual(ctxMX.allowed, true);
    assert.strictEqual(ctxMX.defaultCurrency, "MXN");
    assert.strictEqual(ctxMX.defaultLocale, "es-MX");

    const reqUS: any = { headers: { "cf-ipcountry": "US" } };
    const ctxUS = GeoBlockService.resolveGeoContext(reqUS);
    assert.strictEqual(ctxUS.country, "US");
    assert.strictEqual(ctxUS.allowed, false, "EUA deve estar bloqueado na Fase 2");
  });
});

describe("Subetapa 2 (Unit): FeatureFlagsService com Cache & Fallback", () => {
  it("5. Deve retornar flags com fallback em memória seguro se banco e cache forem mockados", async () => {
    const mockPg: any = {
      query: async (sql: string, params: any[]) => {
        if (sql.includes("FROM countries WHERE code")) {
          return { rows: [{ is_active: true }] };
        }
        if (sql.includes("FROM country_feature_flags WHERE country_code")) {
          return { rows: [{ flag_key: "trading_enabled", enabled: true }] };
        }
        return { rows: [] };
      }
    };

    const memoryCache = new Map<string, string>();
    const mockRedis: any = {
      get: async (key: string) => memoryCache.get(key) || null,
      set: async (key: string, val: string) => { memoryCache.set(key, val); return "OK"; },
      del: async (key: string) => { memoryCache.delete(key); return 1; },
      publish: async () => 1
    };

    const service = new FeatureFlagsService(mockPg, mockRedis);

    // 1ª chamada: Cache Miss (consulta banco e popula cache)
    const flags1 = await service.getCountryFlags("BR");
    assert.strictEqual(flags1.trading_enabled, true);
    assert.strictEqual(memoryCache.has("broker:flags:country:BR"), true, "Chave deve estar gravada no Redis");

    // 2ª chamada: Cache Hit (retorna do cache)
    const flags2 = await service.getCountryFlags("BR");
    assert.strictEqual(flags2.trading_enabled, true);

    // Atualização de flag invalida o cache
    await service.setCountryFlag("BR", "trading_enabled", false);
    assert.strictEqual(memoryCache.has("broker:flags:country:BR"), false, "Cache deve ser invalidado após update");
  });

  it("6. Resiliência: Deve tolerar queda total do Redis e recorrer ao PostgreSQL sem lançar erro", async () => {
    const mockPg: any = {
      query: async (sql: string) => {
        if (sql.includes("FROM countries WHERE code")) return { rows: [{ is_active: true }] };
        if (sql.includes("FROM country_feature_flags WHERE country_code")) {
          return { rows: [{ flag_key: "otc_real_feed", enabled: true }] };
        }
        return { rows: [] };
      }
    };

    const brokenRedis: any = {
      get: async () => { throw new Error("ECONNREFUSED: Redis instance offline"); },
      set: async () => { throw new Error("ECONNREFUSED: Redis instance offline"); },
      del: async () => { throw new Error("ECONNREFUSED: Redis instance offline"); }
    };

    const service = new FeatureFlagsService(mockPg, brokenRedis);
    const flags = await service.getCountryFlags("MX");

    assert.strictEqual(flags.otc_real_feed, true, "Deve responder com dados do PostgreSQL mesmo com Redis caído");
  });

  it("7. Deve carregar as 10 Feature Flags oficiais da especificação com seus valores padrão", async () => {
    const mockPg: any = {
      query: async (sql: string) => {
        if (sql.includes("FROM system_feature_flags")) {
          return {
            rows: [
              { flag_key: "payments_enabled", enabled: false },
              { flag_key: "kyc_required", enabled: false },
              { flag_key: "otc_enabled", enabled: true },
              { flag_key: "synthetic_enabled", enabled: true },
              { flag_key: "country_br_enabled", enabled: true },
              { flag_key: "country_mx_enabled", enabled: true },
              { flag_key: "country_co_enabled", enabled: true },
              { flag_key: "country_ar_enabled", enabled: true },
              { flag_key: "country_cl_enabled", enabled: true },
              { flag_key: "country_pe_enabled", enabled: true }
            ]
          };
        }
        return { rows: [] };
      }
    };

    const service = new FeatureFlagsService(mockPg, null);
    const systemFlags = await service.getSystemFlags();

    assert.strictEqual(systemFlags.payments_enabled, false);
    assert.strictEqual(systemFlags.kyc_required, false);
    assert.strictEqual(systemFlags.otc_enabled, true);
    assert.strictEqual(systemFlags.synthetic_enabled, true);
    assert.strictEqual(systemFlags.country_br_enabled, true);
    assert.strictEqual(systemFlags.country_mx_enabled, true);
    assert.strictEqual(systemFlags.country_co_enabled, true);
    assert.strictEqual(systemFlags.country_ar_enabled, true);
    assert.strictEqual(systemFlags.country_cl_enabled, true);
    assert.strictEqual(systemFlags.country_pe_enabled, true);
  });

  it("8. Desligar flag de país desativa o acesso do país instantaneamente sem deploy", async () => {
    let flagState = true;
    const mockPg: any = {
      query: async (sql: string, params: any[]) => {
        if (sql.includes("FROM system_feature_flags")) {
          return { rows: [{ flag_key: "country_ar_enabled", enabled: flagState }] };
        }
        if (sql.includes("FROM countries WHERE code")) {
          return { rows: [{ is_active: true }] };
        }
        if (sql.includes("FROM country_feature_flags")) {
          return { rows: [] };
        }
        return { rows: [] };
      }
    };

    const service = new FeatureFlagsService(mockPg, null);

    // Com flag ativa
    assert.strictEqual(await service.isCountryActive("AR"), true);

    // Com flag inativa
    flagState = false;
    assert.strictEqual(await service.isCountryActive("AR"), false, "País deve ser bloqueado ao desligar a flag");
  });
});
