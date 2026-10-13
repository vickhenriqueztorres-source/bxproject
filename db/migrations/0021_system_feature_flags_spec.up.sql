-- Migration 0021_system_feature_flags_spec.up.sql
-- Fase 2: Tabela centralizada para as 10 Feature Flags oficiais da especificação

BEGIN;

CREATE TABLE IF NOT EXISTS system_feature_flags (
    flag_key VARCHAR(64) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_feature_flags (flag_key, enabled, description) VALUES
    ('payments_enabled', FALSE, 'Habilita pagamentos reais e PSP'),
    ('kyc_required', FALSE, 'Exige KYC para operações ou saques'),
    ('otc_enabled', TRUE, 'Habilita feed e contratos de mercado OTC demo'),
    ('synthetic_enabled', TRUE, 'Habilita índices sintéticos nativos'),
    ('country_br_enabled', TRUE, 'Acesso e operações para Brasil'),
    ('country_mx_enabled', TRUE, 'Acesso e operações para México'),
    ('country_co_enabled', TRUE, 'Acesso e operações para Colômbia'),
    ('country_ar_enabled', TRUE, 'Acesso e operações para Argentina'),
    ('country_cl_enabled', TRUE, 'Acesso e operações para Chile'),
    ('country_pe_enabled', TRUE, 'Acesso e operações para Peru')
ON CONFLICT (flag_key) DO UPDATE SET 
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON system_feature_flags TO app_contract;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        GRANT SELECT ON system_feature_flags TO app_reader;
    END IF;
END $$;

COMMIT;
