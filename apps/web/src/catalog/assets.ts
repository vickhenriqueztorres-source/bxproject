export type AssetCategory = 'Forex' | 'Cripto' | 'Commodities' | 'Sintéticos';

export interface AssetOption {
  symbol: string;
  name: string;
  category: AssetCategory;
  payout: number;
  precision: number;
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

  // Sintéticos (6)
  { symbol: 'SYNTH_VOL_10', name: 'Volatility 10 Index', category: 'Sintéticos', payout: 85, precision: 4 },
  { symbol: 'SYNTH_VOL_25', name: 'Volatility 25 Index', category: 'Sintéticos', payout: 85, precision: 4 },
  { symbol: 'SYNTH_VOL_50', name: 'Volatility 50 Index', category: 'Sintéticos', payout: 85, precision: 4 },
  { symbol: 'SYNTH_VOL_75', name: 'Volatility 75 Index', category: 'Sintéticos', payout: 85, precision: 4 },
  { symbol: 'SYNTH_VOL_100', name: 'Volatility 100 Index', category: 'Sintéticos', payout: 85, precision: 4 },
  { symbol: 'SYNTH_CRASH_BOOM_100', name: 'Crash/Boom 100 Index', category: 'Sintéticos', payout: 85, precision: 4 },
];

export const CATEGORIES: Array<'Todos' | AssetCategory> = [
  'Todos',
  'Forex',
  'Cripto',
  'Commodities',
  'Sintéticos',
];

export function getAssetMeta(symbol: string): AssetOption {
  const found = ASSET_CATALOG.find((a) => a.symbol === symbol);
  return (
    found ?? {
      symbol,
      name: symbol,
      category: 'Sintéticos',
      payout: 85,
      precision: 4,
    }
  );
}
