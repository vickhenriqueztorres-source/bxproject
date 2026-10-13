import assert from 'node:assert';
import { GeoBlockService } from '../services/api/dist/services/geoblock.js';
import { FeatureFlagsService } from '../services/api/dist/services/feature-flags.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 2: Motor de Geoblocking & Feature Flags Engine');

// 1. Verificação de Extração e Sanitização de Headers Anti-Spoofing
const safeReq = { headers: { 'cf-ipcountry': 'br' } };
assert.strictEqual(GeoBlockService.extractCountry(safeReq), 'BR', 'Deve sanitizar e normalizar para maiúsculas');

const maliciousReq = { headers: { 'cf-ipcountry': 'BR; DROP TABLE users;' } };
assert.strictEqual(GeoBlockService.extractCountry(maliciousReq), 'UNKNOWN', 'Deve rejeitar injeção e retornar UNKNOWN');
console.log('  ✅ [PASS] Extração sanitizada e anti-spoofing de headers de país comprovada');

// 2. Verificação da Allowlist dos 6 Países
const allowed = ['BR', 'MX', 'CO', 'AR', 'CL', 'PE'];
for (const c of allowed) {
  assert(GeoBlockService.isAllowed(c), `País ${c} deve estar na allowlist`);
}
const denied = ['US', 'DE', 'FR', 'GB', 'RU', 'CN', 'CA'];
for (const c of denied) {
  assert(!GeoBlockService.isAllowed(c), `País ${c} deve estar bloqueado`);
}
console.log('  ✅ [PASS] Allowlist estrita dos 6 países da Fase 2 e bloqueio de terceiros comprovado');

// 3. Verificação de Resolução do GeoContext
const ctxCO = GeoBlockService.resolveGeoContext({ headers: { 'cf-ipcountry': 'CO' } });
assert.strictEqual(ctxCO.country, 'CO');
assert.strictEqual(ctxCO.allowed, true);
assert.strictEqual(ctxCO.defaultCurrency, 'COP');
assert.strictEqual(ctxCO.defaultLocale, 'es-CO');

const ctxUS = GeoBlockService.resolveGeoContext({ headers: { 'cf-ipcountry': 'US' } });
assert.strictEqual(ctxUS.allowed, false, 'EUA não pode ser permitido');
console.log('  ✅ [PASS] Mapeamento automático de moeda e locale por país validado');

// 4. Verificação de Resiliência e Fallback do FeatureFlagsService
const mockPg = {
  query: async (sql, params) => {
    if (sql.includes('FROM countries WHERE code')) return { rows: [{ is_active: true }] };
    if (sql.includes('FROM country_feature_flags WHERE country_code')) {
      return { rows: [{ flag_key: 'trading_enabled', enabled: true }] };
    }
    return { rows: [] };
  }
};
const brokenRedis = {
  get: async () => { throw new Error('Redis offline'); },
  set: async () => { throw new Error('Redis offline'); },
  del: async () => { throw new Error('Redis offline'); }
};

const service = new FeatureFlagsService(mockPg, brokenRedis);
const flags = await service.getCountryFlags('MX');
assert.strictEqual(flags.trading_enabled, true, 'Deve fazer fallback gracioso para o banco');
console.log('  ✅ [PASS] Resiliência a pane do Redis comprovada com fallback para PostgreSQL');

console.log('\n===============================================================');
console.log('🎉 QUALITY GATE 2 (GATE-F2-02) HOMOLOGADO COM 100% DE SUCESSO!');
console.log('===============================================================\n');
