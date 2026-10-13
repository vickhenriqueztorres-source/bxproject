-- Migration 0043_email_verification.up.sql
-- Adiciona suporte a verificação obrigatória de e-mail e códigos OTP de 6 dígitos

BEGIN;

-- 1. Campos de status de e-mail na tabela users
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Usuários de teste pré-existentes são marcados como verificados
UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE email = 'demo@binmax.com';

-- 2. Tabela de códigos e tokens de verificação de e-mail
CREATE TABLE IF NOT EXISTS email_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code CHAR(6) NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verif_code ON email_verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_email_verif_token ON email_verification_codes(token);

-- 3. Concessão de permissões às roles de aplicação
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON email_verification_codes TO app_contract;
        GRANT SELECT, INSERT, UPDATE ON users TO app_contract;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        GRANT SELECT ON email_verification_codes TO app_reader;
        GRANT SELECT ON users TO app_reader;
    END IF;
END $$;

COMMIT;
