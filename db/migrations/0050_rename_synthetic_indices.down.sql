-- Migration 0050_rename_synthetic_indices.down.sql
-- Reversao segura da renomeacao

BEGIN;

SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
LOCK TABLE indices, index_state, ticks, candles, contracts IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM index_state s JOIN indices i USING(symbol)
             WHERE i.seeded_by_0050 AND s.last_sequence > 0)
     OR EXISTS (SELECT 1 FROM ticks t JOIN indices i USING(symbol) WHERE i.seeded_by_0050)
     OR EXISTS (SELECT 1 FROM candles c JOIN indices i USING(symbol) WHERE i.seeded_by_0050)
     OR EXISTS (SELECT 1 FROM contracts c JOIN indices i USING(symbol) WHERE i.seeded_by_0050)
  THEN
    RAISE EXCEPTION '0050 rollback refused: canonical symbol has durable activity';
  END IF;
END $$;

DELETE FROM index_state WHERE symbol IN (SELECT symbol FROM indices WHERE seeded_by_0050);
DELETE FROM indices WHERE seeded_by_0050;

ALTER TABLE indices DROP COLUMN seeded_by_0050;

COMMIT;
