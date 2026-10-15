-- Migration 0062_arena_trade_orders.up.sql
-- Subetapa 04.1 (Gate T1): Persistência durável de ordens de torneio (arena_trade_orders),
-- saldos reais de torneio (arena_real_balances), transações (arena_wallet_transactions)
-- e suporte a IDs alfanuméricos/UUID em arena_tournaments / arena_participants / arena_ledger_events / user_bonus_grants.

BEGIN;

-- 1. Ajusta colunas de ID/user_id da migration 0061 para VARCHAR(128) mantendo integridade referencial,
-- permitindo tanto UUIDs quanto identificadores determinísticos (usr_*, seed_*, trn-*).
ALTER TABLE arena_participants DROP CONSTRAINT IF EXISTS arena_participants_tournament_id_fkey;
ALTER TABLE arena_ledger_events DROP CONSTRAINT IF EXISTS arena_ledger_events_tournament_id_fkey;
ALTER TABLE user_bonus_grants DROP CONSTRAINT IF EXISTS user_bonus_grants_tournament_id_fkey;

ALTER TABLE arena_tournaments ALTER COLUMN id TYPE VARCHAR(128) USING id::text;
ALTER TABLE arena_participants ALTER COLUMN id TYPE VARCHAR(128) USING id::text;
ALTER TABLE arena_participants ALTER COLUMN tournament_id TYPE VARCHAR(128) USING tournament_id::text;
ALTER TABLE arena_participants ALTER COLUMN user_id TYPE VARCHAR(128) USING user_id::text;

ALTER TABLE arena_ledger_events ALTER COLUMN id TYPE VARCHAR(128) USING id::text;
ALTER TABLE arena_ledger_events ALTER COLUMN tournament_id TYPE VARCHAR(128) USING tournament_id::text;
ALTER TABLE arena_ledger_events ALTER COLUMN user_id TYPE VARCHAR(128) USING user_id::text;

ALTER TABLE user_bonus_grants ALTER COLUMN id TYPE VARCHAR(128) USING id::text;
ALTER TABLE user_bonus_grants ALTER COLUMN user_id TYPE VARCHAR(128) USING user_id::text;
ALTER TABLE user_bonus_grants ALTER COLUMN tournament_id TYPE VARCHAR(128) USING tournament_id::text;

ALTER TABLE arena_participants
    ADD CONSTRAINT arena_participants_tournament_id_fkey
    FOREIGN KEY (tournament_id) REFERENCES arena_tournaments(id) ON DELETE CASCADE;

ALTER TABLE arena_ledger_events
    ADD CONSTRAINT arena_ledger_events_tournament_id_fkey
    FOREIGN KEY (tournament_id) REFERENCES arena_tournaments(id) ON DELETE CASCADE;

ALTER TABLE user_bonus_grants
    ADD CONSTRAINT user_bonus_grants_tournament_id_fkey
    FOREIGN KEY (tournament_id) REFERENCES arena_tournaments(id) ON DELETE SET NULL;

-- 2. Tabela de Ordens de Trade da Arena Blitz (com trilha de auditoria do tick oficial)
CREATE TABLE IF NOT EXISTS arena_trade_orders (
    id VARCHAR(128) PRIMARY KEY,
    tournament_id VARCHAR(128) NOT NULL REFERENCES arena_tournaments(id) ON DELETE CASCADE,
    participant_id VARCHAR(128) NOT NULL REFERENCES arena_participants(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    direction VARCHAR(8) NOT NULL,
    stake_t_minor BIGINT NOT NULL,
    entry_price NUMERIC(18, 6),
    entry_tick_sequence BIGINT,
    exit_price NUMERIC(18, 6),
    exit_tick_sequence BIGINT,
    opened_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    result VARCHAR(8),
    base_profit_t_minor BIGINT NOT NULL DEFAULT 0,
    streak_bonus_t_minor BIGINT NOT NULL DEFAULT 0,
    ip_address VARCHAR(64),
    device_fingerprint VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_arena_trade_direction CHECK (direction IN ('UP', 'DOWN')),
    CONSTRAINT chk_arena_trade_stake CHECK (stake_t_minor >= 1000),
    CONSTRAINT chk_arena_trade_status CHECK (status IN ('OPEN', 'SETTLED')),
    CONSTRAINT chk_arena_trade_result CHECK (result IS NULL OR result IN ('WIN', 'LOSS', 'DRAW'))
);

CREATE INDEX IF NOT EXISTS idx_arena_trade_orders_tour_status
    ON arena_trade_orders(tournament_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_arena_trade_orders_user
    ON arena_trade_orders(tournament_id, user_id);

-- 3. Espelho Durável de Saldos Reais da Arena (sincronizado com Blnk Ledger)
CREATE TABLE IF NOT EXISTS arena_real_balances (
    user_id VARCHAR(128) PRIMARY KEY,
    available_minor BIGINT NOT NULL DEFAULT 0,
    reserved_minor BIGINT NOT NULL DEFAULT 0,
    bonus_margin_minor BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_arena_real_balances_non_neg CHECK (
        available_minor >= 0 AND reserved_minor >= 0 AND bonus_margin_minor >= 0
    )
);

-- 4. Transações de Caixa Real da Arena (Depósitos e Saques 2-etapas)
CREATE TABLE IF NOT EXISTS arena_wallet_transactions (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    type VARCHAR(16) NOT NULL,
    method VARCHAR(16) NOT NULL,
    amount_minor BIGINT NOT NULL,
    fee_minor BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    destination_account VARCHAR(255),
    idempotency_key VARCHAR(128) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_arena_wallet_tx_user_idem UNIQUE (user_id, type, idempotency_key),
    CONSTRAINT chk_arena_wallet_tx_type CHECK (type IN ('DEPOSIT', 'WITHDRAWAL')),
    CONSTRAINT chk_arena_wallet_tx_status CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'REJECTED'))
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON arena_trade_orders TO app_contract;
        GRANT SELECT, INSERT, UPDATE, DELETE ON arena_real_balances TO app_contract;
        GRANT SELECT, INSERT, UPDATE, DELETE ON arena_wallet_transactions TO app_contract;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        GRANT SELECT ON arena_trade_orders TO app_reader;
        GRANT SELECT ON arena_real_balances TO app_reader;
        GRANT SELECT ON arena_wallet_transactions TO app_reader;
    END IF;
END $$;

COMMIT;
