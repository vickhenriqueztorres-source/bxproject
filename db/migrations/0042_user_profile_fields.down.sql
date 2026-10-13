-- Migration 0042_user_profile_fields.down.sql

BEGIN;

ALTER TABLE users 
    DROP COLUMN IF EXISTS phone_number,
    DROP COLUMN IF EXISTS phone_code;

COMMIT;
