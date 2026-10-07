import assert from 'node:assert';
import {
  getStaggeredDelay,
  MAX_STAGGERED_DELAY_MS
} from '../services/api/dist/services/staggered-startup.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 4 (Reconnect Storm): Staggered Startup');

async function runTests() {
  // 1. Constante padrão
  assert.strictEqual(MAX_STAGGERED_DELAY_MS, 10000, 'Atraso máximo escalonado deve ser de 10s (10000ms)');
  console.log('  ✅ [PASS] Constante MAX_STAGGERED_DELAY_MS validada em 10.000ms');

  // 2. Bypass imediato (forceImmediate = true)
  const immediate = getStaggeredDelay(10000, true);
  assert.strictEqual(immediate, 0, 'Bypass deve resultar em exatamente 0ms');
  console.log('  ✅ [PASS] Bypass imediato validado: conexões manuais do usuário ocorrem em 0ms');

  // 3. Determinismo com random injetado
  assert.strictEqual(getStaggeredDelay(10000, false, () => 0.5), 5000);
  assert.strictEqual(getStaggeredDelay(10000, false, () => 0.0), 0);
  assert.strictEqual(getStaggeredDelay(10000, false, () => 0.999), 9990);
  console.log('  ✅ [PASS] Aritmética de retardo determinístico comprovada');

  // 4. Teste de dispersão no deploy: 1.000 clientes simulados
  const CLIENTS = 1000;
  const buckets = new Array(10).fill(0); // 10 buckets de 1 segundo cada

  for (let i = 0; i < CLIENTS; i++) {
    const delay = getStaggeredDelay(10000, false);
    assert.ok(delay >= 0 && delay <= 10000, `Delay (${delay}) fora do intervalo [0, 10000ms]`);
    const bucket = Math.min(9, Math.floor(delay / 1000));
    buckets[bucket]++;
  }

  // Verifica que cada bucket de 1s recebeu entre 6% e 14% das conexões (esperado ~10%)
  for (let b = 0; b < 10; b++) {
    const pct = (buckets[b] / CLIENTS) * 100;
    assert.ok(pct >= 6 && pct <= 14, `Bucket ${b}s recebeu ${pct.toFixed(1)}% (esperado ~10%)`);
  }
  console.log('  ✅ [PASS] Dispersão de deploy comprovada: 1.000 clientes distribuídos uniformemente ao longo dos 10 segundos');

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 4 (STAGGERED STARTUP) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 4:', err);
  process.exit(1);
});
