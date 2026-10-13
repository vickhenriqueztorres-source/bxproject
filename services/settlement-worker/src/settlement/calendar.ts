const ALL_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const TRADING_CALENDARS: Record<string, { days: string[]; holidays: string[]; sessions: { open: string; close: string }[] }> = {};

const CRYPTO_SYMBOLS = [
  'BTCUSD_OTC', 'ETHUSD_OTC', 'SOLUSD_OTC', 'XRPUSD_OTC', 'ADAUSD_OTC',
  'DOGEUSD_OTC', 'DOTUSD_OTC', 'AVAXUSD_OTC', 'LINKUSD_OTC', 'LTCUSD_OTC'
];
for (const sym of CRYPTO_SYMBOLS) {
  TRADING_CALENDARS[sym] = {
    sessions: [{ open: '00:00', close: '23:59' }],
    days: ALL_DAYS,
    holidays: [],
  };
}

const SYNTHETIC_SYMBOLS = [
  'VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'CRASH_BOOM_100',
  'SYNTH_VOL_10', 'SYNTH_VOL_25', 'SYNTH_VOL_50', 'SYNTH_VOL_75', 'SYNTH_VOL_100', 'SYNTH_CRASH_BOOM_100',
  'VOL10_OTC', 'VOL25_OTC', 'VOL50_OTC', 'VOL75_OTC', 'VOL100_OTC',
  'CRASH500_OTC', 'CRASH1000_OTC', 'BOOM500_OTC', 'BOOM1000_OTC', 'STEP_OTC', 'RANGE_OTC'
];
for (const sym of SYNTHETIC_SYMBOLS) {
  TRADING_CALENDARS[sym] = {
    sessions: [{ open: '00:00', close: '23:59' }],
    days: ALL_DAYS,
    holidays: [],
  };
}

const FOREX_SYMBOLS = [
  'EURUSD_OTC', 'GBPUSD_OTC', 'USDJPY_OTC', 'USDCHF_OTC', 'AUDUSD_OTC',
  'USDCAD_OTC', 'NZDUSD_OTC', 'EURGBP_OTC', 'EURJPY_OTC', 'GBPJPY_OTC'
];
for (const sym of FOREX_SYMBOLS) {
  TRADING_CALENDARS[sym] = {
    sessions: [{ open: '00:00', close: '23:59' }],
    days: WEEKDAYS,
    holidays: ['2026-12-25', '2026-01-01'],
  };
}

const COMMODITY_SYMBOLS = [
  'XAUUSD_OTC', 'XAGUSD_OTC', 'USOIL_OTC', 'UKOIL_OTC',
  'SPX500_OTC', 'NAS100_OTC', 'US30_OTC', 'GER40_OTC', 'UK100_OTC', 'JPN225_OTC'
];
for (const sym of COMMODITY_SYMBOLS) {
  TRADING_CALENDARS[sym] = {
    sessions: [
      { open: '00:00', close: '21:00' },
      { open: '22:00', close: '23:59' }
    ],
    days: WEEKDAYS,
    holidays: ['2026-12-25', '2026-01-01'],
  };
}

export function isMarketOpen(symbol: string, timeInput: Date | string | number = new Date()): boolean {
  const cal = TRADING_CALENDARS[symbol];
  if (!cal) return true;

  const date = typeof timeInput === 'number' || typeof timeInput === 'string' ? new Date(timeInput) : timeInput;
  if (!Number.isFinite(date.getTime())) return false;

  const dateStr = date.toISOString().split('T')[0];
  if (cal.holidays.includes(dateStr)) return false;

  const dayIndex = date.getUTCDay();
  const dayName = ALL_DAYS[dayIndex];
  if (!cal.days.includes(dayName)) return false;

  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return cal.sessions.some((s) => timeStr >= s.open && timeStr <= s.close);
}
