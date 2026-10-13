-- Migration 0045_kyc_and_community_modules.up.sql
-- Subetapa 5.1: Schemas de KYC Real, Torneios e Promoções Vinculadas a Usuários

BEGIN;

-- 1. Tabela de Perfil KYC de Usuários
CREATE TABLE IF NOT EXISTS kyc_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    country_code CHAR(2) NOT NULL DEFAULT 'ES',
    identity_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    address_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    document_type VARCHAR(32),
    document_number VARCHAR(64),
    uploaded_files JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_kyc_user UNIQUE (user_id),
    CONSTRAINT chk_kyc_id_status CHECK (identity_status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED')),
    CONSTRAINT chk_kyc_addr_status CHECK (address_status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_profiles(user_id);

-- 2. Tabela de Torneios
CREATE TABLE IF NOT EXISTS tournaments (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'EN_VIVO',
    prize_formatted VARCHAR(32) NOT NULL,
    participants_count INT NOT NULL DEFAULT 0,
    ends_at TIMESTAMPTZ NOT NULL,
    rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    prizes JSONB NOT NULL DEFAULT '[]'::jsonb,
    leaderboard JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_tournament_status CHECK (status IN ('EN_VIVO', 'PROXIMO', 'FINALIZADO'))
);

-- Seed dos Torneios Oficiais
INSERT INTO tournaments (id, name, status, prize_formatted, participants_count, ends_at, rules, prizes, leaderboard) VALUES
(
    'copa-binmax',
    'Copa BINMAX',
    'EN_VIVO',
    '$2,500',
    1248,
    NOW() + INTERVAL '2 hours 15 minutes',
    '{"period": "24 horas", "depositRequired": "No requerido", "operationType": "Contratos 60 segundos", "criteria": "Mayor rentabilidad porcentual", "minOperations": 10}'::jsonb,
    '[{"position": "1º Lugar", "prize": "$1,000 USD"}, {"position": "2º Lugar", "prize": "$500 USD"}, {"position": "3º Lugar", "prize": "$300 USD"}]'::jsonb,
    '[{"rank": 2, "name": "Carlos M.", "country": "CO", "returnPct": "+241.10%", "ops": 38}, {"rank": 3, "name": "Elena R.", "country": "ES", "returnPct": "+198.50%", "ops": 35}]'::jsonb
),
(
    'desafio-semana',
    'Desafío de la Semana',
    'EN_VIVO',
    '$5,000',
    2840,
    NOW() + INTERVAL '14 hours 40 minutes',
    '{"period": "7 días", "depositRequired": "No requerido", "operationType": "Índices sintéticos continuos", "criteria": "Mayor rentabilidad acumulada", "minOperations": 25}'::jsonb,
    '[{"position": "1º Lugar", "prize": "$2,000 USD"}, {"position": "2º Lugar", "prize": "$1,200 USD"}, {"position": "3º Lugar", "prize": "$800 USD"}]'::jsonb,
    '[{"rank": 2, "name": "Andrés V.", "country": "CL", "returnPct": "+310.20%", "ops": 52}]'::jsonb
),
(
    'maestros-forex',
    'Arena Algorítmica OTC',
    'PROXIMO',
    '$10,000',
    850,
    NOW() + INTERVAL '2 days 5 hours',
    '{"period": "48 horas", "depositRequired": "No requerido", "operationType": "Pares sintéticos y OTC", "criteria": "Mayor volumen de ganancias netas", "minOperations": 15}'::jsonb,
    '[{"position": "1º Lugar", "prize": "$5,000 USD"}]'::jsonb,
    '[]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    prize_formatted = EXCLUDED.prize_formatted,
    status = EXCLUDED.status;

-- 3. Participantes de Torneios
CREATE TABLE IF NOT EXISTS tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id VARCHAR(64) NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tournament_user UNIQUE (tournament_id, user_id)
);

-- 4. Promoções e Bônus de Usuários
CREATE TABLE IF NOT EXISTS user_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    promo_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_promo UNIQUE (user_id, promo_id)
);

-- Permissões de roles (DB-05)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON kyc_profiles TO app_contract;
        GRANT SELECT, INSERT, UPDATE, DELETE ON tournaments TO app_contract;
        GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_participants TO app_contract;
        GRANT SELECT, INSERT, UPDATE, DELETE ON user_promotions TO app_contract;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        GRANT SELECT ON kyc_profiles TO app_reader;
        GRANT SELECT ON tournaments TO app_reader;
        GRANT SELECT ON tournament_participants TO app_reader;
        GRANT SELECT ON user_promotions TO app_reader;
    END IF;
END $$;

COMMIT;
