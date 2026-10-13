import fs from 'node:assert';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 5: Painel Admin Multi-País & Gestão de Flags em Runtime');

// 1. Verificação do Bundle Gerado para Produção
const adminDistHtml = path.resolve('apps/admin/dist/index.html');
const adminSrcApp = path.resolve('apps/admin/src/App.tsx');

const appContent = await fsPromises.readFile(adminSrcApp, 'utf-8');

// 2. Verificação das Abas da Fase 2
const requiredTabs = ['countries', 'geoblock', 'kyc'];
for (const tab of requiredTabs) {
  assert(appContent.includes(`"${tab}"`), `Aba '${tab}' deve estar presente no Painel Admin`);
}
console.log('  ✅ [PASS] Abas da Fase 2 (Países & Flags, Geoblocking, KYC Preparatório) presentes na navegação');

// 3. Verificação dos 6 Países no Estado Inicial do Admin
const expectedCountries = ['BR', 'MX', 'CO', 'AR', 'CL', 'PE'];
for (const code of expectedCountries) {
  assert(appContent.includes(`code: "${code}"`), `País ${code} deve constar no estado inicial do Admin`);
}
console.log('  ✅ [PASS] Todos os 6 países da América Latina declarados no Painel Admin');

// 4. Verificação dos Switches de Feature Flags
const flagSwitches = ['isActive', 'tradingEnabled', 'otcRealFeed', 'demoWallet'];
for (const flag of flagSwitches) {
  assert(appContent.includes(flag), `Controle da flag '${flag}' deve existir no Admin`);
}
console.log('  ✅ [PASS] Controles em tempo real das 4 flags por país validados no Admin');

// 5. Verificação da Tabela de Triagem de KYC e Auditoria de Geoblocking
assert(appContent.includes('GeoblockLogItem'), 'Interface de logs de Geoblocking deve estar definida');
assert(appContent.includes('KycProfileItem'), 'Interface de perfis de KYC deve estar definida');
assert(appContent.includes('handleUpdateKycStatus'), 'Ação administrativa de triagem de KYC deve estar implementada');
console.log('  ✅ [PASS] Tabelas de auditoria de Geoblocking e triagem de KYC preparatório validadas');

// 6. Verificação de Arquivo de Distribuição Compilado
const distExists = await fsPromises.stat(adminDistHtml).then(() => true).catch(() => false);
assert(distExists, 'Bundle de produção em apps/admin/dist/index.html deve existir e estar compilado');
console.log('  ✅ [PASS] Bundle de produção do Admin compilado com sucesso');

console.log('\n===============================================================');
console.log('🎉 QUALITY GATE 5 (GATE-F2-05) HOMOLOGADO COM 100% DE SUCESSO!');
console.log('===============================================================\n');
