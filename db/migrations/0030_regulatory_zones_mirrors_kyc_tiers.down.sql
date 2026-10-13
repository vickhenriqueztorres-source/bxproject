-- Migration 0030_regulatory_zones_mirrors_kyc_tiers.down.sql
-- Subetapa 1: Reversão de Zonas Regulatórias, Domínios Espelho e KYC Tiers

BEGIN;

ALTER TABLE kyc_profiles 
    DROP CONSTRAINT IF EXISTS chk_kyc_tier,
    DROP COLUMN IF EXISTS rejection_reason,
    DROP COLUMN IF EXISTS nationality_country_code,
    DROP COLUMN IF EXISTS deposit_limit_minor,
    DROP COLUMN IF EXISTS tier;

DROP TABLE IF EXISTS mirror_domains;
DROP TABLE IF EXISTS regulatory_jurisdictions;

COMMIT;
