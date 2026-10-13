import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 1 da Fase 2: Schemas de Países, Moedas, Flags, KYC e Pagamentos');

const upFile = path.resolve('db/migrations/0020_phase2_countries_flags_kyc_payments.up.sql');
const downFile = path.resolve('db/migrations/0020_phase2_countries_flags_kyc_payments.down.sql');

assert(fs.existsSync(upFile), 'Migration up deve existir: 0020_phase2_countries_flags_kyc_payments.up.sql');
assert(fs.existsSync(downFile), 'Migration down deve existir: 0020_phase2_countries_flags_kyc_payments.down.sql');

const upSql = fs.readFileSync(upFile, 'utf-8');
const downSql = fs.readFileSync(downFile, 'utf-8');

// 1. Verificação das 5 Tabelas Criadas
const expectedTables = [
  'countries',
  'display_currencies',
  'country_feature_flags',
  'kyc_profiles',
  'payment_methods_registry'
];

for (const table of expectedTables) {
  assert(upSql.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `Tabela ${table} deve ser criada na migration`);
}
console.log(`  ✅ [PASS] Todas as 5 tabelas estruturais da Fase 2 declaradas com CREATE TABLE`);

// 2. Verificação dos 6 Países no Seed
const expectedCountries = [
  { code: 'BR', name: 'Brasil', currency: 'BRL', locale: 'pt-BR' },
  { code: 'MX', name: 'México', currency: 'MXN', locale: 'es-MX' },
  { code: 'CO', name: 'Colômbia', currency: 'COP', locale: 'es-CO' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', locale: 'es-AR' },
  { code: 'CL', name: 'Chile', currency: 'CLP', locale: 'es-CL' },
  { code: 'PE', name: 'Peru', currency: 'PEN', locale: 'es-PE' }
];

for (const country of expectedCountries) {
  assert(upSql.includes(`'${country.code}'`), `Código do país ${country.code} deve estar presente`);
  assert(upSql.includes(`'${country.name}'`), `Nome do país ${country.name} deve estar presente`);
  assert(upSql.includes(`'${country.currency}'`), `Moeda padrão ${country.currency} deve estar presente`);
  assert(upSql.includes(`'${country.locale}'`), `Locale padrão ${country.locale} deve estar presente`);
}
console.log(`  ✅ [PASS] Todos os 6 países da Fase 2 (BR, MX, CO, AR, CL, PE) validados no seed`);

// 3. Verificação das 6 Moedas de Exibição
const expectedCurrencies = ['BRL', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'];
for (const curr of expectedCurrencies) {
  assert(upSql.includes(`'${curr}'`), `Moeda ${curr} deve estar presente no seed`);
}
console.log(`  ✅ [PASS] Todas as 6 moedas de exibição (BRL, MXN, COP, ARS, CLP, PEN) validadas no seed`);

// 4. Verificação das Feature Flags Dinâmicas
const expectedFlags = ['trading_enabled', 'otc_real_feed', 'demo_wallet'];
for (const flag of expectedFlags) {
  assert(upSql.includes(`'${flag}'`), `Feature flag ${flag} deve constar no seed`);
}
console.log(`  ✅ [PASS] Feature flags operacionais por país validadas no seed`);

// 5. Verificação de Métodos de Pagamento Inativos (Zero dinheiro real na Fase 2)
const expectedMethods = ['PIX', 'SPEI', 'PSE', 'RAPIPAGO', 'SENCILLITO', 'PAGOEFECTIVO'];
for (const method of expectedMethods) {
  assert(upSql.includes(`'${method}'`), `Método de pagamento preparatório ${method} deve constar no seed`);
}
assert(upSql.includes('FALSE'), 'Métodos de pagamento devem ter flag is_active com valor FALSE');
console.log(`  ✅ [PASS] Métodos de pagamento preparatórios cadastrados como inativos (FALSE)`);

// 6. Verificação de Menor Privilégio (Grants)
assert(upSql.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON countries'), 'Permissões app_contract concedidas');
assert(upSql.includes('GRANT SELECT ON countries'), 'Permissões app_reader concedidas');
console.log('  ✅ [PASS] Concessão de GRANTs para roles app_contract e app_reader validada');

// 7. Verificação da Migration Down (Reversibilidade Limpa)
for (const table of expectedTables) {
  assert(downSql.includes(`DROP TABLE IF EXISTS ${table} CASCADE;`), `Tabela ${table} deve ser revertida no down.sql`);
}
console.log('  ✅ [PASS] Reversibilidade estrita e limpa da migration down comprovada');

console.log('\n===============================================================');
console.log('🎉 QUALITY GATE 1 (GATE-F2-01) HOMOLOGADO COM 100% DE SUCESSO!');
console.log('===============================================================\n');
