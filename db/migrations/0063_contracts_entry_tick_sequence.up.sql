-- Migration 0063: Add entry_tick_sequence to contracts (Relatório #12)
-- Nullable BIGINT column added without table rewrite or lock.

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS entry_tick_sequence BIGINT;
