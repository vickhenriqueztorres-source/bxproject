-- Migration 0020_phase2_countries_flags_kyc_payments.up.sql
-- Fase 2: Schemas para 6 Países, 6 Moedas de Exibição, Feature Flags, KYC Preparatório e Métodos de Pagamento Inativos

BEGIN;

-- 1. Catálogo Oficial dos 6 Países Autorizados
CREATE TABLE IF NOT EXISTS countries (
    code CHAR(2) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    default_currency CHAR(3) NOT NULL,
    default_locale VARCHAR(10) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Catálogo das 6 Moedas de Exibição (Display Only - Não altera Ledger em USD)
CREATE TABLE IF NOT EXISTS display_currencies (
    code CHAR(3) PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    name VARCHAR(64) NOT NULL,
    decimals INT NOT NULL DEFAULT 2,
    exchange_rate_to_usd NUMERIC(18,6) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Feature Flags Dinâmicas por País
CREATE TABLE IF NOT EXISTS country_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code CHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
    flag_key VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_country_flag UNIQUE (country_code, flag_key)
);
CREATE INDEX IF NOT EXISTS idx_country_flags_lookup ON country_feature_flags(country_code, flag_key);

-- 4. Schema Preparatório para KYC Regional (Zero obrigatoriedade na Fase 2 Demo)
CREATE TABLE IF NOT EXISTS kyc_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL UNIQUE,
    country_code CHAR(2) NOT NULL REFERENCES countries(code),
    document_type VARCHAR(32) NOT NULL,
    document_number VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_kyc_status CHECK (status IN ('UNVERIFIED', 'PENDING', 'APPROVED', 'REJECTED'))
);
CREATE INDEX IF NOT EXISTS idx_kyc_user_country ON kyc_profiles(user_id, country_code);

-- 5. Schema Preparatório para Métodos de Pagamento Futuros (is_active estritamente FALSE)
CREATE TABLE IF NOT EXISTS payment_methods_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code CHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
    method_code VARCHAR(32) NOT NULL,
    name VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_country_method UNIQUE (country_code, method_code)
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_country ON payment_methods_registry(country_code);

-- ==========================================================
-- SEEDS INICIAIS DA FASE 2
-- ==========================================================

-- Países Autorizados
INSERT INTO countries (code, name, default_currency, default_locale, is_active) VALUES
    ('BR', 'Brasil', 'BRL', 'pt-BR', TRUE),
    ('MX', 'México', 'MXN', 'es-MX', TRUE),
    ('CO', 'Colômbia', 'COP', 'es-CO', TRUE),
    ('AR', 'Argentina', 'ARS', 'es-AR', TRUE),
    ('CL', 'Chile', 'CLP', 'es-CL', TRUE),
    ('PE', 'Peru', 'PEN', 'es-PE', TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    default_currency = EXCLUDED.default_currency,
    default_locale = EXCLUDED.default_locale,
    is_active = EXCLUDED.is_active;

-- Moedas de Exibição com taxas iniciais de referência para 1 USD
INSERT INTO display_currencies (code, symbol, name, decimals, exchange_rate_to_usd) VALUES
    ('BRL', 'R$', 'Real Brasileiro', 2, 5.500000),
    ('MXN', 'Mex$', 'Peso Mexicano', 2, 19.500000),
    ('COP', 'Col$', 'Peso Colombiano', 0, 4150.000000),
    ('ARS', '$', 'Peso Argentino', 2, 980.000000),
    ('CLP', 'CLP$', 'Peso Chileno', 0, 940.000000),
    ('PEN', 'S/.', 'Sol Peruano', 2, 3.750000)
ON CONFLICT (code) DO UPDATE SET
    symbol = EXCLUDED.symbol,
    name = EXCLUDED.name,
    decimals = EXCLUDED.decimals,
    exchange_rate_to_usd = EXCLUDED.exchange_rate_to_usd,
    updated_at = NOW();

-- Feature Flags Padrão para os 6 Países
INSERT INTO country_feature_flags (country_code, flag_key, enabled) VALUES
    ('BR', 'trading_enabled', TRUE),
    ('BR', 'otc_real_feed', TRUE),
    ('BR', 'demo_wallet', TRUE),
    ('MX', 'trading_enabled', TRUE),
    ('MX', 'otc_real_feed', TRUE),
    ('MX', 'demo_wallet', TRUE),
    ('CO', 'trading_enabled', TRUE),
    ('CO', 'otc_real_feed', TRUE),
    ('CO', 'demo_wallet', TRUE),
    ('AR', 'trading_enabled', TRUE),
    ('AR', 'otc_real_feed', TRUE),
    ('AR', 'demo_wallet', TRUE),
    ('CL', 'trading_enabled', TRUE),
    ('CL', 'otc_real_feed', TRUE),
    ('CL', 'demo_wallet', TRUE),
    ('PE', 'trading_enabled', TRUE),
    ('PE', 'otc_real_feed', TRUE),
    ('PE', 'demo_wallet', TRUE)
ON CONFLICT (country_code, flag_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

-- Métodos de Pagamento Preparatórios (Inativos na Fase 2 Demo)
INSERT INTO payment_methods_registry (country_code, method_code, name, type, is_active, config) VALUES
    ('BR', 'PIX', 'Pix Banco Central', 'INSTANT', FALSE, '{"currency": "BRL"}'::jsonb),
    ('BR', 'BOLETO', 'Boleto Bancário', 'VOUCHER', FALSE, '{"currency": "BRL"}'::jsonb),
    ('MX', 'SPEI', 'SPEI Transferencia', 'INSTANT', FALSE, '{"currency": "MXN"}'::jsonb),
    ('MX', 'OXXO', 'OXXO Pay Voucher', 'VOUCHER', FALSE, '{"currency": "MXN"}'::jsonb),
    ('CO', 'PSE', 'PSE Pagos Seguros en Línea', 'INSTANT', FALSE, '{"currency": "COP"}'::jsonb),
    ('CO', 'EFECTY', 'Efecty Puntos de Pago', 'VOUCHER', FALSE, '{"currency": "COP"}'::jsonb),
    ('AR', 'RAPIPAGO', 'RapiPago Express', 'VOUCHER', FALSE, '{"currency": "ARS"}'::jsonb),
    ('AR', 'PAGOFACIL', 'Pago Fácil', 'VOUCHER', FALSE, '{"currency": "ARS"}'::jsonb),
    ('CL', 'SENCILLITO', 'Sencillito Express', 'VOUCHER', FALSE, '{"currency": "CLP"}'::jsonb),
    ('CL', 'WEBPAY', 'WebPay Plus Débito', 'INSTANT', FALSE, '{"currency": "CLP"}'::jsonb),
    ('PE', 'PAGOEFECTIVO', 'PagoEfectivo CIP', 'VOUCHER', FALSE, '{"currency": "PEN"}'::jsonb),
    ('PE', 'YAPE', 'Yape BCP', 'INSTANT', FALSE, '{"currency": "PEN"}'::jsonb)
ON CONFLICT (country_code, method_code) DO NOTHING;

-- Grants de Menor Privilégio
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON countries, display_currencies, country_feature_flags, kyc_profiles, payment_methods_registry TO app_contract;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        GRANT SELECT ON countries, display_currencies, country_feature_flags TO app_reader;
    END IF;
END $$;

COMMIT;
