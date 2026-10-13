-- Migration 0043_email_verification.down.sql

BEGIN;

DROP TABLE IF EXISTS email_verification_codes;
ALTER TABLE users 
    DROP COLUMN IF EXISTS email_verified,
    DROP COLUMN IF EXISTS email_verified_at;

COMMIT;
