-- Migration 0044_cashier_deposits_withdrawals.up.sql
-- Subetapa 4.1: Tabela de Transações Financeiras (Depósitos e Saques) com Idempotência Estrita

BEGIN;

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(16) NOT NULL, -- 'DEPOSIT', 'WITHDRAWAL'
    method VARCHAR(32) NOT NULL, -- 'PIX', 'CARD', 'CRYPTO', 'BANK'
    amount_minor BIGINT NOT NULL, -- Valor em centavos USD (ex: 10000 = US$ 100.00)
    fee_minor BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'COMPLETED', 'CANCELLED', 'REJECTED'
    destination_account VARCHAR(255), -- Chave PIX, endereço de carteira crypto ou agência/conta
    idempotency_key VARCHAR(128) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wallet_tx_idempotency UNIQUE (user_id, idempotency_key),
    CONSTRAINT chk_wallet_tx_type CHECK (type IN ('DEPOSIT', 'WITHDRAWAL')),
    CONSTRAINT chk_wallet_tx_status CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'REJECTED')),
    CONSTRAINT chk_wallet_tx_amount CHECK (amount_minor > 0)
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_status ON wallet_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created ON wallet_transactions(user_id, created_at DESC);

-- Permissões de roles (DB-05)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT, INSERT, UPDATE ON wallet_transactions TO app_contract;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        GRANT SELECT ON wallet_transactions TO app_reader;
    END IF;
END $$;

COMMIT;
