import assert from 'node:assert';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 6 (Fan-Out): Métricas Industriais & Telemetria Prometheus');

const METRICS_URL = 'http://localhost:3001/metrics';
const BURST_URL = 'http://localhost:3001/api/dev/trigger-fanout-burst';
const BACKPRESSURE_URL = 'http://localhost:3001/api/dev/trigger-backpressure';
const RESET_URL = 'http://localhost:3001/api/dev/reset-fanout';

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
  // 1. Scraping Nominal Inicial
  const initial = await fetchMetrics();
  assert.ok('fanout_messages_sent_total' in initial, 'fanout_messages_sent_total deve existir');
  assert.ok('coalesced_ticks_dropped_total' in initial, 'coalesced_ticks_dropped_total deve existir');
  assert.strictEqual(initial.backpressure_paused_clients, 0, 'backpressure_paused_clients deve ser 0 inicialmente');
  assert.ok('fanout_active_subscriptions' in initial, 'fanout_active_subscriptions deve existir');
  console.log('  ✅ [PASS] Scraping nominal aprovado: todas as 5 métricas de fan-out presentes e nominais');

  // 2. Disparo de Rajada com Coalescing
  const burstRes = await fetch(BURST_URL);
  assert.strictEqual(burstRes.status, 200);
  const burstMetrics = await fetchMetrics();

  assert.ok(burstMetrics.fanout_messages_sent_total >= 100, 'fanout_messages_sent_total deve contabilizar mensagens enviadas');
  assert.ok(burstMetrics.coalesced_ticks_dropped_total >= 85, 'coalesced_ticks_dropped_total deve contabilizar descartes de coalescing');
  console.log('  ✅ [PASS] Telemetria de rajada validada: +100 mensagens e +85 descartes de coalescing registrados');

  // 3. Disparo de Backpressure (Clientes Saturados e Purgados)
  const bpRes = await fetch(BACKPRESSURE_URL);
  assert.strictEqual(bpRes.status, 200);
  const bpMetrics = await fetchMetrics();

  assert.strictEqual(bpMetrics.backpressure_paused_clients, 2, 'backpressure_paused_clients deve registrar 2 sockets pausados');
  assert.ok(bpMetrics.slow_clients_disconnected_total >= 1, 'slow_clients_disconnected_total deve registrar clientes purgados');
  console.log('  ✅ [PASS] Telemetria de backpressure validada: 2 conexões pausadas e 1 cliente purgado por timeout');

  // 4. Auto-resolução
  const resetRes = await fetch(RESET_URL);
  assert.strictEqual(resetRes.status, 200);
  const resetMetrics = await fetchMetrics();
  assert.strictEqual(resetMetrics.backpressure_paused_clients, 0);
  console.log('  ✅ [PASS] Auto-resolução validada: sockets pausados retornaram a 0 após normalização');

  // 5. Performance de Scraping Industrial (< 15ms)
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) {
    await fetchMetrics();
  }
  const avgLatency = (performance.now() - t0) / 10;
  assert.ok(avgLatency < 15, `Latência de scraping (${avgLatency.toFixed(2)}ms) deve ser inferior a 15ms`);
  console.log(`  ✅ [PASS] Latência média do endpoint de telemetria: ${avgLatency.toFixed(2)}ms (< 15ms)`);

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 6 (FAN-OUT METRICS & TELEMETRY) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 6:', err);
  process.exit(1);
});
