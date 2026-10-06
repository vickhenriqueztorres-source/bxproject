import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { chartRoutes } from "../src/routes/chart.js";

describe("Chart API UDF Endpoints", () => {
  async function buildTestApp(mockQueryResult: any = { rows: [] }) {
    const app = Fastify();
    // Decorate mock pg
    app.decorate("pg", {
      query: async (sql: string, params: any[]) => {
        if (typeof mockQueryResult === "function") {
          return mockQueryResult(sql, params);
        }
        return mockQueryResult;
      }
    } as any);

    await app.register(chartRoutes);
    return app;
  }

  it("GET /api/v1/chart/config returns valid UDF configurations", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/chart/config"
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.deepEqual(body.supported_resolutions, ["1S", "1", "5", "15", "60"]);
    assert.equal(body.supports_time, true);
    await app.close();
  });

  it("GET /api/v1/chart/time returns current timestamp in seconds", async () => {
    const app = await buildTestApp();
    const beforeSec = Math.floor(Date.now() / 1000);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/chart/time"
    });
    const afterSec = Math.floor(Date.now() / 1000);

    assert.equal(res.statusCode, 200);
    const serverTime = parseInt(res.payload, 10);
    assert.ok(serverTime >= beforeSec && serverTime <= afterSec);
    await app.close();
  });

  it("GET /api/v1/chart/symbols returns symbol metadata", async () => {
    const app = await buildTestApp({
      rows: [{ symbol: "SYNTH_VOL_50", name: "Synthetic Volatility 50" }]
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/chart/symbols?symbol=SYNTH_VOL_50"
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.name, "SYNTH_VOL_50");
    assert.equal(body.ticker, "SYNTH_VOL_50");
    assert.equal(body.type, "synthetic");
    assert.equal(body.session, "24x7");
    await app.close();
  });

  it("GET /api/v1/chart/history returns bars formatted for TradingView UDF", async () => {
    const mockRows = [
      {
        bucket_start: "2026-10-06T14:00:00.000Z",
        open: "1.48510",
        high: "1.48550",
        low: "1.48480",
        close: "1.48520",
        volume: 115
      },
      {
        bucket_start: "2026-10-06T14:01:00.000Z",
        open: "1.48520",
        high: "1.48590",
        low: "1.48490",
        close: "1.48560",
        volume: 120
      }
    ];

    const app = await buildTestApp({ rows: mockRows });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/chart/history?symbol=SYNTH_VOL_50&resolution=1&from=1775483000&to=1775485000"
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.s, "ok");
    assert.equal(body.t.length, 2);
    assert.equal(body.o[0], 1.4851);
    assert.equal(body.h[0], 1.4855);
    assert.equal(body.l[0], 1.4848);
    assert.equal(body.c[0], 1.4852);
    assert.equal(body.v[0], 115);
    await app.close();
  });

  it("GET /api/v1/chart/history returns no_data when no bars exist in range", async () => {
    const app = await buildTestApp({ rows: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/chart/history?symbol=SYNTH_VOL_50&resolution=1&from=1775483000&to=1775485000"
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.s, "no_data");
    await app.close();
  });
});
