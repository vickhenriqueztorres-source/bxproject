import { DisplayCurrencyCode, PHASE2_DISPLAY_CURRENCIES } from "./types.js";

export interface CurrencyConfig {
  code: DisplayCurrencyCode;
  symbol: string;
  name: string;
  defaultLocale: string;
  decimals: number;
}

export const CURRENCY_CONFIGS: Record<DisplayCurrencyCode, CurrencyConfig> = {
  // Já implementados (6)
  BRL: { code: "BRL", symbol: "R$", name: "Real Brasileiro", defaultLocale: "pt-BR", decimals: 2 },
  MXN: { code: "MXN", symbol: "Mex$", name: "Peso Mexicano", defaultLocale: "es-MX", decimals: 2 },
  COP: { code: "COP", symbol: "Col$", name: "Peso Colombiano", defaultLocale: "es-CO", decimals: 0 },
  ARS: { code: "ARS", symbol: "$", name: "Peso Argentino", defaultLocale: "es-AR", decimals: 2 },
  CLP: { code: "CLP", symbol: "CLP$", name: "Peso Chileno", defaultLocale: "es-CL", decimals: 0 },
  PEN: { code: "PEN", symbol: "S/.", name: "Sol Peruano", defaultLocale: "es-PE", decimals: 2 },

  // Novos (9) - USD compartilhado por EC/SV/PA
  VES: { code: "VES", symbol: "Bs.D", name: "Bolívar Digital", defaultLocale: "es-VE", decimals: 2 },
  GTQ: { code: "GTQ", symbol: "Q", name: "Quetzal Guatemalteco", defaultLocale: "es-GT", decimals: 2 },
  BOB: { code: "BOB", symbol: "Bs.", name: "Boliviano", defaultLocale: "es-BO", decimals: 2 },
  DOP: { code: "DOP", symbol: "RD$", name: "Peso Dominicano", defaultLocale: "es-DO", decimals: 2 },
  HNL: { code: "HNL", symbol: "L", name: "Lempira Hondureño", defaultLocale: "es-HN", decimals: 2 },
  PYG: { code: "PYG", symbol: "₲", name: "Guaraní Paraguayo", defaultLocale: "es-PY", decimals: 0 },
  NIO: { code: "NIO", symbol: "C$", name: "Córdoba Nicaragüense", defaultLocale: "es-NI", decimals: 2 },
  CRC: { code: "CRC", symbol: "₡", name: "Colón Costarricense", defaultLocale: "es-CR", decimals: 2 },
  UYU: { code: "UYU", symbol: "$U", name: "Peso Uruguayo", defaultLocale: "es-UY", decimals: 2 }
};

/**
 * Formata um valor numérico para a moeda e locale de exibição selecionados
 */
export function formatCurrency(
  amount: number,
  currency: DisplayCurrencyCode,
  overrideLocale?: string
): string {
  const config = CURRENCY_CONFIGS[currency];
  if (!config) {
    return `${currency} ${amount.toFixed(2)}`;
  }

  const locale = overrideLocale || config.defaultLocale;

  try {
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals
    }).format(amount);

    return `${config.symbol} ${formattedNumber}`;
  } catch {
    return `${config.symbol} ${amount.toFixed(config.decimals)}`;
  }
}

/**
 * Converte stake_minor (centavos de USD) para o valor estimado na moeda de exibição.
 * IMPORTANTE: Essa função é puramente visual (Display Only).
 * O valor real da ordem e do ledger é sempre mantido em centavos de USD (I-01, I-02, D-18).
 */
export function convertUSDMinorToDisplay(
  amountMinorUSD: number,
  exchangeRateToUSD: number,
  targetCurrency: DisplayCurrencyCode,
  overrideLocale?: string
): { amount: number; formatted: string } {
  const config = CURRENCY_CONFIGS[targetCurrency];
  const decimals = config ? config.decimals : 2;

  // 1 USD = 100 minor units
  const amountUSD = amountMinorUSD / 100;
  const rawConverted = amountUSD * exchangeRateToUSD;

  // Arredonda para o número de casas da moeda (0 para COP/CLP, 2 para as demais)
  const factor = Math.pow(10, decimals);
  const roundedAmount = Math.round(rawConverted * factor) / factor;

  const formatted = formatCurrency(roundedAmount, targetCurrency, overrideLocale);

  return {
    amount: roundedAmount,
    formatted
  };
}
