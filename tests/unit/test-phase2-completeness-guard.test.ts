import { describe, it } from "vitest";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { COUNTRY_STAKE_LIMITS, KYCStatusSchema, PaymentMethodSpecSchema, PaymentIntentSchema } from "../../packages/shared/src/types.ts";
import { GeoBlockService } from "../../services/api/src/services/geoblock.ts";
import { DEFAULT_SYSTEM_FEATURE_FLAGS } from "../../services/api/src/services/feature-flags.ts";
import { RegionalMetricsService } from "../../services/api/src/services/metrics.ts";
import { BlnkClient } from "../../services/wallet-adapter/src/blnk-client.ts";

describe("Guardrail Permanente: Fase 2 Completa (Seções 1 a 16)", () => {
  it("Seção 2.2: Estrutura locales/{pt-BR,es-MX,es-CO,es-AR,es-CL,es-PE} presente na raiz e no frontend com aviso de risco, banner demo e termos por país", () => {
    const countries = ["pt-BR", "es-MX", "es-CO", "es-AR", "es-CL", "es-PE"];
    const namespaces = ["common.json", "auth.json", "wallet.json", "contracts.json", "admin.json"];

    for (const c of countries) {
      for (const ns of namespaces) {
        const rootFile = path.resolve(process.cwd(), "locales", c, ns);
        const webFile = path.resolve(process.cwd(), "apps/web/src/i18n/locales", c, ns);
        assert(fs.existsSync(rootFile), `Arquivo ausente em locales/${c}/${ns}`);
        assert(fs.existsSync(webFile), `Arquivo ausente em apps/web/src/i18n/locales/${c}/${ns}`);
      }

      const commonJson = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), "apps/web/src/i18n/locales", c, "common.json"), "utf8")
      );
      assert(typeof commonJson.demo_banner === "string" && commonJson.demo_banner.length > 5);
      assert(typeof commonJson.risk_warning === "string" && commonJson.risk_warning.length > 10);
      assert(typeof commonJson.legal?.terms_title === "string");
      assert(typeof commonJson.legal?.privacy_title === "string");
    }
  });

  it("Seção 3.1 & 10.1: Region Router detecta país por CF-IPCountry e possui fallback IP GeoIP", () => {
    assert.strictEqual(GeoBlockService.extractCountry({ headers: { "cf-ipcountry": "MX" } } as any), "MX");
    assert.strictEqual(GeoBlockService.resolveCountryFromIp("187.188.10.1"), "MX");
    assert.strictEqual(GeoBlockService.resolveCountryFromIp("181.48.10.1"), "CO");
    assert.strictEqual(GeoBlockService.resolveCountryFromIp("181.16.5.1"), "AR");
    assert.strictEqual(GeoBlockService.resolveCountryFromIp("190.45.1.1"), "CL");
    assert.strictEqual(GeoBlockService.resolveCountryFromIp("190.42.1.1"), "PE");
    assert.strictEqual(GeoBlockService.resolveCountryFromIp("177.10.1.1"), "BR");
  });

  it("Seção 3.2: As 10 Feature Flags obrigatórias da Fase 2 existem com os defaults exatos", () => {
    assert.deepStrictEqual(DEFAULT_SYSTEM_FEATURE_FLAGS, {
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
    });
  });

  it("Seção 6.1 & 7: Limites de stake por país e contas Ledger Demo por moeda", () => {
    const requiredCountries = ["BR", "MX", "CO", "AR", "CL", "PE"] as const;
    for (const c of requiredCountries) {
      assert(COUNTRY_STAKE_LIMITS[c].min_stake_minor > 0);
      assert(COUNTRY_STAKE_LIMITS[c].max_stake_minor > COUNTRY_STAKE_LIMITS[c].min_stake_minor);
    }

    assert.strictEqual(BlnkClient.getUserDemoAccount("u1", "available", "MXN"), "user:u1:demo:MXN:available");
    assert.strictEqual(BlnkClient.getUserDemoAccount("u1", "reserved", "COP"), "user:u1:demo:COP:reserved");
    assert.strictEqual(BlnkClient.getPlatformDemoAccount("liability", "ARS"), "platform:demo:ARS:liability");
    assert.strictEqual(BlnkClient.getPlatformDemoAccount("revenue", "CLP"), "platform:demo:CLP:revenue");
    assert.strictEqual(BlnkClient.getPlatformDemoAccount("payout", "PEN"), "platform:demo:PEN:payout");
  });

  it("Seção 8.1: Schemas de payment_methods, kyc_profiles (NOT_STARTED) e payment_intents validam", () => {
    assert.strictEqual(KYCStatusSchema.parse("NOT_STARTED"), "NOT_STARTED");
    const pm = PaymentMethodSpecSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      country_code: "BR",
      method: "pix",
      enabled: false,
      created_at: new Date().toISOString(),
    });
    assert.strictEqual(pm.enabled, false);

    const pi = PaymentIntentSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440001",
      user_id: "550e8400-e29b-41d4-a716-446655440002",
      country_code: "MX",
      currency: "MXN",
      amount_minor: 50000,
      method: "spei",
      status: "PENDING",
      psp_reference: "psp-demo-ref-001",
      created_at: new Date().toISOString(),
    });
    assert.strictEqual(pi.status, "PENDING");
  });

  it("Seção 12.1 & 12.2: Métricas Prometheus multi-país e 5 regras de alerta configuradas", () => {
    const metrics = RegionalMetricsService.getInstance();
    metrics.incrementContractCreated("SYNTH_VOL_50", "UP", "BR");
    metrics.incrementHttp5xx("/api/v1/contracts", 500, "MX");
    metrics.recordRegionLatency("CO", 42);
    metrics.setFlagStatus("PE", "country_pe_enabled", false);

    const prom = metrics.renderOpenMetrics();
    assert(prom.includes("broker_active_users"));
    assert(prom.includes("broker_contracts_by_country_total"));
    assert(prom.includes("broker_region_latency_p95_ms"));
    assert(prom.includes("broker_http_5xx_by_country_total"));
    assert(prom.includes("broker_feature_flag_changes_total"));

    const alertsYml = fs.readFileSync(path.resolve(process.cwd(), "infra/prometheus/phase2_alerts.yml"), "utf8");
    assert(alertsYml.includes("GeoblockingFailed"));
    assert(alertsYml.includes("OtcFeedStoppedInCountry"));
    assert(alertsYml.includes("HighRegionLatency"));
    assert(alertsYml.includes("High5xxErrorRateByCountry"));
    assert(alertsYml.includes("FeatureFlagChanged"));
  });
});
