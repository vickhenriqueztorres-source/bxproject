import { describe, test } from 'node:test';
import assert from 'node:assert';

/**
 * BUG-2: Payout Configurável por Ativo
 *
 * Testa que o payout é configurável por ativo e capturado no momento
 * da abertura do contrato (snapshot pattern).
 *
 * Correções aplicadas:
 * - Migration 0070: adiciona coluna payout_pct na tabela contracts
 * - ASSETS_CONFIG: adiciona payout_pct para todos os 36 ativos
 * - Endpoint /api/indices/:symbol retorna payout_pct do config
 * - Abertura captura payout_pct do config no momento (linha ~2715)
 * - Liquidação usa payout_pct gravado no contrato (linha ~2802)
 */

describe('BUG-2: Payout Configurável por Ativo', () => {
  test('[DOC] Migration 0070 adiciona coluna payout_pct', () => {
    console.log('\n=== VERIFICAÇÃO DA MIGRATION ===\n');
    console.log('1. Verificar que migration existe:');
    console.log('   ls -la D:\\brokerproject\\db\\migrations\\0070_payout_per_asset.*.sql');
    console.log('');
    console.log('2. Aplicar migration:');
    console.log('   psql -d binmax -f db/migrations/0070_payout_per_asset.up.sql');
    console.log('');
    console.log('3. Verificar coluna criada:');
    console.log('   psql -d binmax -c "\\d contracts"');
    console.log('   # Deve mostrar: payout_pct | integer | default 85');
    console.log('');
    console.log('4. Verificar índice criado:');
    console.log('   psql -d binmax -c "\\di idx_contracts_payout_pct"');
    console.log('');
  });

  test('[DOC] ASSETS_CONFIG contém payout_pct para todos os ativos', () => {
    console.log('\n=== VERIFICAÇÃO DO ASSETS_CONFIG ===\n');
    console.log('1. Grep por payout_pct no config:');
    console.log('   grep -c "payout_pct:" D:\\brokerproject\\scripts\\dev-live-feed.mjs');
    console.log('   # Esperado: 36 (todos os ativos)');
    console.log('');
    console.log('2. Verificar que nenhum ativo ficou sem payout_pct:');
    console.log('   # Contar ativos em ASSETS_CONFIG');
    console.log('   grep -A 50 "const ASSETS_CONFIG" D:\\brokerproject\\scripts\\dev-live-feed.mjs | grep -c "symbol:"');
    console.log('   # Deve ser igual ao count de payout_pct');
    console.log('');
  });

  test('[MANUAL] Endpoint /api/indices/:symbol retorna payout_pct correto', async () => {
    console.log('\n=== TESTE MANUAL DO ENDPOINT ===\n');
    console.log('1. Testar endpoint para VOL_50:');
    console.log('   curl http://localhost:3001/api/indices/VOL_50');
    console.log('');
    console.log('2. Esperado:');
    console.log('   {');
    console.log('     "symbol": "VOL_50",');
    console.log('     "canonical_symbol": "VOL_50",');
    console.log('     "status": "ACTIVE",');
    console.log('     "name": "VOL_50",');
    console.log('     "precision": 4,');
    console.log('     "payout_pct": 85  // <-- DEVE ESTAR PRESENTE');
    console.log('   }');
    console.log('');
    console.log('3. Testar outros ativos:');
    console.log('   curl http://localhost:3001/api/indices/EURUSD_OTC');
    console.log('   curl http://localhost:3001/api/indices/BTCUSD_OTC');
    console.log('   # Todos devem retornar payout_pct: 85');
    console.log('');
  });

  test('[MANUAL] Contrato novo captura payout_pct no momento da abertura', async () => {
    console.log('\n=== TESTE MANUAL DA CAPTURA ===\n');
    console.log('1. Abrir contrato:');
    console.log('   curl -X POST http://localhost:3001/contracts \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -H "Authorization: Bearer <token>" \\');
    console.log('     -H "Idempotency-Key: test-bug2-capture-$(date +%s)" \\');
    console.log('     -d \'{"symbol": "VOL_50", "direction": "UP", "stake_minor": 100000, "duration_seconds": 60}\'');
    console.log('');
    console.log('2. Capturar contract_id da resposta');
    console.log('');
    console.log('3. Verificar que payout_pct foi gravado:');
    console.log('   psql -d binmax -c "SELECT id, symbol, payout_pct FROM contracts WHERE id = \'<contract_id>\';"');
    console.log('');
    console.log('4. Esperado:');
    console.log('   payout_pct | 85');
    console.log('');
  });

  test('[MANUAL] Liquidação usa payout_pct gravado no contrato', async () => {
    console.log('\n=== TESTE MANUAL DA LIQUIDAÇÃO ===\n');
    console.log('## Cenário 1: Contrato WIN com payout_pct=85');
    console.log('1. Abrir contrato com stake_minor=100000 (1000.00)');
    console.log('2. Aguardar expiração (60 segundos)');
    console.log('3. Se WIN, verificar payout:');
    console.log('   psql -d binmax -c "SELECT id, stake_minor, payout_minor, payout_pct FROM contracts WHERE id = \'<contract_id>\';"');
    console.log('');
    console.log('4. Esperado:');
    console.log('   stake_minor  | 100000');
    console.log('   payout_minor | 185000  (100000 * 1.85)');
    console.log('   payout_pct   | 85');
    console.log('');
    console.log('## Cenário 2: Contrato DRAW retorna stake');
    console.log('1. (Difícil simular, requer preço de saída = preço de entrada)');
    console.log('2. Se DRAW, payout_minor deve ser igual a stake_minor');
    console.log('');
    console.log('## Cenário 3: Contrato LOSS tem payout zero');
    console.log('1. Abrir contrato que vai perder');
    console.log('2. Se LOSS, payout_minor = 0');
    console.log('');
  });

  test('[REGRESSION] Contratos antigos liquidam com DEFAULT payout_pct=85', async () => {
    console.log('\n=== TESTE DE RETROCOMPATIBILIDADE ===\n');
    console.log('1. Identificar contratos criados ANTES da migration:');
    console.log('   psql -d binmax -c "SELECT id, created_at, payout_pct FROM contracts WHERE payout_pct IS NULL OR payout_pct = 85 ORDER BY created_at ASC LIMIT 5;"');
    console.log('');
    console.log('2. Migration deve ter preenchido com DEFAULT 85');
    console.log('   # Contratos antigos: payout_pct = 85');
    console.log('   # Contratos novos: payout_pct = <valor do config no momento>');
    console.log('');
    console.log('3. Verificar que liquidação funciona para contratos antigos:');
    console.log('   # Código usa: const payoutPct = target.payout_pct || 85;');
    console.log('   # Se payout_pct for NULL (impossível com DEFAULT), usa 85');
    console.log('');
  });

  test('[DOC] Grep final para verificar zero hardcoded', async () => {
    console.log('\n=== VERIFICAÇÃO FINAL ===\n');
    console.log('1. Verificar que endpoint usa config:');
    console.log('   grep -n "payout_pct.*assetConfig" D:\\brokerproject\\scripts\\dev-live-feed.mjs');
    console.log('   # Deve mostrar linha ~774: payout_pct: assetConfig ? assetConfig.payout_pct : 85');
    console.log('');
    console.log('2. Verificar que abertura captura:');
    console.log('   grep -n "const payoutPct = assetConfig" D:\\brokerproject\\scripts\\dev-live-feed.mjs');
    console.log('   # Deve mostrar linha ~2715');
    console.log('');
    console.log('3. Verificar que liquidação usa capturado:');
    console.log('   grep -n "const payoutPct = target.payout_pct" D:\\brokerproject\\scripts\\dev-live-feed.mjs');
    console.log('   # Deve mostrar linha ~2802');
    console.log('');
    console.log('4. Verificar ZERO hardcoded 1.85:');
    console.log('   grep -n "Math.round(stake \\* 1.85)" D:\\brokerproject\\scripts\\dev-live-feed.mjs');
    console.log('   # Esperado: ZERO resultados (ou só em comentários)');
    console.log('');
    console.log('5. Verificar que fórmula usa variável:');
    console.log('   grep -n "Math.round(stake \\* (1 \\+ payoutPct / 100))" D:\\brokerproject\\scripts\\dev-live-feed.mjs');
    console.log('   # Deve mostrar linha ~2803');
    console.log('');
  });
});

describe('BUG-2: Como Configurar Payout Diferente por Ativo', () => {
  test('[DOC] passo a passo para alterar payout de um ativo', () => {
    console.log('\n=== COMO CONFIGURAR PAYOUT POR ATIVO ===\n');

    console.log('## Exemplo: Aumentar payout de VOL_50 para 90%');
    console.log('1. Editar ASSETS_CONFIG em dev-live-feed.mjs:');
    console.log('   { symbol: \'VOL_50\', price: 500.1250, precision: 4, sigma: 0.00060, payout_pct: 90 },');
    console.log('   //                                                                       ^^^ era 85');
    console.log('');
    console.log('2. Reiniciar servidor:');
    console.log('   # kill e restart do dev-live-feed.mjs');
    console.log('');
    console.log('3. Verificar endpoint:');
    console.log('   curl http://localhost:3001/api/indices/VOL_50');
    console.log('   # Deve retornar: "payout_pct": 90');
    console.log('');
    console.log('4. Abrir contrato novo:');
    console.log('   curl -X POST http://localhost:3001/contracts \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -H "Authorization: Bearer <token>" \\');
    console.log('     -H "Idempotency-Key: test-payout90-$(date +%s)" \\');
    console.log('     -d \'{"symbol": "VOL_50", "direction": "UP", "stake_minor": 100000, "duration_seconds": 60}\'');
    console.log('');
    console.log('5. Verificar que foi capturado:');
    console.log('   psql -d binmax -c "SELECT id, symbol, payout_pct, stake_minor FROM contracts ORDER BY created_at DESC LIMIT 1;"');
    console.log('   # Esperado: payout_pct = 90');
    console.log('');
    console.log('6. Aguardar WIN e verificar payout:');
    console.log('   # stake_minor: 100000');
    console.log('   # payout_minor: 190000 (100000 * 1.90)');
    console.log('');
    console.log('## Importante:');
    console.log('- Contratos ANTIGOS continuam com payout_pct=85 (snapshot)');
    console.log('- Contratos NOVOS capturam payout_pct=90 no momento da abertura');
    console.log('- Mudança de payout NÃO afeta contratos já abertos');
    console.log('');
  });
});
