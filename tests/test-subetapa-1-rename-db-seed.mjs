import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

console.log('🧪 Executando Teste de Certificação - Subetapa 01: Banco de Dados, Schema & Aliases');

function dockerPsql(sql) {
  const tmpFile = 'tmp_query.sql';
  fs.writeFileSync(tmpFile, sql, 'utf-8');
  try {
    execSync(`docker cp ${tmpFile} fase1-test-postgres-1:/tmp/query.sql`);
    const output = execSync('docker exec fase1-test-postgres-1 psql -U postgres -d synth -t -A -f /tmp/query.sql', { encoding: 'utf-8' });
    return output.trim();
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// 1. Validar que os 6 novos índices canônicos existem e estão ACTIVE no PostgreSQL
const outputIndices = dockerPsql("SELECT symbol, status, params->>'name', params->>'subtitle' FROM indices WHERE symbol IN ('VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'CRASH_BOOM_100') ORDER BY symbol;").split('\n');

assert.strictEqual(outputIndices.length, 6, 'Devem existir exatamente 6 índices canônicos no banco');

const expectedNames = {
  'VOL_10': 'Volatilidad 10',
  'VOL_25': 'Volatilidad 25',
  'VOL_50': 'Volatilidad 50',
  'VOL_75': 'Volatilidad 75',
  'VOL_100': 'Volatilidad 100',
  'CRASH_BOOM_100': 'Crash & Boom 100'
};

for (const line of outputIndices) {
  const [sym, status, name, subtitle] = line.split('|');
  assert.strictEqual(status, 'ACTIVE', `Índice ${sym} deve estar ACTIVE`);
  assert.strictEqual(name, expectedNames[sym], `Nome do índice ${sym} incorreto: ${name}`);
  assert(subtitle && subtitle.length > 0, `Índice ${sym} deve ter subtítulo oficial`);
}
console.log('  ✅ [PASS] 6 Índices canônicos ativos e com nomes validados no PostgreSQL');

// 2. Validar integridade dos Genesis Hashes em index_state
const outputState = dockerPsql("SELECT symbol, last_hash FROM index_state WHERE symbol IN ('VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'CRASH_BOOM_100');").split('\n');

for (const line of outputState) {
  const [sym, hash] = line.split('|');
  const expectedHash = crypto.createHash('sha256').update(`genesis|${sym}`).digest('hex');
  assert.strictEqual(hash, expectedHash, `Genesis hash de ${sym} divergente`);
}
console.log('  ✅ [PASS] Hashes de gênese criptográficos calculados com precisão absoluta');

// 3. Teste de Idempotência: Re-executar a migration não pode falhar nem duplicar dados
execSync('docker cp db/migrations/0050_rename_synthetic_indices.up.sql fase1-test-postgres-1:/tmp/migration.sql');
execSync('docker exec fase1-test-postgres-1 psql -U postgres -d synth -f /tmp/migration.sql');

const countCheck = dockerPsql("SELECT COUNT(*) FROM indices WHERE symbol IN ('VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'CRASH_BOOM_100');");
assert.strictEqual(parseInt(countCheck, 10), 6, 'Após re-execução deve permanecer exatamente 6 índices');
console.log('  ✅ [PASS] Idempotência comprovada (zero duplicatas após re-execução)');

// 4. Teste de integridade referencial: Índices legados continuam acessíveis e mapeados
const legacyCheck = dockerPsql("SELECT symbol, params->>'alias_canonical' FROM indices WHERE symbol = 'SYNTH_VOL_50';");
assert.strictEqual(legacyCheck, 'SYNTH_VOL_50|VOL_50', 'Índice legado SYNTH_VOL_50 deve apontar para alias VOL_50');
console.log('  ✅ [PASS] Dual-alias preservado para retrocompatibilidade sem quebra de chaves estrangeiras');

console.log('\n🎉 GATE DA SUBETAPA 01 100% HOMOLOGADO E REAPROVADO COM SUCESSO!\n');
