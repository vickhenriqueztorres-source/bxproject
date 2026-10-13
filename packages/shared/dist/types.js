import { z } from "zod";
export const OpenContractSchema = z.object({
    symbol: z.string().min(1).max(32),
    direction: z.enum(["UP", "DOWN"]),
    stake_minor: z.number().int().min(100).max(10000), // US$ 1,00 a US$ 100,00 em centavos
    duration_seconds: z.number().int().min(30).max(300).optional(), // 30s a 5min (Piso inviolável de 30s)
}).strict();
// ==========================================
// FASE 2: TIPOS E SCHEMAS REGIONAIS
// ==========================================
export const PHASE2_COUNTRIES = ["BR", "MX", "CO", "AR", "CL", "PE"];
export const CountryCodeSchema = z.enum(PHASE2_COUNTRIES);
export const PHASE2_DISPLAY_CURRENCIES = ["BRL", "MXN", "COP", "ARS", "CLP", "PEN"];
export const DisplayCurrencyCodeSchema = z.enum(PHASE2_DISPLAY_CURRENCIES);
export const CountrySchema = z.object({
    code: CountryCodeSchema,
    name: z.string().min(1).max(64),
    default_currency: DisplayCurrencyCodeSchema,
    default_locale: z.string().min(2).max(10),
    is_active: z.boolean()
});
export const DisplayCurrencySchema = z.object({
    code: DisplayCurrencyCodeSchema,
    symbol: z.string().min(1).max(10),
    name: z.string().min(1).max(64),
    decimals: z.number().int().min(0).max(4),
    exchange_rate_to_usd: z.string()
});
export const CountryFeatureFlagSchema = z.object({
    country_code: CountryCodeSchema,
    flag_key: z.string().min(1).max(64),
    enabled: z.boolean(),
    metadata: z.record(z.unknown()).optional()
});
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
export const KYCStatusSchema = z.enum(["UNVERIFIED", "PENDING", "APPROVED", "REJECTED"]);
export const KYCTierSchema = z.enum(["TIER_0", "TIER_1"]);
export const KYCProfileSchema = z.object({
    id: z.string().uuid().optional(),
    user_id: z.string().min(1).max(64),
    country_code: CountryCodeSchema,
    document_type: z.string().min(2).max(32),
    document_number: z.string().min(1).max(64).optional(),
    status: KYCStatusSchema,
    tier: KYCTierSchema.default("TIER_0"),
    deposit_limit_minor: z.number().int().min(0).default(30000), // Default $300 para Tier 0
    nationality_country_code: z.string().length(2).optional(),
    rejection_reason: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
});
export const PaymentMethodSchema = z.object({
    id: z.string().uuid().optional(),
    country_code: CountryCodeSchema,
    method_code: z.string().min(1).max(32),
    name: z.string().min(1).max(64),
    type: z.string().min(1).max(32),
    is_active: z.boolean(),
    config: z.record(z.unknown()).optional()
});
// ==========================================
// ZONAS REGULATÓRIAS E DOMÍNIOS ESPELHO
// ==========================================
export const RegulatoryZoneSchema = z.enum(["RED", "YELLOW", "GREEN"]);
export const RED_ZONE_COUNTRIES = [
    "US", "CA", "GB", "AU", "IL", "JP",
    "DE", "FR", "IT", "ES", "NL", "BE", "AT", "SE", "PL", "IE", "PT", "GR"
];
export const YELLOW_ZONE_COUNTRIES = [
    "MX", "IN", "ID", "TH", "ZA", "NG", "TR", "PH"
];
export const GREEN_ZONE_COUNTRIES = [
    "BR", "KM", "VC", "SC", "VU", "MH", "CR", "LC",
    "CO", "AR", "CL", "PE"
];
export const MirrorDomainStatusSchema = z.enum(["ACTIVE", "STANDBY", "BLOCKED", "DEAD"]);
export const MirrorDomainSchema = z.object({
    id: z.string().uuid().optional(),
    domain_name: z.string().min(3).max(255),
    target_country: z.string().length(2).nullable().optional(),
    status: MirrorDomainStatusSchema,
    priority: z.number().int().min(1).max(1000).default(100),
    latency_ms: z.number().int().min(0).default(0),
    last_health_check_at: z.string().optional()
});
