import assert from 'node:assert';
import { RealMarketDataFeedAdapter, OTC_REAL_ASSETS_CONFIG } from '../services/tick-engine/dist/engine/real-feed-adapter.js';
import { HashChain } from '../services/tick-engine/dist/engine/hash-chain.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 4: Conector & Adapter de Feed Real para OTC Demo');

// 1. Verificação dos 4 Ativos OTC Reais Obrigatórios
const requiredPairs = ['BTCUSD_OTC', 'ETHUSD_OTC', 'EURUSD_OTC', 'XAUUSD_OTC'];
for (const sym of requiredPairs) {
  assert(OTC_REAL_ASSETS_CONFIG[sym], `Configuração do ativo ${sym} deve existir`);
}
assert.strictEqual(OTC_REAL_ASSETS_CONFIG.EURUSD_OTC.decimals, 5, 'EURUSD_OTC deve ter 5 decimais');
assert.strictEqual(OTC_REAL_ASSETS_CONFIG.BTCUSD_OTC.decimals, 2, 'BTCUSD_OTC deve ter 2 decimais');
console.log('  ✅ [PASS] Catálogo e precisões decimais dos 4 ativos OTC reais validados');

// 2. Verificação de Emissão e Precisão de Cotações
const eurAdapter = new RealMarketDataFeedAdapter('EURUSD_OTC');
const eurTick = await eurAdapter.getNextTickPrice();
assert.strictEqual(eurTick.isRealFeed, true);
assert.strictEqual(eurTick.circuitState, 'CLOSED');
assert.strictEqual(eurTick.priceString.split('.')[1].length, 5, 'EURUSD_OTC deve ter exatamente 5 decimais');
console.log('  ✅ [PASS] Cotação normalizada de mercado real emitida em estado CLOSED');

// 3. Verificação de Circuit Breaker e Contingência Estocástica Sob Falha
eurAdapter.setSimulatedExternalError(true);
for (let i = 0; i < 3; i++) await eurAdapter.getNextTickPrice();
assert.strictEqual(eurAdapter.getCircuitState(), 'OPEN');

const fallbackTick = await eurAdapter.getNextTickPrice();
assert.strictEqual(fallbackTick.isRealFeed, false, 'Deve comutar para fallback estocástico');
assert.strictEqual(fallbackTick.circuitState, 'OPEN');
assert.strictEqual(fallbackTick.priceString.split('.')[1].length, 5, 'Fallback deve manter 5 decimais');
console.log('  ✅ [PASS] Transição para OPEN e fallback estocástico imediato sem congelar o mercado validado');

// 4. Verificação de Integridade Criptográfica (Hash SHA-256)
const genesis = HashChain.computeGenesisHash('BTCUSD_OTC');
const ts = new Date();
const tickHash = HashChain.computeTickHash(genesis, 'BTCUSD_OTC', 1n, ts, '64250.00');
assert.strictEqual(tickHash.length, 64);
console.log('  ✅ [PASS] Cálculo de hash SHA-256 encadeado validado');

console.log('\n===============================================================');
console.log('🎉 QUALITY GATE 4 (GATE-F2-04) HOMOLOGADO COM 100% DE SUCESSO!');
console.log('===============================================================\n');
