-- Migration 0050_rename_synthetic_indices.up.sql
-- Renomeacao Segura e Padronizacao Institucional dos Indices Sinteticos (Padrao Ouro Opcoes Binarias)
-- Símbolos Canônicos: VOL_10, VOL_25, VOL_50, VOL_75, VOL_100, CRASH_BOOM_100

BEGIN;

SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
ALTER TABLE indices ADD COLUMN IF NOT EXISTS seeded_by_0050 boolean NOT NULL DEFAULT false;
CREATE TEMP TABLE seed_0050_existing_symbols ON COMMIT DROP AS SELECT symbol FROM indices;

-- Seed only missing canonical symbols; never rewrite a live configuration.
INSERT INTO indices (symbol, name, status, params, updated_at) VALUES
(
  'VOL_10',
  'Volatilidad 10',
  'ACTIVE',
  '{"name": "Volatilidad 10", "subtitle": "Índice V-10 (24/7)", "sigma": 0.00015, "precision": 4, "payout_pct": 85, "initial_price": "100.5420"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'VOL_10',
  0,
  '100.5420',
  '85b5c4d913491120452f10c25a2c2713976969a3fe8bf667182617f5f407fb10',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;


INSERT INTO indices (symbol, name, status, params, updated_at) VALUES
(
  'VOL_25',
  'Volatilidad 25',
  'ACTIVE',
  '{"name": "Volatilidad 25", "subtitle": "Índice V-25 (24/7)", "sigma": 0.00030, "precision": 4, "payout_pct": 85, "initial_price": "250.8410"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'VOL_25',
  0,
  '250.8410',
  'a4b70c16f8754b66971a74117f11c9987ed85f0a38a88b63e53811434887e226',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;


INSERT INTO indices (symbol, name, status, params, updated_at) VALUES
(
  'VOL_50',
  'Volatilidad 50',
  'ACTIVE',
  '{"name": "Volatilidad 50", "subtitle": "Índice V-50 (24/7)", "sigma": 0.00060, "precision": 4, "payout_pct": 85, "initial_price": "500.1250"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'VOL_50',
  0,
  '500.1250',
  '1c81ac540994d68b90ecd2855ac61c7fbd80c62d5ffa27f82ee9cc0a00c5f24c',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;


INSERT INTO indices (symbol, name, status, params, updated_at) VALUES
(
  'VOL_75',
  'Volatilidad 75',
  'ACTIVE',
  '{"name": "Volatilidad 75", "subtitle": "Índice V-75 (24/7)", "sigma": 0.00085, "precision": 4, "payout_pct": 85, "initial_price": "750.3200"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'VOL_75',
  0,
  '750.3200',
  'a1f734d8dc10abf44874bf9391c7c924e4638d7191ac0b8b8ac828d8d0275a59',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;


INSERT INTO indices (symbol, name, status, params, updated_at) VALUES
(
  'VOL_100',
  'Volatilidad 100',
  'ACTIVE',
  '{"name": "Volatilidad 100", "subtitle": "Índice V-100 (24/7)", "sigma": 0.00110, "precision": 4, "payout_pct": 85, "initial_price": "1000.4500"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'VOL_100',
  0,
  '1000.4500',
  'ff051203dddb8fcfd1cc6f984cf5e15619f3d25f65e46fb6e0998380f3fd0223',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;


INSERT INTO indices (symbol, name, status, params, updated_at) VALUES
(
  'CRASH_BOOM_100',
  'Crash & Boom 100',
  'ACTIVE',
  '{"name": "Crash & Boom 100", "subtitle": "Índice Crash / Boom (Spikes)", "sigma": 0.00130, "precision": 4, "payout_pct": 85, "initial_price": "1000.8200"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'CRASH_BOOM_100',
  0,
  '1000.8200',
  '0a2caf665d713231014a28d9e2dfb200f01b50d861a9941094c9733e83bbbc06',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

UPDATE indices
SET base_price = (params->>'initial_price')::numeric,
    volatility = (params->>'sigma')::numeric,
    mean_reversion_speed = 0,
    seeded_by_0050 = true
WHERE indices.symbol IN ('VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'CRASH_BOOM_100')
  AND NOT EXISTS (SELECT 1 FROM seed_0050_existing_symbols old WHERE old.symbol = indices.symbol);

COMMIT;
