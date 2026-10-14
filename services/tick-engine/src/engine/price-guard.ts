import { NormalizedQuote } from "./price-normalizer.js";

export interface GuardEvaluationResult {
  accepted: boolean;
  rejectReason?: "OLD_PRICE" | "OUT_OF_ORDER" | "ABSURD_JUMP" | "INVALID_QUOTE";
  message?: string;
  price: number;
  timestampIso: string;
  ageMs: number;
  variationPercentage: number;
}

export class PriceGuard {
  // Limites rigorosos definidos na especificação da Fase 2
  public static readonly MAX_AGE_MS = 5_000;       // Rejeita preço velho (> 5s)
  public static readonly MAX_JUMP_RATIO = 0.10;    // Rejeita salto absurdo (> 10%)

  private lastAcceptedPrice: number | null = null;
  private lastAcceptedTimestampMs: number = 0;

  constructor(initialAnchorPrice?: number) {
    if (initialAnchorPrice && initialAnchorPrice > 0) {
      this.lastAcceptedPrice = initialAnchorPrice;
      this.lastAcceptedTimestampMs = 0;
    }
  }

  /**
   * Avalia uma cotação normalizada contra as regras de segurança do Price Guard
   */
  public evaluate(quote: NormalizedQuote, nowMs: number = Date.now()): GuardEvaluationResult {
    if (!quote.isValid) {
      return {
        accepted: false,
        rejectReason: "INVALID_QUOTE",
        message: quote.rejectReason || "Cotação inválida fornecida pelo normalizador",
        price: quote.price,
        timestampIso: quote.timestampIso,
        ageMs: 0,
        variationPercentage: 0
      };
    }

    const ageMs = Math.abs(nowMs - quote.timestampMs);

    // 1. Rejeição de Tick Fora de Ordem (timestamp < último aceito)
    if (this.lastAcceptedTimestampMs > 0 && quote.timestampMs < this.lastAcceptedTimestampMs) {
      return {
        accepted: false,
        rejectReason: "OUT_OF_ORDER",
        message: `Tick fora de ordem rejeitado: timestamp ${quote.timestampMs}ms é anterior ao último aceito (${this.lastAcceptedTimestampMs}ms)`,
        price: quote.price,
        timestampIso: quote.timestampIso,
        ageMs,
        variationPercentage: 0
      };
    }

    // 2. Rejeição de Preço Velho / Atrasado (> 5 segundos)
    if (ageMs > PriceGuard.MAX_AGE_MS) {
      return {
        accepted: false,
        rejectReason: "OLD_PRICE",
        message: `Preço rejeitado por obsolescência: idade de ${ageMs}ms excede limite de ${PriceGuard.MAX_AGE_MS}ms`,
        price: quote.price,
        timestampIso: quote.timestampIso,
        ageMs,
        variationPercentage: 0
      };
    }

    // 3. Rejeição de Salto Absurdo (> 10%)
    let variation = 0;
    if (this.lastAcceptedPrice !== null && this.lastAcceptedPrice > 0) {
      variation = Math.abs(quote.price - this.lastAcceptedPrice) / this.lastAcceptedPrice;
      if (variation > PriceGuard.MAX_JUMP_RATIO) {
        return {
          accepted: false,
          rejectReason: "ABSURD_JUMP",
          message: `Salto de preço rejeitado: variação de ${(variation * 100).toFixed(2)}% excede limite máximo de 10%`,
          price: quote.price,
          timestampIso: quote.timestampIso,
          ageMs,
          variationPercentage: variation * 100
        };
      }
    }

    // Cotação Aprovada: atualiza o último preço e timestamp aceitos
    this.lastAcceptedPrice = quote.price;
    this.lastAcceptedTimestampMs = quote.timestampMs;

    return {
      accepted: true,
      price: quote.price,
      timestampIso: quote.timestampIso,
      ageMs,
      variationPercentage: variation * 100
    };
  }

  public getLastAcceptedPrice(): number | null {
    return this.lastAcceptedPrice;
  }

  public getLastAcceptedTimestampMs(): number {
    return this.lastAcceptedTimestampMs;
  }

  public setAnchorPrice(price: number): void {
    this.lastAcceptedPrice = price;
    this.lastAcceptedTimestampMs = 0;
  }
}
