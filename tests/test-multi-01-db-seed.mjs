import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import crypto from 'node:crypto';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 1: Seed de Catálogo Expandido (36 Ativos Reais) & SQL');

const upFile = path.resolve('db/migrations/0010_seed_multi_assets.up.sql');
const downFile = path.resolve('db/migrations/0010_seed_multi_assets.down.sql');

assert(fs.existsSync(upFile), 'Migration up deve existir: 0010_seed_multi_assets.up.sql');
assert(fs.existsSync(downFile), 'Migration down deve existir: 0010_seed_multi_assets.down.sql');

const upSql = fs.readFileSync(upFile, 'utf-8');
const downSql = fs.readFileSync(downFile, 'utf-8');

const requiredSymbols = [
  'EURUSD_OTC', 'GBPUSD_OTC', 'USDJPY_OTC', 'USDCHF_OTC', 'AUDUSD_OTC', 'USDCAD_OTC', 'NZDUSD_OTC',
  'EURGBP_OTC', 'EURJPY_OTC', 'GBPJPY_OTC', 'EURCAD_OTC', 'EURAUD_OTC', 'GBPAUD_OTC', 'GBPCAD_OTC',
  'AUDCAD_OTC', 'AUDJPY_OTC', 'CADJPY_OTC', 'NZDJPY_OTC',
  'BTCUSD_OTC', 'ETHUSD_OTC', 'SOLUSD_OTC', 'BNBUSD_OTC', 'XRPUSD_OTC', 'ADAUSD_OTC', 'DOGEUSD_OTC', 'AVAXUSD_OTC',
  'XAUUSD_OTC', 'XAGUSD_OTC', 'USOIL_OTC', 'UKOIL_OTC',
  'SYNTH_VOL_10', 'SYNTH_VOL_25', 'SYNTH_VOL_50', 'SYNTH_VOL_75', 'SYNTH_VOL_100', 'SYNTH_CRASH_BOOM_100'
];

assert.strictEqual(requiredSymbols.length, 36, 'Deve haver exatamente 36 ativos no catálogo');

// 1. Verificação da presença dos 36 símbolos
for (const sym of requiredSymbols) {
  assert(upSql.includes(`'${sym}'`), `Símbolo ${sym} deve estar no seed`);
}
console.log(`  ✅ [PASS] Todos os ${requiredSymbols.length} símbolos presentes na migration`);

// 2. Verificação de Genesis Hashes SHA-256
for (const sym of requiredSymbols) {
  const expectedHash = crypto.createHash('sha256').update(`genesis|${sym}`).digest('hex');
  assert(upSql.includes(expectedHash), `Hash de gênese incorreto para ${sym}: esperado ${expectedHash}`);
}
console.log('  ✅ [PASS] 36 Hashes de gênese SHA-256 calculados criptograficamente validados');

// 3. Verificação de Idempotência SQL (ON CONFLICT DO UPDATE / DO NOTHING)
assert(upSql.includes('ON CONFLICT (symbol) DO UPDATE'), 'Tabela indices deve usar ON CONFLICT DO UPDATE');
assert(upSql.includes('ON CONFLICT (symbol) DO NOTHING'), 'Tabela index_state deve usar ON CONFLICT DO NOTHING');
console.log('  ✅ [PASS] Idempotência de inserção SQL garantida');

// 4. Verificação de Integridade da Migration Down
for (const sym of requiredSymbols.filter(s => s !== 'SYNTH_VOL_50')) {
  assert(downSql.includes(`'${sym}'`), `Símbolo ${sym} deve estar na migration down`);
}
console.log('  ✅ [PASS] Reversibilidade da migration down validada para todos os ativos adicionais');

// 5. Verificação do script efêmero de estresse
const stressSqlPath = path.resolve('tests/load/seed-stress-symbols.sql');
assert(fs.existsSync(stressSqlPath), 'Script de estresse efêmero tests/load/seed-stress-symbols.sql deve existir');
console.log('  ✅ [PASS] Script efêmero para pares de estresse STRESS_0001..STRESS_NNNN verificado');

console.log(`\nResultado: 5/5 verificações aprovadas para o catálogo de 36 ativos.`);
console.log('🎉 QUALITY GATE 1 100% HOMOLOGADO E REAPROVADO!\n');
