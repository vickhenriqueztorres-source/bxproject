-- Migration 0060_phase2_spec_completeness.down.sql
-- Reversão limpa da migration 0060_phase2_spec_completeness

BEGIN;

DROP TABLE IF EXISTS payment_intents;
DROP TABLE IF EXISTS payment_methods;

ALTER TABLE countries
  DROP COLUMN IF EXISTS min_stake_minor,
  DROP COLUMN IF EXISTS max_stake_minor;

COMMIT;
