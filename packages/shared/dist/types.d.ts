import { z } from "zod";
export type Direction = "UP" | "DOWN";
export type ContractStatus = "CREATED" | "OPEN" | "SETTLED" | "CANCELLED";
export type ContractResult = "WIN" | "LOSS" | "DRAW";
export declare const OpenContractSchema: z.ZodObject<{
    symbol: z.ZodString;
    direction: z.ZodEnum<["UP", "DOWN"]>;
    stake_minor: z.ZodNumber;
    duration_seconds: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    symbol: string;
    direction: "UP" | "DOWN";
    stake_minor: number;
    duration_seconds?: number | undefined;
}, {
    symbol: string;
    direction: "UP" | "DOWN";
    stake_minor: number;
    duration_seconds?: number | undefined;
}>;
export type OpenContractDTO = z.infer<typeof OpenContractSchema>;
export interface TickDTO {
    symbol: string;
    sequence: string;
    price: string;
    ts: string;
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
export declare const PHASE2_COUNTRIES: readonly ["BR", "MX", "CO", "AR", "CL", "PE"];
export type CountryCode = typeof PHASE2_COUNTRIES[number];
export declare const CountryCodeSchema: z.ZodEnum<["BR", "MX", "CO", "AR", "CL", "PE"]>;
export declare const PHASE2_DISPLAY_CURRENCIES: readonly ["BRL", "MXN", "COP", "ARS", "CLP", "PEN"];
export type DisplayCurrencyCode = typeof PHASE2_DISPLAY_CURRENCIES[number];
export declare const DisplayCurrencyCodeSchema: z.ZodEnum<["BRL", "MXN", "COP", "ARS", "CLP", "PEN"]>;
export declare const CountrySchema: z.ZodObject<{
    code: z.ZodEnum<["BR", "MX", "CO", "AR", "CL", "PE"]>;
    name: z.ZodString;
    default_currency: z.ZodEnum<["BRL", "MXN", "COP", "ARS", "CLP", "PEN"]>;
    default_locale: z.ZodString;
    is_active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: "BR" | "MX" | "CO" | "AR" | "CL" | "PE";
    name: string;
    default_currency: "BRL" | "MXN" | "COP" | "ARS" | "CLP" | "PEN";
    default_locale: string;
    is_active: boolean;
}, {
    code: "BR" | "MX" | "CO" | "AR" | "CL" | "PE";
    name: string;
    default_currency: "BRL" | "MXN" | "COP" | "ARS" | "CLP" | "PEN";
    default_locale: string;
    is_active: boolean;
}>;
export type CountryDTO = z.infer<typeof CountrySchema>;
export declare const DisplayCurrencySchema: z.ZodObject<{
    code: z.ZodEnum<["BRL", "MXN", "COP", "ARS", "CLP", "PEN"]>;
    symbol: z.ZodString;
    name: z.ZodString;
    decimals: z.ZodNumber;
    exchange_rate_to_usd: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    code: "BRL" | "MXN" | "COP" | "ARS" | "CLP" | "PEN";
    name: string;
    decimals: number;
    exchange_rate_to_usd: string;
}, {
    symbol: string;
    code: "BRL" | "MXN" | "COP" | "ARS" | "CLP" | "PEN";
    name: string;
    decimals: number;
    exchange_rate_to_usd: string;
}>;
export type DisplayCurrencyDTO = z.infer<typeof DisplayCurrencySchema>;
export declare const CountryFeatureFlagSchema: z.ZodObject<{
    country_code: z.ZodEnum<["BR", "MX", "CO", "AR", "CL", "PE"]>;
    flag_key: z.ZodString;
    enabled: z.ZodBoolean;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    country_code: "BR" | "MX" | "CO" | "AR" | "CL" | "PE";
    flag_key: string;
    enabled: boolean;
    metadata?: Record<string, unknown> | undefined;
}, {
    country_code: "BR" | "MX" | "CO" | "AR" | "CL" | "PE";
    flag_key: string;
    enabled: boolean;
    metadata?: Record<string, unknown> | undefined;
}>;
export type CountryFeatureFlagDTO = z.infer<typeof CountryFeatureFlagSchema>;
export declare const SystemFeatureFlagsSchema: z.ZodObject<{
    payments_enabled: z.ZodDefault<z.ZodBoolean>;
    kyc_required: z.ZodDefault<z.ZodBoolean>;
    otc_enabled: z.ZodDefault<z.ZodBoolean>;
    synthetic_enabled: z.ZodDefault<z.ZodBoolean>;
    country_br_enabled: z.ZodDefault<z.ZodBoolean>;
    country_mx_enabled: z.ZodDefault<z.ZodBoolean>;
    country_co_enabled: z.ZodDefault<z.ZodBoolean>;
    country_ar_enabled: z.ZodDefault<z.ZodBoolean>;
    country_cl_enabled: z.ZodDefault<z.ZodBoolean>;
    country_pe_enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodBoolean, z.objectOutputType<{
    payments_enabled: z.ZodDefault<z.ZodBoolean>;
    kyc_required: z.ZodDefault<z.ZodBoolean>;
    otc_enabled: z.ZodDefault<z.ZodBoolean>;
    synthetic_enabled: z.ZodDefault<z.ZodBoolean>;
    country_br_enabled: z.ZodDefault<z.ZodBoolean>;
    country_mx_enabled: z.ZodDefault<z.ZodBoolean>;
    country_co_enabled: z.ZodDefault<z.ZodBoolean>;
    country_ar_enabled: z.ZodDefault<z.ZodBoolean>;
    country_cl_enabled: z.ZodDefault<z.ZodBoolean>;
    country_pe_enabled: z.ZodDefault<z.ZodBoolean>;
}, z.ZodBoolean, "strip">, z.objectInputType<{
    payments_enabled: z.ZodDefault<z.ZodBoolean>;
    kyc_required: z.ZodDefault<z.ZodBoolean>;
    otc_enabled: z.ZodDefault<z.ZodBoolean>;
    synthetic_enabled: z.ZodDefault<z.ZodBoolean>;
    country_br_enabled: z.ZodDefault<z.ZodBoolean>;
    country_mx_enabled: z.ZodDefault<z.ZodBoolean>;
    country_co_enabled: z.ZodDefault<z.ZodBoolean>;
    country_ar_enabled: z.ZodDefault<z.ZodBoolean>;
    country_cl_enabled: z.ZodDefault<z.ZodBoolean>;
    country_pe_enabled: z.ZodDefault<z.ZodBoolean>;
}, z.ZodBoolean, "strip">>;
export type SystemFeatureFlags = z.infer<typeof SystemFeatureFlagsSchema>;
export declare const KYCStatusSchema: z.ZodEnum<["UNVERIFIED", "PENDING", "APPROVED", "REJECTED"]>;
export type KYCStatus = z.infer<typeof KYCStatusSchema>;
export declare const KYCTierSchema: z.ZodEnum<["TIER_0", "TIER_1"]>;
export type KYCTier = z.infer<typeof KYCTierSchema>;
export declare const KYCProfileSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    user_id: z.ZodString;
    country_code: z.ZodEnum<["BR", "MX", "CO", "AR", "CL", "PE"]>;
    document_type: z.ZodString;
    document_number: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["UNVERIFIED", "PENDING", "APPROVED", "REJECTED"]>;
    tier: z.ZodDefault<z.ZodEnum<["TIER_0", "TIER_1"]>>;
    deposit_limit_minor: z.ZodDefault<z.ZodNumber>;
    nationality_country_code: z.ZodOptional<z.ZodString>;
    rejection_reason: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "UNVERIFIED" | "PENDING" | "APPROVED" | "REJECTED";
    country_code: "BR" | "MX" | "CO" | "AR" | "CL" | "PE";
    user_id: string;
    document_type: string;
    tier: "TIER_0" | "TIER_1";
    deposit_limit_minor: number;
    metadata?: Record<string, unknown> | undefined;
    id?: string | undefined;
    document_number?: string | undefined;
    nationality_country_code?: string | undefined;
    rejection_reason?: string | undefined;
}, {
    status: "UNVERIFIED" | "PENDING" | "APPROVED" | "REJECTED";
    country_code: "BR" | "MX" | "CO" | "AR" | "CL" | "PE";
    user_id: string;
    document_type: string;
    metadata?: Record<string, unknown> | undefined;
    id?: string | undefined;
    document_number?: string | undefined;
    tier?: "TIER_0" | "TIER_1" | undefined;
    deposit_limit_minor?: number | undefined;
    nationality_country_code?: string | undefined;
    rejection_reason?: string | undefined;
}>;
export type KYCProfileDTO = z.infer<typeof KYCProfileSchema>;
export declare const PaymentMethodSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    country_code: z.ZodEnum<["BR", "MX", "CO", "AR", "CL", "PE"]>;
    method_code: z.ZodString;
    name: z.ZodString;
    type: z.ZodString;
    is_active: z.ZodBoolean;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    name: string;
    is_active: boolean;
    country_code: "BR" | "MX" | "CO" | "AR" | "CL" | "PE";
    method_code: string;
    id?: string | undefined;
    config?: Record<string, unknown> | undefined;
}, {
    type: string;
    name: string;
    is_active: boolean;
    country_code: "BR" | "MX" | "CO" | "AR" | "CL" | "PE";
    method_code: string;
    id?: string | undefined;
    config?: Record<string, unknown> | undefined;
}>;
export type PaymentMethodDTO = z.infer<typeof PaymentMethodSchema>;
export declare const RegulatoryZoneSchema: z.ZodEnum<["RED", "YELLOW", "GREEN"]>;
export type RegulatoryZone = z.infer<typeof RegulatoryZoneSchema>;
export declare const RED_ZONE_COUNTRIES: readonly ["US", "CA", "GB", "AU", "IL", "JP", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "SE", "PL", "IE", "PT", "GR"];
export declare const YELLOW_ZONE_COUNTRIES: readonly ["MX", "IN", "ID", "TH", "ZA", "NG", "TR", "PH"];
export declare const GREEN_ZONE_COUNTRIES: readonly ["BR", "KM", "VC", "SC", "VU", "MH", "CR", "LC", "CO", "AR", "CL", "PE"];
export declare const MirrorDomainStatusSchema: z.ZodEnum<["ACTIVE", "STANDBY", "BLOCKED", "DEAD"]>;
export type MirrorDomainStatus = z.infer<typeof MirrorDomainStatusSchema>;
export declare const MirrorDomainSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    domain_name: z.ZodString;
    target_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodEnum<["ACTIVE", "STANDBY", "BLOCKED", "DEAD"]>;
    priority: z.ZodDefault<z.ZodNumber>;
    latency_ms: z.ZodDefault<z.ZodNumber>;
    last_health_check_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "ACTIVE" | "STANDBY" | "BLOCKED" | "DEAD";
    domain_name: string;
    priority: number;
    latency_ms: number;
    id?: string | undefined;
    target_country?: string | null | undefined;
    last_health_check_at?: string | undefined;
}, {
    status: "ACTIVE" | "STANDBY" | "BLOCKED" | "DEAD";
    domain_name: string;
    id?: string | undefined;
    target_country?: string | null | undefined;
    priority?: number | undefined;
    latency_ms?: number | undefined;
    last_health_check_at?: string | undefined;
}>;
export type MirrorDomainDTO = z.infer<typeof MirrorDomainSchema>;
