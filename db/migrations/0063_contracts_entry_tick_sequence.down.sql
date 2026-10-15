-- Rollback Migration 0063: Drop entry_tick_sequence from contracts (Relatório #12)

ALTER TABLE contracts
  DROP COLUMN IF EXISTS entry_tick_sequence;
