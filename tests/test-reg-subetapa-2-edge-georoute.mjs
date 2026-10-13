import assert from 'node:assert';
import { RegulatoryZoneService } from '../services/api/dist/services/regulatory-zones.js';
import { RED_ZONE_COUNTRIES, YELLOW_ZONE_COUNTRIES, GREEN_ZONE_COUNTRIES } from '../packages/shared/dist/index.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 2: Edge Geoblocking & Motor de Geo-Routing Regional');

// 1. Verificação de Extração e Higienização Anti-Spoofing de Headers
const reqValidUS = { headers: { 'cf-ipcountry': 'us' } };
assert.strictEqual(RegulatoryZoneService.extractCountry(reqValidUS), 'US', 'Deve normalizar para maiúsculo');

const reqSqlInjection = { headers: { 'cf-ipcountry': 'US; DROP TABLE regulatory_jurisdictions;' } };
assert.strictEqual(RegulatoryZoneService.extractCountry(reqSqlInjection), 'UNKNOWN', 'Deve rejeitar injeção e retornar UNKNOWN');

const reqXss = { headers: { 'cf-ipcountry': '<script>' } };
assert.strictEqual(RegulatoryZoneService.extractCountry(reqXss), 'UNKNOWN', 'Deve rejeitar tags HTML');

const reqCountryCodeHeader = { headers: { 'x-country-code': 'br' } };
assert.strictEqual(RegulatoryZoneService.extractCountry(reqCountryCodeHeader), 'BR', 'Deve aceitar X-Country-Code válido');

console.log('  ✅ [PASS] Sanitização e proteção anti-spoofing de headers de país comprovada');

// 2. Classificação de Zonas Regulatórias (RED, YELLOW, GREEN)
const service = new RegulatoryZoneService();

// Zona Vermelha (Hard Geo-block)
const testRedCountries = ['US', 'CA', 'GB', 'AU', 'IL', 'JP', 'DE', 'FR', 'IT', 'ES'];
for (const country of testRedCountries) {
  const jurisdiction = await service.getJurisdiction(country);
  assert.strictEqual(jurisdiction.zone, 'RED', `País ${country} deve ser Zona Vermelha`);
  assert.strictEqual(jurisdiction.hardBlock, true, `País ${country} deve ter hardBlock = true`);
  const isBlocked = await service.isHardBlocked(country);
  assert.strictEqual(isBlocked, true, `isHardBlocked deve retornar true para ${country}`);
}
console.log('  ✅ [PASS] Hard Geo-block obrigatório para Zona Vermelha (US, CA, GB, EU, AU, IL, JP) validado');

// Zona Amarela (Reverse Solicitation)
const testYellowCountries = ['MX', 'IN', 'ID', 'TH', 'ZA', 'NG', 'TR', 'PH'];
for (const country of testYellowCountries) {
  const jurisdiction = await service.getJurisdiction(country);
  assert.strictEqual(jurisdiction.zone, 'YELLOW', `País ${country} deve ser Zona Amarela`);
  assert.strictEqual(jurisdiction.hardBlock, false, `País ${country} NÃO deve ter hardBlock`);
}
console.log('  ✅ [PASS] Zona Amarela (Reverse Solicitation: MX, IN, ID, TH, ZA, NG, TR, PH) validada');

// Zona Verde (Offshore, Hospedagem & Acesso Total - Brasil 100% Livre)
const testGreenCountries = ['BR', 'KM', 'VC', 'SC', 'VU', 'MH', 'CR', 'LC', 'CO', 'AR', 'CL', 'PE'];
for (const country of testGreenCountries) {
  const jurisdiction = await service.getJurisdiction(country);
  assert.strictEqual(jurisdiction.zone, 'GREEN', `País ${country} deve ser Zona Verde`);
  assert.strictEqual(jurisdiction.hardBlock, false, `País ${country} NÃO deve ter hardBlock`);
}
console.log('  ✅ [PASS] Zona Verde (Brasil 100% livre, Comores, SVG, Seychelles, etc.) validada');

// 3. Resolução de Geo-Routing e Domínios Espelho
const mirrorBR = await service.getPreferredMirror('BR');
assert.strictEqual(mirrorBR, 'app.nomedominio-br1.com', 'Brasil deve rotear para app.nomedominio-br1.com');

const mirrorIN = await service.getPreferredMirror('IN');
assert.strictEqual(mirrorIN, 'app.nomedominio-in.com', 'Índia deve rotear para app.nomedominio-in.com');

const mirrorKM = await service.getPreferredMirror('KM');
assert.strictEqual(mirrorKM, 'app.nomedominio-global.com', 'Comores deve rotear para app.nomedominio-global.com');

const mirrorGlobal = await service.getPreferredMirror('XX');
assert.strictEqual(mirrorGlobal, 'app.nomedominio-global.com', 'Desconhecido deve rotear para app.nomedominio-global.com');

console.log('  ✅ [PASS] Geo-routing para domínios espelho por país e fallback global validados');

// 4. Teste de Resiliência a Pane de Cache Redis (Fallback Gracioso)
const brokenRedis = {
  get: async () => { throw new Error('Redis Connection Refused'); },
  set: async () => { throw new Error('Redis Connection Refused'); }
};
const mockPg = {
  query: async (sql, params) => {
    if (params && params[0] === 'US') {
      return {
        rows: [{
          country_code: 'US',
          country_name: 'Estados Unidos',
          zone: 'RED',
          regulator_authority: 'CFTC/SEC',
          enforcement_level: 'CRIMINAL_SANCTIONS',
          hard_block: true
        }]
      };
    }
    return { rows: [] };
  }
};
const resilientService = new RegulatoryZoneService(mockPg, brokenRedis);
const resUS = await resilientService.getJurisdiction('US');
assert.strictEqual(resUS.zone, 'RED', 'Deve manter zona RED mesmo com falha no Redis');
assert.strictEqual(resUS.hardBlock, true, 'Deve manter hardBlock mesmo com falha no Redis');
console.log('  ✅ [PASS] Resiliência a pane do Redis comprovada com fallback para PostgreSQL/in-memory');

console.log('\n===============================================================');
console.log('🎉 QUALITY GATE 2 (GATE-REG-02) HOMOLOGADO COM 100% DE SUCESSO!');
console.log('===============================================================\n');
