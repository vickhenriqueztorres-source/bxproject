-- Migration 0062_arena_trade_orders.down.sql

BEGIN;

DROP TABLE IF EXISTS arena_wallet_transactions;
DROP TABLE IF EXISTS arena_real_balances;
DROP TABLE IF EXISTS arena_trade_orders;

COMMIT;
