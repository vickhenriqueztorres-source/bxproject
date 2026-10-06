-- Migration Rollback: 0002_roles_and_grants.down.sql

DROP ROLE IF EXISTS app_reader;
DROP ROLE IF EXISTS app_settle;
DROP ROLE IF EXISTS app_contract;
DROP ROLE IF EXISTS app_tick;
DROP ROLE IF EXISTS synth_owner;
