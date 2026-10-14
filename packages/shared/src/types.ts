import { z } from "zod";

export type Direction = "UP" | "DOWN";
export type ContractStatus = "CREATED" | "OPEN" | "SETTLED" | "CANCELLED";
export type ContractResult = "WIN" | "LOSS" | "DRAW";

export const OpenContractSchema = z.object({
  symbol: z.string().min(1).max(32),
  direction: z.enum(["UP", "DOWN"]),
  stake_minor: z.number().int().min(100).max(10000), // US$ 1,00 a US$ 100,00 em centavos
  duration_seconds: z.number().int().min(30).max(300).optional(), // 30s a 5min (Piso inviolável de 30s)
}).strict();

export type OpenContractDTO = z.infer<typeof OpenContractSchema>;

export interface TickDTO {
  symbol: string;
  sequence: string; // string para preservar int64 no JSON
  price: string;    // decimal fixo string (numeric 18,6)
  ts: string;       // ISO 8601 UTC
  prev_hash: string;
  hash: string;
}

export interface CandleDTO {
  symbol: string;
  interval: string;
  bucket_start: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
}

// ==========================================
// FASE 2: TIPOS E SCHEMAS REGIONAIS
// ==========================================

export const PHASE2_COUNTRIES = ["BR", "MX", "CO", "AR", "CL", "PE"] as const;
export type CountryCode = typeof PHASE2_COUNTRIES[number];
export const CountryCodeSchema = z.enum(PHASE2_COUNTRIES);

export const PHASE2_DISPLAY_CURRENCIES = ["BRL", "MXN", "COP", "ARS", "CLP", "PEN"] as const;
export type DisplayCurrencyCode = typeof PHASE2_DISPLAY_CURRENCIES[number];
export const DisplayCurrencyCodeSchema = z.enum(PHASE2_DISPLAY_CURRENCIES);

export const COUNTRY_STAKE_LIMITS: Record<CountryCode, { min_stake_minor: number; max_stake_minor: number }> = {
  BR: { min_stake_minor: 100, max_stake_minor: 10000 },
  MX: { min_stake_minor: 100, max_stake_minor: 10000 },
  CO: { min_stake_minor: 100, max_stake_minor: 10000 },
  AR: { min_stake_minor: 100, max_stake_minor: 10000 },
  CL: { min_stake_minor: 100, max_stake_minor: 10000 },
  PE: { min_stake_minor: 100, max_stake_minor: 10000 }
};

export const CountrySchema = z.object({
  code: CountryCodeSchema,
  name: z.string().min(1).max(64),
  default_currency: DisplayCurrencyCodeSchema,
  default_locale: z.string().min(2).max(10),
  is_active: z.boolean(),
  min_stake_minor: z.number().int().min(100).optional(),
  max_stake_minor: z.number().int().min(100).optional()
});
export type CountryDTO = z.infer<typeof CountrySchema>;

export const DisplayCurrencySchema = z.object({
  code: DisplayCurrencyCodeSchema,
  symbol: z.string().min(1).max(10),
  name: z.string().min(1).max(64),
  decimals: z.number().int().min(0).max(4),
  exchange_rate_to_usd: z.string()
});
export type DisplayCurrencyDTO = z.infer<typeof DisplayCurrencySchema>;

export const CountryFeatureFlagSchema = z.object({
  country_code: CountryCodeSchema,
  flag_key: z.string().min(1).max(64),
  enabled: z.boolean(),
  metadata: z.record(z.unknown()).optional()
});
export type CountryFeatureFlagDTO = z.infer<typeof CountryFeatureFlagSchema>;

export const SystemFeatureFlagsSchema = z.object({
  payments_enabled: z.boolean().default(false),
  kyc_required: z.boolean().default(false),
  otc_enabled: z.boolean().default(true),
  synthetic_enabled: z.boolean().default(true),
  country_br_enabled: z.boolean().default(true),
  country_mx_enabled: z.boolean().default(true),
  country_co_enabled: z.boolean().default(true),
  country_ar_enabled: z.boolean().default(true),
  country_cl_enabled: z.boolean().default(true),
  country_pe_enabled: z.boolean().default(true)
}).catchall(z.boolean());

export type SystemFeatureFlags = z.infer<typeof SystemFeatureFlagsSchema>;

export const KYCStatusSchema = z.enum(["NOT_STARTED", "UNVERIFIED", "PENDING", "APPROVED", "REJECTED"]);
export type KYCStatus = z.infer<typeof KYCStatusSchema>;

export const KYCTierSchema = z.enum(["TIER_0", "TIER_1"]);
export type KYCTier = z.infer<typeof KYCTierSchema>;

export const KYCProfileSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().min(1).max(64),
  country_code: CountryCodeSchema,
  document_type: z.string().min(2).max(32).optional(),
  document_number: z.string().min(1).max(64).optional(),
  status: KYCStatusSchema,
  tier: KYCTierSchema.default("TIER_0"),
  deposit_limit_minor: z.number().int().min(0).default(30000), // Default $300 para Tier 0
  nationality_country_code: z.string().length(2).optional(),
  rejection_reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});
export type KYCProfileDTO = z.infer<typeof KYCProfileSchema>;

export const PaymentMethodSchema = z.object({
  id: z.string().uuid().optional(),
  country_code: CountryCodeSchema,
  method_code: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  type: z.string().min(1).max(32),
  is_active: z.boolean(),
  config: z.record(z.unknown()).optional()
});
export type PaymentMethodDTO = z.infer<typeof PaymentMethodSchema>;

export const PaymentMethodSpecSchema = z.object({
  id: z.string().uuid().optional(),
  country_code: CountryCodeSchema,
  method: z.enum(["pix", "spei", "pse", "mercado_pago", "khipu", "yape"]),
  enabled: z.boolean().default(false),
  created_at: z.string().optional()
});
export type PaymentMethodSpecDTO = z.infer<typeof PaymentMethodSpecSchema>;

export const PaymentIntentSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  country_code: CountryCodeSchema,
  currency: DisplayCurrencyCodeSchema,
  amount_minor: z.number().int().positive(),
  method: z.string().min(1).max(32),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED", "REJECTED"]).default("PENDING"),
  psp_reference: z.string().optional(),
  created_at: z.string().optional()
});
export type PaymentIntentDTO = z.infer<typeof PaymentIntentSchema>;

// ==========================================
// ZONAS REGULATÓRIAS E DOMÍNIOS ESPELHO
// ==========================================

export const RegulatoryZoneSchema = z.enum(["RED", "YELLOW", "GREEN"]);
export type RegulatoryZone = z.infer<typeof RegulatoryZoneSchema>;

export const RED_ZONE_COUNTRIES = [
  "US", "CA", "GB", "AU", "IL", "JP",
  "DE", "FR", "IT", "ES", "NL", "BE", "AT", "SE", "PL", "IE", "PT", "GR"
] as const;

export const YELLOW_ZONE_COUNTRIES = [
  "MX", "IN", "ID", "TH", "ZA", "NG", "TR", "PH"
] as const;

export const GREEN_ZONE_COUNTRIES = [
  "BR", "KM", "VC", "SC", "VU", "MH", "CR", "LC",
  "CO", "AR", "CL", "PE"
] as const;

export const MirrorDomainStatusSchema = z.enum(["ACTIVE", "STANDBY", "BLOCKED", "DEAD"]);
export type MirrorDomainStatus = z.infer<typeof MirrorDomainStatusSchema>;

export const MirrorDomainSchema = z.object({
  id: z.string().uuid().optional(),
  domain_name: z.string().min(3).max(255),
  target_country: z.string().length(2).nullable().optional(),
  status: MirrorDomainStatusSchema,
  priority: z.number().int().min(1).max(1000).default(100),
  latency_ms: z.number().int().min(0).default(0),
  last_health_check_at: z.string().optional()
});
export type MirrorDomainDTO = z.infer<typeof MirrorDomainSchema>;


