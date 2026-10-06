"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyntheticOUEngine = exports.CSPRNGRandomSource = void 0;
const node_crypto_1 = require("node:crypto");
/**
 * Fonte de aleatoriedade baseada estritamente em CSPRNG criptográfico do Node.js
 * Inviolabilidade: M-01, B-06 (Proibição total de Math.random)
 */
class CSPRNGRandomSource {
    nextUniform() {
        const buffer = (0, node_crypto_1.randomBytes)(8);
        const uInt64 = buffer.readBigUInt64BE(0);
        // Intervalo uniforme estrito (0, 1] com 53 bits de precisão
        return Number(uInt64 + 1n) / 18446744073709551616.0;
    }
    nextGaussian() {
        const u1 = this.nextUniform();
        const u2 = this.nextUniform();
        // Transformação Box-Muller: Z ~ N(0, 1)
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
}
exports.CSPRNGRandomSource = CSPRNGRandomSource;
/**
 * Motor estocástico de Ornstein-Uhlenbeck com reversão à média e barreiras de proteção
 * Equação: dX_t = theta * (mu - X_t) * dt + sigma * X_t * dW_t
 */
class SyntheticOUEngine {
    symbol;
    basePrice;
    currentPrice;
    theta;
    sigma;
    dt;
    rng;
    constructor(params, rng) {
        this.symbol = params.symbol;
        this.basePrice = params.basePrice;
        this.currentPrice = params.currentPrice ?? params.basePrice;
        this.theta = params.theta ?? 0.05;
        this.sigma = params.sigma ?? 0.0015;
        this.dt = params.dt ?? 1.0;
        this.rng = rng ?? new CSPRNGRandomSource();
    }
    generateNextPrice() {
        const z = this.rng.nextGaussian();
        const drift = this.theta * (this.basePrice - this.currentPrice) * this.dt;
        const diffusion = this.sigma * this.currentPrice * Math.sqrt(this.dt) * z;
        let next = this.currentPrice + drift + diffusion;
        // Barreira de proteção: impede preços negativos ou desvios absurdos (< 1% do preço base)
        const minPrice = this.basePrice * 0.1;
        const maxPrice = this.basePrice * 10.0;
        if (next < minPrice)
            next = minPrice;
        if (next > maxPrice)
            next = maxPrice;
        this.currentPrice = Number(next.toFixed(6));
        return {
            priceNumeric: this.currentPrice,
            priceString: this.currentPrice.toFixed(6)
        };
    }
}
exports.SyntheticOUEngine = SyntheticOUEngine;
