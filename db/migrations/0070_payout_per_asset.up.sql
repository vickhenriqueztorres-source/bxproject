-- Migration: 0070 - Payout Configurável por Ativo
-- Adiciona coluna payout_pct na tabela contracts para capturar o payout no momento da abertura
-- DEFAULT 85 garante retrocompatibilidade com contratos antigos

-- Adicionar coluna payout_pct com DEFAULT 85
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS payout_pct INT DEFAULT 85;

-- Comentário para documentação
COMMENT ON COLUMN contracts.payout_pct IS 'Percentual de payout capturado no momento da abertura do contrato (ex: 85 = 85% = 1.85x)';

-- Índice para queries de análise por payout
CREATE INDEX IF NOT EXISTS idx_contracts_payout_pct ON contracts(payout_pct);
