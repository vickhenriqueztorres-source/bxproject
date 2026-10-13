import { randomBytes } from "node:crypto";

export interface RandomSource {
  nextUniform(): number;
  nextGaussian(): number;
}

/**
 * Fonte de aleatoriedade baseada estritamente em CSPRNG criptográfico do Node.js
 * Inviolabilidade: M-01, B-06 (Proibição total de Math.random)
 */
export class CSPRNGRandomSource implements RandomSource {
  public nextUniform(): number {
    const buffer = randomBytes(8);
    const uInt64 = buffer.readBigUInt64BE(0);
    // Intervalo uniforme estrito (0, 1] com 53 bits de precisão
    return Number(uInt64 + 1n) / 18446744073709551616.0;
  }

  public nextGaussian(): number {
    const u1 = this.nextUniform();
    const u2 = this.nextUniform();
    // Transformação Box-Muller: Z ~ N(0, 1)
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

export interface OUEngineParams {
  symbol: string;
  basePrice: number;
  currentPrice?: number;
  theta?: number; // Taxa de reversão à média (padrão: 0.05)
  sigma?: number; // Volatilidade estocástica (padrão: 0.0015)
  dt?: number;    // Intervalo de tempo discreto (padrão: 1.0s)
}

/**
 * Motor estocástico de Ornstein-Uhlenbeck com reversão à média e barreiras de proteção
 * Equação: dX_t = theta * (mu - X_t) * dt + sigma * X_t * dW_t
 */
export class SyntheticOUEngine {
  public readonly symbol: string;
  public readonly basePrice: number;
  public currentPrice: number;
  public readonly theta: number;
  public readonly sigma: number;
  public readonly dt: number;
  private readonly rng: RandomSource;

  constructor(params: OUEngineParams, rng?: RandomSource) {
    this.symbol = params.symbol;
    this.basePrice = params.basePrice;
    this.currentPrice = params.currentPrice ?? params.basePrice;
    this.theta = params.theta ?? 0.05;
    this.sigma = params.sigma ?? 0.0015;
    this.dt = params.dt ?? 1.0;
    this.rng = rng ?? new CSPRNGRandomSource();
  }

  public generateNextPrice(): { priceNumeric: number; priceString: string } {
    const z = this.rng.nextGaussian();
    const drift = this.theta * (this.basePrice - this.currentPrice) * this.dt;
    const diffusion = this.sigma * this.currentPrice * Math.sqrt(this.dt) * z;
    const next = this.currentPrice + drift + diffusion;

    // Barreira de proteção: impede preços negativos ou desvios absurdos (< 10% do preço base)
    const minPrice = this.basePrice * 0.1;
    const maxPrice = this.basePrice * 10.0;
    let clamped = next;
    if (clamped < minPrice) clamped = minPrice;
    if (clamped > maxPrice) clamped = maxPrice;

    this.currentPrice = Number(clamped.toFixed(6));
    return {
      priceNumeric: this.currentPrice,
      priceString: this.currentPrice.toFixed(6)
    };
  }
}
