-- Migration 0030_regulatory_zones_mirrors_kyc_tiers.up.sql
-- Subetapa 1: Zonas Regulatórias (Red, Yellow, Green), Domínios Espelho e KYC Tiers

BEGIN;

-- 1. Catálogo de Jurisdições Regulatórias
CREATE TABLE IF NOT EXISTS regulatory_jurisdictions (
    country_code CHAR(2) PRIMARY KEY,
    country_name VARCHAR(64) NOT NULL,
    zone VARCHAR(16) NOT NULL CHECK (zone IN ('RED', 'YELLOW', 'GREEN')),
    regulator_authority VARCHAR(64) NOT NULL,
    enforcement_level VARCHAR(64) NOT NULL,
    hard_block BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reg_jurisdictions_zone ON regulatory_jurisdictions(zone);

-- 2. Catálogo da Rede de Domínios Espelho (Mirror Domains / Domain Rotation)
CREATE TABLE IF NOT EXISTS mirror_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name VARCHAR(255) NOT NULL UNIQUE,
    target_country CHAR(2) REFERENCES regulatory_jurisdictions(country_code) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'STANDBY' CHECK (status IN ('ACTIVE', 'STANDBY', 'BLOCKED', 'DEAD')),
    priority INT NOT NULL DEFAULT 100,
    latency_ms INT NOT NULL DEFAULT 0,
    last_health_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mirror_domains_country_status ON mirror_domains(target_country, status);
CREATE INDEX IF NOT EXISTS idx_mirror_domains_priority ON mirror_domains(priority);

-- 3. Evolução do Schema de KYC em Camadas (Tier 0 & Tier 1)
ALTER TABLE kyc_profiles 
    ADD COLUMN IF NOT EXISTS tier VARCHAR(16) NOT NULL DEFAULT 'TIER_0',
    ADD COLUMN IF NOT EXISTS deposit_limit_minor BIGINT NOT NULL DEFAULT 30000,
    ADD COLUMN IF NOT EXISTS nationality_country_code CHAR(2) REFERENCES regulatory_jurisdictions(country_code) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_kyc_tier'
    ) THEN
        ALTER TABLE kyc_profiles ADD CONSTRAINT chk_kyc_tier CHECK (tier IN ('TIER_0', 'TIER_1'));
    END IF;
END $$;

-- 4. Seeds Iniciais de Jurisdições Regulatórias

-- ZONA VERMELHA: Banimento absoluto de oferta a varejo / Hard Geo-block obrigatório
INSERT INTO regulatory_jurisdictions (country_code, country_name, zone, regulator_authority, enforcement_level, hard_block) VALUES
    ('US', 'Estados Unidos', 'RED', 'CFTC/SEC', 'CRIMINAL_SANCTIONS', TRUE),
    ('CA', 'Canadá', 'RED', 'CSA', 'ACTIVE_PROSECUTION', TRUE),
    ('GB', 'Reino Unido', 'RED', 'FCA', 'RETAIL_BAN', TRUE),
    ('AU', 'Austrália', 'RED', 'ASIC', 'RETAIL_BAN', TRUE),
    ('IL', 'Israel', 'RED', 'ISA', 'TOTAL_BAN', TRUE),
    ('JP', 'Japão', 'RED', 'JFSA', 'STRICT_LOCAL_LICENSE_ONLY', TRUE),
    ('DE', 'Alemanha', 'RED', 'BaFin', 'ESMA_RETAIL_BAN', TRUE),
    ('FR', 'França', 'RED', 'AMF', 'ESMA_RETAIL_BAN', TRUE),
    ('IT', 'Itália', 'RED', 'CONSOB', 'ESMA_RETAIL_BAN', TRUE),
    ('ES', 'Espanha', 'RED', 'CNMV', 'ESMA_RETAIL_BAN', TRUE),
    ('NL', 'Holanda', 'RED', 'AFM', 'ESMA_RETAIL_BAN', TRUE),
    ('BE', 'Bélgica', 'RED', 'FSMA', 'TOTAL_BAN', TRUE),
    ('AT', 'Áustria', 'RED', 'FMA', 'ESMA_RETAIL_BAN', TRUE),
    ('SE', 'Suécia', 'RED', 'FI', 'ESMA_RETAIL_BAN', TRUE),
    ('PL', 'Polônia', 'RED', 'KNF', 'ESMA_RETAIL_BAN', TRUE),
    ('IE', 'Irlanda', 'RED', 'CBI', 'ESMA_RETAIL_BAN', TRUE),
    ('PT', 'Portugal', 'RED', 'CMVM', 'ESMA_RETAIL_BAN', TRUE),
    ('GR', 'Grécia', 'RED', 'HCMC', 'ESMA_RETAIL_BAN', TRUE)
ON CONFLICT (country_code) DO UPDATE SET
    zone = EXCLUDED.zone,
    regulator_authority = EXCLUDED.regulator_authority,
    enforcement_level = EXCLUDED.enforcement_level,
    hard_block = EXCLUDED.hard_block;

-- ZONA AMARELA / CINZENTA: Proibição de captação ativa, execução offshore operante (Reverse Solicitation)
INSERT INTO regulatory_jurisdictions (country_code, country_name, zone, regulator_authority, enforcement_level, hard_block) VALUES
    ('MX', 'México', 'YELLOW', 'CNBV', 'REVERSE_SOLICITATION', FALSE),
    ('IN', 'Índia', 'YELLOW', 'SEBI/RBI', 'REVERSE_SOLICITATION', FALSE),
    ('ID', 'Indonésia', 'YELLOW', 'Bappebti', 'REVERSE_SOLICITATION', FALSE),
    ('TH', 'Tailândia', 'YELLOW', 'SEC', 'REVERSE_SOLICITATION', FALSE),
    ('ZA', 'África do Sul', 'YELLOW', 'FSCA', 'REVERSE_SOLICITATION', FALSE),
    ('NG', 'Nigéria', 'YELLOW', 'SEC', 'REVERSE_SOLICITATION', FALSE),
    ('TR', 'Turquia', 'YELLOW', 'CMB', 'REVERSE_SOLICITATION', FALSE),
    ('PH', 'Filipinas', 'YELLOW', 'SEC', 'REVERSE_SOLICITATION', FALSE)
ON CONFLICT (country_code) DO UPDATE SET
    zone = EXCLUDED.zone,
    regulator_authority = EXCLUDED.regulator_authority,
    enforcement_level = EXCLUDED.enforcement_level,
    hard_block = EXCLUDED.hard_block;

-- ZONA VERDE: Sedes, licenças offshore e tolerância total de acesso (Brasil 100% livre)
INSERT INTO regulatory_jurisdictions (country_code, country_name, zone, regulator_authority, enforcement_level, hard_block) VALUES
    ('BR', 'Brasil', 'GREEN', 'LIBERADO_BR', 'UNRESTRICTED_ACCESS', FALSE),
    ('KM', 'Comores', 'GREEN', 'Mwali/Anjouan', 'OFFSHORE_LICENSED', FALSE),
    ('VC', 'São Vicente e Granadinas', 'GREEN', 'SVGFSA', 'OFFSHORE_TOLERATED', FALSE),
    ('SC', 'Seychelles', 'GREEN', 'FSA', 'OFFSHORE_LICENSED', FALSE),
    ('VU', 'Vanuatu', 'GREEN', 'VFSC', 'OFFSHORE_LICENSED', FALSE),
    ('MH', 'Ilhas Marshall', 'GREEN', 'Maritime/Registry', 'IBC_TOLERATED', FALSE),
    ('CR', 'Costa Rica', 'GREEN', 'General Commerce', 'OFFSHORE_TOLERATED', FALSE),
    ('LC', 'Santa Lúcia', 'GREEN', 'FSRA', 'OFFSHORE_LICENSED', FALSE),
    ('CO', 'Colômbia', 'GREEN', 'SFC', 'UNRESTRICTED_ACCESS', FALSE),
    ('AR', 'Argentina', 'GREEN', 'CNV', 'UNRESTRICTED_ACCESS', FALSE),
    ('CL', 'Chile', 'GREEN', 'CMF', 'UNRESTRICTED_ACCESS', FALSE),
    ('PE', 'Peru', 'GREEN', 'SMV', 'UNRESTRICTED_ACCESS', FALSE)
ON CONFLICT (country_code) DO UPDATE SET
    zone = EXCLUDED.zone,
    regulator_authority = EXCLUDED.regulator_authority,
    enforcement_level = EXCLUDED.enforcement_level,
    hard_block = EXCLUDED.hard_block;

-- 5. Seeds Iniciais de Domínios Espelho
INSERT INTO mirror_domains (domain_name, target_country, status, priority, latency_ms) VALUES
    ('app.nomedominio-br1.com', 'BR', 'ACTIVE', 10, 15),
    ('app.nomedominio-br2.com', 'BR', 'STANDBY', 20, 18),
    ('app.nomedominio-in.com', 'IN', 'ACTIVE', 10, 45),
    ('app.nomedominio-in2.com', 'IN', 'STANDBY', 20, 50),
    ('app.nomedominio-global.com', NULL, 'ACTIVE', 10, 30),
    ('app.nomedominio-global2.com', NULL, 'STANDBY', 20, 35)
ON CONFLICT (domain_name) DO UPDATE SET
    target_country = EXCLUDED.target_country,
    status = EXCLUDED.status,
    priority = EXCLUDED.priority,
    updated_at = NOW();

-- 6. Concessão de Privilégios Mínimos
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON regulatory_jurisdictions, mirror_domains TO app_contract;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        GRANT SELECT ON regulatory_jurisdictions, mirror_domains TO app_reader;
    END IF;
END $$;

COMMIT;
