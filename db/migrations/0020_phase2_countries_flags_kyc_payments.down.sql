-- Migration 0020_phase2_countries_flags_kyc_payments.down.sql
-- Rollback das estruturas da Fase 2

BEGIN;

DROP TABLE IF EXISTS payment_methods_registry CASCADE;
DROP TABLE IF EXISTS kyc_profiles CASCADE;
DROP TABLE IF EXISTS country_feature_flags CASCADE;
DROP TABLE IF EXISTS display_currencies CASCADE;
DROP TABLE IF EXISTS countries CASCADE;

COMMIT;
