import { describe, it, expect, afterEach } from "vitest";
import assert from "node:assert/strict";
import { GeoBlockService } from "../../services/api/src/services/geoblock.ts";
import { FeatureFlagsService } from "../../services/api/src/services/feature-flags.ts";
import { RegionalMetricsService } from "../../services/api/src/services/metrics.ts";

afterEach(() => {
  GeoBlockService.setSimulatedFailure(false);
  GeoBlockService.setCustomGeoProvider(null);
});

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

describe("Item 4 (Unit): Prevenção dos 5 Modos de Falha de Feature Flag + Geoblocking", () => {
  it("9. Prevenção 1 (Flag com Expiration Date / Dead Code): Flag expirada desliga automaticamente e entra em getExpiredDeadFlags()", async () => {
    const mockPg: any = {
      query: async (sql: string) => {
        if (sql.includes("FROM system_feature_flags")) {
          return { rows: [{ flag_key: "otc_enabled", enabled: true }] };
        }
        return { rows: [] };
      }
    };

    const service = new FeatureFlagsService(mockPg, null);

    // Configura flag com data de expiração no passado (dead flag)
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    await service.setSystemFlag("otc_enabled", true, { expiresAt: pastDate });

    assert.strictEqual(service.isFlagExpired("otc_enabled"), true, "Flag com expiresAt no passado deve constar como expirada");

    const flags = await service.getSystemFlags();
    assert.strictEqual(flags.otc_enabled, false, "Flag expirada deve ser forçada para false (Fail-Safe)");

    const deadFlags = service.getExpiredDeadFlags();
    assert.ok(deadFlags.includes("SYSTEM:otc_enabled"), "Flag expirada deve ser reportada como dead code para limpeza");
  });

  it("10. Prevenção 2 (Config Atômica entre Nós): publishAtomicConfig gera versão monotônica e hash SHA-256 determinístico", async () => {
    const redisStore = new Map<string, string>();
    const publishedMessages: string[] = [];
    const mockRedis: any = {
      get: async (k: string) => redisStore.get(k) || null,
      set: async (k: string, v: string) => { redisStore.set(k, v); return "OK"; },
      del: async (k: string) => { redisStore.delete(k); return 1; },
      publish: async (_ch: string, msg: string) => { publishedMessages.push(msg); return 1; }
    };

    const service = new FeatureFlagsService(null as any, mockRedis);

    const snap1 = await service.publishAtomicConfig({
      systemFlags: {
        country_br_enabled: true,
        country_mx_enabled: true,
        country_ar_enabled: false
      }
    });

    const snap2 = await service.publishAtomicConfig({
      systemFlags: {
        country_br_enabled: true,
        country_mx_enabled: false,
        country_ar_enabled: false
      }
    });

    assert.ok(snap2.version > snap1.version, "Versão do snapshot deve ser estritamente monotônica crescente");
    assert.notStrictEqual(snap1.configHash, snap2.configHash, "Hashes de configs diferentes devem divergir");
    assert.strictEqual(snap2.configHash.length, 16);
    assert.strictEqual(publishedMessages.length, 2, "Deve publicar snapshot atômico via pub/sub para todos os nós");
  });

  it("11. Prevenção 3 (Monitorar Inconsistência entre Nós): Detecta divergência de flags entre nós e dispara alerta", async () => {
    const metrics = RegionalMetricsService.getInstance();
    const service = new FeatureFlagsService(null as any, null);
    let alertPayload: any = null;
    service.onInconsistencyAlert((report) => {
      alertPayload = report;
    });

    const alertsBefore = metrics.getFlagInconsistencyAlertsTotal();

    // Nó 1 e Nó 2 com estados divergentes para country_mx_enabled
    service.reportNodeFlagState("node-1", {
      country_br_enabled: true,
      country_mx_enabled: true
    }, 10);

    service.reportNodeFlagState("node-2", {
      country_br_enabled: true,
      country_mx_enabled: false
    }, 9);

    const report = service.checkFleetConsistency();
    assert.strictEqual(report.consistent, false, "Frota deve ser marcada como inconsistente");
    assert.strictEqual(report.alertTriggered, true, "Alerta de inconsistência deve disparar");
    assert.ok(report.divergentFlags.includes("country_mx_enabled"), "Deve identificar exatamente a flag divergente");
    assert.ok(alertPayload !== null, "Callback de alerta deve ter sido invocado");
    assert.strictEqual(metrics.isFlagInconsistencyActive(), true, "Métrica de alerta ativo deve ser true");
    assert.ok(metrics.getFlagInconsistencyAlertsTotal() > alertsBefore, "Contador Prometheus de alertas deve incrementar");

    // Quando Nó 2 sincroniza com Nó 1, o estado volta a ficar consistente
    service.reportNodeFlagState("node-2", {
      country_br_enabled: true,
      country_mx_enabled: true
    }, 10);

    const reportFixed = service.checkFleetConsistency();
    assert.strictEqual(reportFixed.consistent, true, "Frota deve voltar a ser consistente após sincronização");
    assert.strictEqual(metrics.isFlagInconsistencyActive(), false);
  });

  it("12. Prevenção 4 (Flag Interaction & Risco Regulatório): Valida combinações proibidas e bloqueia país fora da Fase 2", async () => {
    const service = new FeatureFlagsService(null as any, null);

    // 4a. Tentar ligar país não autorizado (ex: US) via setSystemFlag deve lançar erro regulatório
    await assert.rejects(
      async () => {
        await service.setSystemFlag("country_us_enabled", true);
      },
      /REGULATORY_VIOLATION/,
      "Não deve permitir ativar flag de país fora da allowlist da Fase 2"
    );

    // 4b. Combinação crítica: payments_enabled=true sem kyc_required=true
    const validation = service.validateFlagCombinations(
      {
        payments_enabled: true,
        kyc_required: false,
        otc_enabled: false,
        synthetic_enabled: false,
        country_ar_enabled: false
      },
      {
        AR: {
          trading_enabled: true,
          pix_enabled: false,
          spei_enabled: false,
          pse_enabled: false,
          otc_real_feed: true,
          kyc_required: false,
          Spanish_ui: true
        }
      }
    );

    assert.strictEqual(validation.valid, false);
    assert.ok(validation.conflicts.some((c) => c.code === "PAYMENTS_WITHOUT_KYC"));
    assert.ok(validation.conflicts.some((c) => c.code === "ALL_MARKETS_DISABLED_WHILE_TRADING_ACTIVE"));
    assert.ok(validation.conflicts.some((c) => c.code === "ORPHAN_COUNTRY_TRADING_FLAG"));
  });

  it("13. Prevenção 5 (Canary Cohort 1%): Rollout gradual determinístico habilita apenas ~1% dos usuários antes do rollout global", async () => {
    const mockPg: any = {
      query: async (sql: string) => {
        if (sql.includes("FROM system_feature_flags")) {
          return { rows: [{ flag_key: "otc_enabled", enabled: true }] };
        }
        return { rows: [] };
      }
    };

    const service = new FeatureFlagsService(mockPg, null);
    service.setCanaryRollout("otc_enabled", 1); // 1% canary cohort

    assert.strictEqual(service.getCanaryRollout("otc_enabled"), 1);

    let enabledCount = 0;
    const totalUsers = 1000;
    for (let i = 0; i < totalUsers; i++) {
      const allowed = await service.isFlagEnabledForUser("otc_enabled", `user-cohort-${i}`);
      if (allowed) enabledCount++;
    }

    // Com 1000 usuários e hash SHA-256 uniforme, ~1% (entre 1 e 30 usuários) deve estar no cohort
    assert.ok(enabledCount > 0 && enabledCount <= 30, `Canary 1% deve ativar apenas ~1% da base (ativou ${enabledCount}/1000)`);
  });

  it("14. Roteiro Completo de 8 Passos (End-to-End Unit): Liga X, Bloqueia Y, Detecta Nó Inconsistente e Geoblock Fail-Closed", async () => {
    const metrics = RegionalMetricsService.getInstance();
    const systemState: Record<string, boolean> = {
      payments_enabled: false,
      kyc_required: false,
      otc_enabled: true,
      synthetic_enabled: true,
      country_br_enabled: false,
      country_mx_enabled: false,
      country_co_enabled: false,
      country_ar_enabled: true,
      country_cl_enabled: false,
      country_pe_enabled: false
    };

    const mockPg: any = {
      query: async (sql: string, params?: any[]) => {
        if (sql.includes("FROM system_feature_flags")) {
          return {
            rows: Object.entries(systemState).map(([flag_key, enabled]) => ({ flag_key, enabled }))
          };
        }
        if (sql.includes("INSERT INTO system_feature_flags")) {
          const [key, val] = params || [];
          systemState[key] = Boolean(val);
          return { rowCount: 1 };
        }
        if (sql.includes("FROM countries WHERE code")) {
          return { rows: [{ is_active: true }] };
        }
        if (sql.includes("FROM country_feature_flags")) {
          return { rows: [{ flag_key: "trading_enabled", enabled: true }] };
        }
        return { rows: [] };
      }
    };

    const service = new FeatureFlagsService(mockPg, null);

    // PASSO 1: Liga flag de país X (MX)
    await service.setSystemFlag("country_mx_enabled", true);

    // PASSO 2: Verifica se só usuários de X (MX) (e AR que estava ativo) acessam, enquanto BR/CO/CL/PE estão desligados
    assert.strictEqual(await service.isCountryActive("MX"), true, "Passo 2: Usuários de MX (X) devem acessar");
    assert.strictEqual(await service.isFeatureEnabled("MX", "trading_enabled"), true, "Passo 2: Trading deve estar ativo para MX");
    assert.strictEqual(await service.isCountryActive("BR"), false, "Passo 2: País com flag desligada não deve acessar");

    // PASSO 3: Desliga flag de país Y (AR)
    await service.setSystemFlag("country_ar_enabled", false);

    // PASSO 4: Verifica se usuários de Y (AR) são bloqueados (inclusive nas features dependentes)
    assert.strictEqual(await service.isCountryActive("AR"), false, "Passo 4: Usuários de AR (Y) devem ser bloqueados");
    assert.strictEqual(await service.isFeatureEnabled("AR", "trading_enabled"), false, "Passo 4: Feature de país desativado deve retornar false");

    // PASSO 5: Simula flag inconsistente entre 2 nós (node-a vê MX=true, node-b vê MX=false)
    let inconsistencyAlertFired = false;
    service.onInconsistencyAlert(() => {
      inconsistencyAlertFired = true;
    });
    service.reportNodeFlagState("node-a", { country_mx_enabled: true, country_ar_enabled: false }, 1);
    service.reportNodeFlagState("node-b", { country_mx_enabled: false, country_ar_enabled: false }, 1);

    // PASSO 6: Verifica se alerta dispara
    const consistency = service.checkFleetConsistency();
    assert.strictEqual(consistency.consistent, false, "Passo 6: Inconsistência entre nós deve ser detectada");
    assert.strictEqual(consistency.alertTriggered, true, "Passo 6: Alerta deve disparar");
    assert.strictEqual(inconsistencyAlertFired, true, "Passo 6: Listener de alerta deve ser acionado");
    const promText = metrics.renderOpenMetrics();
    assert.ok(promText.includes("broker_feature_flag_inconsistency_alert 1"), "Passo 6: Métrica Prometheus deve registrar o alerta");

    // PASSO 7: Simula geoblocking falhando (provedor GeoIP lança erro / modo de falha / header XX / IP público externo sem geo header)
    const failuresBefore = metrics.getGeoblockProviderFailuresTotal();
    GeoBlockService.setSimulatedFailure(true);
    const ctxSimulatedFail = GeoBlockService.resolveGeoContext({
      headers: { "cf-ipcountry": "BR" }
    } as any);

    GeoBlockService.setSimulatedFailure(false);
    GeoBlockService.setCustomGeoProvider(() => {
      throw new Error("MaxMind GeoIP lookup timeout");
    });
    const ctxProviderThrow = GeoBlockService.resolveGeoContext({
      headers: { "cf-ipcountry": "MX" }
    } as any);

    GeoBlockService.setCustomGeoProvider(null);
    const ctxCloudflareUnknown = GeoBlockService.resolveGeoContext({
      headers: { "cf-ipcountry": "XX" }
    } as any);

    const ctxExternalIpNoHeader = GeoBlockService.resolveGeoContext({
      headers: { "x-forwarded-for": "8.8.8.8" }
    } as any);

    // PASSO 8: Verifica se país bloqueado / falha de geoblocking é estritamente bloqueado (Fail-Closed)
    assert.strictEqual(ctxSimulatedFail.country, "UNKNOWN");
    assert.strictEqual(ctxSimulatedFail.allowed, false, "Passo 8: Falha simulada de geoblocking deve bloquear acesso (Fail-Closed)");
    assert.strictEqual(ctxProviderThrow.country, "UNKNOWN");
    assert.strictEqual(ctxProviderThrow.allowed, false, "Passo 8: Exceção no provedor GeoIP deve bloquear acesso (Fail-Closed)");
    assert.strictEqual(ctxCloudflareUnknown.country, "UNKNOWN");
    assert.strictEqual(ctxCloudflareUnknown.allowed, false, "Passo 8: Header CF-IPCountry=XX deve bloquear acesso");
    assert.strictEqual(ctxExternalIpNoHeader.country, "UNKNOWN");
    assert.strictEqual(ctxExternalIpNoHeader.allowed, false, "Passo 8: IP externo público fora da LatAm sem header geo deve ser bloqueado");
    assert.ok(metrics.getGeoblockProviderFailuresTotal() > failuresBefore, "Passo 8: Contador de falhas de geoblocking deve incrementar");
  });
});

