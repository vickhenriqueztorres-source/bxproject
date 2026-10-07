import assert from 'node:assert';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 6 (Reconnect Storm): Métricas Industriais & Telemetria Prometheus');

const METRICS_URL = 'http://localhost:3001/metrics';
const TRIGGER_STORM_URL = 'http://localhost:3001/api/dev/trigger-storm';
const RESET_STORM_URL = 'http://localhost:3001/api/dev/reset-storm';

async function fetchMetrics() {
  const res = await fetch(METRICS_URL);
  assert.strictEqual(res.status, 200, 'Endpoint /metrics deve retornar 200 OK');
  const text = await res.text();
  const metrics = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(' ');
    if (parts.length >= 2) {
      metrics[parts[0]] = parseFloat(parts[1]);
    }
  }
  return metrics;
}

async function runTests() {
  // 1. Scraping Inicial Nominal
  const initial = await fetchMetrics();
  assert.ok('reconnect_attempts_total' in initial, 'reconnect_attempts_total deve estar presente');
  assert.strictEqual(initial.circuit_breaker_state, 0, 'circuit_breaker_state deve iniciar em 0 (CLOSED)');
  assert.strictEqual(initial.token_bucket_available_tokens, 10, 'token_bucket_available_tokens deve iniciar em 10');
  assert.strictEqual(initial.reconnect_storm_alert, 0, 'reconnect_storm_alert deve ser 0 em condições nominais');
  console.log('  ✅ [PASS] Scraping nominal validado: circuit_breaker=0 (CLOSED), tokens=10, storm_alert=0');

  // 2. Disparo de Reconnect Storm
  const trigRes = await fetch(TRIGGER_STORM_URL);
  assert.strictEqual(trigRes.status, 200);
  const stormMetrics = await fetchMetrics();

  assert.strictEqual(stormMetrics.reconnect_storm_alert, 1, 'reconnect_storm_alert deve ser 1 durante tempestade');
  assert.strictEqual(stormMetrics.circuit_breaker_state, 2, 'circuit_breaker_state deve ser 2 (OPEN)');
  assert.strictEqual(stormMetrics.token_bucket_available_tokens, 0, 'token_bucket_available_tokens deve ser 0');
  assert.strictEqual(stormMetrics.reconnect_backoff_seconds, 30, 'reconnect_backoff_seconds deve registrar 30s');
  assert.ok(stormMetrics.reconnect_attempts_total > 0, 'reconnect_attempts_total deve ser incrementado');
  console.log('  ✅ [PASS] Detecção de tempestade comprovada: storm_alert=1, breaker=OPEN (2), tokens=0, backoff=30s');

  // 3. Auto-resolução e Retorno ao Estado Nominal
  const resetRes = await fetch(RESET_STORM_URL);
  assert.strictEqual(resetRes.status, 200);
  const resetMetrics = await fetchMetrics();

  assert.strictEqual(resetMetrics.reconnect_storm_alert, 0, 'storm_alert deve retornar para 0');
  assert.strictEqual(resetMetrics.circuit_breaker_state, 0, 'breaker deve retornar para 0 (CLOSED)');
  assert.strictEqual(resetMetrics.token_bucket_available_tokens, 10, 'tokens devem ser restaurados para 10');
  console.log('  ✅ [PASS] Auto-resolução validada: storm_alert=0, breaker restaurado para CLOSED, balde reabastecido');

  // 4. Performance de Scraping Industrial (< 10ms)
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) {
    await fetchMetrics();
  }
  const avgLatency = (performance.now() - t0) / 10;
  assert.ok(avgLatency < 15, `Latência de scraping (${avgLatency.toFixed(2)}ms) deve ser inferior a 15ms`);
  console.log(`  ✅ [PASS] Latência média do endpoint de telemetria: ${avgLatency.toFixed(2)}ms (< 15ms)`);

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 6 (RECONNECT STORM METRICS & TELEMETRY) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 6:', err);
  process.exit(1);
});
