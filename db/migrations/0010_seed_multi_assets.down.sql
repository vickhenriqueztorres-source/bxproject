-- Migration 0010_seed_multi_assets.down.sql
BEGIN;

SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';

-- Never remove a catalog asset or the precision guard after durable activity.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ticks)
     OR EXISTS (SELECT 1 FROM candles)
     OR EXISTS (SELECT 1 FROM contracts)
  THEN
    RAISE EXCEPTION '0010 rollback refused: durable ticks, candles or contracts exist';
  END IF;
END $$;

DROP TRIGGER IF EXISTS indices_precision_guard ON indices;
DROP FUNCTION IF EXISTS indices_precision_immutable_guard();

DELETE FROM index_state WHERE symbol IN (SELECT symbol FROM indices WHERE seeded_by_0010) AND symbol IN (
  'EURUSD_OTC',
  'GBPUSD_OTC',
  'USDJPY_OTC',
  'USDCHF_OTC',
  'AUDUSD_OTC',
  'USDCAD_OTC',
  'NZDUSD_OTC',
  'EURGBP_OTC',
  'EURJPY_OTC',
  'GBPJPY_OTC',
  'EURCAD_OTC',
  'EURAUD_OTC',
  'GBPAUD_OTC',
  'GBPCAD_OTC',
  'AUDCAD_OTC',
  'AUDJPY_OTC',
  'CADJPY_OTC',
  'NZDJPY_OTC',
  'BTCUSD_OTC',
  'ETHUSD_OTC',
  'SOLUSD_OTC',
  'BNBUSD_OTC',
  'XRPUSD_OTC',
  'ADAUSD_OTC',
  'DOGEUSD_OTC',
  'AVAXUSD_OTC',
  'XAUUSD_OTC',
  'XAGUSD_OTC',
  'USOIL_OTC',
  'UKOIL_OTC',
  'SYNTH_VOL_10',
  'SYNTH_VOL_25',
  'SYNTH_VOL_75',
  'SYNTH_VOL_100',
  'SYNTH_CRASH_BOOM_100'
);

DELETE FROM indices WHERE seeded_by_0010 AND symbol IN (
  'EURUSD_OTC',
  'GBPUSD_OTC',
  'USDJPY_OTC',
  'USDCHF_OTC',
  'AUDUSD_OTC',
  'USDCAD_OTC',
  'NZDUSD_OTC',
  'EURGBP_OTC',
  'EURJPY_OTC',
  'GBPJPY_OTC',
  'EURCAD_OTC',
  'EURAUD_OTC',
  'GBPAUD_OTC',
  'GBPCAD_OTC',
  'AUDCAD_OTC',
  'AUDJPY_OTC',
  'CADJPY_OTC',
  'NZDJPY_OTC',
  'BTCUSD_OTC',
  'ETHUSD_OTC',
  'SOLUSD_OTC',
  'BNBUSD_OTC',
  'XRPUSD_OTC',
  'ADAUSD_OTC',
  'DOGEUSD_OTC',
  'AVAXUSD_OTC',
  'XAUUSD_OTC',
  'XAGUSD_OTC',
  'USOIL_OTC',
  'UKOIL_OTC',
  'SYNTH_VOL_10',
  'SYNTH_VOL_25',
  'SYNTH_VOL_75',
  'SYNTH_VOL_100',
  'SYNTH_CRASH_BOOM_100'
);

-- Keep compatibility columns: they may hold state written after 0010.
ALTER TABLE indices DROP COLUMN seeded_by_0010;

COMMIT;
