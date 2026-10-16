-- Migration 0064: Add payout_pct snapshot column to contracts (P1-1)
-- Idempotent, non-destructive migration (nullable with default 85 for new rows, constraint [0, 100]).

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS payout_pct SMALLINT DEFAULT 85;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_contracts_payout_pct_range'
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT chk_contracts_payout_pct_range
      CHECK (payout_pct IS NULL OR (payout_pct >= 0 AND payout_pct <= 100));
  END IF;
END $$;
