/**
 * Módulo: PriceNormalizer
 * Responsabilidades:
 * 1. Normaliza símbolo de diferentes convenções de provedores para o formato OTC canônico da plataforma.
 * 2. Valida se o timestamp é válido e estruturado em UTC.
 * 3. Detecta outliers estatísticos grosseiros (preços <= 0, NaN, infinitos ou fora de faixas de sanidade).
 */

export interface NormalizedQuote {
  canonicalSymbol: string;
  price: number;
  timestampMs: number;
  timestampIso: string;
  isValid: boolean;
  rejectReason?: string;
}

export const CANONICAL_OTC_SYMBOLS = [
  "BTCUSD_OTC",
  "ETHUSD_OTC",
  "EURUSD_OTC",
  "XAUUSD_OTC"
] as const;

export type CanonicalOTCSymbol = typeof CANONICAL_OTC_SYMBOLS[number];

// Faixas de sanidade para detecção de outliers grotescos
export const ASSET_SANITY_RANGES: Record<CanonicalOTCSymbol, { min: number; max: number; decimals: number }> = {
  BTCUSD_OTC: { min: 1_000, max: 500_000, decimals: 2 },
  ETHUSD_OTC: { min: 100, max: 50_000, decimals: 2 },
  EURUSD_OTC: { min: 0.2, max: 5.0, decimals: 5 },
  XAUUSD_OTC: { min: 500, max: 20_000, decimals: 2 }
};

export class PriceNormalizer {
  /**
   * Normaliza um símbolo externo de mercado para o símbolo canônico OTC da plataforma
   */
  static normalizeSymbol(rawSymbol: string): CanonicalOTCSymbol | null {
    if (!rawSymbol || typeof rawSymbol !== "string") return null;

    const cleaned = rawSymbol.toUpperCase().replace(/[\/\-_]/g, "");

    if (cleaned.startsWith("BTCUSD") || cleaned.startsWith("BTCUSDT")) return "BTCUSD_OTC";
    if (cleaned.startsWith("ETHUSD") || cleaned.startsWith("ETHUSDT")) return "ETHUSD_OTC";
    if (cleaned.startsWith("EURUSD")) return "EURUSD_OTC";
    if (cleaned.startsWith("XAUUSD") || cleaned.includes("GOLD")) return "XAUUSD_OTC";

    // Se já estiver no formato canônico
    if (CANONICAL_OTC_SYMBOLS.includes(cleaned as CanonicalOTCSymbol)) {
      return cleaned as CanonicalOTCSymbol;
    }

    return null;
  }

  /**
   * Valida e converte timestamp para milissegundos UTC e string ISO
   */
  static parseTimestamp(rawTimestamp: string | number | Date): { timestampMs: number; timestampIso: string } | null {
    let dateObj: Date;

    if (rawTimestamp instanceof Date) {
      dateObj = rawTimestamp;
    } else if (typeof rawTimestamp === "number") {
      // Suporte tanto para segundos (Unix) quanto milissegundos
      const ms = rawTimestamp < 10_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;
      dateObj = new Date(ms);
    } else if (typeof rawTimestamp === "string") {
      dateObj = new Date(rawTimestamp);
    } else {
      return null;
    }

    const ms = dateObj.getTime();
    if (isNaN(ms) || ms <= 0) return null;

    return {
      timestampMs: ms,
      timestampIso: dateObj.toISOString()
    };
  }

  /**
   * Normaliza e valida uma cotação bruta recebida de qualquer provedor
   */
  static normalizeQuote(
    rawSymbol: string,
    rawPrice: number | string,
    rawTimestamp: string | number | Date
  ): NormalizedQuote {
    const canonicalSymbol = this.normalizeSymbol(rawSymbol);
    if (!canonicalSymbol) {
      return {
        canonicalSymbol: rawSymbol,
        price: 0,
        timestampMs: 0,
        timestampIso: "",
        isValid: false,
        rejectReason: `Símbolo desconhecido ou não suportado: '${rawSymbol}'`
      };
    }

    const priceNum = typeof rawPrice === "number" ? rawPrice : parseFloat(rawPrice);
    if (isNaN(priceNum) || !isFinite(priceNum) || priceNum <= 0) {
      return {
        canonicalSymbol,
        price: 0,
        timestampMs: 0,
        timestampIso: "",
        isValid: false,
        rejectReason: `Preço inválido ou não positivo: '${rawPrice}'`
      };
    }

    const parsedTime = this.parseTimestamp(rawTimestamp);
    if (!parsedTime) {
      return {
        canonicalSymbol,
        price: priceNum,
        timestampMs: 0,
        timestampIso: "",
        isValid: false,
        rejectReason: `Timestamp corrompido ou inválido: '${rawTimestamp}'`
      };
    }

    // Detecção de Outlier (fora da faixa de sanidade do ativo)
    const sanity = ASSET_SANITY_RANGES[canonicalSymbol];
    if (priceNum < sanity.min || priceNum > sanity.max) {
      return {
        canonicalSymbol,
        price: priceNum,
        timestampMs: parsedTime.timestampMs,
        timestampIso: parsedTime.timestampIso,
        isValid: false,
        rejectReason: `Outlier detectado: preço ${priceNum} fora da faixa de sanidade [${sanity.min} - ${sanity.max}]`
      };
    }

    return {
      canonicalSymbol,
      price: Number(priceNum.toFixed(sanity.decimals)),
      timestampMs: parsedTime.timestampMs,
      timestampIso: parsedTime.timestampIso,
      isValid: true
    };
  }
}
