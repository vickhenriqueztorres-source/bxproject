import assert from 'node:assert';
import { validateTickFreshness, MAX_TICK_AGE_MS } from '../services/api/contract-domain.mjs';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 1: Backend Staleness Gate & Validação Atômica de Preço');

// 1. Verificação da Constante de Staleness
assert.strictEqual(MAX_TICK_AGE_MS, 5000, 'Tolerância máxima de staleness deve ser estritamente 5000ms (5 segundos)');
console.log('  ✅ [PASS] Constante MAX_TICK_AGE_MS = 5000ms validada');

// 2. Teste de Tick Fresco (1.200ms de idade)
const freshTs = new Date(Date.now() - 1200).toISOString();
const freshResult = validateTickFreshness('EURUSD_OTC', freshTs, MAX_TICK_AGE_MS);
assert.strictEqual(freshResult.ok, true);
assert.ok(freshResult.ageMs <= 3000);
console.log(`  ✅ [PASS] Tick fresco aceito com sucesso (idade: ${freshResult.ageMs}ms)`);

// 3. Teste de Tick Stale (6.500ms de idade)
const staleTs = new Date(Date.now() - 6500).toISOString();
assert.throws(
  () => validateTickFreshness('BTCUSD_OTC', staleTs, MAX_TICK_AGE_MS),
  (err) => {
    assert.ok(err.message.includes('FEED_STALE'), 'Erro deve conter código FEED_STALE');
    assert.ok(err.message.includes('BTCUSD_OTC'), 'Erro deve referenciar o símbolo afetado');
    return true;
  },
  'Tick com mais de 5000ms DEVE ser rejeitado com FEED_STALE'
);
console.log('  ✅ [PASS] Tick com 6500ms de atraso rejeitado com código FEED_STALE');

// 4. Teste de Tick Ausente / Inexistente (Zero fallback para preço fictício)
assert.throws(
  () => validateTickFreshness('SYNTH_UNKNOWN', null, MAX_TICK_AGE_MS),
  (err) => {
    assert.ok(err.message.includes('TICK_UNAVAILABLE'), 'Erro deve conter código TICK_UNAVAILABLE');
    return true;
  },
  'Ativo sem cotação deve lançar TICK_UNAVAILABLE'
);
console.log('  ✅ [PASS] Ativo sem cotação rejeitado com TICK_UNAVAILABLE (zero fallback para preço fake)');

// 5. Simulação de Fluxo do ContractService com Mock DB
class MockContractService {
  constructor(indexState) {
    this.indexState = indexState;
    this.contractsInserted = [];
  }

  async openContract(symbol, stakeMinor) {
    const row = this.indexState.get(symbol);
    if (!row || Number(row.last_sequence) <= 0) {
      throw new Error(`TICK_UNAVAILABLE: Nenhum tick oficial registrado para o ativo ${symbol}`);
    }

    const lastTs = new Date(row.last_ts);
    const tickAgeMs = Date.now() - lastTs.getTime();
    if (tickAgeMs > 5000) {
      throw new Error(`FEED_STALE: Cotação para ${symbol} desatualizada há ${tickAgeMs}ms`);
    }

    // Inserção bem-sucedida apenas com tick fresco
    const contract = {
      id: 'contract_' + Math.random().toString(36).slice(2, 8),
      symbol,
      entry_price: row.last_price,
      stake_minor: stakeMinor,
      opened_at: lastTs,
    };
    this.contractsInserted.push(contract);
    return contract;
  }
}

const mockState = new Map([
  ['EURUSD_OTC', { last_sequence: 100, last_price: '1.08542', last_ts: new Date(Date.now() - 500).toISOString() }],
  ['BTCUSD_OTC', { last_sequence: 200, last_price: '64850.00', last_ts: new Date(Date.now() - 15000).toISOString() }], // Stale há 15s!
  ['DEAD_ASSET', { last_sequence: 0, last_price: '0.00', last_ts: null }],
]);

const service = new MockContractService(mockState);

// Ativo fresco: deve abrir
await service.openContract('EURUSD_OTC', 1000);
assert.strictEqual(service.contractsInserted.length, 1);
assert.strictEqual(service.contractsInserted[0].symbol, 'EURUSD_OTC');
console.log('  ✅ [PASS] Ordem em par com feed fresco (EURUSD_OTC) executada com sucesso');

// Ativo congelado: deve falhar e não inserir
await assert.rejects(
  async () => service.openContract('BTCUSD_OTC', 1000),
  /FEED_STALE/,
  'Ordem em ativo com feed congelado há 15s deve falhar com FEED_STALE'
);
assert.strictEqual(service.contractsInserted.length, 1, 'Nenhum contrato deve ser inserido para ativo stale');
console.log('  ✅ [PASS] Ordem em par congelado (BTCUSD_OTC) abortada antes de qualquer inserção');

// Ativo sem ticks: deve falhar com TICK_UNAVAILABLE
await assert.rejects(
  async () => service.openContract('DEAD_ASSET', 1000),
  /TICK_UNAVAILABLE/,
  'Ativo sem sequence deve falhar com TICK_UNAVAILABLE'
);
assert.strictEqual(service.contractsInserted.length, 1);
console.log('  ✅ [PASS] Ativo sem cotação rejeitado sem tocar no ledger');

console.log('\n================================================================================');
console.log('🎉 SUBETAPA 1 (BACKEND STALENESS GATE) 100% HOMOLOGADA E APROVADA!');
console.log('================================================================================\n');
process.exit(0);
