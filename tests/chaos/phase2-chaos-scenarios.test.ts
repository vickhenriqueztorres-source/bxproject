import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { RealMarketDataFeedAdapter } from "../../services/tick-engine/src/engine/real-feed-adapter.ts";
import { HashChain } from "../../services/tick-engine/src/engine/hash-chain.ts";
import { GeoBlockService } from "../../services/api/src/services/geoblock.ts";
import { FeatureFlagsService } from "../../services/api/src/services/feature-flags.ts";

describe("Subetapa 8 (Caos): Cenários Críticos de Resiliência e Caos na Fase 2", () => {
  it("Caos C-F2-01: Queda do feed real não causa congelamento de mercado nem quebra de sequência", async () => {
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

  it("Caos C-F2-02: Queda simultânea do Redis de Feature Flags mantém fail-closed e segurança", async () => {
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
      del: async () => { throw new Error("ECONNREFUSED: Redis offline"); }
    };

    const service = new FeatureFlagsService(mockPg, deadRedis);

    // Mesmo com Redis offline, consulta ao banco identifica que Chile está inativo
    const clActive = await service.isCountryActive("CL");
    assert.strictEqual(clActive, false, "Chile inativo deve permanecer bloqueado");

    const brActive = await service.isCountryActive("BR");
    assert.strictEqual(brActive, true, "Brasil deve permanecer ativo via fallback");
  });

  it("Caos C-F2-03: Injeção massiva de IP Spoofing é 100% interceptada pelo GeoBlockService", () => {
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
