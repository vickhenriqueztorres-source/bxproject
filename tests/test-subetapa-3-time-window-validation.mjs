import assert from 'node:assert';
import {
  validateCrossAssetSync,
  MAX_CROSS_ASSET_SKEW_MS,
  MAX_INDIVIDUAL_TICK_AGE_MS
} from '../services/api/dist/services/cross-asset-validator.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 3 (Cross-Sync): Janela de Tempo & Validação Cross-Asset');

async function runTests() {
  const now = Date.now();

  // Teste 1: Par Sincronizado (EURUSD vs BTCUSD com 150ms de diferença e idades frescas)
  const eurFresh = { symbol: 'EURUSD_OTC', event_time: now - 300, price: '1.0850' };
  const btcFresh = { symbol: 'BTCUSD_OTC', event_time: now - 450, price: '64800.00' };

  const resFresh = validateCrossAssetSync(eurFresh, btcFresh, MAX_CROSS_ASSET_SKEW_MS, now);
  assert.strictEqual(resFresh.synchronized, true);
  assert.strictEqual(resFresh.skewMs, 150);
  console.log('  ✅ [PASS] Par sincronizado validado: skew de 150ms (< 2000ms limite) aprovado');

  // Teste 2: Par Dessincronizado por Latência de Rota (BTC atualizado há 400ms, ETH atrasado há 3200ms)
  const btcFast = { symbol: 'BTCUSD_OTC', event_time: now - 400, price: '64800.00' };
  const ethLagged = { symbol: 'ETHUSD_OTC', event_time: now - 3200, price: '3450.00' };

  const resLag = validateCrossAssetSync(btcFast, ethLagged, MAX_CROSS_ASSET_SKEW_MS, now);
  assert.strictEqual(resLag.synchronized, false);
  assert.strictEqual(resLag.skewMs, 2800);
  assert.ok(resLag.error.includes('CROSS_ASSET_DESYNCHRONIZED'));
  console.log(`  ✅ [PASS] Par dessincronizado rejeitado com sucesso: skew de ${resLag.skewMs}ms (> 2000ms) bloqueado`);

  // Teste 3: Limites de Borda Exatos (2000ms vs 2001ms)
  const edgeBase = { symbol: 'EURUSD_OTC', event_time: now - 1000, price: '1.0850' };
  const edgeExact2000 = { symbol: 'GBPUSD_OTC', event_time: now - 3000, price: '1.2700' }; // exatamente 2000ms
  const edgeOver2001 = { symbol: 'GBPUSD_OTC', event_time: now - 3001, price: '1.2700' }; // 2001ms

  const resEdge2000 = validateCrossAssetSync(edgeBase, edgeExact2000, MAX_CROSS_ASSET_SKEW_MS, now);
  assert.strictEqual(resEdge2000.synchronized, true, 'Skew de exatamente 2000ms deve ser aceito na borda');

  const resEdge2001 = validateCrossAssetSync(edgeBase, edgeOver2001, MAX_CROSS_ASSET_SKEW_MS, now);
  assert.strictEqual(resEdge2001.synchronized, false, 'Skew de 2001ms deve ser rejeitado');
  console.log('  ✅ [PASS] Limiar de borda estrito comprovado: 2000ms aceito, 2001ms bloqueado');

  // Teste 4: Rejeição por Ativo Stale (> 5000ms) mesmo que o skew aparente fosse pequeno
  // Exemplo: Ambos os ativos congelaram há 6 segundos atrás (skew = 100ms, mas idades = 6100ms e 6000ms)
  const stale1 = { symbol: 'EURUSD_OTC', event_time: now - 6100, price: '1.0850' };
  const stale2 = { symbol: 'BTCUSD_OTC', event_time: now - 6000, price: '64800.00' };

  const resStale = validateCrossAssetSync(stale1, stale2, MAX_CROSS_ASSET_SKEW_MS, now);
  assert.strictEqual(resStale.synchronized, false);
  assert.ok(resStale.error.includes('TICK_STALE_EURUSD_OTC'));
  console.log('  ✅ [PASS] Proteção dupla: ativos congelados juntos bloqueados imediatamente por staleness individual');

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 3 (TIME-WINDOW CROSS-ASSET VALIDATION) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 3:', err);
  process.exit(1);
});
