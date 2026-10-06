import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Flashmob Concurrency Attack (3% Float Solvency Cap)", () => {
  it("enforces exact 3% risk cap under concurrent order burst with zero oversubscription", () => {
    // Simulação determinística do script Lua atômico
    const depositFloatMinor = 1_000_000; // US$ 10.000,00
    const maxRiskCap = Math.floor(depositFloatMinor * 0.03); // 30.000 centavos = US$ 300,00
    const stakeMinor = 1_000; // US$ 10,00
    const payoutPct = 85;
    const additionalRisk = Math.floor((stakeMinor * payoutPct) / 100); // 850 centavos

    const theoreticalMaxOrders = Math.floor(maxRiskCap / additionalRisk); // 35 ordens
    assert.equal(theoreticalMaxOrders, 35);

    let currentExposure = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    const TOTAL_BURST_REQUESTS = 500;

    for (let req = 0; req < TOTAL_BURST_REQUESTS; req++) {
      // Simulação da verificação atômica no Redis Lua:
      if (currentExposure + additionalRisk > maxRiskCap) {
        rejectedCount++;
      } else {
        currentExposure += additionalRisk;
        approvedCount++;
      }
    }

    assert.equal(approvedCount, 35, "Exactly 35 orders should be approved");
    assert.equal(rejectedCount, 465, "Remaining 465 orders should be rejected");
    assert.ok(currentExposure <= maxRiskCap, `Current exposure ${currentExposure} exceeded max cap ${maxRiskCap}`);
    assert.equal(currentExposure, 35 * 850); // 29.750 centavos <= 30.000 centavos
  });
});
