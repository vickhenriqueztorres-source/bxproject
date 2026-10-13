-- Migration 0021_system_feature_flags_spec.down.sql
BEGIN;
DROP TABLE IF EXISTS system_feature_flags;
COMMIT;
