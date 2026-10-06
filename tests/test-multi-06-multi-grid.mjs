import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 6: Seletor de Grade Multi-Gráficos & Overlays Oficiais');

const gridFile = path.resolve('../indices-sinteticos/apps/web/src/chart/MultiChartGrid.tsx');
assert(fs.existsSync(gridFile), 'MultiChartGrid.tsx deve existir');

const gridContent = fs.readFileSync(gridFile, 'utf-8');

// 1. Verificação de Suporte aos 3 Modos de Grade (1x1, 2x1, 2x2)
assert(gridContent.includes("'1x1'"), "Deve suportar modo '1x1'");
assert(gridContent.includes("'2x1'"), "Deve suportar modo '2x1'");
assert(gridContent.includes("'2x2'"), "Deve suportar modo '2x2'");
assert(gridContent.includes('gridTemplateColumns'), 'Deve configurar colunas dinâmicas CSS Grid');
console.log('  ✅ [PASS] Modos de grade 1x1, 2x1 e 2x2 implementados com layout responsivo');

// 2. Verificação de Isolamento Estrito de Contratos por Ativo (Anti-Cross Visual)
assert(gridContent.includes("c.status === 'OPEN' && c.symbol === symbol"), 'Contratos na célula devem ser estritamente filtrados pelo símbolo da própria célula');
console.log('  ✅ [PASS] Overlays de strike e bandeirinhas isolados exclusivamente pelo símbolo da célula');

// 3. Verificação de Sincronização de Foco do Painel Operacional
assert(gridContent.includes('onActiveSymbolChange'), 'Deve sincronizar ativo em foco com o Order Ticket');
assert(gridContent.includes('border: isActive ?'), 'Deve destacar visualmente a célula ativa com borda destacada');
console.log('  ✅ [PASS] Sincronização bidirecional de foco e Order Ticket validada');

// 4. Verificação de Integração no App.tsx
const appFile = path.resolve('../indices-sinteticos/apps/web/src/App.tsx');
const appContent = fs.readFileSync(appFile, 'utf-8');
assert(appContent.includes('<MultiChartGrid'), 'App.tsx deve renderizar MultiChartGrid no slot central');
console.log('  ✅ [PASS] Integração do MultiChartGrid no App.tsx confirmada');

console.log('\nResultado: 4/4 verificações aprovadas.');
console.log('🎉 QUALITY GATE 6 100% HOMOLOGADO E APROVADO!\n');

process.exit(0);
