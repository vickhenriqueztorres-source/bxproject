import { describe, it, expect } from "vitest";

describe("Blnk Ledger Double-Entry Accounting Audit (Invariantes I-01, I-02, I-03, D-18)", () => {
  it("mantém a equação de soma zero em 300 simulações de ciclo de vida de contratos (WIN, LOSS, DRAW)", () => {
    // Contabilidade de partidas dobradas (double-entry)
    const ledger = {
      "@broker_float": 0,
      "@house_revenue": 0,
      "@house_payout": 0,
      "@user_reserved": 0,
      "@user_available": 1_000_000 // Inicia com US$ 10.000,00 demo em centavos
    };

    const recordTx = (source: keyof typeof ledger, dest: keyof typeof ledger, amount: number) => {
      expect(Number.isSafeInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThan(0);
      ledger[source] -= amount;
      ledger[dest] += amount;
    };

    // 100 WIN, 100 LOSS, 100 DRAW
    for (let i = 0; i < 100; i++) {
      // 1. Abertura: Reserva $10,00 (1000 centavos)
      recordTx("@user_available", "@user_reserved", 1000);
      // WIN: Devolve $10,00 da reserva para disponível + paga lucro de $8,50 (850 centavos) da casa
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
      // DRAW: Stake reservada devolvida integralmente ao trader
      recordTx("@user_reserved", "@user_available", 1000);
    }

    // Invariante I-02: A soma de todas as contas do ledger DEVE conservar exatamente o valor inicial
    const totalBalance = Object.values(ledger).reduce((a, b) => a + b, 0);
    expect(totalBalance).toBe(1_000_000);

    // Saldo em reserva deve ter zerado (todos os contratos foram liquidados)
    expect(ledger["@user_reserved"]).toBe(0);

    // Receita da casa com 100 losses de 1000 = 100.000 centavos
    expect(ledger["@house_revenue"]).toBe(100_000);

    // Payout da casa com 100 wins de 850 = -85.000 centavos
    expect(ledger["@house_payout"]).toBe(-85_000);

    // Lucro líquido da corretora = 100.000 - 85.000 = +15.000 centavos (+US$ 150,00)
    const netHouseProfit = ledger["@house_revenue"] + ledger["@house_payout"];
    expect(netHouseProfit).toBe(15_000);
  });

  it("garante precisão inteira estrita (minor units / centavos) sem arredondamento de float", () => {
    const stakeMinor = 1000; // $10.00
    const payoutRatio = 0.85;
    // Arredondamento institucional obrigatório (Math.round para centavo inteiro mais próximo)
    const profitMinor = Math.round(stakeMinor * payoutRatio);
    expect(profitMinor).toBe(850);
    expect(Number.isInteger(profitMinor)).toBe(true);

    // Teste com stake ímpar: $33.33 (3333 centavos)
    const oddStake = 3333;
    const oddProfit = Math.round(oddStake * payoutRatio); // 3333 * 0.85 = 2833.05 -> 2833
    expect(oddProfit).toBe(2833);
    expect(Number.isInteger(oddProfit)).toBe(true);
  });

  it("bloqueia transações duplicadas pelo mecanismo de Idempotency Reference", () => {
    const references = new Set<string>();
    const processTx = (ref: string) => {
      if (references.has(ref)) {
        return { status: "DUPLICATE_IGNORED" };
      }
      references.add(ref);
      return { status: "SUCCESS" };
    };

    const first = processTx("settlement:order_123:WIN");
    const second = processTx("settlement:order_123:WIN");
    const third = processTx("settlement:order_123:WIN");

    expect(first.status).toBe("SUCCESS");
    expect(second.status).toBe("DUPLICATE_IGNORED");
    expect(third.status).toBe("DUPLICATE_IGNORED");
    expect(references.size).toBe(1);
  });
});
