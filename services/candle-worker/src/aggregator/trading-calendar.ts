/**
 * Perigo 7 — Calendário de Trading por Símbolo em UTC e Agregação Gap-Tolerant (M-05)
 * Garante que:
 * 1. Ticks fora da sessão oficial de trading não geram nem fecham velas espúrias.
 * 2. Buckets sem ticks (gaps legítimos ou mercado fechado) retornam null (nunca vela artificial).
 */

import type { TickInput, CandleData } from "./timeframe-aggregator.js";

const ALL_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const;

export interface TradingSession {
  open: string; // HH:mm UTC
  close: string; // HH:mm UTC
}

export interface SymbolTradingCalendar {
  symbol: string;
  category: "crypto" | "synthetics" | "forex" | "commodities";
  sessions: TradingSession[];
  days: readonly string[];
  holidays: string[];
  timezone: "UTC";
}

export const TRADING_CALENDARS: Record<string, SymbolTradingCalendar> = {};

function normalizeCalendarSymbol(symbol: string): string {
  return (symbol || "").trim().toUpperCase().replace(/-/g, "_");
}

const CRYPTO_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT",
  "BTCUSD_OTC", "ETHUSD_OTC", "SOLUSD_OTC", "XRPUSD_OTC", "ADAUSD_OTC",
  "DOGEUSD_OTC", "DOTUSD_OTC", "AVAXUSD_OTC", "LINKUSD_OTC", "LTCUSD_OTC"
];
for (const sym of CRYPTO_SYMBOLS) {
  TRADING_CALENDARS[sym] = {
    symbol: sym,
    category: "crypto",
    sessions: [{ open: "00:00", close: "23:59" }],
    days: ALL_DAYS,
    holidays: [],
    timezone: "UTC"
  };
}

const SYNTHETIC_SYMBOLS = [
  "R_10", "R_25", "R_50", "R_75", "R_100",
  "VOL_10", "VOL_25", "VOL_50", "VOL_75", "VOL_100", "CRASH_BOOM_100",
  "SYNTH_VOL_10", "SYNTH_VOL_25", "SYNTH_VOL_50", "SYNTH_VOL_75", "SYNTH_VOL_100", "SYNTH_CRASH_BOOM_100",
  "VOL10_OTC", "VOL25_OTC", "VOL50_OTC", "VOL75_OTC", "VOL100_OTC",
  "CRASH500_OTC", "CRASH1000_OTC", "BOOM500_OTC", "BOOM1000_OTC", "STEP_OTC", "RANGE_OTC"
];
for (const sym of SYNTHETIC_SYMBOLS) {
  TRADING_CALENDARS[sym] = {
    symbol: sym,
    category: "synthetics",
    sessions: [{ open: "00:00", close: "23:59" }],
    days: ALL_DAYS,
    holidays: [],
    timezone: "UTC"
  };
}

const FOREX_SYMBOLS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD",
  "EURUSD_OTC", "GBPUSD_OTC", "USDJPY_OTC", "USDCHF_OTC", "AUDUSD_OTC",
  "USDCAD_OTC", "NZDUSD_OTC", "EURGBP_OTC", "EURJPY_OTC", "GBPJPY_OTC"
];
for (const sym of FOREX_SYMBOLS) {
  TRADING_CALENDARS[sym] = {
    symbol: sym,
    category: "forex",
    sessions: [{ open: "00:00", close: "23:59" }],
    days: WEEKDAYS,
    holidays: ["2026-12-25", "2026-01-01"],
    timezone: "UTC"
  };
}

const COMMODITY_SYMBOLS = [
  "XAUUSD", "XAGUSD", "USOIL", "UKOIL",
  "XAUUSD_OTC", "XAGUSD_OTC", "USOIL_OTC", "UKOIL_OTC",
  "SPX500_OTC", "NAS100_OTC", "US30_OTC", "GER40_OTC", "UK100_OTC", "JPN225_OTC"
];
for (const sym of COMMODITY_SYMBOLS) {
  TRADING_CALENDARS[sym] = {
    symbol: sym,
    category: "commodities",
    sessions: [
      { open: "00:00", close: "21:00" },
      { open: "22:00", close: "23:59" }
    ],
    days: WEEKDAYS,
    holidays: ["2026-12-25", "2026-01-01"],
    timezone: "UTC"
  };
}

export function isMarketOpen(symbol: string, timeInput: Date | string | number = new Date()): boolean {
  const norm = normalizeCalendarSymbol(symbol);
  const cal = TRADING_CALENDARS[norm];
  if (!cal) return true;

  const date = timeInput instanceof Date ? timeInput : new Date(timeInput);
  if (!Number.isFinite(date.getTime())) return false;

  const dateStr = date.toISOString().split("T")[0];
  if (cal.holidays.includes(dateStr)) return false;

  const dayIndex = date.getUTCDay();
  const dayName = ALL_DAYS[dayIndex];
  if (!cal.days.includes(dayName)) return false;

  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return cal.sessions.some((s) => timeStr >= s.open && timeStr <= s.close);
}

export function shouldCloseCandle(tick: Pick<TickInput, "ts">, symbol: string): boolean {
  if (!symbol) return true;
  return isMarketOpen(symbol, tick.ts);
}

/**
 * Perigo 7 (Técnica 5): Agregação Gap-Tolerant.
 * Se o mercado estiver fechado no bucket ou se não houver ticks reais no intervalo,
 * retorna null (jamais cria candle sintético/artificial).
 */
export function aggregateCandleGapTolerant(
  ticks: TickInput[],
  bucketStart: Date,
  bucketEnd: Date,
  symbol: string,
  interval = "1m"
): CandleData | null {
  if (symbol && !isMarketOpen(symbol, bucketStart)) {
    return null;
  }

  const startMs = bucketStart.getTime();
  const endMs = bucketEnd.getTime();
  const inBucket = ticks
    .filter((t) => {
      const ms = t.ts.getTime();
      return ms >= startMs && ms < endMs && isMarketOpen(t.symbol || symbol, t.ts);
    })
    .sort((a, b) => (a.sequence < b.sequence ? -1 : a.sequence > b.sequence ? 1 : 0));

  if (inBucket.length === 0) {
    return null;
  }

  let open = inBucket[0].price;
  let high = inBucket[0].price;
  let low = inBucket[0].price;
  let highNum = parseFloat(high);
  let lowNum = parseFloat(low);
  let close = inBucket[inBucket.length - 1].price;

  for (const t of inBucket) {
    const val = parseFloat(t.price);
    if (val > highNum) {
      highNum = val;
      high = t.price;
    }
    if (val < lowNum) {
      lowNum = val;
      low = t.price;
    }
  }

  return {
    symbol,
    interval,
    bucket_start: bucketStart,
    open,
    high,
    low,
    close,
    volume: inBucket.length
  };
}
