-- Migration 0050_rename_synthetic_indices.up.sql
-- Renomeacao Segura e Padronizacao Institucional dos Indices Sinteticos (Padrao Ouro Opcoes Binarias)
-- Símbolos Canônicos: VOL_10, VOL_25, VOL_50, VOL_75, VOL_100, CRASH_BOOM_100

BEGIN;

-- 1. Inserir ou atualizar os novos índices canônicos
INSERT INTO indices (symbol, status, params, updated_at) VALUES
(
  'VOL_10',
  'ACTIVE',
  '{"name": "Volatilidad 10", "subtitle": "Índice V-10 (24/7)", "sigma": 0.00015, "precision": 4, "payout_pct": 85, "initial_price": "100.0000"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO UPDATE SET params = EXCLUDED.params, status = 'ACTIVE', updated_at = NOW();

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'VOL_10',
  0,
  '100.0000',
  '85b5c4d913491120452f10c25a2c2713976969a3fe8bf667182617f5f407fb10',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;


INSERT INTO indices (symbol, status, params, updated_at) VALUES
(
  'VOL_25',
  'ACTIVE',
  '{"name": "Volatilidad 25", "subtitle": "Índice V-25 (24/7)", "sigma": 0.00020, "precision": 4, "payout_pct": 85, "initial_price": "150.0000"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO UPDATE SET params = EXCLUDED.params, status = 'ACTIVE', updated_at = NOW();

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'VOL_25',
  0,
  '150.0000',
  'a4b70c16f8754b66971a74117f11c9987ed85f0a38a88b63e53811434887e226',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;


INSERT INTO indices (symbol, status, params, updated_at) VALUES
(
  'VOL_50',
  'ACTIVE',
  '{"name": "Volatilidad 50", "subtitle": "Índice V-50 (24/7)", "sigma": 0.00025, "precision": 4, "payout_pct": 85, "initial_price": "125.0000"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO UPDATE SET params = EXCLUDED.params, status = 'ACTIVE', updated_at = NOW();

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'VOL_50',
  0,
  '125.0000',
  '1c81ac540994d68b90ecd2855ac61c7fbd80c62d5ffa27f82ee9cc0a00c5f24c',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;


INSERT INTO indices (symbol, status, params, updated_at) VALUES
(
  'VOL_75',
  'ACTIVE',
  '{"name": "Volatilidad 75", "subtitle": "Índice V-75 (24/7)", "sigma": 0.00035, "precision": 4, "payout_pct": 85, "initial_price": "250.0000"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO UPDATE SET params = EXCLUDED.params, status = 'ACTIVE', updated_at = NOW();

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'VOL_75',
  0,
  '250.0000',
  'a1f734d8dc10abf44874bf9391c7c924e4638d7191ac0b8b8ac828d8d0275a59',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;


INSERT INTO indices (symbol, status, params, updated_at) VALUES
(
  'VOL_100',
  'ACTIVE',
  '{"name": "Volatilidad 100", "subtitle": "Índice V-100 (24/7)", "sigma": 0.00050, "precision": 4, "payout_pct": 85, "initial_price": "500.0000"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO UPDATE SET params = EXCLUDED.params, status = 'ACTIVE', updated_at = NOW();

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'VOL_100',
  0,
  '500.0000',
  'ff051203dddb8fcfd1cc6f984cf5e15619f3d25f65e46fb6e0998380f3fd0223',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;


INSERT INTO indices (symbol, status, params, updated_at) VALUES
(
  'CRASH_BOOM_100',
  'ACTIVE',
  '{"name": "Crash & Boom 100", "subtitle": "Índice Crash / Boom (Spikes)", "sigma": 0.00040, "precision": 4, "payout_pct": 85, "initial_price": "1000.0000"}'::jsonb,
  NOW()
) ON CONFLICT (symbol) DO UPDATE SET params = EXCLUDED.params, status = 'ACTIVE', updated_at = NOW();

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch) VALUES
(
  'CRASH_BOOM_100',
  0,
  '1000.0000',
  '0a2caf665d713231014a28d9e2dfb200f01b50d861a9941094c9733e83bbbc06',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

-- 2. Atualizar indices legados para conter tag de alias e manter integridade de chaves estrangeiras
UPDATE indices SET params = params || '{"alias_canonical": "VOL_10"}'::jsonb WHERE symbol = 'SYNTH_VOL_10';
UPDATE indices SET params = params || '{"alias_canonical": "VOL_25"}'::jsonb WHERE symbol = 'SYNTH_VOL_25';
UPDATE indices SET params = params || '{"alias_canonical": "VOL_50"}'::jsonb WHERE symbol = 'SYNTH_VOL_50';
UPDATE indices SET params = params || '{"alias_canonical": "VOL_75"}'::jsonb WHERE symbol = 'SYNTH_VOL_75';
UPDATE indices SET params = params || '{"alias_canonical": "VOL_100"}'::jsonb WHERE symbol = 'SYNTH_VOL_100';
UPDATE indices SET params = params || '{"alias_canonical": "CRASH_BOOM_100"}'::jsonb WHERE symbol = 'SYNTH_CRASH_BOOM_100';

COMMIT;
