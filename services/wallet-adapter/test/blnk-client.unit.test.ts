import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BlnkClient } from "../src/blnk-client.js";

describe("BlnkClient Unit Tests", () => {
  it("initializes client with default demo balance and ledger ID", () => {
    const client = new BlnkClient("http://localhost:5001");
    assert.equal(client.LEDGER_ID, "broker_demo");
    assert.equal(client.DEMO_START_BALANCE_MINOR, 1_000_000); // US$ 10.000,00
    assert.equal(client.HOUSE_REVENUE, "@house_revenue");
    assert.equal(client.HOUSE_PAYOUT, "@house_payout");
    assert.equal(client.BROKER_FLOAT, "@broker_float");
  });

  it("formats idempotent transaction reference patterns properly", () => {
    const contractId = "11111111-1111-1111-1111-111111111111";
    const userId = "22222222-2222-2222-2222-222222222222";

    const reserveRef = `reserve:${contractId}`;
    const winRef = `settlement:${contractId}:WIN_STAKE`;
    const lossRef = `settlement:${contractId}:LOSS`;
    const onboardingRef = `onboarding:${userId}`;

    assert.equal(reserveRef, "reserve:11111111-1111-1111-1111-111111111111");
    assert.equal(winRef, "settlement:11111111-1111-1111-1111-111111111111:WIN_STAKE");
    assert.equal(lossRef, "settlement:11111111-1111-1111-1111-111111111111:LOSS");
    assert.equal(onboardingRef, "onboarding:22222222-2222-2222-2222-222222222222");
  });
});
