-- Migration 0001: Initial Schema (ACID Invariants, Strict Types)
-- Enforces: numeric(18,6) for prices, bigint for minor-unit cents (*_minor)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Metadata dos Ativos Sintéticos
CREATE TABLE IF NOT EXISTS indices (
    symbol VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED
    tick_interval_ms INT NOT NULL DEFAULT 1000,
    base_price NUMERIC(18,6) NOT NULL,
    volatility NUMERIC(18,6) NOT NULL,
    mean_reversion_speed NUMERIC(18,6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Estado em Tempo Real e Concorrência de Lease
CREATE TABLE IF NOT EXISTS index_state (
    symbol VARCHAR(32) PRIMARY KEY REFERENCES indices(symbol) ON DELETE CASCADE,
    last_sequence BIGINT NOT NULL DEFAULT 0,
    last_price NUMERIC(18,6) NOT NULL,
    last_hash VARCHAR(64) NOT NULL,
    lease_leader VARCHAR(128),
    lease_epoch BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Série Temporal Imutável de Ticks (M-02, M-04)
CREATE TABLE IF NOT EXISTS ticks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES indices(symbol),
    sequence BIGINT NOT NULL,
    price NUMERIC(18,6) NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    prev_hash VARCHAR(64) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ticks_symbol_sequence UNIQUE (symbol, sequence)
);

CREATE INDEX IF NOT EXISTS idx_ticks_symbol_ts ON ticks(symbol, ts);

-- 4. Agregações OHLCV Derivadas (M-05)
CREATE TABLE IF NOT EXISTS candles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES indices(symbol),
    interval VARCHAR(8) NOT NULL, -- '1s', '1m', '5m'
    bucket_start TIMESTAMPTZ NOT NULL,
    open NUMERIC(18,6) NOT NULL,
    high NUMERIC(18,6) NOT NULL,
    low NUMERIC(18,6) NOT NULL,
    close NUMERIC(18,6) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 1,
    CONSTRAINT uq_candles_sym_int_bucket UNIQUE (symbol, interval, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_candles_lookup ON candles(symbol, interval, bucket_start DESC);

-- 5. Ordens de Trading / Contratos UP/DOWN (B-01, B-05, B-08)
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol VARCHAR(32) NOT NULL REFERENCES indices(symbol),
    direction VARCHAR(8) NOT NULL, -- 'UP', 'DOWN'
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN', -- 'CREATED', 'OPEN', 'SETTLED', 'CANCELLED'
    result VARCHAR(8), -- 'WIN', 'LOSS', 'DRAW'
    stake_minor BIGINT NOT NULL, -- em centavos de dólar (ex: 1000 = US$ 10,00)
    payout_minor BIGINT NOT NULL DEFAULT 0,
    entry_price NUMERIC(18,6) NOT NULL,
    exit_price NUMERIC(18,6),
    exit_tick_sequence BIGINT,
    idempotency_key VARCHAR(128) NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contracts_user_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_contracts_user_status ON contracts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_settlement ON contracts(status, expires_at) WHERE status = 'OPEN';

-- 6. Transactional Outbox Pattern (M-03, R-01)
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSED', 'FAILED'
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, created_at) WHERE status = 'PENDING';

-- 7. Auditoria Append-Only (B-14)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_resource VARCHAR(128) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Inicial do Índice Oficial da Fase 1 (SYNTH_VOL_50)
INSERT INTO indices (symbol, name, status, tick_interval_ms, base_price, volatility, mean_reversion_speed)
VALUES ('SYNTH_VOL_50', 'Índice de Volatilidade 50 Sintético (OTC)', 'ACTIVE', 1000, 1000.000000, 0.001500, 0.050000)
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash)
VALUES ('SYNTH_VOL_50', 0, 1000.000000, 'genesis|SYNTH_VOL_50')
ON CONFLICT (symbol) DO NOTHING;
