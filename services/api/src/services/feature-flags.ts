import { Pool } from "pg";
import { Redis } from "ioredis";
import { CountryCode, PHASE2_COUNTRIES, SystemFeatureFlags } from "@broker/shared";

export const DEFAULT_SYSTEM_FEATURE_FLAGS: SystemFeatureFlags = {
  payments_enabled: false,
  kyc_required: false,
  otc_enabled: true,
  synthetic_enabled: true,
  country_br_enabled: true,
  country_mx_enabled: true,
  country_co_enabled: true,
  country_ar_enabled: true,
  country_cl_enabled: true,
  country_pe_enabled: true
};

export interface CountryWithFlags {
  code: CountryCode;
  name: string;
  default_currency: string;
  default_locale: string;
  is_active: boolean;
  flags: Record<string, boolean>;
}

export class FeatureFlagsService {
  private pg: Pool;
  private redis: Redis | null;
  private readonly CACHE_TTL_SECONDS = 60;

  // Defaults seguros em memória (fail-closed para segurança caso banco e redis fiquem fora)
  private readonly defaultFallbackFlags: Record<string, boolean> = {
    trading_enabled: true,
    otc_real_feed: true,
    demo_wallet: true
  };

  constructor(pg: Pool, redis: Redis | null = null) {
    this.pg = pg;
    this.redis = redis;
  }

  private getCacheKey(country: string): string {
    return `broker:flags:country:${country.toUpperCase()}`;
  }

  private getSystemFlagsCacheKey(): string {
    return "broker:system:feature_flags";
  }

  /**
   * Retorna o mapa consolidado das 10 Feature Flags do sistema (com cache no Redis)
   */
  async getSystemFlags(): Promise<SystemFeatureFlags> {
    const cacheKey = this.getSystemFlagsCacheKey();

    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return { ...DEFAULT_SYSTEM_FEATURE_FLAGS, ...JSON.parse(cached) };
        }
      } catch {
        // Fallback para PostgreSQL
      }
    }

    const flags: SystemFeatureFlags = { ...DEFAULT_SYSTEM_FEATURE_FLAGS };

    try {
      const result = await this.pg.query<{ flag_key: string; enabled: boolean }>(
        "SELECT flag_key, enabled FROM system_feature_flags"
      );
      for (const row of result.rows) {
        flags[row.flag_key] = row.enabled;
      }

      if (this.redis) {
        try {
          await this.redis.set(cacheKey, JSON.stringify(flags), "EX", this.CACHE_TTL_SECONDS);
        } catch {
          // Ignora falha de escrita no cache
        }
      }
    } catch {
      // Retorna flags default caso tabela ainda não exista
    }

    return flags;
  }

  /**
   * Verifica se uma feature flag do sistema está habilitada
   */
  async isSystemFeatureEnabled(flagKey: string): Promise<boolean> {
    const flags = await this.getSystemFlags();
    return flags[flagKey] ?? false;
  }

  /**
   * Altera ou insere uma Feature Flag do sistema e invalida o cache
   */
  async setSystemFlag(flagKey: string, enabled: boolean): Promise<void> {
    await this.pg.query(
      `INSERT INTO system_feature_flags (flag_key, enabled, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (flag_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
      [flagKey, enabled]
    );

    if (this.redis) {
      try {
        await this.redis.del(this.getSystemFlagsCacheKey());
        await this.redis.publish("broker:flags:invalidated", `system:${flagKey}`);
      } catch {
        // Ignora erro de cache
      }
    }
  }

  /**
   * Retorna se o país está globalmente ativo (is_active e flag country_{code}_enabled)
   */
  async isCountryActive(country: string): Promise<boolean> {
    const code = country.toUpperCase() as CountryCode;
    if (!PHASE2_COUNTRIES.includes(code)) {
      return false;
    }

    // 1. Checa a feature flag central country_{code}_enabled (sem necessidade de deploy)
    const countryFlagKey = `country_${code.toLowerCase()}_enabled`;
    const isFlagEnabled = await this.isSystemFeatureEnabled(countryFlagKey);
    if (!isFlagEnabled) {
      return false;
    }

    try {
      const flags = await this.getCountryFlags(code);
      if (flags["_is_country_active"] !== undefined) {
        return flags["_is_country_active"];
      }
    } catch {
      // Continua para o banco
    }

    try {
      const result = await this.pg.query<{ is_active: boolean }>(
        "SELECT is_active FROM countries WHERE code = $1 LIMIT 1",
        [code]
      );
      if (result.rows.length === 0) return false;
      return result.rows[0].is_active;
    } catch {
      return false; // Fail-closed em caso de erro severo
    }
  }

  /**
   * Retorna todas as feature flags de um país, com cache em Redis
   */
  async getCountryFlags(country: string): Promise<Record<string, boolean>> {
    const code = country.toUpperCase() as CountryCode;
    if (!PHASE2_COUNTRIES.includes(code)) {
      return {};
    }

    const cacheKey = this.getCacheKey(code);

    // 1. Tenta recuperar do Redis
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {
        // Fallback silencioso para PostgreSQL caso o Redis falhe
      }
    }

    // 2. Consulta no PostgreSQL
    const flags: Record<string, boolean> = { ...this.defaultFallbackFlags };

    try {
      const countryRes = await this.pg.query<{ is_active: boolean }>(
        "SELECT is_active FROM countries WHERE code = $1 LIMIT 1",
        [code]
      );
      if (countryRes.rows.length > 0) {
        flags["_is_country_active"] = countryRes.rows[0].is_active;
      }

      const flagsRes = await this.pg.query<{ flag_key: string; enabled: boolean }>(
        "SELECT flag_key, enabled FROM country_feature_flags WHERE country_code = $1",
        [code]
      );

      for (const row of flagsRes.rows) {
        flags[row.flag_key] = row.enabled;
      }

      // 3. Salva no cache do Redis
      if (this.redis) {
        try {
          await this.redis.set(cacheKey, JSON.stringify(flags), "EX", this.CACHE_TTL_SECONDS);
        } catch {
          // Ignora falha de escrita no cache
        }
      }
    } catch {
      // Em falha total do PostgreSQL, mantém os defaults
    }

    return flags;
  }

  /**
   * Checa se uma flag específica está habilitada para o país
   */
  async isFeatureEnabled(country: string, flagKey: string): Promise<boolean> {
    const flags = await this.getCountryFlags(country);
    return flags[flagKey] ?? false;
  }

  /**
   * Altera ou insere uma feature flag para o país e invalida o cache
   */
  async setCountryFlag(country: string, flagKey: string, enabled: boolean): Promise<void> {
    const code = country.toUpperCase() as CountryCode;
    if (!PHASE2_COUNTRIES.includes(code)) {
      throw new Error(`País inválido para Fase 2: ${country}`);
    }

    await this.pg.query(
      `INSERT INTO country_feature_flags (country_code, flag_key, enabled, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (country_code, flag_key)
       DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
      [code, flagKey, enabled]
    );

    await this.invalidateCache(code);
  }

  /**
   * Ativa ou desativa um país por completo
   */
  async setCountryActive(country: string, active: boolean): Promise<void> {
    const code = country.toUpperCase() as CountryCode;
    if (!PHASE2_COUNTRIES.includes(code)) {
      throw new Error(`País inválido para Fase 2: ${country}`);
    }

    await this.pg.query(
      "UPDATE countries SET is_active = $1, updated_at = NOW() WHERE code = $2",
      [active, code]
    );

    await this.invalidateCache(code);
  }

  /**
   * Invalida o cache do país no Redis e emite notificação PubSub
   */
  async invalidateCache(country: string): Promise<void> {
    const code = country.toUpperCase();
    if (this.redis) {
      try {
        await this.redis.del(this.getCacheKey(code));
        await this.redis.publish("broker:flags:invalidated", code);
      } catch {
        // Ignora erro de cache
      }
    }
  }

  /**
   * Lista todos os 6 países com suas flags para a visão do Admin
   */
  async getAllCountriesWithFlags(): Promise<CountryWithFlags[]> {
    const res = await this.pg.query<{
      code: CountryCode;
      name: string;
      default_currency: string;
      default_locale: string;
      is_active: boolean;
    }>("SELECT code, name, default_currency, default_locale, is_active FROM countries ORDER BY name ASC");

    const countriesWithFlags: CountryWithFlags[] = [];

    for (const c of res.rows) {
      const flags = await this.getCountryFlags(c.code);
      countriesWithFlags.push({
        code: c.code,
        name: c.name,
        default_currency: c.default_currency,
        default_locale: c.default_locale,
        is_active: c.is_active,
        flags
      });
    }

    return countriesWithFlags;
  }
}
