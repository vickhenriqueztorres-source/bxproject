-- Migration 0060_phase2_spec_completeness.up.sql
-- Fase 2 Completa (Seções 6.1, 8.1 e 9.3): Schemas exatos de payment_methods, payment_intents, kyc_profiles (NOT_STARTED) e limites de stake por país

BEGIN;

-- 1. Limites de Stake Mínimo e Máximo por País (Seção 6.1)
ALTER TABLE countries
  ADD COLUMN IF NOT EXISTS min_stake_minor BIGINT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_stake_minor BIGINT NOT NULL DEFAULT 10000;

UPDATE countries SET min_stake_minor = 100, max_stake_minor = 10000 WHERE code IN ('BR', 'MX', 'CO', 'AR', 'CL', 'PE');

-- 2. Tabela oficial payment_methods conforme Seção 8.1
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  method TEXT NOT NULL, -- pix, spei, pse, mercado_pago, khipu, yape
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_methods_country_method UNIQUE (country_code, method)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_country_code ON payment_methods(country_code);

INSERT INTO payment_methods (id, country_code, method, enabled) VALUES
  (gen_random_uuid(), 'BR', 'pix', FALSE),
  (gen_random_uuid(), 'MX', 'spei', FALSE),
  (gen_random_uuid(), 'CO', 'pse', FALSE),
  (gen_random_uuid(), 'AR', 'mercado_pago', FALSE),
  (gen_random_uuid(), 'CL', 'khipu', FALSE),
  (gen_random_uuid(), 'PE', 'yape', FALSE)
ON CONFLICT (country_code, method) DO UPDATE SET
  enabled = FALSE;

-- 3. Compatibilidade de kyc_profiles com Seção 8.1 (status DEFAULT 'NOT_STARTED', document_type anulável)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kyc_profiles') THEN
    ALTER TABLE kyc_profiles ALTER COLUMN document_type DROP NOT NULL;
    ALTER TABLE kyc_profiles ALTER COLUMN status SET DEFAULT 'NOT_STARTED';
    ALTER TABLE kyc_profiles DROP CONSTRAINT IF EXISTS chk_kyc_status;
    ALTER TABLE kyc_profiles ADD CONSTRAINT chk_kyc_status CHECK (status IN ('NOT_STARTED', 'UNVERIFIED', 'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'));
  ELSE
    CREATE TABLE kyc_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'NOT_STARTED',
      document_type TEXT,
      document_number TEXT,
      country_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- 4. Tabela oficial payment_intents conforme Seção 8.1
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  country_code TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  psp_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_user_id ON payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_country_status ON payment_intents(country_code, status);

-- 5. Grants de menor privilégio (DB-05)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON payment_methods, payment_intents TO app_contract;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
    GRANT SELECT ON payment_methods, payment_intents TO app_reader;
  END IF;
END $$;

COMMIT;
