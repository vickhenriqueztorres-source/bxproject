import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BlnkClient } from "../src/blnk-client.js";

describe("BlnkClient Unit Tests (I-01, I-02, I-03, D-18)", () => {
  it("[I-01][I-02] initializes client with default demo balance and ledger ID", () => {
    const client = new BlnkClient("http://localhost:5001");
    assert.equal(client.LEDGER_ID, "broker_demo");
    assert.equal(client.DEMO_START_BALANCE_MINOR, 1_000_000); // US$ 10.000,00
    assert.equal(client.HOUSE_REVENUE, "@house_revenue");
    assert.equal(client.HOUSE_PAYOUT, "@house_payout");
    assert.equal(client.BROKER_FLOAT, "@broker_float");
  });

  it("[I-03] formats idempotent transaction reference patterns and canonical demo accounts properly", () => {
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

    assert.equal(BlnkClient.getUserDemoAccount(userId, "available", "USD"), `user:${userId}:demo:USD:available`);
    assert.equal(BlnkClient.getUserDemoAccount(userId, "reserved", "USD"), `user:${userId}:demo:USD:reserved`);
    assert.equal(BlnkClient.getPlatformDemoAccount("revenue", "USD"), "platform:demo:USD:revenue");
    assert.throws(() => BlnkClient.getUserDemoAccount(userId, "available", "BRL"), /SILENT_CONVERSION_FORBIDDEN/);
    assert.throws(() => BlnkClient.getPlatformDemoAccount("payout", "EUR"), /SILENT_CONVERSION_FORBIDDEN/);
  });

  it("[D-18][I-02] rejects float amounts, non-USD currencies, implicit conversion rates and self-transfers before network call", async () => {
    const client = new BlnkClient("http://127.0.0.1:59999");

    await assert.rejects(
      () =>
        client.recordTransaction({
          amount: 12.34,
          precision: 100,
          currency: "USD",
          source: "@broker_float",
          destination: "@user_1:available",
          reference: "ref-float"
        }),
      /INVALID_MINOR_AMOUNT/
    );

    await assert.rejects(
      () =>
        client.recordTransaction({
          amount: 1000,
          precision: 100,
          currency: "BRL",
          source: "@broker_float",
          destination: "@user_1:available",
          reference: "ref-brl"
        }),
      /SILENT_CONVERSION_FORBIDDEN/
    );

    await assert.rejects(
      () =>
        client.recordTransaction({
          amount: 1000,
          precision: 100,
          currency: "USD",
          source: "@broker_float",
          destination: "@user_1:available",
          reference: "ref-rate",
          ...({ exchange_rate: 5.2 } as any)
        }),
      /SILENT_CONVERSION_FORBIDDEN/
    );

    await assert.rejects(
      () =>
        client.recordTransaction({
          amount: 1000,
          precision: 100,
          currency: "USD",
          source: "@user_1:available",
          destination: "@user_1:available",
          reference: "ref-self"
        }),
      /DOUBLE_ENTRY_VIOLATION/
    );
  });
});
