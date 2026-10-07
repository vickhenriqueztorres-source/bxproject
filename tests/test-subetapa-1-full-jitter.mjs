import assert from 'node:assert';
import {
  calculateFullJitterDelay,
  DEFAULT_BASE_MS,
  DEFAULT_CAP_MS
} from '../services/api/dist/services/backoff.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 1 (Reconnect Storm): Exponential Backoff com Full Jitter');

async function runTests() {
  // 1. Verificação de constantes e defaults
  assert.strictEqual(DEFAULT_BASE_MS, 1000, 'Base deve ser de 1000ms');
  assert.strictEqual(DEFAULT_CAP_MS, 60000, 'Cap deve ser de 60000ms (60s)');
  console.log('  ✅ [PASS] Constantes canônicas validadas: base=1s, cap=60s');

  // 2. Teste de determinismo com função random injetada
  // random = 0.5 na tentativa 2 (max = 1000 * 2^2 = 4000) => 2000ms
  const dHalf = calculateFullJitterDelay(2, 1000, 60000, () => 0.5);
  assert.strictEqual(dHalf, 2000, 'Tentativa 2 com random 0.5 deve resultar em 2000ms');

  // random = 0.999 na tentativa 1 (max = 2000) => ~1998ms
  const dHigh = calculateFullJitterDelay(1, 1000, 60000, () => 0.999);
  assert.strictEqual(dHigh, 1998);

  // random = 0.0 => 0ms
  const dZero = calculateFullJitterDelay(3, 1000, 60000, () => 0.0);
  assert.strictEqual(dZero, 0);
  console.log('  ✅ [PASS] Determinismo e precisão aritmética da fórmula comprovados');

  // 3. Teste de Limites de Intervalo (Ceiling & Bounds) para 1.000 iterações por tentativa
  const attemptsToTest = [0, 1, 2, 3, 4, 5, 6, 10, 20];
  for (const att of attemptsToTest) {
    const theoreticalMax = Math.min(60000, 1000 * Math.pow(2, att));
    for (let i = 0; i < 1000; i++) {
      const delay = calculateFullJitterDelay(att);
      assert.ok(delay >= 0, `Delay deve ser >= 0 (recebido: ${delay})`);
      assert.ok(delay <= theoreticalMax, `Delay (${delay}) não pode exceder o teto teórico (${theoreticalMax}) para tentativa ${att}`);
      assert.ok(delay <= DEFAULT_CAP_MS, `Delay (${delay}) não pode exceder o CAP absoluto de 60s`);
    }
  }
  console.log('  ✅ [PASS] 9.000 amostras de borda testadas: zero violações de intervalo e teto de 60s respeitado');

  // 4. Prova Estatística de Des-correlação de Picos (10.000 clientes simultâneos)
  // Simula 10.000 conexões caindo juntas na tentativa 3 (janela [0, 8000ms])
  const SAMPLES = 10000;
  const buckets = new Array(8).fill(0); // 8 buckets de 1 segundo cada
  const allDelays = [];

  for (let i = 0; i < SAMPLES; i++) {
    const d = calculateFullJitterDelay(3); // max 8000ms
    allDelays.push(d);
    const bucketIdx = Math.min(7, Math.floor(d / 1000));
    buckets[bucketIdx]++;
  }

  // Comprova que cada segundo recebeu entre 8% e 18% das reconexões (distribuição uniforme esperada ~12.5%)
  for (let b = 0; b < 8; b++) {
    const pct = (buckets[b] / SAMPLES) * 100;
    assert.ok(pct >= 8 && pct <= 18, `Bucket ${b}s recebeu ${pct.toFixed(2)}% (esperado ~12.5% em Full Jitter)`);
  }
  console.log('  ✅ [PASS] Prova estatística com 10.000 clientes: pico síncrono transformado em fluxo plano e uniforme ao longo de 8s');

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 1 (EXPONENTIAL BACKOFF FULL JITTER) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 1:', err);
  process.exit(1);
});
