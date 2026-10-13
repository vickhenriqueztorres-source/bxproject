-- Migration 0040_users_and_auth.down.sql

BEGIN;

DROP TABLE IF EXISTS password_recovery_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

COMMIT;
