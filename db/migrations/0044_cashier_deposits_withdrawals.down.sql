-- Migration 0044_cashier_deposits_withdrawals.down.sql
BEGIN;
DROP TABLE IF EXISTS wallet_transactions;
COMMIT;
