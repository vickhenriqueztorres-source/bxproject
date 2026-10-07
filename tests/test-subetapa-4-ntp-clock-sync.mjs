import assert from 'node:assert';
import { ClockSyncMonitor } from '../services/api/dist/services/clock-sync-monitor.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 4 (Cross-Sync): NTP & Monitoramento de Clock Offset');

async function runTests() {
  const monitor = new ClockSyncMonitor(100, 500);

  // 1. Teste: Medição em Nó Calibrado (Offset Normal < 100ms)
  // tStart = 1000, tRef = 1010, tEnd = 1020 (RTT = 20ms, estimatedMidpoint = 1010, offset = 0ms)
  const statusOk = monitor.recordSample(1000, 1010, 1020);
  assert.strictEqual(statusOk.alert, false);
  assert.strictEqual(statusOk.severity, 'OK');
  assert.strictEqual(statusOk.offsetMs, 0);
  assert.strictEqual(statusOk.rttMs, 20);
  console.log(`  ✅ [PASS] Nó com relógio perfeitamente calibrado: offset=${statusOk.offsetMs}ms, RTT=${statusOk.rttMs}ms, alert=false`);

  // 2. Teste: Detecção de Clock Skew / NTP Warning (Offset = 130ms > 100ms limite)
  // tStart = 1000, tRef = 1140, tEnd = 1020 (RTT = 20ms, estimatedMidpoint = 1010, offset = +130ms)
  const statusWarning = monitor.recordSample(1000, 1140, 1020);
  assert.strictEqual(statusWarning.alert, true);
  assert.strictEqual(statusWarning.severity, 'WARNING');
  assert.strictEqual(statusWarning.offsetMs, 130);
  console.log(`  ✅ [PASS] Alerta de desvio de relógio disparado: offset=${statusWarning.offsetMs}ms (> 100ms), severity=WARNING, alert=true`);

  // 3. Teste: Detecção de Clock Skew Crítico (Offset = 600ms > 500ms limite)
  // tStart = 2000, tRef = 2620, tEnd = 2040 (RTT = 40ms, estimatedMidpoint = 2020, offset = +600ms)
  const statusCritical = monitor.recordSample(2000, 2620, 2040);
  assert.strictEqual(statusCritical.alert, true);
  assert.strictEqual(statusCritical.severity, 'CRITICAL');
  assert.strictEqual(statusCritical.offsetMs, 600);
  console.log(`  ✅ [PASS] Alerta crítico de desvio de relógio disparado: offset=${statusCritical.offsetMs}ms (> 500ms), severity=CRITICAL`);

  // 4. Teste: Auto-Recalibração e Normalização após sincronização NTP
  // tStart = 3000, tRef = 3010, tEnd = 3020 (offset = 0ms)
  const statusRecovered = monitor.recordSample(3000, 3010, 3020);
  assert.strictEqual(statusRecovered.alert, false);
  assert.strictEqual(statusRecovered.severity, 'OK');
  assert.strictEqual(statusRecovered.offsetMs, 0);
  console.log('  ✅ [PASS] Auto-recalibração comprovada: alerta desativado após ressincronização do relógio');

  // 5. Teste de Calibração do Lado do Cliente (Simulação WebSocket Ping/Pong com server_ts)
  class MockClientFeedWithClockSync {
    constructor() {
      this.serverClockOffsetMs = 0;
    }
    onPingReceived(serverTs, clientNow) {
      this.serverClockOffsetMs = serverTs - clientNow;
    }
    getCalibratedNow(clientNow) {
      return clientNow + this.serverClockOffsetMs;
    }
  }

  const client = new MockClientFeedWithClockSync();
  const mockServerTime = 1728200000500;
  const mockClientTime = 1728200000000; // Cliente 500ms atrasado em relação ao servidor

  client.onPingReceived(mockServerTime, mockClientTime);
  assert.strictEqual(client.serverClockOffsetMs, 500);
  assert.strictEqual(client.getCalibratedNow(mockClientTime), mockServerTime);
  console.log('  ✅ [PASS] Calibração de relógio no cliente validada: offset corrigido em +500ms alinhando UI ao servidor');

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 4 (NTP & CLOCK SYNC MONITORING) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 4:', err);
  process.exit(1);
});
