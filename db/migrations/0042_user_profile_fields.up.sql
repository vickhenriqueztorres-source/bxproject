-- Migration 0042_user_profile_fields.up.sql
-- Subetapa 1.1: Adiciona campos de telefone e metadados ao perfil do usuário

BEGIN;

ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS phone_code VARCHAR(8) DEFAULT '+34',
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32);

-- Atualiza permissões das roles existentes se aplicável
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT, INSERT, UPDATE ON users TO app_contract;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        GRANT SELECT ON users TO app_reader;
    END IF;
END $$;

COMMIT;
