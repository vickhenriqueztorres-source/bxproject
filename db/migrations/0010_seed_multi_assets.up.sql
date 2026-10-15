-- Migration 0010_seed_multi_assets.up.sql
-- Seed expandido com catalogo oficial de 36 ativos OTC (Forex, Cripto, Commodities, Sinteticos)

BEGIN;

SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';

-- 0001 has a legacy configuration shape. Expand it before seeding the
-- catalog; existing prices, sequence, hash, status and contracts stay intact.
ALTER TABLE indices ADD COLUMN IF NOT EXISTS params jsonb;
ALTER TABLE indices ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();
ALTER TABLE indices ADD COLUMN IF NOT EXISTS seeded_by_0010 boolean NOT NULL DEFAULT false;
ALTER TABLE index_state ADD COLUMN IF NOT EXISTS last_ts timestamptz;

UPDATE indices
SET params = jsonb_build_object(
  'initial_price', last_price::text,
  'sigma', volatility,
  'precision', 6,
  'payout_pct', 85
)
FROM index_state
WHERE indices.symbol = index_state.symbol AND indices.params IS NULL;

UPDATE index_state
SET last_ts = COALESCE(
  (SELECT MAX(ts) FROM ticks WHERE ticks.symbol = index_state.symbol),
  index_state.updated_at
)
WHERE last_ts IS NULL;

-- Defaults satisfy the legacy NOT NULL columns while catalog rows are added.
-- The exact catalog values are copied into them below, before COMMIT.
ALTER TABLE indices ALTER COLUMN base_price SET DEFAULT 1;
ALTER TABLE indices ALTER COLUMN volatility SET DEFAULT 0;
ALTER TABLE indices ALTER COLUMN mean_reversion_speed SET DEFAULT 0;

CREATE TEMP TABLE seed_0010_existing_symbols ON COMMIT DROP AS
SELECT symbol FROM indices;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'EURUSD_OTC',
  'EUR/USD (OTC)',
  '{"sigma": 0.00015, "precision": 5, "payout_pct": 85, "initial_price": "1.08540"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'EURUSD_OTC',
  0,
  '1.08540',
  '65cecb570f4b52e2bb26bdee189378df96c97a12d501c1a32f6501be241cce10',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'GBPUSD_OTC',
  'GBP/USD (OTC)',
  '{"sigma": 0.00018, "precision": 5, "payout_pct": 85, "initial_price": "1.29420"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'GBPUSD_OTC',
  0,
  '1.29420',
  '7a7136279b8c5b80b134012fdb4d1be73a8bec4d44b57fe22712dd83b3f5f9d7',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'USDJPY_OTC',
  'USD/JPY (OTC)',
  '{"sigma": 0.00016, "precision": 3, "payout_pct": 85, "initial_price": "151.850"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'USDJPY_OTC',
  0,
  '151.850',
  'cefdb310d5dc76990bc6a701a9d4b0b283e2b5682edb67ca15fee39fc2b3f7ca',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'USDCHF_OTC',
  'USD/CHF (OTC)',
  '{"sigma": 0.00014, "precision": 5, "payout_pct": 85, "initial_price": "0.88450"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'USDCHF_OTC',
  0,
  '0.88450',
  '428d268dcd5bb3c602ee07e28efb2374c0ebce6133ee3f66ef9d85abb3c3f2a6',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'AUDUSD_OTC',
  'AUD/USD (OTC)',
  '{"sigma": 0.00016, "precision": 5, "payout_pct": 85, "initial_price": "0.65820"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'AUDUSD_OTC',
  0,
  '0.65820',
  '6fadf7538eebbe354d5a68f3f2cb9a1485fdd886257c8d991e88a140f93056e4',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'USDCAD_OTC',
  'USD/CAD (OTC)',
  '{"sigma": 0.00015, "precision": 5, "payout_pct": 85, "initial_price": "1.38540"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'USDCAD_OTC',
  0,
  '1.38540',
  '7c708ee8a062ab61fdfcf1dd4baa6ac48e419f35a5e997210b4f9b71d61d5cac',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'NZDUSD_OTC',
  'NZD/USD (OTC)',
  '{"sigma": 0.00017, "precision": 5, "payout_pct": 85, "initial_price": "0.59820"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'NZDUSD_OTC',
  0,
  '0.59820',
  '833a840f3a76f834bde71ae5a7c37b431d472beb1c772aab4e1239bed422ef43',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'EURGBP_OTC',
  'EUR/GBP (OTC)',
  '{"sigma": 0.00013, "precision": 5, "payout_pct": 85, "initial_price": "0.83850"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'EURGBP_OTC',
  0,
  '0.83850',
  'a9409b8e4a55433d2edb5a9df45c33e5b888b63f67735969332464b58ce85ca0',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'EURJPY_OTC',
  'EUR/JPY (OTC)',
  '{"sigma": 0.00018, "precision": 3, "payout_pct": 85, "initial_price": "164.820"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'EURJPY_OTC',
  0,
  '164.820',
  '79ac70c0f9d266d4c2b0f957201b1313ffad6e242035d1477e9577059f792b1a',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'GBPJPY_OTC',
  'GBP/JPY (OTC)',
  '{"sigma": 0.0002, "precision": 3, "payout_pct": 85, "initial_price": "196.540"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'GBPJPY_OTC',
  0,
  '196.540',
  'a70f7d42f2ce7b6d5828c786e3b28991f52b38071195ab2f8643fee35d97939e',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'EURCAD_OTC',
  'EUR/CAD (OTC)',
  '{"sigma": 0.00016, "precision": 5, "payout_pct": 85, "initial_price": "1.48520"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'EURCAD_OTC',
  0,
  '1.48520',
  'badf8f7607aa4dba8bc41bf675d4d75ed01b003c1418fabf44f631dcfeef68d8',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'EURAUD_OTC',
  'EUR/AUD (OTC)',
  '{"sigma": 0.00017, "precision": 5, "payout_pct": 85, "initial_price": "1.64890"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'EURAUD_OTC',
  0,
  '1.64890',
  '5ecb240a08c83b22dc3e4d37cb4116bbbf2a2040cda145578d896d3200ac9892',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'GBPAUD_OTC',
  'GBP/AUD (OTC)',
  '{"sigma": 0.00019, "precision": 5, "payout_pct": 85, "initial_price": "1.96600"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'GBPAUD_OTC',
  0,
  '1.96600',
  '4835d5d60d30544e1bc540f4570f7f69956614eaad58becbb621a4cd49620a20',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'GBPCAD_OTC',
  'GBP/CAD (OTC)',
  '{"sigma": 0.00018, "precision": 5, "payout_pct": 85, "initial_price": "1.79350"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'GBPCAD_OTC',
  0,
  '1.79350',
  '88ebc84ca7a8ff0f4c7a04a8238e49636da6a57862512e27c449b020f0b14e6a',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'AUDCAD_OTC',
  'AUD/CAD (OTC)',
  '{"sigma": 0.00015, "precision": 5, "payout_pct": 85, "initial_price": "0.91180"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'AUDCAD_OTC',
  0,
  '0.91180',
  '205d7e9b8f67acbf20f1937f23a3dae2603c163e3c8f6b354b4053367196e8d4',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'AUDJPY_OTC',
  'AUD/JPY (OTC)',
  '{"sigma": 0.00018, "precision": 3, "payout_pct": 85, "initial_price": "99.950"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'AUDJPY_OTC',
  0,
  '99.950',
  '4f9ea16e3a72b46930ebfbe16cd61ee32657fa3c7f38034000ccaab3dbb2e7fc',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'CADJPY_OTC',
  'CAD/JPY (OTC)',
  '{"sigma": 0.00017, "precision": 3, "payout_pct": 85, "initial_price": "109.610"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'CADJPY_OTC',
  0,
  '109.610',
  '47f94c55f4599ebfce223864640aae0874dafbda25c1992362ed7e7c6c591663',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'NZDJPY_OTC',
  'NZD/JPY (OTC)',
  '{"sigma": 0.00018, "precision": 3, "payout_pct": 85, "initial_price": "90.840"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'NZDJPY_OTC',
  0,
  '90.840',
  '074e7817c6ebe468dd641154b80459295169895608329313817caf02a56f57f0',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'BTCUSD_OTC',
  'BTC/USD (OTC)',
  '{"sigma": 0.00035, "precision": 2, "payout_pct": 85, "initial_price": "64500.00"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'BTCUSD_OTC',
  0,
  '64500.00',
  '17987197a424b82cd27ffcb82f45b09e878d426f6144ea77d87950ff2a5d45b9',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'ETHUSD_OTC',
  'ETH/USD (OTC)',
  '{"sigma": 0.00045, "precision": 2, "payout_pct": 85, "initial_price": "3450.00"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'ETHUSD_OTC',
  0,
  '3450.00',
  '022707e4c590b831821a0f4a04bfb63cbc129ee47e56f7e9e504a586ab95c8f4',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'SOLUSD_OTC',
  'SOL/USD (OTC)',
  '{"sigma": 0.0006, "precision": 2, "payout_pct": 85, "initial_price": "155.40"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'SOLUSD_OTC',
  0,
  '155.40',
  'f653484e9ba84a1e07173dcc1808fb6c808025ea9c8baa4f1f7e004617e936df',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'BNBUSD_OTC',
  'BNB/USD (OTC)',
  '{"sigma": 0.0004, "precision": 2, "payout_pct": 85, "initial_price": "580.50"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'BNBUSD_OTC',
  0,
  '580.50',
  '41fdbb84a17f26f377a43fe86853ba8a28b9d5c05fd1ae0f1e258c9fda979031',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'XRPUSD_OTC',
  'XRP/USD (OTC)',
  '{"sigma": 0.00055, "precision": 4, "payout_pct": 85, "initial_price": "0.5480"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'XRPUSD_OTC',
  0,
  '0.5480',
  '1a56e749c132b03217108f391c8387d7fba68b08736a406f6087da83176b1ab9',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'ADAUSD_OTC',
  'ADA/USD (OTC)',
  '{"sigma": 0.0006, "precision": 4, "payout_pct": 85, "initial_price": "0.3540"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'ADAUSD_OTC',
  0,
  '0.3540',
  '00cd6b21779b33f0d6114d67a6986964b04895d565f6d3c39457e9cc0934e8e6',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'DOGEUSD_OTC',
  'DOGE/USD (OTC)',
  '{"sigma": 0.00075, "precision": 4, "payout_pct": 85, "initial_price": "0.1145"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'DOGEUSD_OTC',
  0,
  '0.1145',
  'bbe7093f0a0c8632223bfa5187972216f1542eb35db1dbe8d4f0fc74c678292a',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'AVAXUSD_OTC',
  'AVAX/USD (OTC)',
  '{"sigma": 0.00065, "precision": 2, "payout_pct": 85, "initial_price": "28.50"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'AVAXUSD_OTC',
  0,
  '28.50',
  '06ae5206225f8bb27103256d5bebdc550eacb6a6b937f0c2e2e09c93e9067970',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'XAUUSD_OTC',
  'Gold Spot (OTC)',
  '{"sigma": 0.0002, "precision": 2, "payout_pct": 85, "initial_price": "2650.50"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'XAUUSD_OTC',
  0,
  '2650.50',
  '025fba950e2bf676c597e36e90613f2e9f5f263925cf432787a284141978a913',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'XAGUSD_OTC',
  'Silver Spot (OTC)',
  '{"sigma": 0.0003, "precision": 3, "payout_pct": 85, "initial_price": "31.850"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'XAGUSD_OTC',
  0,
  '31.850',
  '881a23ddebab3e6dd4b246814ceab855436cbf1d3f0fdb956bdd2f1f325d5a9f',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'USOIL_OTC',
  'WTI Crude Oil (OTC)',
  '{"sigma": 0.00035, "precision": 2, "payout_pct": 85, "initial_price": "71.40"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'USOIL_OTC',
  0,
  '71.40',
  '2ff96297a909183c4044c9d4902599dc1040e53b22c66464af47986e7a5e19cc',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'UKOIL_OTC',
  'Brent Crude Oil (OTC)',
  '{"sigma": 0.00035, "precision": 2, "payout_pct": 85, "initial_price": "75.20"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'UKOIL_OTC',
  0,
  '75.20',
  'e4838943db4cb65e2127146afd1a21751f29842e39a5fad67b30fdf1224bbf7e',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'SYNTH_VOL_10',
  'Volatility 10 Index',
  '{"sigma": 0.0001, "precision": 4, "payout_pct": 85, "initial_price": "100.0000"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'SYNTH_VOL_10',
  0,
  '100.0000',
  '91093c83ef98df14fe914968e03b4214ab07d2884bff209242a7ec1854bc788d',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'SYNTH_VOL_25',
  'Volatility 25 Index',
  '{"sigma": 0.00018, "precision": 4, "payout_pct": 85, "initial_price": "150.0000"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'SYNTH_VOL_25',
  0,
  '150.0000',
  '2e78a424ca8ac1f666cf342b65de856e29d7489a364bddddee45912f6cb6050c',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'SYNTH_VOL_50',
  'Volatility 50 Index',
  '{"sigma": 0.00025, "precision": 4, "payout_pct": 85, "initial_price": "125.0000"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'SYNTH_VOL_50',
  0,
  '125.0000',
  '1f17a01dad47a5fc37566172a992b3eb0e6c52b40987c68c2bc6acb41800c278',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'SYNTH_VOL_75',
  'Volatility 75 Index',
  '{"sigma": 0.00035, "precision": 4, "payout_pct": 85, "initial_price": "250.0000"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'SYNTH_VOL_75',
  0,
  '250.0000',
  'b6aaaa227972e80ba2ee599fa9d8e5da5db54a59adc81d9b3ef0840c7b484cdf',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'SYNTH_VOL_100',
  'Volatility 100 Index',
  '{"sigma": 0.0005, "precision": 4, "payout_pct": 85, "initial_price": "500.0000"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'SYNTH_VOL_100',
  0,
  '500.0000',
  '7e0050d953bd601711ce2b336b289d730dba5fd596035d97be53204869093b8d',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO indices (symbol, name, params, status) VALUES (
  'SYNTH_CRASH_BOOM_100',
  'Crash/Boom 100 Index',
  '{"sigma": 0.0004, "precision": 4, "payout_pct": 85, "initial_price": "1000.0000"}'::jsonb,
  'ACTIVE'
) ON CONFLICT (symbol) DO NOTHING;

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
VALUES (
  'SYNTH_CRASH_BOOM_100',
  0,
  '1000.0000',
  '0e985318cd9bbaf62d01552bb67aa6ba0fd657666665e359005af1d9b5b872fc',
  NOW(),
  0
) ON CONFLICT (symbol) DO NOTHING;

-- V-01: Garantia de imutabilidade do campo precision apos o primeiro tick
UPDATE indices
SET base_price = (indices.params->>'initial_price')::numeric,
    volatility = (indices.params->>'sigma')::numeric,
    mean_reversion_speed = 0,
    seeded_by_0010 = true
WHERE NOT EXISTS (
  SELECT 1 FROM seed_0010_existing_symbols old WHERE old.symbol = indices.symbol
);

CREATE OR REPLACE FUNCTION indices_precision_immutable_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE last_seq bigint;
BEGIN
  IF (OLD.params->>'precision') IS DISTINCT FROM (NEW.params->>'precision') THEN
    SELECT last_sequence INTO last_seq FROM index_state WHERE symbol = NEW.symbol;
    IF last_seq > 0 THEN
      RAISE EXCEPTION 'V-01: params.precision e imutavel depois do primeiro tick para o ativo %', NEW.symbol
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS indices_precision_guard ON indices;
CREATE TRIGGER indices_precision_guard
BEFORE UPDATE ON indices
FOR EACH ROW EXECUTE FUNCTION indices_precision_immutable_guard();

COMMIT;
