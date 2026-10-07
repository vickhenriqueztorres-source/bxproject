import assert from 'node:assert';
import { TokenBucketRateLimiter } from '../services/api/dist/services/token-bucket.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 3 (Reconnect Storm): Token Bucket Rate Limiter');

async function runTests() {
  let simulatedTime = 1000000;
  const timeFn = () => simulatedTime;

  // 1. Inicialização com capacidade padrão de 10 tokens
  const bucket = new TokenBucketRateLimiter({ capacity: 10, refillRatePerSecond: 1 }, timeFn);
  assert.strictEqual(bucket.getAvailableTokens(), 10, 'Balde deve iniciar cheio com 10 tokens');
  console.log('  ✅ [PASS] Balde inicializado com capacidade de 10 tokens');

  // 2. Consumo imediato dos 10 tokens
  for (let i = 1; i <= 10; i++) {
    const consumed = bucket.tryConsume(1);
    assert.strictEqual(consumed, true, `Token ${i} deve ser consumido`);
  }
  assert.strictEqual(bucket.getAvailableTokens(), 0, 'Balde deve estar vazio após 10 consumos');
  console.log('  ✅ [PASS] Rajada inicial de 10 consumos permitida com sucesso');

  // 3. Rejeição com balde vazio (sem avanço de tempo)
  const rejected = bucket.tryConsume(1);
  assert.strictEqual(rejected, false, 'Consumo deve ser rejeitado quando o balde está vazio');
  console.log('  ✅ [PASS] Tentativa 11 rejeitada no mesmo instante (proteção de vazão ativa)');

  // 4. Reposição temporal gradual
  // Avança 1 segundo (+1000ms) -> exatamente 1 token disponível
  simulatedTime += 1000;
  assert.strictEqual(bucket.getAvailableTokens(), 1);
  assert.strictEqual(bucket.tryConsume(1), true);
  assert.strictEqual(bucket.tryConsume(1), false);
  console.log('  ✅ [PASS] Reposição de 1 token aos 1000ms comprovada');

  // Avança 5 segundos (+5000ms) -> 5 tokens disponíveis
  simulatedTime += 5000;
  assert.strictEqual(bucket.getAvailableTokens(), 5);
  console.log('  ✅ [PASS] Reposição de 5 tokens aos 5000ms comprovada');

  // 5. Teto de capacidade (Cap não pode ultrapassar 10)
  simulatedTime += 20000; // +20 segundos
  assert.strictEqual(bucket.getAvailableTokens(), 10, 'Balde não pode ultrapassar a capacidade máxima de 10');
  console.log('  ✅ [PASS] Teto de saturação respeitado: balde permaneceu limitado a 10 tokens');

  // 6. Teste de Rajada Concorrente de 50 Requisições (Burst Test)
  bucket.reset();
  let immediateCount = 0;
  let rejectedCount = 0;

  for (let req = 1; req <= 50; req++) {
    if (bucket.tryConsume(1)) {
      immediateCount++;
    } else {
      rejectedCount++;
    }
  }

  assert.strictEqual(immediateCount, 10, 'Exatamente 10 requisições devem passar na rajada');
  assert.strictEqual(rejectedCount, 40, 'Exatamente 40 requisições devem ser retidas');
  console.log(`  ✅ [PASS] Burst Test de 50 requisições: 10 executadas imediatamente e 40 amortecidas`);

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 3 (TOKEN BUCKET RATE LIMITER) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 3:', err);
  process.exit(1);
});
