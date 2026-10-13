import { Pool } from "pg";
import { Redis } from "ioredis";
import {
  DisplayCurrencyCode,
  DisplayCurrencyDTO,
  convertUSDMinorToDisplay,
  CURRENCY_CONFIGS,
  PHASE2_DISPLAY_CURRENCIES
} from "@broker/shared";

// Taxas nominais de contingência (caso banco e Redis fiquem inacessíveis simultaneamente)
const CONTINGENCY_RATES: Record<DisplayCurrencyCode, number> = {
  BRL: 5.500000,
  MXN: 19.500000,
  COP: 4150.000000,
  ARS: 980.000000,
  CLP: 940.000000,
  PEN: 3.750000
};

export class ExchangeRateService {
  private pg: Pool;
  private redis: Redis | null;
  private readonly CACHE_KEY = "broker:rates:usd";
  private readonly CACHE_TTL_SECONDS = 300;

  constructor(pg: Pool, redis: Redis | null = null) {
    this.pg = pg;
    this.redis = redis;
  }

  /**
   * Retorna todas as moedas de exibição cadastradas com taxas e metadados
   */
  async getAllCurrencies(): Promise<DisplayCurrencyDTO[]> {
    // 1. Tenta recuperar taxas consolidadas do Redis
    if (this.redis) {
      try {
        const cached = await this.redis.get(this.CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {
        // Fallback para o PostgreSQL
      }
    }

    // 2. Consulta no PostgreSQL
    try {
      const res = await this.pg.query<{
        code: DisplayCurrencyCode;
        symbol: string;
        name: string;
        decimals: number;
        exchange_rate_to_usd: string;
      }>("SELECT code, symbol, name, decimals, exchange_rate_to_usd FROM display_currencies ORDER BY code ASC");

      if (res.rows.length > 0) {
        const currencies: DisplayCurrencyDTO[] = res.rows.map((r) => ({
          code: r.code,
          symbol: r.symbol,
          name: r.name,
          decimals: r.decimals,
          exchange_rate_to_usd: r.exchange_rate_to_usd
        }));

        if (this.redis) {
          try {
            await this.redis.set(this.CACHE_KEY, JSON.stringify(currencies), "EX", this.CACHE_TTL_SECONDS);
          } catch {
            // Ignora erro de escrita no cache
          }
        }

        return currencies;
      }
    } catch {
      // Fallback para taxas de contingência
    }

    // 3. Fallback de contingência
    return PHASE2_DISPLAY_CURRENCIES.map((code) => {
      const config = CURRENCY_CONFIGS[code];
      return {
        code,
        symbol: config.symbol,
        name: config.name,
        decimals: config.decimals,
        exchange_rate_to_usd: CONTINGENCY_RATES[code].toFixed(6)
      };
    });
  }

  /**
   * Retorna a taxa de câmbio de 1 USD para a moeda de exibição solicitada
   */
  async getRateToUSD(currency: DisplayCurrencyCode): Promise<number> {
    const list = await this.getAllCurrencies();
    const found = list.find((c) => c.code === currency);
    if (found) {
      return parseFloat(found.exchange_rate_to_usd);
    }
    return CONTINGENCY_RATES[currency] || 1.0;
  }

  /**
   * Converte valor em USD minor (centavos) para a moeda de exibição.
   * Puramente informativo para o cliente / UI (I-01, I-02, D-18).
   */
  async convertUSDMinor(
    amountMinorUSD: number,
    targetCurrency: DisplayCurrencyCode,
    locale?: string
  ): Promise<{
    amount: number;
    formatted: string;
    symbol: string;
    currency: DisplayCurrencyCode;
    rate: number;
  }> {
    const rate = await this.getRateToUSD(targetCurrency);
    const { amount, formatted } = convertUSDMinorToDisplay(amountMinorUSD, rate, targetCurrency, locale);
    const symbol = CURRENCY_CONFIGS[targetCurrency]?.symbol || "$";

    return {
      amount,
      formatted,
      symbol,
      currency: targetCurrency,
      rate
    };
  }
}
