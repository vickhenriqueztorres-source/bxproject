import assert from 'node:assert';
import { SymbolShardingRouter } from '../services/api/dist/services/sharding.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 5 (Fan-Out): Sharding por Símbolo (Escala Horizontal)');

async function runTests() {
  const SYMBOLS = [
    'EURUSD_OTC', 'GBPUSD_OTC', 'USDJPY_OTC', 'AUDUSD_OTC', 'USDCAD_OTC', 'USDCHF_OTC',
    'NZDUSD_OTC', 'EURGBP_OTC', 'EURJPY_OTC', 'GBPJPY_OTC', 'BTCUSD_OTC', 'ETHUSD_OTC',
    'SOLUSD_OTC', 'XRPUSD_OTC', 'ADAUSD_OTC', 'DOGEUSD_OTC', 'DOTUSD_OTC', 'AVAXUSD_OTC',
    'LINKUSD_OTC', 'LTCUSD_OTC', 'XAUUSD_OTC', 'XAGUSD_OTC', 'USOIL_OTC', 'UKOIL_OTC',
    'SPX500_OTC', 'NAS100_OTC', 'US30_OTC', 'GER40_OTC', 'UK100_OTC', 'JPN225_OTC',
    'VOL10_OTC', 'VOL25_OTC', 'VOL50_OTC', 'VOL75_OTC', 'VOL100_OTC', 'CRASH500_OTC'
  ];
  assert.strictEqual(SYMBOLS.length, 36);

  // 1. Modo Single-Node Fallback (1 nó)
  const singleRouter = new SymbolShardingRouter(1);
  for (const s of SYMBOLS) {
    assert.strictEqual(singleRouter.getNodeIndex(s), 0, 'Em nó único, todos devem apontar para o nó 0');
  }
  console.log('  ✅ [PASS] Fallback single-node validado: 36 ativos direcionados ao nó 0 com zero sobrecarga');

  // 2. Particionamento entre 3 nós Redis (Cluster com 3 instâncias)
  const clusterRouter = new SymbolShardingRouter(3);
  const nodeDistribution = [0, 0, 0];

  for (const s of SYMBOLS) {
    const nodeIdx = clusterRouter.getNodeIndex(s);
    assert.ok(nodeIdx >= 0 && nodeIdx < 3, `Índice de nó (${nodeIdx}) fora do intervalo [0, 2]`);
    nodeDistribution[nodeIdx]++;
  }

  // Verifica que os 36 ativos foram distribuídos de forma equilibrada (média 12 por nó)
  for (let n = 0; n < 3; n++) {
    const count = nodeDistribution[n];
    assert.ok(count >= 8 && count <= 16, `Nó ${n} recebeu ${count} ativos (esperado ~12 para distribuição balanceada)`);
  }
  console.log(`  ✅ [PASS] Homogeneidade comprovada entre 3 nós: [${nodeDistribution.join(', ')}] ativos por nó`);

  // 3. Determinismo Absoluto (10.000 iterações repetidas)
  const initialBtcNode = clusterRouter.getNodeIndex('BTCUSD_OTC');
  const initialEthNode = clusterRouter.getNodeIndex('ETHUSD_OTC');
  for (let i = 0; i < 10000; i++) {
    assert.strictEqual(clusterRouter.getNodeIndex('BTCUSD_OTC'), initialBtcNode);
    assert.strictEqual(clusterRouter.getNodeIndex('ETHUSD_OTC'), initialEthNode);
  }
  console.log('  ✅ [PASS] Determinismo absoluto comprovado: 10.000 iterações sem desvios de nó');

  // 4. Mapeamento de canal canônico
  const mapping = clusterRouter.getChannelForSymbol('BTCUSD_OTC');
  assert.strictEqual(mapping.channel, 'market:ticks:BTCUSD_OTC');
  assert.strictEqual(mapping.nodeIndex, initialBtcNode);
  console.log(`  ✅ [PASS] Resolução de canal canônico validada: ${mapping.channel} -> Nó ${mapping.nodeIndex}`);

  console.log('\n================================================================================');
  console.log('🎉 SUBETAPA 5 (SYMBOL SHARDING ROUTER) 100% HOMOLOGADA E APROVADA!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Falha no teste da Subetapa 5:', err);
  process.exit(1);
});
