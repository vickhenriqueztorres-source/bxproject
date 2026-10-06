import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CatchupHandler } from "../src/handlers/catchup-handler.js";

describe("CatchupHandler (lastSequence Resync Protocol)", () => {
  it("returns no ticks when client is already at latest sequence", async () => {
    const mockRedis = {
      xrevrange: async () => [
        ["entry-1", ["symbol", "SYNTH_VOL_50", "sequence", "500", "price", "1.48520", "ts", new Date().toISOString()]]
      ]
    };

    const handler = new CatchupHandler(mockRedis as any);
    const result = await handler.getCatchupTicks("SYNTH_VOL_50", 500n);

    assert.equal(result.resyncRequired, false);
    assert.equal(result.ticks.length, 0);
  });

  it("returns pending ticks when gap is within buffer (gap <= 1000)", async () => {
    const mockRedis = {
      xrevrange: async (key: string, start: string, end: string, countOpt: string, count: number) => {
        if (count === 1) {
          return [["entry-2", ["symbol", "SYNTH_VOL_50", "sequence", "502", "price", "1.48550", "ts", new Date().toISOString()]]];
        }
        return [
          ["entry-2", ["symbol", "SYNTH_VOL_50", "sequence", "502", "price", "1.48550", "ts", new Date().toISOString()]],
          ["entry-1", ["symbol", "SYNTH_VOL_50", "sequence", "501", "price", "1.48530", "ts", new Date().toISOString()]]
        ];
      }
    };

    const handler = new CatchupHandler(mockRedis as any);
    const result = await handler.getCatchupTicks("SYNTH_VOL_50", 500n);

    assert.equal(result.resyncRequired, false);
    assert.equal(result.ticks.length, 2);
    assert.equal(result.ticks[0].sequence, "501");
    assert.equal(result.ticks[1].sequence, "502");
  });

  it("requires full resync when gap exceeds 1000 ticks", async () => {
    const mockRedis = {
      xrevrange: async () => [
        ["entry-latest", ["symbol", "SYNTH_VOL_50", "sequence", "2500", "price", "1.48500", "ts", new Date().toISOString()]]
      ]
    };

    const handler = new CatchupHandler(mockRedis as any);
    // Cliente em 1000, último em 2500 -> gap de 1500 > 1000
    const result = await handler.getCatchupTicks("SYNTH_VOL_50", 1000n);

    assert.equal(result.resyncRequired, true);
    assert.equal(result.ticks.length, 0);
  });
});
