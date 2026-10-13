import { describe, it } from "vitest";
import assert from "node:assert/strict";
import Fastify from "../../services/api/node_modules/fastify/fastify.js";
import { currencyRoutes } from "../../services/api/src/routes/currencies.ts";

async function buildTestCurrencyServer() {
  const app = Fastify();

  const mockCurrencies = [
    { code: "BRL", symbol: "R$", name: "Real Brasileiro", decimals: 2, exchange_rate_to_usd: "5.500000" },
    { code: "MXN", symbol: "Mex$", name: "Peso Mexicano", decimals: 2, exchange_rate_to_usd: "19.500000" },
    { code: "COP", symbol: "Col$", name: "Peso Colombiano", decimals: 0, exchange_rate_to_usd: "4150.000000" },
    { code: "ARS", symbol: "$", name: "Peso Argentino", decimals: 2, exchange_rate_to_usd: "980.000000" },
    { code: "CLP", symbol: "CLP$", name: "Peso Chileno", decimals: 0, exchange_rate_to_usd: "940.000000" },
    { code: "PEN", symbol: "S/.", name: "Sol Peruano", decimals: 2, exchange_rate_to_usd: "3.750000" }
  ];

  const mockPg: any = {
    query: async (sql: string) => {
      if (sql.includes("FROM display_currencies")) {
        return { rows: mockCurrencies };
      }
      return { rows: [] };
    }
  };

  const redisMap = new Map<string, string>();
  const mockRedis: any = {
    get: async (k: string) => redisMap.get(k) || null,
    set: async (k: string, v: string) => { redisMap.set(k, v); return "OK"; },
    del: async (k: string) => { redisMap.delete(k); return 1; }
  };

  app.decorate("pg", mockPg);
  app.decorate("redis", mockRedis);

  await app.register(currencyRoutes);
  return app;
}

describe("Subetapa 3 (Integration): Endpoints de Moedas de Exibição e Conversão", () => {
  it("1. GET /api/v1/currencies retorna as 6 moedas cadastradas", async () => {
    const app = await buildTestCurrencyServer();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/currencies"
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.currencies.length, 6);
    const codes = body.currencies.map((c: any) => c.code).sort();
    assert.deepStrictEqual(codes, ["ARS", "BRL", "CLP", "COP", "MXN", "PEN"]);
  });

  it("2. POST /api/v1/currencies/convert converte US$ 10.00 (1000 centavos) para BRL", async () => {
    const app = await buildTestCurrencyServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/currencies/convert",
      payload: {
        stake_minor: 1000,
        currency: "BRL",
        locale: "pt-BR"
      }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.stake_minor_usd, 1000);
    assert.strictEqual(body.usd_nominal, "10.00");
    assert.strictEqual(body.currency, "BRL");
    assert.strictEqual(body.display_amount, 55.00);
    assert(body.display_formatted.includes("R$ 55,00"));
  });

  it("3. POST /api/v1/currencies/convert rejeita moeda inválida ou campos extras", async () => {
    const app = await buildTestCurrencyServer();

    // Moeda inválida (EUR não é permitida como moeda de exibição na Fase 2)
    const resInvalidCurrency = await app.inject({
      method: "POST",
      url: "/api/v1/currencies/convert",
      payload: {
        stake_minor: 1000,
        currency: "EUR"
      }
    });
    assert.strictEqual(resInvalidCurrency.statusCode, 400);

    // Campo extra proibido (.strict)
    const resExtraField = await app.inject({
      method: "POST",
      url: "/api/v1/currencies/convert",
      payload: {
        stake_minor: 1000,
        currency: "BRL",
        malicious_field: "bypass"
      }
    });
    assert.strictEqual(resExtraField.statusCode, 400);
  });
});
