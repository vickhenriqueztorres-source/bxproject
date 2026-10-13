import assert from 'node:assert';
import { DynamicComplianceService } from '../services/api/dist/services/compliance-kyc.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 4: Camada de KYC Dinâmico & Compliance em Tiers com Anti-Red Zone');

// Mock em memória para testar lógica do DynamicComplianceService
const mockDB = {
  profiles: new Map()
};

const mockPg = {
  query: async (sql, params) => {
    if (sql.includes('SELECT') && sql.includes('FROM kyc_profiles') && sql.includes('WHERE user_id = $1')) {
      const userId = params[0];
      const found = mockDB.profiles.get(userId);
      return { rows: found ? [found] : [] };
    }
    if (sql.includes('INSERT INTO kyc_profiles')) {
      const [userId, country] = params;
      const newProfile = {
        id: 'prof-' + userId,
        user_id: userId,
        country_code: country,
        document_type: 'AUTO_TIER0',
        document_number: null,
        status: 'UNVERIFIED',
        tier: 'TIER_0',
        deposit_limit_minor: 30000,
        nationality_country_code: null,
        rejection_reason: null
      };
      mockDB.profiles.set(userId, newProfile);
      return { rows: [newProfile] };
    }
    if (sql.includes('UPDATE kyc_profiles') && sql.includes("status = 'REJECTED'")) {
      const [nat, reason, userId] = params;
      const found = mockDB.profiles.get(userId);
      if (found) {
        found.status = 'REJECTED';
        found.nationality_country_code = nat;
        found.rejection_reason = reason;
      }
      return { rows: [found] };
    }
    if (sql.includes('UPDATE kyc_profiles') && sql.includes("status = 'APPROVED'")) {
      const [limit, docType, docNum, nat, userId] = params;
      const found = mockDB.profiles.get(userId);
      if (found) {
        found.status = 'APPROVED';
        found.tier = 'TIER_1';
        found.deposit_limit_minor = limit;
        found.document_type = docType;
        found.document_number = docNum;
        found.nationality_country_code = nat;
        found.rejection_reason = null;
      }
      return { rows: [found] };
    }
    return { rows: [] };
  }
};

const mockRedis = {
  get: async (key) => null
};

const service = new DynamicComplianceService(mockPg, mockRedis);

// 1. Verificação de Onboarding Automático em Tier 0 (Até $300)
const userBR = 'user-br-trader';
const profile0 = await service.getProfile(userBR, 'BR');
assert.strictEqual(profile0.tier, 'TIER_0');
assert.strictEqual(profile0.deposit_limit_minor, 30000);
assert.strictEqual(profile0.status, 'UNVERIFIED');
console.log('  ✅ [PASS] Onboarding em Tier 0 sem atrito validado com teto de $300 (30.000 centavos)');

// 2. Verificação de Limites de Depósito no Tier 0
const checkDepositSmall = await service.evaluateDepositEligibility(userBR, 10000, 'BR');
assert.strictEqual(checkDepositSmall.allowed, true, 'Depósito de $100 deve ser liberado no Tier 0');

const checkDepositExceeded = await service.evaluateDepositEligibility(userBR, 35000, 'BR');
assert.strictEqual(checkDepositExceeded.allowed, false, 'Depósito de $350 deve ser barrado no Tier 0');
assert(checkDepositExceeded.reason.includes('TIER_0_LIMIT_EXCEEDED'), 'Deve apontar exigência de documento Tier 1');
console.log('  ✅ [PASS] Teto financeiro de depósito no Tier 0 rigorosamente aplicado');

// 3. Bloqueio Absoluto de Depósito para IPs da Zona Vermelha
const checkDepositRedZone = await service.evaluateDepositEligibility(userBR, 5000, 'US');
assert.strictEqual(checkDepositRedZone.allowed, false);
assert(checkDepositRedZone.reason.includes('RED_ZONE_PROHIBITED'));
console.log('  ✅ [PASS] Bloqueio total de depósitos a partir de IP de Zona Vermelha comprovado');

// 4. Teste Anti-Red Zone Exclusion: Tentativa de Envio de Documento US ou EU
const userUSInfiltrator = 'user-us-attempt';
await service.getProfile(userUSInfiltrator, 'BR'); // Cria conta tentando passar por BR

const submissionUS = await service.submitTier1Document(userUSInfiltrator, {
  documentType: 'PASSPORT',
  documentNumber: 'US-PASS-998822',
  nationalityCountry: 'US',
  issuerCountry: 'US'
});
assert.strictEqual(submissionUS.status, 'REJECTED');
assert(submissionUS.reason.includes('RED_ZONE_DOCUMENT_REJECTED'));

const profileAfterUS = await service.getProfile(userUSInfiltrator);
assert.strictEqual(profileAfterUS.status, 'REJECTED');
assert.strictEqual(profileAfterUS.nationality_country_code, 'US');

// Tentativa subsequente de depósito deve ser barrada por conta rejeitada
const checkDepositAfterReject = await service.evaluateDepositEligibility(userUSInfiltrator, 1000, 'BR');
assert.strictEqual(checkDepositAfterReject.allowed, false);
console.log('  ✅ [PASS] Anti-Red Zone Exclusion validada: Rejeição absoluta e bloqueio permanente para documentos US/EU');

// 5. Teste de Aprovação e Elevação de Limites para Zona Amarela (Tier 1)
const userGoodTrader = 'user-good-trader';
await service.getProfile(userGoodTrader, 'BR');

const submissionBR = await service.submitTier1Document(userGoodTrader, {
  documentType: 'RG',
  documentNumber: '12.345.678-9',
  nationalityCountry: 'BR',
  issuerCountry: 'BR'
});
assert.strictEqual(submissionBR.status, 'APPROVED');
assert.strictEqual(submissionBR.tier, 'TIER_1');

const profileAfterUpgrade = await service.getProfile(userGoodTrader);
assert.strictEqual(profileAfterUpgrade.tier, 'TIER_1');
assert.strictEqual(profileAfterUpgrade.status, 'APPROVED');
assert.strictEqual(profileAfterUpgrade.deposit_limit_minor, 1000000); // $10.000

// Agora depósito de $2.000 deve ser liberado com sucesso
const checkDepositTier1 = await service.evaluateDepositEligibility(userGoodTrader, 200000, 'BR');
assert.strictEqual(checkDepositTier1.allowed, true);
console.log('  ✅ [PASS] Upgrade para Tier 1 com elevação para $10.000 liberado para usuários de Zona Amarela');

console.log('\n===============================================================');
console.log('🎉 QUALITY GATE 4 (GATE-REG-04) HOMOLOGADO COM 100% DE SUCESSO!');
console.log('===============================================================\n');
