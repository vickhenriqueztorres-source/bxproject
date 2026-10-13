-- Migration 0050_rename_synthetic_indices.down.sql
-- Reversao segura da renomeacao

BEGIN;

-- Remover os novos indices se nao houverem contratos atrelados
DELETE FROM index_state WHERE symbol IN ('VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'CRASH_BOOM_100');
DELETE FROM indices WHERE symbol IN ('VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'CRASH_BOOM_100');

-- Limpar referencia de alias nos legados
UPDATE indices SET params = params - 'alias_canonical' WHERE symbol LIKE 'SYNTH_%';

COMMIT;
