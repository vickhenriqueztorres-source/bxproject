-- Rollback Migration: 0070 - Payout Configurável por Ativo
-- Remove coluna payout_pct da tabela contracts

-- Remover índice
DROP INDEX IF EXISTS idx_contracts_payout_pct;

-- Remover coluna
ALTER TABLE contracts
DROP COLUMN IF EXISTS payout_pct;
