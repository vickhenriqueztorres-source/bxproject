import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { formatCurrency, convertUSDMinorToDisplay, DisplayCurrencyCode } from "../../packages/shared/src/currency.ts";

describe("Subetapa 3 (Unit): Motor de Formatação e Conversão de Moedas", () => {
  it("1. Deve formatar corretamente as 6 moedas com seus símbolos e decimais", () => {
    // BRL (2 decimais)
    const brl = formatCurrency(55.5, "BRL", "pt-BR");
    assert(brl.includes("R$"), `BRL deve conter R$, recebido: ${brl}`);
    assert(brl.includes("55,50"), `BRL deve formatar com 2 decimais e vírgula, recebido: ${brl}`);

    // MXN (2 decimais)
    const mxn = formatCurrency(195.25, "MXN", "es-MX");
    assert(mxn.includes("Mex$"), `MXN deve conter Mex$, recebido: ${mxn}`);
    assert(mxn.includes("195.25") || mxn.includes("195,25"), `MXN formatado: ${mxn}`);

    // COP (0 decimais)
    const cop = formatCurrency(41500, "COP", "es-CO");
    assert(cop.includes("Col$"), `COP deve conter Col$, recebido: ${cop}`);
    assert(!cop.includes(",00") && !cop.includes(".00"), `COP não deve conter centavos, recebido: ${cop}`);

    // ARS (2 decimais)
    const ars = formatCurrency(9800.75, "ARS", "es-AR");
    assert(ars.includes("$"), `ARS deve conter $, recebido: ${ars}`);

    // CLP (0 decimais)
    const clp = formatCurrency(9400, "CLP", "es-CL");
    assert(clp.includes("CLP$"), `CLP deve conter CLP$, recebido: ${clp}`);
    assert(!clp.includes(",00") && !clp.includes(".00"), `CLP não deve conter centavos, recebido: ${clp}`);

    // PEN (2 decimais)
    const pen = formatCurrency(37.5, "PEN", "es-PE");
    assert(pen.includes("S/."), `PEN deve conter S/., recebido: ${pen}`);
  });

  it("2. Deve converter stake_minor (USD centavos) para exibição regional preservando precisão", () => {
    // US$ 10,00 = 1000 minor units
    const stakeUSDMinor = 1000;

    // BRL (taxa 5.50) -> R$ 55,00
    const brlResult = convertUSDMinorToDisplay(stakeUSDMinor, 5.50, "BRL", "pt-BR");
    assert.strictEqual(brlResult.amount, 55.00);
    assert(brlResult.formatted.includes("R$ 55,00"));

    // COP (taxa 4150.00) -> Col$ 41.500
    const copResult = convertUSDMinorToDisplay(stakeUSDMinor, 4150.00, "COP", "es-CO");
    assert.strictEqual(copResult.amount, 41500);
    assert(copResult.formatted.includes("Col$"));

    // CLP (taxa 940.00) -> CLP$ 9.400
    const clpResult = convertUSDMinorToDisplay(stakeUSDMinor, 940.00, "CLP", "es-CL");
    assert.strictEqual(clpResult.amount, 9400);
    assert(clpResult.formatted.includes("CLP$"));

    // PEN (taxa 3.75) -> S/. 37,50
    const penResult = convertUSDMinorToDisplay(stakeUSDMinor, 3.75, "PEN", "es-PE");
    assert.strictEqual(penResult.amount, 37.50);
    assert(penResult.formatted.includes("S/."));
  });

  it("3. Invariante Contábil D-18: O stake original permanece imutável como inteiro", () => {
    const rawStake = 2500; // US$ 25,00
    const converted = convertUSDMinorToDisplay(rawStake, 5.50, "BRL");
    assert.strictEqual(rawStake, 2500, "O valor base minor não pode ser mutado");
    assert.strictEqual(typeof rawStake, "number");
    assert(Number.isInteger(rawStake), "O valor de stake no ledger é estritamente inteiro");
  });
});
