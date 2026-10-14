import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { RealMarketDataFeedAdapter } from "../../services/tick-engine/src/engine/real-feed-adapter.ts";
import { HashChain } from "../../services/tick-engine/src/engine/hash-chain.ts";
import { GeoBlockService } from "../../services/api/src/services/geoblock.ts";
import { FeatureFlagsService } from "../../services/api/src/services/feature-flags.ts";

describe("Subetapa 8 (Caos): Cenários Críticos de Resiliência e Caos na Fase 2 (Seção 13.5)", () => {
  it("Caos C-F2-01 (13.5.1 - Feed OTC cai em um país): Queda do feed real não causa congelamento de mercado nem quebra de sequência", async () => {
    const adapter = new RealMarketDataFeedAdapter("ETHUSD_OTC");
    let prevHash = HashChain.computeGenesisHash("ETHUSD_OTC");

    // Executa 30 ticks simulando queda no tick 10 e retorno no tick 20
    for (let i = 1; i <= 30; i++) {
      if (i === 10) {
        adapter.setSimulatedExternalError(true);
      }
      if (i === 20) {
        adapter.setSimulatedExternalError(false);
        adapter.attemptRecovery();
      }

      const tick = await adapter.getNextTickPrice();
      const currentHash = HashChain.computeTickHash(prevHash, "ETHUSD_OTC", BigInt(i), new Date(), tick.priceString);

      // O tick NUNCA pode ser nulo ou vazio
      assert(tick.priceString.length > 0);
      assert.strictEqual(currentHash.length, 64);
      prevHash = currentHash;
    }
  });

  it("Caos C-F2-02 (13.5.2 - Redis cai): Queda simultânea do Redis de Feature Flags mantém fail-closed e segurança via PostgreSQL", async () => {
    const mockPg: any = {
      query: async (sql: string, params: any[]) => {
        if (sql.includes("FROM countries WHERE code")) {
          // Chile está desativado no banco
          if (params[0] === "CL") return { rows: [{ is_active: false }] };
          return { rows: [{ is_active: true }] };
        }
        return { rows: [] };
      }
    };

    const deadRedis: any = {
      get: async () => { throw new Error("ECONNREFUSED: Redis offline"); },
      set: async () => { throw new Error("ECONNREFUSED: Redis offline"); },
      del: async () => { throw new Error("ECONNREFUSED: Redis offline"); },
      publish: async () => { throw new Error("ECONNREFUSED: Redis offline"); },
    };

    const service = new FeatureFlagsService(mockPg, deadRedis);

    // Mesmo com Redis offline, consulta ao banco identifica que Chile está inativo
    const clActive = await service.isCountryActive("CL");
    assert.strictEqual(clActive, false, "Chile inativo deve permanecer bloqueado");

    const brActive = await service.isCountryActive("BR");
    assert.strictEqual(brActive, true, "Brasil deve permanecer ativo via fallback");
  });

  it("Caos C-F2-03 (13.5.3 - Postgres cai): Queda do PostgreSQL preserva operação via Redis Cache e fail-safe determinístico", async () => {
    const redisStore = new Map<string, string>([
      ["broker:flags:country:MX", JSON.stringify({ _is_country_active: true, trading_enabled: true })],
      ["broker:flags:country:PE", JSON.stringify({ _is_country_active: false, trading_enabled: false })],
      [
        "broker:system:feature_flags",
        JSON.stringify({
          payments_enabled: false,
          kyc_required: false,
          otc_enabled: true,
          synthetic_enabled: true,
          country_br_enabled: true,
          country_mx_enabled: true,
          country_co_enabled: true,
          country_ar_enabled: true,
          country_cl_enabled: true,
          country_pe_enabled: true,
        }),
      ],
    ]);

    const liveRedis: any = {
      get: async (key: string) => redisStore.get(key) ?? null,
      set: async (key: string, val: string) => { redisStore.set(key, val); },
      del: async (key: string) => { redisStore.delete(key); },
      publish: async () => 1,
    };

    const deadPg: any = {
      query: async () => { throw new Error("57P01: terminating connection due to administrator command (Postgres offline)"); }
    };

    const service = new FeatureFlagsService(deadPg, liveRedis);

    // 1. Países cacheados no Redis respondem instantaneamente mesmo com Postgres fora do ar
    assert.strictEqual(await service.isCountryActive("MX"), true, "México em cache Redis deve responder ativo");
    assert.strictEqual(await service.isCountryActive("PE"), false, "Peru bloqueado em cache Redis deve permanecer bloqueado");

    // 2. Flags globais cacheadas ou com default seguro não quebram
    assert.strictEqual(await service.isSystemFeatureEnabled("otc_enabled"), true);
    assert.strictEqual(await service.isSystemFeatureEnabled("payments_enabled"), false, "payments_enabled jamais pode ativar em falha de banco");

    // 3. País sem entrada no Redis usa default seguro quando Postgres cai
    assert.strictEqual(await service.isCountryActive("BR"), true, "Brasil autorizado deve manter fallback seguro");
    assert.strictEqual(await service.isCountryActive("US"), false, "País fora da lista LatAm deve ser negado");
  });

  it("Caos C-F2-04 (13.5.4 - Feature flag muda em runtime): Chaveamento de país e OTC em runtime aplica efeito imediato sem deploy", async () => {
    const redisStore = new Map<string, string>();
    const dbFlags = new Map<string, boolean>([
      ["country_co_enabled", true],
      ["otc_enabled", true],
      ["payments_enabled", false],
    ]);
    const dbCountries = new Map<string, boolean>([
      ["CO", true],
      ["AR", true],
    ]);

    const mockRedis: any = {
      get: async (key: string) => redisStore.get(key) ?? null,
      set: async (key: string, val: string) => { redisStore.set(key, val); },
      del: async (key: string) => { redisStore.delete(key); },
      publish: async () => 1,
    };

    const mockPg: any = {
      query: async (sql: string, params: any[]) => {
        if (sql.includes("FROM system_feature_flags")) {
          return {
            rows: Array.from(dbFlags.entries()).map(([flag_key, enabled]) => ({ flag_key, enabled })),
          };
        }
        if (sql.includes("INSERT INTO system_feature_flags")) {
          dbFlags.set(params[0], params[1]);
          return { rows: [] };
        }
        if (sql.includes("FROM countries WHERE code")) {
          const code = params[0];
          if (dbCountries.has(code)) return { rows: [{ is_active: dbCountries.get(code) }] };
          return { rows: [] };
        }
        return { rows: [] };
      }
    };

    const service = new FeatureFlagsService(mockPg, mockRedis);

    // Estado inicial: Colômbia e OTC ativos
    assert.strictEqual(await service.isCountryActive("CO"), true);
    assert.strictEqual(await service.isSystemFeatureEnabled("otc_enabled"), true);

    // Mudança em runtime 1: Desliga country_co_enabled sem deploy
    await service.setSystemFlag("country_co_enabled", false);
    assert.strictEqual(await service.isCountryActive("CO"), false, "Colômbia deve ser bloqueada imediatamente após toggle em runtime");

    // Mudança em runtime 2: Religa country_co_enabled sem deploy
    await service.setSystemFlag("country_co_enabled", true);
    assert.strictEqual(await service.isCountryActive("CO"), true, "Colômbia deve voltar a ficar ativa imediatamente em runtime");

    // Mudança em runtime 3: Desliga otc_enabled em runtime
    await service.setSystemFlag("otc_enabled", false);
    assert.strictEqual(await service.isSystemFeatureEnabled("otc_enabled"), false, "otc_enabled deve desligar imediatamente em runtime");
  });

  it("Caos C-F2-05: Injeção massiva de IP Spoofing é 100% interceptada pelo GeoBlockService", () => {
    const maliciousPayloads = [
      "127.0.0.1, 10.0.0.1",
      "BR; SELECT * FROM users",
      "US' OR '1'='1",
      "<script>alert(1)</script>",
      "INVALID_CODE",
      "B R",
      "BR\nInjected-Header: evil"
    ];

    for (const payload of maliciousPayloads) {
      const mockReq: any = { headers: { "cf-ipcountry": payload } };
      const extracted = GeoBlockService.extractCountry(mockReq);
      assert.strictEqual(extracted, "UNKNOWN", `Payload malicioso '${payload}' deve resultar em UNKNOWN`);
      assert.strictEqual(GeoBlockService.isAllowed(extracted), false, "Origem forjada deve ser bloqueada");
    }
  });
});
