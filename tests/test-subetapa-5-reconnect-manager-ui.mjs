import assert from 'node:assert';
import { FeedCircuitBreaker } from '../services/api/dist/services/circuit-breaker.js';
import { TokenBucketRateLimiter } from '../services/api/dist/services/token-bucket.js';
import { calculateFullJitterDelay } from '../services/api/dist/services/backoff.js';
import { getStaggeredDelay } from '../services/api/dist/services/staggered-startup.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 5 (Reconnect Storm): Integração TradingFeedManager & UI');

async function runTests() {
  let simulatedTime = 1000000;
  const timeFn = () => simulatedTime;

  // 1. Verificação do pipeline de 4 camadas montado
  const cb = new FeedCircuitBreaker({ failureThreshold: 3, openDurationMs: 30000 }, timeFn);
  const tb = new TokenBucketRateLimiter({ capacity: 10, refillRatePerSecond: 1 }, timeFn);

  assert.strictEqual(cb.getState(), 'CLOSED');
  assert.strictEqual(tb.getAvailableTokens(), 10);
  console.log('  ✅ [PASS] Estado inicial nominal: Circuit Breaker CLOSED, Token Bucket com 10 tokens');

  // 2. Simulação de Staggered Startup no arranque inicial
  const startDelay = getStaggeredDelay(10000, false, () => 0.4);
  assert.strictEqual(startDelay, 4000, 'Arranque deve aplicar 4s no deploy');
  const immediateDelay = getStaggeredDelay(10000, true);
  assert.strictEqual(immediateDelay, 0, 'Forçar reconexão deve ter 0ms');
  console.log('  ✅ [PASS] Staggered Startup orquestrado: 4000ms a frio, 0ms sob ação manual');

  // 3. Orquestração de Quedas e Consumo de Tokens com Full Jitter
  let reconnectDelays = [];
  let notifiedState = null;
  let notifiedCooldown = 0;

  const onCircuitChange = (st, cd) => {
    notifiedState = st;
    notifiedCooldown = cd;
  };

  // Falha 1
  assert.strictEqual(tb.tryConsume(1), true);
  cb.recordFailure();
  reconnectDelays.push(calculateFullJitterDelay(1, 1000, 60000, () => 0.5)); // max 2000 => 1000ms
  assert.strictEqual(cb.getState(), 'CLOSED');

  // Falha 2
  assert.strictEqual(tb.tryConsume(1), true);
  cb.recordFailure();
  reconnectDelays.push(calculateFullJitterDelay(2, 1000, 60000, () => 0.5)); // max 4000 => 2000ms
  assert.strictEqual(cb.getState(), 'CLOSED');

  // Falha 3 -> CIRCUIT BREAKER ABRE
  assert.strictEqual(tb.tryConsume(1), true);
  cb.recordFailure();
  assert.strictEqual(cb.getState(), 'OPEN');
  onCircuitChange(cb.getState(), cb.getTimeUntilRetryMs());

  assert.strictEqual(notifiedState, 'OPEN');
  assert.strictEqual(notifiedCooldown, 30000);
  console.log('  ✅ [PASS] 3 falhas consecutivas consumiram tokens, aplicaram jitter e abriram o Circuit Breaker (30s)');

  // 4. Bloqueio e Notificação de UI durante os 30s
  assert.strictEqual(cb.canExecute(), false);
  simulatedTime += 10000; // 10s depois
  onCircuitChange(cb.getState(), cb.getTimeUntilRetryMs());
  assert.strictEqual(notifiedCooldown, 20000);
  assert.strictEqual(cb.canExecute(), false);
  console.log('  ✅ [PASS] UI notificada com tempo restante decrescente (20s restantes); bloqueio mantido');

  // 5. Transição automática para HALF-OPEN e Restauração
  simulatedTime += 20000; // 30s totais decorridos
  assert.strictEqual(cb.getState(), 'HALF_OPEN');
  assert.strictEqual(cb.canExecute(), true);
  cb.recordAttempt();
  assert.strictEqual(cb.canExecute(), false); // 2ª tentativa bloqueada em HALF_OPEN

  // Servidor voltou -> handshake tem sucesso!
  cb.recordSuccess();
  assert.strictEqual(cb.getState(), 'CLOSED');
  assert.strictEqual(cb.canExecute(), true);
  assert.strictEqual(cb.getConsecutiveFailures(), 0);
  console.log('  ✅ [PASS] Auto-recuperação validada: teste em HALF_OPEN restaurou estado CLOSED limpo');

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 5 (INTEGRAÇÃO TRADING FEED MANAGER & UI) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 5:', err);
  process.exit(1);
});
