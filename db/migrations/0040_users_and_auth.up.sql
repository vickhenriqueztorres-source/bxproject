-- Migration 0040_users_and_auth.up.sql
-- Subetapa 01: Tabelas de Usuários e Autenticação Nativa (Fase 1 / Secondary Pages)

BEGIN;

-- 1. Tabela users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(64) NOT NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'ES',
    demo_balance_minor BIGINT NOT NULL DEFAULT 1000000, -- US$ 10.000,00 demo inicial
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Tabela password_recovery_tokens
CREATE TABLE IF NOT EXISTS password_recovery_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_recovery_token ON password_recovery_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_recovery_user ON password_recovery_tokens(user_id);

-- 3. Seed da conta de teste oficial Demo Binmax
INSERT INTO users (
    id,
    name,
    email,
    password_hash,
    password_salt,
    country_code,
    demo_balance_minor,
    failed_login_attempts
) VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Usuario Demo Binmax',
    'demo@binmax.com',
    '8e8aa9233600ad27603a664119de807c118928ffdf765157b8ea0cecab3a9f5f',
    'c7a8b9f1d2e3456789abcdef01234567',
    'ES',
    1000000,
    0
) ON CONFLICT (email) DO NOTHING;

-- 4. Permissões de roles (DB-05)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT, INSERT, UPDATE ON users TO app_contract;
        GRANT SELECT, INSERT, UPDATE ON password_recovery_tokens TO app_contract;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        GRANT SELECT ON users TO app_reader;
    END IF;
END $$;

COMMIT;
