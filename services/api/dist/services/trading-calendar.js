"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRADING_CALENDARS = void 0;
exports.isMarketOpen = isMarketOpen;
const ALL_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
// Calendários canônicos institucionais para os 36 ativos (Perigo 7 / Técnica 1)
exports.TRADING_CALENDARS = {};
// 1. Cripto (24/7 ininterrupto)
const CRYPTO_SYMBOLS = [
    'BTCUSD_OTC', 'ETHUSD_OTC', 'SOLUSD_OTC', 'XRPUSD_OTC', 'ADAUSD_OTC',
    'DOGEUSD_OTC', 'DOTUSD_OTC', 'AVAXUSD_OTC', 'LINKUSD_OTC', 'LTCUSD_OTC'
];
for (const sym of CRYPTO_SYMBOLS) {
    exports.TRADING_CALENDARS[sym] = {
        symbol: sym,
        category: 'crypto',
        sessions: [{ open: '00:00', close: '23:59' }],
        days: ALL_DAYS,
        holidays: [],
        timezone: 'UTC',
    };
}
// 2. Sintéticos (24/7 ininterrupto)
const SYNTHETIC_SYMBOLS = [
    'SYNTH_VOL_50', 'VOL10_OTC', 'VOL25_OTC', 'VOL50_OTC', 'VOL75_OTC', 'VOL100_OTC',
    'CRASH500_OTC', 'CRASH1000_OTC', 'BOOM500_OTC', 'BOOM1000_OTC', 'STEP_OTC', 'RANGE_OTC'
];
for (const sym of SYNTHETIC_SYMBOLS) {
    exports.TRADING_CALENDARS[sym] = {
        symbol: sym,
        category: 'synthetics',
        sessions: [{ open: '00:00', close: '23:59' }],
        days: ALL_DAYS,
        holidays: [],
        timezone: 'UTC',
    };
}
// 3. Forex (Segunda a Sexta, fecha fins de semana e feriados globais)
const FOREX_SYMBOLS = [
    'EURUSD_OTC', 'GBPUSD_OTC', 'USDJPY_OTC', 'USDCHF_OTC', 'AUDUSD_OTC',
    'USDCAD_OTC', 'NZDUSD_OTC', 'EURGBP_OTC', 'EURJPY_OTC', 'GBPJPY_OTC'
];
for (const sym of FOREX_SYMBOLS) {
    exports.TRADING_CALENDARS[sym] = {
        symbol: sym,
        category: 'forex',
        sessions: [{ open: '00:00', close: '23:59' }],
        days: WEEKDAYS,
        holidays: ['2026-12-25', '2026-01-01'],
        timezone: 'UTC',
    };
}
// 4. Commodities & Metais (Segunda a Sexta com pausa diária de compensação 21:00-22:00 UTC)
const COMMODITY_SYMBOLS = [
    'XAUUSD_OTC', 'XAGUSD_OTC', 'USOIL_OTC', 'UKOIL_OTC',
    'SPX500_OTC', 'NAS100_OTC', 'US30_OTC', 'GER40_OTC', 'UK100_OTC', 'JPN225_OTC'
];
for (const sym of COMMODITY_SYMBOLS) {
    exports.TRADING_CALENDARS[sym] = {
        symbol: sym,
        category: 'commodities',
        sessions: [
            { open: '00:00', close: '21:00' },
            { open: '22:00', close: '23:59' }
        ],
        days: WEEKDAYS,
        holidays: ['2026-12-25', '2026-01-01'],
        timezone: 'UTC',
    };
}
/**
 * Validação algorítmica de mercado aberto em UTC (Técnica 1, 3 e 4).
 * Retorna true se o mercado estiver aberto para o símbolo no timestamp especificado.
 */
function isMarketOpen(symbol, timeInput = new Date()) {
    const cal = exports.TRADING_CALENDARS[symbol];
    if (!cal) {
        // Se o ativo não tiver calendário explicitamente cadastrado, adota fail-safe
        return true;
    }
    const date = typeof timeInput === 'number' || typeof timeInput === 'string' ? new Date(timeInput) : timeInput;
    if (!Number.isFinite(date.getTime())) {
        return false;
    }
    // 1. Validação de Feriados (UTC)
    const dateStr = date.toISOString().split('T')[0];
    if (cal.holidays.includes(dateStr)) {
        return false;
    }
    // 2. Validação de Dia da Semana (UTC)
    const dayIndex = date.getUTCDay(); // 0 = sun, 1 = mon, ..., 6 = sat
    const dayName = ALL_DAYS[dayIndex];
    if (!cal.days.includes(dayName)) {
        return false;
    }
    // 3. Validação de Horário de Sessão (UTC)
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const inSession = cal.sessions.some((s) => timeStr >= s.open && timeStr <= s.close);
    return inSession;
}
