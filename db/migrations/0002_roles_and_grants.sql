-- Migration 0002: Least-Privilege Application Roles & Grants (DB-05)

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'synth_owner') THEN
        CREATE ROLE synth_owner NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_tick') THEN
        CREATE ROLE app_tick WITH LOGIN PASSWORD 'app_tick_dev_pass';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        CREATE ROLE app_contract WITH LOGIN PASSWORD 'app_contract_dev_pass';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_settle') THEN
        CREATE ROLE app_settle WITH LOGIN PASSWORD 'app_settle_dev_pass';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
        CREATE ROLE app_reader WITH LOGIN PASSWORD 'app_reader_dev_pass';
    END IF;
END $$;

-- 1. Permissões de app_tick (Exclusivo para geração e outbox de ticks)
GRANT SELECT, UPDATE ON index_state TO app_tick;
GRANT INSERT, SELECT ON ticks TO app_tick;
GRANT INSERT ON outbox_events TO app_tick;
GRANT SELECT ON indices TO app_tick;

-- 2. Permissões de app_contract (Exclusivo para abertura de ordens e consulta)
GRANT SELECT ON indices TO app_contract;
GRANT SELECT ON index_state TO app_contract;
GRANT SELECT ON ticks TO app_contract;
GRANT SELECT, INSERT, UPDATE (status, result, exit_price, exit_tick_sequence, settled_at) ON contracts TO app_contract;
GRANT INSERT ON outbox_events TO app_contract;
GRANT INSERT ON audit_logs TO app_contract;

-- 3. Permissões de app_settle (Exclusivo para liquidação de contratos)
GRANT SELECT ON ticks TO app_settle;
GRANT SELECT, UPDATE (status, result, exit_price, exit_tick_sequence, settled_at) ON contracts TO app_settle;
GRANT INSERT ON outbox_events TO app_settle;
GRANT INSERT ON audit_logs TO app_settle;

-- 4. Permissões de app_reader (Exclusivo para a Chart API)
GRANT SELECT ON indices TO app_reader;
GRANT SELECT ON candles TO app_reader;
GRANT SELECT ON ticks TO app_reader;
