import assert from 'node:assert';
import { TickCoalescer } from '../services/api/dist/services/coalescer.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 2 (Fan-Out): Motor de Coalescing Temporal (Janela de 50ms)');

async function runTests() {
  const coalescer = new TickCoalescer({ windowMs: 50 });

  // 1. Rajada de 20 ticks síncronos injetados no mesmo instante (burst imediato)
  const emittedTicks = [];
  const onEmit = (tick) => emittedTicks.push(tick);

  for (let seq = 1; seq <= 20; seq++) {
    coalescer.push({
      symbol: 'BTCUSD_OTC',
      sequence: seq,
      price: (65000 + seq).toFixed(2),
      ts: new Date().toISOString(),
      event_time: Date.now() + seq
    }, onEmit);
  }

  // Imediatamente após a rajada, nenhum tick deve ter sido emitido ainda (timer de 50ms ativo)
  assert.strictEqual(emittedTicks.length, 0, 'Nenhum tick deve ser emitido de imediato antes de 50ms');

  // Aguarda 70ms para a janela de 50ms expirar e o timer disparar
  await new Promise(r => setTimeout(r, 70));

  // 2. Verificação de emissão única e tick mais fresco
  assert.strictEqual(emittedTicks.length, 1, 'Exatamente 1 tick consolidado deve ser emitido');
  const delivered = emittedTicks[0];
  assert.strictEqual(delivered.symbol, 'BTCUSD_OTC');
  assert.strictEqual(delivered.sequence, 20, 'O tick emitido deve ser o 20º (o mais recente da rajada)');
  assert.strictEqual(delivered.price, '65020.00');
  assert.strictEqual(coalescer.getDroppedCount(), 19, 'Exatamente 19 ticks intermediários devem ter sido descartados');
  assert.strictEqual(coalescer.getEmittedCount(), 1);

  console.log('  ✅ [PASS] Rajada de 20 ticks em burst coalescida em 1 emissão única (tick seq 20 entregue, 19 descartados)');

  // 3. Isolamento entre múltiplos ativos simultâneos (BTC vs ETH)
  const multiEmitted = [];
  const multiEmitCb = (tick) => multiEmitted.push(tick);

  for (let i = 1; i <= 5; i++) {
    coalescer.push({ symbol: 'BTCUSD_OTC', sequence: 100 + i, price: '66000', ts: '' }, multiEmitCb);
    coalescer.push({ symbol: 'ETHUSD_OTC', sequence: 200 + i, price: '3500', ts: '' }, multiEmitCb);
  }

  await new Promise(r => setTimeout(r, 70));

  const btcFinal = multiEmitted.find(t => t.symbol === 'BTCUSD_OTC');
  const ethFinal = multiEmitted.find(t => t.symbol === 'ETHUSD_OTC');

  assert.ok(btcFinal && ethFinal, 'Ambos os símbolos devem ser emitidos independentemente');
  assert.strictEqual(btcFinal.sequence, 105);
  assert.strictEqual(ethFinal.sequence, 205);

  console.log('  ✅ [PASS] Coalescing multi-ativo isolado: BTC (seq 105) e ETH (seq 205) entregues sem interferência cruzada');

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 2 (TICK COALESCING ENGINE) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 2:', err);
  process.exit(1);
});
