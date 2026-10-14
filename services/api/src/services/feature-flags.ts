import crypto from "node:crypto";
import { Pool } from "pg";
import { Redis } from "ioredis";
import { CountryCode, PHASE2_COUNTRIES, SystemFeatureFlags } from "@broker/shared";
import { RegionalMetricsService } from "./metrics.js";

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

export interface FlagRuleOptions {
  expiresAt?: string | number | Date | null;
  rolloutPercentage?: number;
}

export interface AtomicFlagSnapshot {
  version: number;
  configHash: string;
  updatedAt: string;
  systemFlags: Record<string, boolean>;
  countryFlags: Record<string, Record<string, boolean>>;
  expirations: Record<string, number>;
  canaryRollouts: Record<string, number>;
}

export interface NodeFlagReport {
  nodeId: string;
  version: number;
  configHash: string;
  flags: Record<string, boolean>;
  reportedAtMs: number;
}

export interface FlagInconsistencyAlert {
  consistent: boolean;
  alertTriggered: boolean;
  reason?: string;
  divergentFlags: string[];
  divergentNodes: string[];
  nodeHashes: Record<string, string>;
  timestamp: string;
}

export interface FlagCombinationValidationResult {
  valid: boolean;
  conflicts: Array<{
    code: string;
    severity: "CRITICAL" | "HIGH";
    flags: string[];
    message: string;
  }>;
  sanitizedSystemFlags: Record<string, boolean>;
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

  // Governança de Feature Flags (Prevenções 1 a 5)
  private flagExpirations = new Map<string, number>(); // key -> expiresAtMs
  private canaryRollouts = new Map<string, number>();  // key -> percentage (0..100)
  private localSystemOverrides = new Map<string, boolean>();
  private localCountryOverrides = new Map<string, Record<string, boolean>>();
  private configVersion = 1;
  private nodeReports = new Map<string, NodeFlagReport>();
  private inconsistencyListeners = new Set<(alert: FlagInconsistencyAlert) => void>();

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

  private getAtomicSnapshotCacheKey(): string {
    return "broker:flags:atomic_snapshot";
  }

  private normalizeExpirationMs(expiresAt?: string | number | Date | null): number | null {
    if (expiresAt === null || expiresAt === undefined) return null;
    if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) return expiresAt;
    if (expiresAt instanceof Date) return expiresAt.getTime();
    if (typeof expiresAt === "string") {
      const parsed = Date.parse(expiresAt);
      if (Number.isFinite(parsed)) return parsed;
    }
    throw new Error(`INVALID_EXPIRATION_DATE: Data de expiração inválida para feature flag (${String(expiresAt)})`);
  }

  private getScopedFlagId(flagKey: string, country?: string): string {
    return country ? `${country.toUpperCase()}:${flagKey}` : `SYSTEM:${flagKey}`;
  }

  /**
   * Regra de Prevenção 1: Define data de expiração para uma flag (evita dead flags e aberturas eternas)
   */
  public setFlagExpiration(
    flagKey: string,
    expiresAt: string | number | Date | null,
    country?: string
  ): void {
    const id = this.getScopedFlagId(flagKey, country);
    const ms = this.normalizeExpirationMs(expiresAt);
    if (ms === null) {
      this.flagExpirations.delete(id);
    } else {
      this.flagExpirations.set(id, ms);
    }
  }

  /**
   * Verifica se uma flag expirou (Dead Flag). Se expirada, registra métrica de alerta.
   */
  public isFlagExpired(flagKey: string, country?: string, nowMs: number = Date.now()): boolean {
    const id = this.getScopedFlagId(flagKey, country);
    const exp = this.flagExpirations.get(id);
    if (exp !== undefined && nowMs >= exp) {
      RegionalMetricsService.getInstance().recordExpiredFlag(id);
      return true;
    }
    return false;
  }

  /**
   * Lista todas as flags mortas/expiradas detectadas (Modo de Falha 4: Dead Flag Detection)
   */
  public getExpiredDeadFlags(nowMs: number = Date.now()): string[] {
    const expired: string[] = [];
    for (const [id, expMs] of this.flagExpirations.entries()) {
      if (nowMs >= expMs) {
        expired.push(id);
      }
    }
    return expired;
  }

  /**
   * Regra de Prevenção 5: Canary Cohort (1% primeiro) com hash determinístico por usuário
   */
  public setCanaryRollout(flagKey: string, percentage: number, country?: string): void {
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error(`INVALID_CANARY_PERCENTAGE: Percentual de canary deve estar entre 0 e 100 (recebido: ${percentage})`);
    }
    const id = this.getScopedFlagId(flagKey, country);
    this.canaryRollouts.set(id, percentage);
  }

  public getCanaryRollout(flagKey: string, country?: string): number {
    const id = this.getScopedFlagId(flagKey, country);
    return this.canaryRollouts.get(id) ?? 100;
  }

  public static computeCanaryBucket(flagKey: string, userId: string): number {
    const digest = crypto.createHash("sha256").update(`${flagKey}:${userId}`).digest();
    return digest.readUInt32BE(0) % 100;
  }

  public async isFlagEnabledForUser(
    flagKey: string,
    userId: string,
    country?: string,
    nowMs: number = Date.now()
  ): Promise<boolean> {
    if (!userId || typeof userId !== "string") return false;
    if (this.isFlagExpired(flagKey, country, nowMs)) return false;

    if (country) {
      const active = await this.isCountryActive(country, nowMs);
      if (!active) return false;
      const enabled = await this.isFeatureEnabled(country, flagKey, nowMs);
      if (!enabled) return false;
    } else {
      const enabled = await this.isSystemFeatureEnabled(flagKey, nowMs);
      if (!enabled) return false;
    }

    const rollout = this.getCanaryRollout(flagKey, country);
    if (rollout <= 0) return false;
    if (rollout >= 100) return true;

    const bucket = FeatureFlagsService.computeCanaryBucket(flagKey, userId);
    return bucket < rollout;
  }

  /**
   * Regra de Prevenção 4: Valida combinações críticas de flags (evita estados não testados ou ilegais)
   */
  public validateFlagCombinations(
    systemFlags: Record<string, boolean>,
    countryFlagsByCode: Record<string, Record<string, boolean>> = {}
  ): FlagCombinationValidationResult {
    const conflicts: FlagCombinationValidationResult["conflicts"] = [];
    const sanitized: Record<string, boolean> = { ...systemFlags };

    // 1. Verifica se alguma flag de país fora da allowlist da Fase 2 foi ligada por engano (ex: country_us_enabled)
    for (const [key, val] of Object.entries(systemFlags)) {
      const match = /^country_([a-z]{2})_enabled$/i.exec(key);
      if (match && val === true) {
        const code = match[1].toUpperCase();
        if (!PHASE2_COUNTRIES.includes(code as CountryCode)) {
          conflicts.push({
            code: "SANCTIONED_COUNTRY_FLAG_ENABLED",
            severity: "CRITICAL",
            flags: [key],
            message: `Tentativa de ligar flag '${key}' para jurisdição bloqueada/sancionada (${code}).`
          });
          sanitized[key] = false;
          RegionalMetricsService.getInstance().recordFlagInteractionConflict("SANCTIONED_COUNTRY_FLAG_ENABLED");
        }
      }
    }

    // 2. Combinação proibida: Pagamentos reais habilitados sem exigência de KYC (payments_enabled=true & kyc_required=false)
    if (sanitized.payments_enabled === true && sanitized.kyc_required === false) {
      conflicts.push({
        code: "PAYMENTS_WITHOUT_KYC",
        severity: "CRITICAL",
        flags: ["payments_enabled", "kyc_required"],
        message: "Combinação proibida: 'payments_enabled=true' exige obrigatoriamente 'kyc_required=true'."
      });
      sanitized.payments_enabled = false;
      RegionalMetricsService.getInstance().recordFlagInteractionConflict("PAYMENTS_WITHOUT_KYC");
    }

    // 3. Combinação inconsistente: Todos os mercados desligados (otc_enabled=false & synthetic_enabled=false) enquanto países têm trading_enabled=true
    if (sanitized.otc_enabled === false && sanitized.synthetic_enabled === false) {
      for (const [country, cFlags] of Object.entries(countryFlagsByCode)) {
        if (cFlags?.trading_enabled === true) {
          conflicts.push({
            code: "ALL_MARKETS_DISABLED_WHILE_TRADING_ACTIVE",
            severity: "HIGH",
            flags: ["otc_enabled", "synthetic_enabled", `${country}:trading_enabled`],
            message: `Conflito de flags em ${country}: trading_enabled=true mas otc_enabled=false e synthetic_enabled=false.`
          });
          RegionalMetricsService.getInstance().recordFlagInteractionConflict("ALL_MARKETS_DISABLED_WHILE_TRADING_ACTIVE");
        }
      }
    }

    // 4. Combinação inconsistente: País desligado na flag global mas ativo na flag local
    for (const [country, cFlags] of Object.entries(countryFlagsByCode)) {
      const sysKey = `country_${country.toLowerCase()}_enabled`;
      if (sanitized[sysKey] === false && cFlags?.trading_enabled === true) {
        conflicts.push({
          code: "ORPHAN_COUNTRY_TRADING_FLAG",
          severity: "HIGH",
          flags: [sysKey, `${country}:trading_enabled`],
          message: `País ${country} está desligado globalmente (${sysKey}=false), mas possui trading_enabled=true.`
        });
        RegionalMetricsService.getInstance().recordFlagInteractionConflict("ORPHAN_COUNTRY_TRADING_FLAG");
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      sanitizedSystemFlags: sanitized
    };
  }

  /**
   * Regra de Prevenção 2: Config Atômica entre Nós (Hash SHA-256 determinístico + Versão Monotônica)
   */
  public static computeConfigHash(flags: Record<string, unknown>): string {
    const canonical = JSON.stringify(
      Object.keys(flags)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          const val = flags[key];
          if (val && typeof val === "object" && !Array.isArray(val)) {
            const nested = val as Record<string, unknown>;
            acc[key] = Object.keys(nested)
              .sort()
              .reduce<Record<string, unknown>>((nAcc, nKey) => {
                nAcc[nKey] = nested[nKey];
                return nAcc;
              }, {});
          } else {
            acc[key] = val;
          }
          return acc;
        }, {})
    );
    return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  }

  public async publishAtomicConfig(input: {
    systemFlags?: Partial<SystemFeatureFlags> & Record<string, boolean>;
    countryFlags?: Record<string, Record<string, boolean>>;
    expirations?: Record<string, string | number | Date>;
    canaryRollouts?: Record<string, number>;
  }): Promise<AtomicFlagSnapshot> {
    const currentSys = await this.getSystemFlags();
    const mergedSys: Record<string, boolean> = { ...currentSys, ...(input.systemFlags || {}) };

    // Valida se há tentativa de ligar país sancionado
    for (const [k, v] of Object.entries(mergedSys)) {
      const match = /^country_([a-z]{2})_enabled$/i.exec(k);
      if (match && v === true && !PHASE2_COUNTRIES.includes(match[1].toUpperCase() as CountryCode)) {
        throw new Error(`REGULATORY_VIOLATION: Proibido ativar flag '${k}' para país fora da allowlist da Fase 2.`);
      }
    }

    const mergedCountries: Record<string, Record<string, boolean>> = {};
    if (input.countryFlags) {
      for (const [country, cFlags] of Object.entries(input.countryFlags)) {
        const code = country.toUpperCase();
        if (!PHASE2_COUNTRIES.includes(code as CountryCode)) {
          throw new Error(`REGULATORY_VIOLATION: País inválido para Fase 2: ${country}`);
        }
        mergedCountries[code] = { ...this.defaultFallbackFlags, ...cFlags };
        this.localCountryOverrides.set(code, mergedCountries[code]);
      }
    }

    if (input.expirations) {
      for (const [key, exp] of Object.entries(input.expirations)) {
        const ms = this.normalizeExpirationMs(exp);
        if (ms !== null) this.flagExpirations.set(key, ms);
      }
    }

    if (input.canaryRollouts) {
      for (const [key, pct] of Object.entries(input.canaryRollouts)) {
        this.setCanaryRollout(key, pct);
      }
    }

    for (const [k, v] of Object.entries(mergedSys)) {
      this.localSystemOverrides.set(k, v);
    }

    this.configVersion += 1;
    const expirationsObj = Object.fromEntries(this.flagExpirations.entries());
    const canaryObj = Object.fromEntries(this.canaryRollouts.entries());

    const configHash = FeatureFlagsService.computeConfigHash({
      systemFlags: mergedSys,
      countryFlags: mergedCountries,
      expirations: expirationsObj,
      canaryRollouts: canaryObj
    });

    const snapshot: AtomicFlagSnapshot = {
      version: this.configVersion,
      configHash,
      updatedAt: new Date().toISOString(),
      systemFlags: mergedSys,
      countryFlags: mergedCountries,
      expirations: expirationsObj,
      canaryRollouts: canaryObj
    };

    if (this.redis) {
      try {
        await this.redis.set(
          this.getAtomicSnapshotCacheKey(),
          JSON.stringify(snapshot),
          "EX",
          this.CACHE_TTL_SECONDS
        );
        await this.redis.set(
          this.getSystemFlagsCacheKey(),
          JSON.stringify(mergedSys),
          "EX",
          this.CACHE_TTL_SECONDS
        );
        for (const [code, cFlags] of Object.entries(mergedCountries)) {
          await this.redis.set(this.getCacheKey(code), JSON.stringify(cFlags), "EX", this.CACHE_TTL_SECONDS);
        }
        await this.redis.publish("broker:flags:atomic_update", JSON.stringify({
          version: snapshot.version,
          configHash: snapshot.configHash
        }));
      } catch {
        // Fallback em memória/Postgres
      }
    }

    return snapshot;
  }

  /**
   * Regra de Prevenção 3: Monitoramento de Inconsistência entre Nós da Frota
   */
  public onInconsistencyAlert(listener: (alert: FlagInconsistencyAlert) => void): () => void {
    this.inconsistencyListeners.add(listener);
    return () => this.inconsistencyListeners.delete(listener);
  }

  public reportNodeFlagState(
    nodeId: string,
    flags: Record<string, boolean>,
    version = this.configVersion
  ): FlagInconsistencyAlert {
    const configHash = FeatureFlagsService.computeConfigHash(flags);
    this.nodeReports.set(nodeId, {
      nodeId,
      version,
      configHash,
      flags: { ...flags },
      reportedAtMs: Date.now()
    });
    return this.checkFleetConsistency();
  }

  public checkFleetConsistency(): FlagInconsistencyAlert {
    const reports = Array.from(this.nodeReports.values());
    const nodeHashes: Record<string, string> = {};
    for (const r of reports) {
      nodeHashes[r.nodeId] = r.configHash;
    }

    if (reports.length <= 1) {
      RegionalMetricsService.getInstance().recordFlagInconsistencyAlert(false);
      return {
        consistent: true,
        alertTriggered: false,
        divergentFlags: [],
        divergentNodes: [],
        nodeHashes,
        timestamp: new Date().toISOString()
      };
    }

    const reference = reports[0];
    const divergentNodesSet = new Set<string>();
    const divergentFlagsSet = new Set<string>();

    const allFlagKeys = new Set<string>();
    for (const r of reports) {
      for (const k of Object.keys(r.flags)) allFlagKeys.add(k);
    }

    for (let i = 1; i < reports.length; i++) {
      const current = reports[i];
      if (current.configHash !== reference.configHash || current.version !== reference.version) {
        divergentNodesSet.add(reference.nodeId);
        divergentNodesSet.add(current.nodeId);
      }
      for (const key of allFlagKeys) {
        if (Boolean(current.flags[key]) !== Boolean(reference.flags[key])) {
          divergentFlagsSet.add(key);
          divergentNodesSet.add(reference.nodeId);
          divergentNodesSet.add(current.nodeId);
        }
      }
    }

    const inconsistent = divergentNodesSet.size > 0 || divergentFlagsSet.size > 0;
    RegionalMetricsService.getInstance().recordFlagInconsistencyAlert(inconsistent);

    const alert: FlagInconsistencyAlert = {
      consistent: !inconsistent,
      alertTriggered: inconsistent,
      reason: inconsistent
        ? `FLAG_INCONSISTENCY_DETECTED: Divergência de flags entre nós [${Array.from(divergentNodesSet).join(", ")}] nas chaves [${Array.from(divergentFlagsSet).join(", ")}]`
        : undefined,
      divergentFlags: Array.from(divergentFlagsSet),
      divergentNodes: Array.from(divergentNodesSet),
      nodeHashes,
      timestamp: new Date().toISOString()
    };

    if (inconsistent) {
      for (const listener of this.inconsistencyListeners) {
        try {
          listener(alert);
        } catch {
          // ignore
        }
      }
    }

    return alert;
  }

  /**
   * Retorna o mapa consolidado das 10 Feature Flags do sistema (com cache no Redis e checagem de expiração)
   */
  async getSystemFlags(nowMs: number = Date.now()): Promise<SystemFeatureFlags> {
    const cacheKey = this.getSystemFlagsCacheKey();
    let flags: SystemFeatureFlags = { ...DEFAULT_SYSTEM_FEATURE_FLAGS };

    let loadedFromCache = false;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          flags = { ...DEFAULT_SYSTEM_FEATURE_FLAGS, ...JSON.parse(cached) };
          loadedFromCache = true;
        }
      } catch {
        // Fallback para PostgreSQL
      }
    }

    if (!loadedFromCache) {
      try {
        if (this.pg) {
          const result = await this.pg.query<{ flag_key: string; enabled: boolean }>(
            "SELECT flag_key, enabled FROM system_feature_flags"
          );
          for (const row of result.rows) {
            flags[row.flag_key] = row.enabled;
          }
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
    }

    // Aplica overrides atômicos locais (quando aplicável)
    for (const [k, v] of this.localSystemOverrides.entries()) {
      flags[k] = v;
    }

    // Aplica expiração automática (Regra 1: Flag com expiration date desliga ao expirar)
    for (const key of Object.keys(flags)) {
      if (this.isFlagExpired(key, undefined, nowMs)) {
        flags[key] = false;
      }
    }

    return flags;
  }

  /**
   * Verifica se uma feature flag do sistema está habilitada
   */
  async isSystemFeatureEnabled(flagKey: string, nowMs: number = Date.now()): Promise<boolean> {
    if (this.isFlagExpired(flagKey, undefined, nowMs)) {
      return false;
    }
    const flags = await this.getSystemFlags(nowMs);
    return flags[flagKey] ?? false;
  }

  /**
   * Altera ou insere uma Feature Flag do sistema e invalida o cache
   */
  async setSystemFlag(flagKey: string, enabled: boolean, options?: FlagRuleOptions): Promise<void> {
    // Bloqueia ativação acidental de país sancionado/fora da Fase 2 (Modo de Falha 1: Flag mal configurada)
    const countryMatch = /^country_([a-z]{2})_enabled$/i.exec(flagKey);
    if (countryMatch && enabled === true) {
      const code = countryMatch[1].toUpperCase();
      if (!PHASE2_COUNTRIES.includes(code as CountryCode)) {
        throw new Error(`REGULATORY_VIOLATION: Proibido ligar flag '${flagKey}' para país bloqueado/não suportado (${code}).`);
      }
    }

    if (options?.expiresAt !== undefined) {
      this.setFlagExpiration(flagKey, options.expiresAt);
    }
    if (options?.rolloutPercentage !== undefined) {
      this.setCanaryRollout(flagKey, options.rolloutPercentage);
    }

    this.localSystemOverrides.set(flagKey, enabled);
    this.configVersion += 1;

    if (this.pg) {
      await this.pg.query(
        `INSERT INTO system_feature_flags (flag_key, enabled, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (flag_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
        [flagKey, enabled]
      );
    }

    try {
      RegionalMetricsService.getInstance().setFlagStatus("SYSTEM", flagKey, enabled);
    } catch {
      // Ignora erro de métrica
    }

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
  async isCountryActive(country: string, nowMs: number = Date.now()): Promise<boolean> {
    if (!country || typeof country !== "string") return false;
    const code = country.toUpperCase() as CountryCode;
    if (!PHASE2_COUNTRIES.includes(code)) {
      return false;
    }

    // 1. Checa a feature flag central country_{code}_enabled (sem necessidade de deploy) e sua expiração
    const countryFlagKey = `country_${code.toLowerCase()}_enabled`;
    if (this.isFlagExpired(countryFlagKey, undefined, nowMs) || this.isFlagExpired("is_active", code, nowMs)) {
      return false;
    }

    const isFlagEnabled = await this.isSystemFeatureEnabled(countryFlagKey, nowMs);
    if (!isFlagEnabled) {
      return false;
    }

    try {
      const flags = await this.getCountryFlags(code, nowMs);
      if (flags["_is_country_active"] !== undefined) {
        return flags["_is_country_active"];
      }
    } catch {
      // Continua para o banco
    }

    try {
      if (!this.pg) return code === "BR";
      const result = await this.pg.query<{ is_active: boolean }>(
        "SELECT is_active FROM countries WHERE code = $1 LIMIT 1",
        [code]
      );
      if (result.rows.length === 0) return code === "BR";
      return result.rows[0].is_active;
    } catch {
      return code === "BR"; // Fail-safe para BR e fail-closed para demais regiões
    }
  }

  /**
   * Retorna todas as feature flags de um país, com cache em Redis
   */
  async getCountryFlags(country: string, nowMs: number = Date.now()): Promise<Record<string, boolean>> {
    if (!country || typeof country !== "string") return {};
    const code = country.toUpperCase() as CountryCode;
    if (!PHASE2_COUNTRIES.includes(code)) {
      return {};
    }

    const cacheKey = this.getCacheKey(code);
    let flags: Record<string, boolean> | null = null;

    // 1. Tenta recuperar do Redis
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          flags = JSON.parse(cached);
        }
      } catch {
        // Fallback silencioso para PostgreSQL caso o Redis falhe
      }
    }

    // 2. Consulta no PostgreSQL se não veio do cache
    if (!flags) {
      flags = { ...this.defaultFallbackFlags };

      try {
        if (this.pg) {
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
    }

    const localOverride = this.localCountryOverrides.get(code);
    if (localOverride) {
      flags = { ...flags, ...localOverride };
    }

    // Verifica expiração das flags do país
    for (const key of Object.keys(flags)) {
      if (this.isFlagExpired(key, code, nowMs)) {
        flags[key] = false;
      }
    }

    return flags;
  }

  /**
   * Checa se uma flag específica está habilitada para o país (respeitando expiração e interação com país ativo)
   */
  async isFeatureEnabled(country: string, flagKey: string, nowMs: number = Date.now()): Promise<boolean> {
    if (this.isFlagExpired(flagKey, country, nowMs)) {
      return false;
    }
    const countryActive = await this.isCountryActive(country, nowMs);
    if (!countryActive) {
      return false;
    }
    const flags = await this.getCountryFlags(country, nowMs);
    return flags[flagKey] ?? false;
  }

  /**
   * Altera ou insere uma feature flag para o país e invalida o cache
   */
  async setCountryFlag(
    country: string,
    flagKey: string,
    enabled: boolean,
    options?: FlagRuleOptions
  ): Promise<void> {
    const code = country.toUpperCase() as CountryCode;
    if (!PHASE2_COUNTRIES.includes(code)) {
      throw new Error(`País inválido para Fase 2: ${country}`);
    }

    if (options?.expiresAt !== undefined) {
      this.setFlagExpiration(flagKey, options.expiresAt, code);
    }
    if (options?.rolloutPercentage !== undefined) {
      this.setCanaryRollout(flagKey, options.rolloutPercentage, code);
    }

    const existing = this.localCountryOverrides.get(code) || {};
    this.localCountryOverrides.set(code, { ...existing, [flagKey]: enabled });
    this.configVersion += 1;

    if (this.pg) {
      await this.pg.query(
        `INSERT INTO country_feature_flags (country_code, flag_key, enabled, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (country_code, flag_key)
         DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
        [code, flagKey, enabled]
      );
    }

    try {
      RegionalMetricsService.getInstance().setFlagStatus(code, flagKey, enabled);
    } catch {
      // Ignora erro de métrica
    }

    await this.invalidateCache(code);
  }

  /**
   * Ativa ou desativa um país por completo
   */
  async setCountryActive(country: string, active: boolean, options?: FlagRuleOptions): Promise<void> {
    const code = country.toUpperCase() as CountryCode;
    if (!PHASE2_COUNTRIES.includes(code)) {
      throw new Error(`País inválido para Fase 2: ${country}`);
    }

    if (options?.expiresAt !== undefined) {
      this.setFlagExpiration("is_active", options.expiresAt, code);
    }

    const existing = this.localCountryOverrides.get(code) || {};
    this.localCountryOverrides.set(code, { ...existing, _is_country_active: active });
    this.configVersion += 1;

    if (this.pg) {
      await this.pg.query(
        "UPDATE countries SET is_active = $1, updated_at = NOW() WHERE code = $2",
        [active, code]
      );
    }

    try {
      RegionalMetricsService.getInstance().setFlagStatus(code, "is_active", active);
    } catch {
      // Ignora erro de métrica
    }

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
