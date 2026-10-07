import assert from 'node:assert';
import { FeedCircuitBreaker } from '../services/api/dist/services/circuit-breaker.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 2 (Reconnect Storm): Circuit Breaker por Feed');

async function runTests() {
  let simulatedTime = 1000000;
  const timeFn = () => simulatedTime;

  // 1. Estado inicial CLOSED
  const cb = new FeedCircuitBreaker({ failureThreshold: 3, openDurationMs: 30000, halfOpenMaxAttempts: 1 }, timeFn);
  assert.strictEqual(cb.getState(), 'CLOSED');
  assert.strictEqual(cb.canExecute(), true);
  console.log('  ✅ [PASS] Estado inicial CLOSED com canExecute()=true');

  // 2. Falhas graduais até o threshold (3 falhas)
  cb.recordFailure(); // falha 1
  assert.strictEqual(cb.getState(), 'CLOSED');
  assert.strictEqual(cb.getConsecutiveFailures(), 1);
  assert.strictEqual(cb.canExecute(), true);

  cb.recordFailure(); // falha 2
  assert.strictEqual(cb.getState(), 'CLOSED');
  assert.strictEqual(cb.getConsecutiveFailures(), 2);
  assert.strictEqual(cb.canExecute(), true);

  cb.recordFailure(); // falha 3 -> ABRE O CIRCUITO
  assert.strictEqual(cb.getState(), 'OPEN');
  assert.strictEqual(cb.canExecute(), false);
  assert.strictEqual(cb.getTimeUntilRetryMs(), 30000);
  console.log('  ✅ [PASS] 3 falhas consecutivas dispararam transição para OPEN com bloqueio imediato');

  // 3. Bloqueio estrito durante o período OPEN (ex: 15s depois)
  simulatedTime += 15000;
  assert.strictEqual(cb.getState(), 'OPEN');
  assert.strictEqual(cb.canExecute(), false);
  assert.strictEqual(cb.getTimeUntilRetryMs(), 15000);
  console.log('  ✅ [PASS] Bloqueio estrito aos 15s de cooldown comprovado (15s restantes)');

  // 4. Transição automática para HALF-OPEN após 30.000ms
  simulatedTime += 15000; // agora 30.000ms decorridos
  assert.strictEqual(cb.getState(), 'HALF_OPEN');
  assert.strictEqual(cb.canExecute(), true, 'Deve permitir 1 tentativa em HALF_OPEN');
  cb.recordAttempt();
  assert.strictEqual(cb.canExecute(), false, 'Não deve permitir 2ª tentativa concorrente em HALF_OPEN');
  console.log('  ✅ [PASS] Transição aos 30s para HALF_OPEN permitindo exatamente 1 tentativa de teste');

  // 5. Falha no teste em HALF-OPEN reabre o circuito por mais 30s
  cb.recordFailure();
  assert.strictEqual(cb.getState(), 'OPEN');
  assert.strictEqual(cb.canExecute(), false);
  assert.strictEqual(cb.getTimeUntilRetryMs(), 30000);
  console.log('  ✅ [PASS] Falha em HALF_OPEN reabriu circuito por mais 30s');

  // 6. Avanço de mais 30s e sucesso no teste em HALF-OPEN fecha o circuito
  simulatedTime += 30000;
  assert.strictEqual(cb.getState(), 'HALF_OPEN');
  assert.strictEqual(cb.canExecute(), true);
  cb.recordAttempt();
  cb.recordSuccess(); // Sucesso no teste!
  assert.strictEqual(cb.getState(), 'CLOSED');
  assert.strictEqual(cb.canExecute(), true);
  assert.strictEqual(cb.getConsecutiveFailures(), 0);
  console.log('  ✅ [PASS] Sucesso em HALF_OPEN fechou o circuito para CLOSED e zerou falhas');

  // 7. Isolamento Multi-Ativo: Breaker do BTCUSD vs Breaker do EURUSD
  const cbBtc = new FeedCircuitBreaker({ failureThreshold: 3, openDurationMs: 30000 }, timeFn);
  const cbEur = new FeedCircuitBreaker({ failureThreshold: 3, openDurationMs: 30000 }, timeFn);

  cbBtc.recordFailure();
  cbBtc.recordFailure();
  cbBtc.recordFailure(); // BTC abre

  assert.strictEqual(cbBtc.getState(), 'OPEN');
  assert.strictEqual(cbEur.getState(), 'CLOSED');
  assert.strictEqual(cbBtc.canExecute(), false);
  assert.strictEqual(cbEur.canExecute(), true);
  console.log('  ✅ [PASS] Isolamento entre ativos comprovado: falha no BTCUSD não afeta EURUSD');

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 2 (CIRCUIT BREAKER POR FEED) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 2:', err);
  process.exit(1);
});
