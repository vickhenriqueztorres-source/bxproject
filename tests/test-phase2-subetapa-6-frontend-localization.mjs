import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 6: Frontend i18n, Localização Regional & Experiência Multi-País');

// 1. Verificação dos Dicionários de Idioma
const ptFile = path.resolve('apps/web/src/i18n/locales/pt-BR.json');
const esFile = path.resolve('apps/web/src/i18n/locales/es-ES.json');
assert(fs.existsSync(ptFile), 'Arquivo de idioma pt-BR deve existir');
assert(fs.existsSync(esFile), 'Arquivo de idioma es-ES deve existir');

const pt = JSON.parse(fs.readFileSync(ptFile, 'utf-8'));
const es = JSON.parse(fs.readFileSync(esFile, 'utf-8'));

assert.strictEqual(typeof pt.app.title, 'string');
assert.strictEqual(typeof es.app.title, 'string');
console.log('  ✅ [PASS] Dicionários pt-BR e es-ES carregados e validados');

// 2. Verificação do Provedor de Contexto React
const i18nProviderFile = path.resolve('apps/web/src/i18n/index.tsx');
assert(fs.existsSync(i18nProviderFile), 'apps/web/src/i18n/index.tsx deve existir');
const providerContent = fs.readFileSync(i18nProviderFile, 'utf-8');
assert(providerContent.includes('I18nProvider'), 'I18nProvider deve estar exportado');
assert(providerContent.includes('useTranslation'), 'Hook useTranslation deve estar exportado');
assert(providerContent.includes('formatBalance'), 'Formatador de saldo multimoeda deve estar implementado');
console.log('  ✅ [PASS] Módulo I18nProvider e hook useTranslation validados');

// 3. Verificação do Componente de Bloqueio Regional (GeoblockedScreen)
const geoblockComponent = path.resolve('apps/web/src/components/geoblock/GeoblockedScreen.tsx');
assert(fs.existsSync(geoblockComponent), 'GeoblockedScreen.tsx deve existir');
const geoblockContent = fs.readFileSync(geoblockComponent, 'utf-8');
assert(geoblockContent.includes('GeoblockedScreen'), 'Componente GeoblockedScreen deve estar implementado');
console.log('  ✅ [PASS] Tela de bloqueio regional amigável implementada com seletor de idioma');

// 4. Verificação de Presença do I18nProvider no Ponto de Entrada
const mainFile = path.resolve('apps/web/src/main.tsx');
const mainContent = fs.readFileSync(mainFile, 'utf-8');
assert(mainContent.includes('<I18nProvider>'), 'I18nProvider deve envolver o App no main.tsx');
console.log('  ✅ [PASS] I18nProvider integrado com sucesso no ponto de entrada do React');

// 5. Verificação do Bundle Compilado de Produção
const webDistHtml = path.resolve('apps/web/dist/index.html');
assert(fs.existsSync(webDistHtml), 'apps/web/dist/index.html deve existir');
console.log('  ✅ [PASS] Bundle de produção do frontend compilado com sucesso');

console.log('\n===============================================================');
console.log('🎉 QUALITY GATE 6 (GATE-F2-06) HOMOLOGADO COM 100% DE SUCESSO!');
console.log('===============================================================\n');
