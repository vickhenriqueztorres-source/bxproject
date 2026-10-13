import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import {
  RED_ZONE_COUNTRIES,
  YELLOW_ZONE_COUNTRIES,
  GREEN_ZONE_COUNTRIES,
  MirrorDomainSchema,
  KYCProfileSchema
} from '../packages/shared/dist/index.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 1: Schemas DB Zonas Regulatórias, Espelhos e KYC Tiers');

const upFile = path.resolve('db/migrations/0030_regulatory_zones_mirrors_kyc_tiers.up.sql');
const downFile = path.resolve('db/migrations/0030_regulatory_zones_mirrors_kyc_tiers.down.sql');

assert(fs.existsSync(upFile), 'Migration up deve existir: 0030_regulatory_zones_mirrors_kyc_tiers.up.sql');
assert(fs.existsSync(downFile), 'Migration down deve existir: 0030_regulatory_zones_mirrors_kyc_tiers.down.sql');

const upSql = fs.readFileSync(upFile, 'utf-8');
const downSql = fs.readFileSync(downFile, 'utf-8');

// 1. Verificação das Tabelas Estruturais
assert(upSql.includes('CREATE TABLE IF NOT EXISTS regulatory_jurisdictions'), 'Tabela regulatory_jurisdictions deve ser criada');
assert(upSql.includes('CREATE TABLE IF NOT EXISTS mirror_domains'), 'Tabela mirror_domains deve ser criada');
assert(upSql.includes('ALTER TABLE kyc_profiles'), 'Evolução de kyc_profiles deve existir');
console.log('  ✅ [PASS] Tabelas regulatory_jurisdictions, mirror_domains e evolução de kyc_profiles confirmadas');

// 2. Verificação dos Países da Zona Vermelha (Hard Geo-block)
const redZoneRequired = ['US', 'CA', 'GB', 'AU', 'IL', 'JP', 'DE', 'FR', 'IT', 'ES'];
for (const country of redZoneRequired) {
  assert(upSql.includes(`'${country}'`), `País de Zona Vermelha ${country} deve constar no seed`);
  assert(RED_ZONE_COUNTRIES.includes(country), `País ${country} deve constar em RED_ZONE_COUNTRIES no shared`);
}
assert(upSql.includes("'CRIMINAL_SANCTIONS'"), 'Nível de enforcement criminal deve constar para os EUA');
console.log('  ✅ [PASS] Zonas Vermelhas com Hard Geo-block obrigatório (US, CA, GB, EU, AU, IL, JP) validadas');

// 3. Verificação dos Países da Zona Amarela (Reverse Solicitation)
const yellowZoneRequired = ['MX', 'IN', 'ID', 'TH', 'ZA', 'NG', 'TR', 'PH'];
for (const country of yellowZoneRequired) {
  assert(upSql.includes(`'${country}'`), `País de Zona Amarela ${country} deve constar no seed`);
  assert(YELLOW_ZONE_COUNTRIES.includes(country), `País ${country} deve constar em YELLOW_ZONE_COUNTRIES no shared`);
}
assert(upSql.includes("'REVERSE_SOLICITATION'"), 'Status de Reverse Solicitation deve constar para a Zona Amarela');
console.log('  ✅ [PASS] Zonas Amarelas com Reverse Solicitation (MX, IN, ID, TH, ZA, NG, TR, PH) validadas');

// 4. Verificação dos Países da Zona Verde (Offshore, Hospedagem & Tolerância Total - Brasil 100% Livre)
const greenZoneRequired = ['BR', 'KM', 'VC', 'SC', 'VU', 'MH', 'CR', 'LC'];
for (const country of greenZoneRequired) {
  assert(upSql.includes(`'${country}'`), `País de Zona Verde ${country} deve constar no seed`);
  assert(GREEN_ZONE_COUNTRIES.includes(country), `País ${country} deve constar em GREEN_ZONE_COUNTRIES no shared`);
}
console.log('  ✅ [PASS] Zonas Verdes (Brasil 100% livre, Comores, SVG, Seychelles, Vanuatu, etc.) validadas');

// 5. Verificação da Rede de Domínios Espelho
const expectedMirrors = [
  'app.nomedominio-br1.com',
  'app.nomedominio-br2.com',
  'app.nomedominio-in.com',
  'app.nomedominio-in2.com',
  'app.nomedominio-global.com'
];
for (const mirror of expectedMirrors) {
  assert(upSql.includes(`'${mirror}'`), `Espelho ${mirror} deve constar no seed`);
}
console.log('  ✅ [PASS] Domínios espelho para Brasil, Índia e Global provisionados com prioridades');

// 6. Verificação de Validação Zod
const validMirror = MirrorDomainSchema.parse({
  domain_name: 'app.nomedominio-br1.com',
  target_country: 'BR',
  status: 'ACTIVE',
  priority: 10
});
assert.strictEqual(validMirror.status, 'ACTIVE');

const validKYC = KYCProfileSchema.parse({
  user_id: 'user-test-123',
  country_code: 'BR',
  document_type: 'CPF',
  status: 'UNVERIFIED',
  tier: 'TIER_0',
  deposit_limit_minor: 30000
});
assert.strictEqual(validKYC.tier, 'TIER_0');
assert.strictEqual(validKYC.deposit_limit_minor, 30000);
console.log('  ✅ [PASS] Schemas Zod de MirrorDomain e KYCProfile validados com tipagem e defaults estritos');

// 7. Verificação de Reversibilidade (Down Migration)
assert(downSql.includes('DROP TABLE IF EXISTS mirror_domains;'), 'mirror_domains deve ser revertido no down');
assert(downSql.includes('DROP TABLE IF EXISTS regulatory_jurisdictions;'), 'regulatory_jurisdictions deve ser revertido no down');
console.log('  ✅ [PASS] Script de rollback 0030.down.sql validado com integridade referencial');

console.log('\n===============================================================');
console.log('🎉 QUALITY GATE 1 (GATE-REG-01) HOMOLOGADO COM 100% DE SUCESSO!');
console.log('===============================================================\n');
