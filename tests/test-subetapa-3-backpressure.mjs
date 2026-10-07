import assert from 'node:assert';
import { BackpressureGuard } from '../services/api/dist/services/backpressure.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 3 (Fan-Out): Backpressure & Proteção de Cliente Lento (64KB)');

async function runTests() {
  let simulatedTime = 1000000;
  const timeFn = () => simulatedTime;

  const guard = new BackpressureGuard({ maxBufferedBytes: 64 * 1024, slowClientTimeoutMs: 5000 }, timeFn);
  assert.strictEqual(guard.getMaxBufferedBytes(), 65536, 'Limite de buffer deve ser exatamente 64KB (65.536 bytes)');

  // 1. Cliente saudável (bufferedAmount = 2.048 bytes < 64KB)
  const healthySocket = {
    bufferedAmount: 2048,
    readyState: 1,
    closedCode: null,
    close(code) { this.closedCode = code; this.readyState = 3; }
  };
  assert.strictEqual(guard.shouldSend(healthySocket), true, 'Socket saudável deve receber mensagem normalmente');
  assert.strictEqual(guard.getPausedCount(), 0);
  console.log('  ✅ [PASS] Socket saudável com buffer < 64KB aprovado para envio imediato');

  // 2. Cliente com buffer saturado (70.000 bytes > 64KB)
  const slowSocket = {
    bufferedAmount: 70000,
    readyState: 1,
    closedCode: null,
    close(code) { this.closedCode = code; this.readyState = 3; }
  };
  assert.strictEqual(guard.shouldSend(slowSocket), false, 'Envio deve ser pausado quando buffer > 64KB');
  assert.strictEqual(guard.getPausedCount(), 1, 'Contador de sockets pausados deve ser 1');
  console.log('  ✅ [PASS] Backpressure ativo: envio pausado para socket com 70.000 bytes em buffer');

  // 3. Simulação de drenagem normal (buffer drena em 2 segundos)
  simulatedTime += 2000;
  slowSocket.bufferedAmount = 0; // Drenou pelo TCP
  guard.handleDrain(slowSocket);

  assert.strictEqual(guard.shouldSend(slowSocket), true, 'Envio deve ser retomado após drain');
  assert.strictEqual(guard.getPausedCount(), 0);
  console.log('  ✅ [PASS] Recuperação suave via drain: envio retomado assim que buffer esvaziou');

  // 4. Simulação de Cliente Tóxico Persistente (saturado por > 5s ininterruptos)
  const toxicSocket = {
    bufferedAmount: 85000,
    readyState: 1,
    closedCode: null,
    close(code, reason) { this.closedCode = code; this.closedReason = reason; this.readyState = 3; }
  };

  assert.strictEqual(guard.shouldSend(toxicSocket), false);
  assert.strictEqual(guard.getPausedCount(), 1);

  // Avança 5.001ms sem drenar
  simulatedTime += 5001;
  const allowedAfter5s = guard.shouldSend(toxicSocket);
  assert.strictEqual(allowedAfter5s, false);
  assert.strictEqual(toxicSocket.closedCode, 4429, 'Socket tóxico deve ser desconectado com código 4429');
  assert.strictEqual(toxicSocket.readyState, 3);
  assert.strictEqual(guard.getDisconnectedCount(), 1);
  console.log('  ✅ [PASS] Cliente tóxico purgado: conexão encerrada com código 4429 após 5s de saturação');

  // 5. Isolamento: múltiplos clientes saudáveis permanecem 100% funcionais
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(guard.shouldSend(healthySocket), true);
  }
  console.log('  ✅ [PASS] Isolamento total: purga do cliente lento não afetou sockets saudáveis');

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 3 (BACKPRESSURE CLIENT GUARD) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 3:', err);
  process.exit(1);
});
