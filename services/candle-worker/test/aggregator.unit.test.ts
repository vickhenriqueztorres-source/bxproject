import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TimeframeAggregator, TIMEFRAMES } from "../src/aggregator/timeframe-aggregator.js";

describe("TimeframeAggregator (OHLCV Calculation)", () => {
  it("calculates correct UTC bucket starts for 1s, 1m and 5m", () => {
    // 2026-10-06T14:02:45.350Z
    const ts = new Date("2026-10-06T14:02:45.350Z");

    const bucket1s = TimeframeAggregator.calculateBucketStart(ts, TIMEFRAMES["1s"]);
    assert.equal(bucket1s.toISOString(), "2026-10-06T14:02:45.000Z");

    const bucket1m = TimeframeAggregator.calculateBucketStart(ts, TIMEFRAMES["1m"]);
    assert.equal(bucket1m.toISOString(), "2026-10-06T14:02:00.000Z");

    const bucket5m = TimeframeAggregator.calculateBucketStart(ts, TIMEFRAMES["5m"]);
    assert.equal(bucket5m.toISOString(), "2026-10-06T14:00:00.000Z");
  });

  it("handles boundary tick at exact minute boundary :00.000Z", () => {
    const tsExact = new Date("2026-10-06T14:03:00.000Z");
    const bucket1m = TimeframeAggregator.calculateBucketStart(tsExact, TIMEFRAMES["1m"]);
    assert.equal(bucket1m.toISOString(), "2026-10-06T14:03:00.000Z");
  });

  it("correctly simulates OHLCV progression over sequential ticks", () => {
    const prices = ["1.485000", "1.485500", "1.484800", "1.485200"];
    let open = prices[0];
    let high = parseFloat(prices[0]);
    let low = parseFloat(prices[0]);
    let close = prices[0];
    let volume = 0;

    for (const p of prices) {
      const pNum = parseFloat(p);
      if (pNum > high) high = pNum;
      if (pNum < low) low = pNum;
      close = p;
      volume++;
    }

    assert.equal(open, "1.485000");
    assert.equal(high, 1.4855);
    assert.equal(low, 1.4848);
    assert.equal(close, "1.485200");
    assert.equal(volume, 4);
  });
});
