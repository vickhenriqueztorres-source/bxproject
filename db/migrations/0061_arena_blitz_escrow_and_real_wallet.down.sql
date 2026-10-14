-- Migration 0061_arena_blitz_escrow_and_real_wallet.down.sql

BEGIN;

DROP TABLE IF EXISTS user_bonus_grants CASCADE;
DROP TABLE IF EXISTS arena_ledger_events CASCADE;
DROP TABLE IF EXISTS arena_participants CASCADE;
DROP TABLE IF EXISTS arena_tournaments CASCADE;

COMMIT;
