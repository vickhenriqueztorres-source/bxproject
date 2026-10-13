import assert from 'node:assert';
import { GeoBlockService } from '../services/api/dist/services/geoblock.js';
import { RegulatoryZoneService } from '../services/api/dist/services/regulatory-zones.js';
import { GREEN_ZONE_COUNTRIES, YELLOW_ZONE_COUNTRIES } from '../packages/shared/dist/index.js';

console.log('🧪 Iniciando Verificação de Blindagem: BRASIL 100% LIVRE (Zero Bloqueios)');

// 1. Verificação no Shared Package
assert(GREEN_ZONE_COUNTRIES.includes('BR'), 'Brasil deve constar em GREEN_ZONE_COUNTRIES');
assert(!YELLOW_ZONE_COUNTRIES.includes('BR'), 'Brasil NÃO deve constar em YELLOW_ZONE_COUNTRIES');
console.log('  ✅ [PASS] Brasil classificado na Zona Verde (Offshore & Tolerância Total de Acesso)');

// 2. Verificação no GeoBlockService
// Acesso sem headers (hospedagem local, VPS sem CDN, testes diretos)
const emptyReq = { headers: {} };
assert.strictEqual(GeoBlockService.extractCountry(emptyReq), 'BR', 'Acesso sem header deve defaultar para Brasil');
assert.strictEqual(GeoBlockService.isAllowed('BR'), true, 'Brasil é 100% permitido');

const geoCtx = GeoBlockService.resolveGeoContext(emptyReq);
assert.strictEqual(geoCtx.country, 'BR');
assert.strictEqual(geoCtx.allowed, true, 'GeoContext para Brasil deve ser sempre allowed: true');
console.log('  ✅ [PASS] GeoBlockService: Acessos do Brasil e requisições diretas de hospedagem são 100% permitidos');

// 3. Verificação no RegulatoryZoneService
const regService = new RegulatoryZoneService();
assert.strictEqual(RegulatoryZoneService.extractCountry(emptyReq), 'BR', 'RegulatoryZoneService extractCountry defaulta para BR');

const jurBR = await regService.getJurisdiction('BR');
assert.strictEqual(jurBR.zone, 'GREEN', 'Zona do Brasil deve ser GREEN');
assert.strictEqual(jurBR.hardBlock, false, 'hardBlock do Brasil deve ser FALSE');
assert.strictEqual(jurBR.enforcementLevel, 'UNRESTRICTED_ACCESS', 'Brasil possui acesso irrestrito');

const isBlockedBR = await regService.isHardBlocked('BR');
assert.strictEqual(isBlockedBR, false, 'isHardBlocked deve retornar FALSE para Brasil');
console.log('  ✅ [PASS] RegulatoryZoneService: hardBlock = false e acesso irrestrito comprovados');

// 4. Verificação de Fallback com Pane no Redis / Postgres
const deadRedis = {
  get: async () => { throw new Error('Redis down'); },
  set: async () => { throw new Error('Redis down'); }
};
const deadPg = {
  query: async () => { throw new Error('DB down'); }
};
const resilientBRService = new RegulatoryZoneService(deadPg, deadRedis);
const failSafeBR = await resilientBRService.getJurisdiction('BR');
assert.strictEqual(failSafeBR.zone, 'GREEN');
assert.strictEqual(failSafeBR.hardBlock, false);
console.log('  ✅ [PASS] Fail-safe de alta resiliência: Brasil permanece 100% livre mesmo se Redis e Postgres caírem');

console.log('\n===============================================================');
console.log('🎉 BRASIL 100% LIVRE DE QUALQUER BLOQUEIO CONFIRMADO COM SUCESSO!');
console.log('===============================================================\n');
