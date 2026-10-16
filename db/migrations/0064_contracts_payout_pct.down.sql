-- Rollback Migration 0064: Drop payout_pct from contracts (P1-1)

ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS chk_contracts_payout_pct_range;

ALTER TABLE contracts
  DROP COLUMN IF EXISTS payout_pct;
