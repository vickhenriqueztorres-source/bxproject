import assert from 'node:assert';
import { TRADING_CALENDARS } from '../services/api/src/services/trading-calendar.ts';
import { isMarketOpen as isSettlementOpen, TRADING_CALENDARS as SETTLEMENT_CALENDARS } from '../services/settlement-worker/src/settlement/calendar.ts';
import { TRADING_CALENDARS as CANDLE_CALENDARS } from '../services/candle-worker/calendar.mjs';

console.log('🧪 Executando Teste de Certificação - Subetapa 03: Candle Worker, Chart API & Calendários');

const canonicalSymbols = ['VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'CRASH_BOOM_100'];

// 1. Validar que todos os 6 símbolos canônicos estão configurados como 24/7 ininterrupto no API Trading Calendar
for (const sym of canonicalSymbols) {
  const cal = TRADING_CALENDARS[sym];
  assert(cal, `Calendário da API deve existir para ${sym}`);
  assert.strictEqual(cal.category, 'synthetics', `Categoria de ${sym} deve ser synthetics`);
  assert.strictEqual(cal.days.length, 7, `${sym} deve operar todos os 7 dias da semana`);
  assert.strictEqual(cal.sessions[0].open, '00:00');
  assert.strictEqual(cal.sessions[0].close, '23:59');
}
console.log('  ✅ [PASS] 6 Símbolos canônicos configurados 24/7 ininterruptos no Trading Calendar da API');

// 2. Validar que o Settlement Calendar reconhece todos os 6 símbolos como mercado 24/7 sempre aberto
for (const sym of canonicalSymbols) {
  const openNow = isSettlementOpen(sym, new Date());
  assert.strictEqual(openNow, true, `Settlement worker deve reconhecer ${sym} como aberto agora`);
}
console.log('  ✅ [PASS] Settlement Worker reconhece todos os 6 índices como 24/7 para liquidação imediata');

// 3. Validar que o Candle Worker possui os calendários e buckets ativos
for (const sym of canonicalSymbols) {
  const cal = CANDLE_CALENDARS[sym];
  assert(cal, `Candle worker deve ter calendário para ${sym}`);
  assert.strictEqual(cal.category, 'synthetics');
}
console.log('  ✅ [PASS] Candle Worker calibrado para agregação de velas dos 6 índices');

// 4. Teste de mapeamento de Aliases Legados (Retrocompatibilidade)
const legacySymbols = ['SYNTH_VOL_10', 'SYNTH_VOL_25', 'SYNTH_VOL_50', 'SYNTH_VOL_75', 'SYNTH_VOL_100', 'SYNTH_CRASH_BOOM_100'];
for (const sym of legacySymbols) {
  assert(TRADING_CALENDARS[sym], `Calendário da API deve manter suporte legado para ${sym}`);
  assert(CANDLE_CALENDARS[sym], `Candle worker deve manter suporte legado para ${sym}`);
}
console.log('  ✅ [PASS] Dual-alias preservado para todos os clientes em cache ou legado');

console.log('\n🎉 GATE DA SUBETAPA 03 100% HOMOLOGADO E REAPROVADO COM SUCESSO!\n');
