export type AssetCategory = 'Forex' | 'Cripto' | 'Commodities' | 'Sintéticos';

export interface AssetOption {
  symbol: string;
  name: string;
  subtitle?: string;
  category: AssetCategory;
  payout: number;
  precision: number;
}

export const LEGACY_SYMBOL_MAP: Record<string, string> = {
  SYNTH_VOL_10: 'VOL_10',
  SYNTH_VOL_25: 'VOL_25',
  SYNTH_VOL_50: 'VOL_50',
  SYNTH_VOL_75: 'VOL_75',
  SYNTH_VOL_100: 'VOL_100',
  SYNTH_CRASH_BOOM_100: 'CRASH_BOOM_100',
};

export function normalizeSymbol(symbol: string): string {
  if (!symbol) return '';
  const trimmed = symbol.trim().toUpperCase();
  return LEGACY_SYMBOL_MAP[trimmed] || (trimmed.startsWith('SYNTH_') ? trimmed.replace('SYNTH_', '') : trimmed);
}

export function isSameAsset(symbolA?: string | null, symbolB?: string | null): boolean {
  if (!symbolA || !symbolB) return false;
  const a = symbolA.trim();
  const b = symbolB.trim();
  if (!a || !b) return false;
  return normalizeSymbol(a) === normalizeSymbol(b);
}

export const ASSET_CATALOG: AssetOption[] = [
  // Forex OTC (18)
  { symbol: 'EURUSD_OTC', name: 'EUR / USD (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'GBPUSD_OTC', name: 'GBP / USD (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'USDJPY_OTC', name: 'USD / JPY (OTC)', category: 'Forex', payout: 85, precision: 3 },
  { symbol: 'USDCHF_OTC', name: 'USD / CHF (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'AUDUSD_OTC', name: 'AUD / USD (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'USDCAD_OTC', name: 'USD / CAD (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'NZDUSD_OTC', name: 'NZD / USD (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'EURGBP_OTC', name: 'EUR / GBP (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'EURJPY_OTC', name: 'EUR / JPY (OTC)', category: 'Forex', payout: 85, precision: 3 },
  { symbol: 'GBPJPY_OTC', name: 'GBP / JPY (OTC)', category: 'Forex', payout: 85, precision: 3 },
  { symbol: 'EURCAD_OTC', name: 'EUR / CAD (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'EURAUD_OTC', name: 'EUR / AUD (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'GBPAUD_OTC', name: 'GBP / AUD (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'GBPCAD_OTC', name: 'GBP / CAD (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'AUDCAD_OTC', name: 'AUD / CAD (OTC)', category: 'Forex', payout: 85, precision: 5 },
  { symbol: 'AUDJPY_OTC', name: 'AUD / JPY (OTC)', category: 'Forex', payout: 85, precision: 3 },
  { symbol: 'CADJPY_OTC', name: 'CAD / JPY (OTC)', category: 'Forex', payout: 85, precision: 3 },
  { symbol: 'NZDJPY_OTC', name: 'NZD / JPY (OTC)', category: 'Forex', payout: 85, precision: 3 },

  // Cripto OTC (8)
  { symbol: 'BTCUSD_OTC', name: 'BTC / USD (OTC)', category: 'Cripto', payout: 85, precision: 2 },
  { symbol: 'ETHUSD_OTC', name: 'ETH / USD (OTC)', category: 'Cripto', payout: 85, precision: 2 },
  { symbol: 'SOLUSD_OTC', name: 'SOL / USD (OTC)', category: 'Cripto', payout: 85, precision: 2 },
  { symbol: 'BNBUSD_OTC', name: 'BNB / USD (OTC)', category: 'Cripto', payout: 85, precision: 2 },
  { symbol: 'XRPUSD_OTC', name: 'XRP / USD (OTC)', category: 'Cripto', payout: 85, precision: 4 },
  { symbol: 'ADAUSD_OTC', name: 'ADA / USD (OTC)', category: 'Cripto', payout: 85, precision: 4 },
  { symbol: 'DOGEUSD_OTC', name: 'DOGE / USD (OTC)', category: 'Cripto', payout: 85, precision: 4 },
  { symbol: 'AVAXUSD_OTC', name: 'AVAX / USD (OTC)', category: 'Cripto', payout: 85, precision: 2 },

  // Commodities OTC (4)
  { symbol: 'XAUUSD_OTC', name: 'Gold Spot (OTC)', category: 'Commodities', payout: 85, precision: 2 },
  { symbol: 'XAGUSD_OTC', name: 'Silver Spot (OTC)', category: 'Commodities', payout: 85, precision: 3 },
  { symbol: 'USOIL_OTC', name: 'WTI Crude Oil (OTC)', category: 'Commodities', payout: 85, precision: 2 },
  { symbol: 'UKOIL_OTC', name: 'Brent Crude Oil (OTC)', category: 'Commodities', payout: 85, precision: 2 },

  // Sintéticos (6) - Padrão Ouro Opções Binárias
  { symbol: 'VOL_10', name: 'Volatilidad 10', subtitle: 'Índice V-10 (24/7)', category: 'Sintéticos', payout: 85, precision: 4 },
  { symbol: 'VOL_25', name: 'Volatilidad 25', subtitle: 'Índice V-25 (24/7)', category: 'Sintéticos', payout: 85, precision: 4 },
  { symbol: 'VOL_50', name: 'Volatilidad 50', subtitle: 'Índice V-50 (24/7)', category: 'Sintéticos', payout: 85, precision: 4 },
  { symbol: 'VOL_75', name: 'Volatilidad 75', subtitle: 'Índice V-75 (24/7)', category: 'Sintéticos', payout: 85, precision: 4 },
  { symbol: 'VOL_100', name: 'Volatilidad 100', subtitle: 'Índice V-100 (24/7)', category: 'Sintéticos', payout: 85, precision: 4 },
  { symbol: 'CRASH_BOOM_100', name: 'Crash & Boom 100', subtitle: 'Índice Crash / Boom (Spikes)', category: 'Sintéticos', payout: 85, precision: 4 },
];

export const CATEGORIES: Array<'Todos' | AssetCategory> = [
  'Todos',
  'Forex',
  'Cripto',
  'Commodities',
  'Sintéticos',
];

export function getAssetMeta(symbol: string): AssetOption {
  const norm = normalizeSymbol(symbol);
  const found = ASSET_CATALOG.find((a) => a.symbol === norm || a.symbol === symbol);
  return (
    found ?? {
      symbol: norm,
      name: norm,
      category: 'Sintéticos',
      payout: 85,
      precision: 4,
    }
  );
}

export const ASSET_BASE_PRICES: Record<string, number> = {
  // Forex OTC (18)
  EURUSD_OTC: 1.08542,
  GBPUSD_OTC: 1.29415,
  USDJPY_OTC: 153.820,
  USDCHF_OTC: 0.86510,
  AUDUSD_OTC: 0.65820,
  USDCAD_OTC: 1.38450,
  NZDUSD_OTC: 0.59820,
  EURGBP_OTC: 0.83850,
  EURJPY_OTC: 166.950,
  GBPJPY_OTC: 199.120,
  EURCAD_OTC: 1.50280,
  EURAUD_OTC: 1.64890,
  GBPAUD_OTC: 1.96620,
  GBPCAD_OTC: 1.79210,
  AUDCAD_OTC: 0.91120,
  AUDJPY_OTC: 101.250,
  CADJPY_OTC: 111.120,
  NZDJPY_OTC: 92.050,

  // Cripto OTC (8)
  BTCUSD_OTC: 64850.00,
  ETHUSD_OTC: 3450.00,
  SOLUSD_OTC: 152.40,
  BNBUSD_OTC: 585.00,
  XRPUSD_OTC: 0.5420,
  ADAUSD_OTC: 0.3540,
  DOGEUSD_OTC: 0.1240,
  AVAXUSD_OTC: 28.40,

  // Commodities OTC (4)
  XAUUSD_OTC: 2652.80,
  XAGUSD_OTC: 31.750,
  USOIL_OTC: 72.40,
  UKOIL_OTC: 76.20,

  // Sintéticos (6) - Padrão Ouro Opções Binárias
  VOL_10: 100.5420,
  VOL_25: 250.8410,
  VOL_50: 500.1250,
  VOL_75: 750.3200,
  VOL_100: 1000.4500,
  CRASH_BOOM_100: 1000.8200,
  SYNTH_VOL_10: 100.5420,
  SYNTH_VOL_25: 250.8410,
  SYNTH_VOL_50: 500.1250,
  SYNTH_VOL_75: 750.3200,
  SYNTH_VOL_100: 1000.4500,
  SYNTH_CRASH_BOOM_100: 1000.8200,
};

export function getAssetBasePrice(symbol: string): number {
  const norm = normalizeSymbol(symbol);
  if (ASSET_BASE_PRICES[norm]) {
    return ASSET_BASE_PRICES[norm];
  }
  if (ASSET_BASE_PRICES[symbol]) {
    return ASSET_BASE_PRICES[symbol];
  }
  const normalized = symbol.endsWith('_OTC') ? symbol : `${symbol}_OTC`;
  if (ASSET_BASE_PRICES[normalized]) {
    return ASSET_BASE_PRICES[normalized];
  }

  // Fallbacks defensivos por classe
  if (symbol.includes('BTC')) return 64850.0;
  if (symbol.includes('ETH')) return 3450.0;
  if (symbol.includes('SOL')) return 152.4;
  if (symbol.includes('XAU')) return 2652.8;
  if (symbol.includes('JPY')) return 153.82;
  if (symbol.startsWith('EUR') || symbol.startsWith('GBP') || symbol.startsWith('AUD') || symbol.startsWith('NZD') || symbol.startsWith('USD')) {
    return 1.15;
  }
  if (symbol.startsWith('VOL_') || symbol.startsWith('SYNTH_VOL_')) return 500.0;

  return 100.0;
}


/**
 * Nome curto de exibição (TRADEROOM_POLISH): "Vol 50", "EUR/USD", "DOGE/USD", "Gold".
 * Nunca devolve o símbolo técnico com "_" ou "SYNTH_".
 */
const DISPLAY_OVERRIDES: Record<string, string> = {
  CRASH_BOOM_100: 'Crash 100',
  XAUUSD: 'Gold',
  XAGUSD: 'Silver',
  USOIL: 'WTI Oil',
  UKOIL: 'Brent Oil',
};

export function getAssetDisplayName(symbol: string): string {
  if (!symbol) return '';
  const norm = normalizeSymbol(symbol).replace(/_OTC$/, '');
  if (DISPLAY_OVERRIDES[norm]) return DISPLAY_OVERRIDES[norm];
  const vol = norm.match(/^VOL_(\d+)$/);
  if (vol) return `Vol ${vol[1]}`;
  if (/^[A-Z]{6}$/.test(norm)) return `${norm.slice(0, 3)}/${norm.slice(3)}`;
  const pair = norm.match(/^([A-Z]{3,5})(USD|EUR|JPY|GBP)$/);
  if (pair) return `${pair[1]}/${pair[2]}`;
  return norm.replace(/_/g, ' ').trim();
}

/** Locale do gráfico com TRADEROOM_POLISH: espanhol com ponto decimal, como a IQ. */
export const POLISH_CHART_LOCALE = 'es-MX';

/**
 * Casas decimais do eixo de preço com TRADEROOM_POLISH.
 * Índices sintéticos (na casa das centenas) usam 2; os demais seguem o catálogo.
 */
export function getAxisPrecision(symbol: string): number {
  const meta = getAssetMeta(symbol || '');
  return meta.category === 'Sintéticos' ? 2 : meta.precision;
}
