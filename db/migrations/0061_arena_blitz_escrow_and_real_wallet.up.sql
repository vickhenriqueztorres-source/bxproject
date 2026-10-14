-- Migration 0061_arena_blitz_escrow_and_real_wallet.up.sql
-- Fase 1: Binmax Arena Blitz Tournaments, Escrow Double-Entry Audit & Bonus Rollover (25x)

BEGIN;

-- 1. Tabela de Torneios Blitz da Arena
CREATE TABLE IF NOT EXISTS arena_tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE, -- ex: 'ARENA_BLITZ_492'
    title VARCHAR(120) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    payout_tier VARCHAR(16) NOT NULL DEFAULT 'TOP_10', -- 'TOP_3', 'TOP_10', 'TOP_20', 'TOP_30'
    status VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED',
    buy_in_minor BIGINT NOT NULL DEFAULT 500,          -- $5.00 USD em centavos inteiros
    rebuy_price_minor BIGINT NOT NULL DEFAULT 300,     -- $3.00 USD em centavos inteiros
    max_rebuys_per_user INT NOT NULL DEFAULT 3,
    max_stake_pct INT NOT NULL DEFAULT 20,             -- Máx 20% da banca T$ por ordem
    initial_t_balance_minor BIGINT NOT NULL DEFAULT 100000, -- T$ 1.000,00 em centavos fictícios de torneio
    house_rake_bps INT NOT NULL DEFAULT 3000,          -- 30.00%
    prize_pool_bps INT NOT NULL DEFAULT 7000,          -- 70.00%
    guaranteed_pool_minor BIGINT NOT NULL DEFAULT 0,
    current_pool_minor BIGINT NOT NULL DEFAULT 0,      -- Acumulado real em centavos USD no Escrow
    ghost_bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ghost_bot_name VARCHAR(64) NOT NULL DEFAULT 'Alpha_Quant',
    ghost_bot_score_minor BIGINT NOT NULL DEFAULT 100000,
    starts_at TIMESTAMPTZ NOT NULL,
    freeze_rebuys_at TIMESTAMPTZ NOT NULL,
    freeze_trades_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_arena_tournament_tier CHECK (payout_tier IN ('TOP_3', 'TOP_10', 'TOP_20', 'TOP_30')),
    CONSTRAINT chk_arena_tournament_status CHECK (
        status IN ('SCHEDULED', 'REGISTRATION_OPEN', 'RUNNING', 'REBUY_FREEZE', 'TRADING_FREEZE', 'SETTLING', 'SETTLED', 'CANCELLED')
    ),
    CONSTRAINT chk_arena_tournament_bps_sum CHECK (house_rake_bps + prize_pool_bps = 10000),
    CONSTRAINT chk_arena_tournament_positive_amounts CHECK (
        buy_in_minor > 0 AND rebuy_price_minor > 0 AND initial_t_balance_minor > 0
    )
);

CREATE INDEX IF NOT EXISTS idx_arena_tournaments_status_ends ON arena_tournaments(status, ends_at);

-- 2. Tabela de Participantes da Arena Blitz
CREATE TABLE IF NOT EXISTS arena_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES arena_tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    country_code VARCHAR(4) NOT NULL DEFAULT 'BR',
    is_synthetic_seed BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE para os 45 bots do Seeder de teste Top 10/20/30
    seed_archetype VARCHAR(24),                        -- 'SCALPER', 'TREND_FOLLOWER', 'SNIPER'
    device_fingerprint VARCHAR(128) NOT NULL,
    ip_address VARCHAR(64),
    current_t_balance_minor BIGINT NOT NULL DEFAULT 100000,
    reserved_t_stake_minor BIGINT NOT NULL DEFAULT 0,
    rebuy_count INT NOT NULL DEFAULT 0,
    consecutive_wins INT NOT NULL DEFAULT 0,           -- Contador para o Momentum Streak 3x
    streak_bonus_earned_minor BIGINT NOT NULL DEFAULT 0,
    total_trades INT NOT NULL DEFAULT 0,
    winning_trades INT NOT NULL DEFAULT 0,
    tie_breaker_seq BIGINT NOT NULL DEFAULT 0,
    final_rank INT,
    prize_won_minor BIGINT NOT NULL DEFAULT 0,
    bonus_won_minor BIGINT NOT NULL DEFAULT 0,
    beat_ghost_bot BOOLEAN NOT NULL DEFAULT FALSE,
    collusion_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    last_trade_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_arena_tournament_user UNIQUE (tournament_id, user_id),
    CONSTRAINT uq_arena_tournament_device UNIQUE (tournament_id, device_fingerprint),
    CONSTRAINT chk_arena_participant_t_balance CHECK (current_t_balance_minor >= 0 AND reserved_t_stake_minor >= 0),
    CONSTRAINT chk_arena_participant_status CHECK (status IN ('ACTIVE', 'BUSTED', 'SETTLED', 'DISQUALIFIED'))
);

CREATE INDEX IF NOT EXISTS idx_arena_part_ranking ON arena_participants(tournament_id, current_t_balance_minor DESC, tie_breaker_seq ASC);

-- 3. Auditoria de Eventos Financeiros da Arena (Espelho de Conciliação Blnk)
CREATE TABLE IF NOT EXISTS arena_ledger_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES arena_tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    event_type VARCHAR(24) NOT NULL, -- 'BUY_IN', 'REBUY', 'OVERLAY_INJECTION', 'PRIZE_PAYOUT', 'BONUS_GRANT'
    gross_amount_minor BIGINT NOT NULL,
    rake_amount_minor BIGINT NOT NULL DEFAULT 0,
    escrow_amount_minor BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    blnk_rake_ref VARCHAR(128),
    blnk_escrow_ref VARCHAR(128),
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_arena_ledger_currency CHECK (currency = 'USD'),
    CONSTRAINT chk_arena_ledger_event_type CHECK (
        event_type IN ('BUY_IN', 'REBUY', 'OVERLAY_INJECTION', 'PRIZE_PAYOUT', 'BONUS_GRANT')
    ),
    CONSTRAINT chk_arena_ledger_split CHECK (
        (event_type IN ('BUY_IN', 'REBUY') AND rake_amount_minor + escrow_amount_minor = gross_amount_minor)
        OR event_type NOT IN ('BUY_IN', 'REBUY')
    )
);

CREATE INDEX IF NOT EXISTS idx_arena_ledger_tour_user ON arena_ledger_events(tournament_id, user_id);

-- 4. Controle de Bônus e Rollover 25x
CREATE TABLE IF NOT EXISTS user_bonus_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    source_type VARCHAR(32) NOT NULL, -- 'BEAT_GHOST_BOT', 'POST_TOURNAMENT_FTD_100', 'PROMO'
    tournament_id UUID REFERENCES arena_tournaments(id) ON DELETE SET NULL,
    bonus_amount_minor BIGINT NOT NULL,
    required_rollover_minor BIGINT NOT NULL, -- 25 * bonus_amount_minor
    completed_volume_minor BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'LOCKED', -- 'LOCKED', 'UNLOCKED', 'EXPIRED', 'FORFEITED'
    blnk_grant_ref VARCHAR(128) NOT NULL UNIQUE,
    blnk_release_ref VARCHAR(128) UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unlocked_at TIMESTAMPTZ,
    CONSTRAINT chk_bonus_rollover CHECK (required_rollover_minor >= bonus_amount_minor AND completed_volume_minor >= 0),
    CONSTRAINT chk_bonus_status CHECK (status IN ('LOCKED', 'UNLOCKED', 'EXPIRED', 'FORFEITED'))
);

CREATE INDEX IF NOT EXISTS idx_user_bonus_grants_user ON user_bonus_grants(user_id, status);

-- Permissões de roles (DB-05)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON arena_tournaments TO app_contract;
        GRANT SELECT, INSERT, UPDATE, DELETE ON arena_participants TO app_contract;
        GRANT SELECT, INSERT, UPDATE ON arena_ledger_events TO app_contract;
        GRANT SELECT, INSERT, UPDATE ON user_bonus_grants TO app_contract;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        GRANT SELECT ON arena_tournaments TO app_reader;
        GRANT SELECT ON arena_participants TO app_reader;
        GRANT SELECT ON arena_ledger_events TO app_reader;
        GRANT SELECT ON user_bonus_grants TO app_reader;
    END IF;
END $$;

COMMIT;
