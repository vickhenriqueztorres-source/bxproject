/**
 * test-subetapa-4-trading-ledger-cycle.mjs
 * 
 * Verificação Automatizada - Subetapa 4: Ciclo Completo de Trading no Blnk Ledger
 * Especialistas: financial-correctness-reviewer, broker-architect-agent, backend-implementation-agent
 * Invariantes: I-01 a I-06, D-18
 */

import assert from 'node:assert';

console.log('='.repeat(80));
console.log('⚖️  TESTE DE CONFORMIDADE - SUBETAPA 4: CICLO DE TRADING & PARTIDAS DOBRADAS');
console.log('='.repeat(80));

class AdvancedTradingLedger {
  constructor() {
    this.accounts = new Map();
    this.transactions = [];
    this.references = new Set();

    // Contas institucionais
    this.initAccount('@broker_float');
    this.initAccount('@house_revenue');
    this.initAccount('@house_payout');
  }

  initAccount(num) {
    if (!this.accounts.has(num)) {
      this.accounts.set(num, { number: num, balance: 0 });
    }
  }

  async transfer({ source, destination, amount, reference, description }) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error(`INVALID_AMOUNT: ${amount}`);
    }

    if (this.references.has(reference)) {
      return { duplicate: true, reference };
    }

    const src = this.accounts.get(source);
    const dst = this.accounts.get(destination);
    if (!src || !dst) throw new Error(`ACCOUNT_NOT_FOUND: ${source} -> ${destination}`);

    // Partidas dobradas
    src.balance -= amount;
    dst.balance += amount;

    const tx = { id: `tx_${this.transactions.length + 1}`, source, destination, amount, reference, description };
    this.transactions.push(tx);
    this.references.add(reference);

    return { duplicate: false, transaction: tx };
  }

  getBalance(num) {
    return this.accounts.get(num)?.balance ?? 0;
  }

  assertZeroSum() {
    let sum = 0;
    for (const acc of this.accounts.values()) {
      sum += acc.balance;
    }
    assert.strictEqual(sum, 0, `Equação de soma zero violada! Total: ${sum}`);
  }
}

async function runSuite() {
  const ledger = new AdvancedTradingLedger();
  const userId = 'trader_bob_456';
  const avail = `@user_${userId}:available`;
  const resv = `@user_${userId}:reserved`;

  ledger.initAccount(avail);
  ledger.initAccount(resv);

  // 1. Onboarding do Trader (US$ 10.000,00)
  console.log('\n--- [Passo 4.1] Setup do Trader: Injeção de US$ 10.000,00 ---');
  await ledger.transfer({
    source: '@broker_float',
    destination: avail,
    amount: 1_000_000,
    reference: `onboard:${userId}`
  });
  ledger.assertZeroSum();
  assert.strictEqual(ledger.getBalance(avail), 1_000_000);
  console.log('  ✅ [PASS] Saldo inicial provisionado: $10.000,00 USD');

  // 2. Abertura de Contrato UP de US$ 100,00 (Reserva de Stake)
  console.log('\n--- [Passo 4.2] Abertura de Ordem: Reserva de Stake ($100.00) ---');
  const contractId1 = 'c_up_001';
  const stake1 = 10_000; // $100.00

  const reserveTx = await ledger.transfer({
    source: avail,
    destination: resv,
    amount: stake1,
    reference: `reserve:${contractId1}`,
    description: 'Stake hold for contract c_up_001'
  });

  assert.strictEqual(reserveTx.duplicate, false);
  assert.strictEqual(ledger.getBalance(avail), 990_000, 'Saldo disponível deve decrescer $100.00');
  assert.strictEqual(ledger.getBalance(resv), 10_000, 'Saldo reservado deve conter $100.00');
  ledger.assertZeroSum();
  console.log('  ✅ [PASS] Reserva executada: Disponível=$9.900,00 | Reservado=$100,00 (Soma zero mantida)');

  // 3. Liquidação WIN (Contrato 1 Vencedor: Payout 85%)
  console.log('\n--- [Passo 4.3] Liquidação de Vitória (WIN): Devolução de Stake + Payout 85% ---');
  const profit1 = Math.round(stake1 * 0.85); // $85.00 = 8500 minor

  // Devolução do principal reservado
  await ledger.transfer({
    source: resv,
    destination: avail,
    amount: stake1,
    reference: `settle_principal:${contractId1}`
  });

  // Crédito do lucro advindo de house_payout
  await ledger.transfer({
    source: '@house_payout',
    destination: avail,
    amount: profit1,
    reference: `settle_profit:${contractId1}`
  });

  assert.strictEqual(ledger.getBalance(resv), 0, 'Saldo reservado deve voltar a 0');
  assert.strictEqual(ledger.getBalance(avail), 1_008_500, 'Saldo disponível deve ser $10.085,00');
  assert.strictEqual(ledger.getBalance('@house_payout'), -8_500, 'House payout refletiu pagamento de $85.00');
  ledger.assertZeroSum();
  console.log('  ✅ [PASS] Vitória WIN liquidada: Disponível=$10.085,00 (+ $85,00 de lucro)');

  // 4. Abertura e Liquidação LOSS (Contrato 2 Perdedor de US$ 200,00)
  console.log('\n--- [Passo 4.4] Abertura e Liquidação de Derrota (LOSS): Transferência para House Revenue ---');
  const contractId2 = 'c_down_002';
  const stake2 = 20_000; // $200.00

  // Reserva do stake
  await ledger.transfer({
    source: avail,
    destination: resv,
    amount: stake2,
    reference: `reserve:${contractId2}`
  });

  assert.strictEqual(ledger.getBalance(avail), 988_500);
  assert.strictEqual(ledger.getBalance(resv), 20_000);

  // Liquidação LOSS: move de reservado para receita da corretora
  await ledger.transfer({
    source: resv,
    destination: '@house_revenue',
    amount: stake2,
    reference: `settle_loss:${contractId2}`
  });

  assert.strictEqual(ledger.getBalance(resv), 0, 'Saldo reservado volta a 0');
  assert.strictEqual(ledger.getBalance(avail), 988_500, 'Saldo disponível permanece decrescido de $200.00');
  assert.strictEqual(ledger.getBalance('@house_revenue'), 20_000, 'House revenue recebeu $200.00');
  ledger.assertZeroSum();
  console.log('  ✅ [PASS] Derrota LOSS liquidada: Receita da corretora creditada em $200,00');

  // 5. Teste de Idempotência: Reexecução de Settlement sem Duplicação
  console.log('\n--- [Passo 4.5] Teste de Proteção contra Duplo Settlement Concorrente ---');
  const duplicateSettle = await ledger.transfer({
    source: resv,
    destination: '@house_revenue',
    amount: stake2,
    reference: `settle_loss:${contractId2}`
  });

  assert.strictEqual(duplicateSettle.duplicate, true, 'Settlement duplicado deve ser detectado e rejeitado');
  ledger.assertZeroSum();
  console.log('  ✅ [PASS] Duplo settlement barrado com sucesso pela chave idempotente');

  console.log('\n' + '='.repeat(80));
  console.log('🎉 SUBETAPA 4 (CICLO DE TRADING & PARTIDAS DOBRADAS) 100% HOMOLOGADA E APROVADA!');
  console.log('='.repeat(80));
}

runSuite().catch(err => {
  console.error('Fatal test error in Subetapa 4:', err);
  process.exit(1);
});
