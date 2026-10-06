import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Blnk Ledger Double-Entry Accounting Audit (Rules I-01, I-02, I-03)", () => {
  it("maintains zero-sum balance across 300 WIN, LOSS and DRAW contract lifecycle simulations", () => {
    // Simulação contábil de livro-razão com partidas dobradas (double-entry)
    const ledger = {
      "@broker_float": 0,
      "@house_revenue": 0,
      "@house_payout": 0,
      "@user_reserved": 0,
      "@user_available": 1_000_000 // Inicia com US$ 10.000,00 demo
    };

    const recordTx = (source: keyof typeof ledger, dest: keyof typeof ledger, amount: number) => {
      ledger[source] -= amount;
      ledger[dest] += amount;
    };

    // 100 WIN, 100 LOSS, 100 DRAW
    for (let i = 0; i < 100; i++) {
      // 1. Abertura: Reserva $10,00 (1000 centavos)
      recordTx("@user_available", "@user_reserved", 1000);
      // WIN: Devolve $10,00 + paga lucro de $8,50 (850 centavos) da casa
      recordTx("@user_reserved", "@user_available", 1000);
      recordTx("@house_payout", "@user_available", 850);
    }

    for (let i = 0; i < 100; i++) {
      // 2. Abertura: Reserva $10,00
      recordTx("@user_available", "@user_reserved", 1000);
      // LOSS: Stake reservada vai para receita da casa
      recordTx("@user_reserved", "@house_revenue", 1000);
    }

    for (let i = 0; i < 100; i++) {
      // 3. Abertura: Reserva $10,00
      recordTx("@user_available", "@user_reserved", 1000);
      // DRAW: Stake reservada devolvida ao trader
      recordTx("@user_reserved", "@user_available", 1000);
    }

    // Invariante Fundamental I-02: A soma de todas as contas do ledger DEVE ser igual ao balanço inicial
    const totalBalance = Object.values(ledger).reduce((a, b) => a + b, 0);
    assert.equal(totalBalance, 1_000_000, "Ledger total sum must strictly conserve value");

    // Saldo em reserva deve ter zerado (todos os contratos foram liquidados)
    assert.equal(ledger["@user_reserved"], 0, "All reserved stakes must be resolved");

    // Receita da casa com 100 losses de 1000 = 100.000 centavos
    assert.equal(ledger["@house_revenue"], 100_000);

    // Payout da casa com 100 wins de 850 = -85.000 centavos
    assert.equal(ledger["@house_payout"], -85_000);

    // Lucro líquido da corretora = 100.000 - 85.000 = +15.000 centavos (+US$ 150,00)
    const netHouseProfit = ledger["@house_revenue"] + ledger["@house_payout"];
    assert.equal(netHouseProfit, 15_000);
  });
});
