-- Migration 0045_kyc_and_community_modules.down.sql
BEGIN;
DROP TABLE IF EXISTS user_promotions;
DROP TABLE IF EXISTS tournament_participants;
DROP TABLE IF EXISTS tournaments;
DROP TABLE IF EXISTS kyc_profiles;
COMMIT;
