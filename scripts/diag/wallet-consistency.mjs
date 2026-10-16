/**
 * P0-1 Passo 4 — Script Read-Only de Auditoria de Consistência de Carteira (scripts/diag/wallet-consistency.mjs)
 *
 * Para cada usuário com contratos desde o deploy de bc0be5a (ou na janela analisada), compara:
 *   saldo esperado = saldo inicial (1_000_000 minor + depósitos confirmados - saques) - Σ stakes + Σ payouts
 * com o saldo atual (users.demo_balance_minor).
 *
 * GARANTIA ESTRITA READ-ONLY:
 * - Executa exclusivamente queries SELECT.
 * - NUNCA corrige saldos automaticamente; apenas gera o relatório de divergências.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const DEFAULT_INITIAL_DEMO_BALANCE_MINOR = 1_000_000;
export const DEFAULT_BC0BE5A_CUTOFF_ISO = '2026-10-14T00:00:00.000Z';

/**
 * Calcula de forma pura e read-only o relatório de divergências de carteira.
 *
 * @param {Array<{
 *   user_id: string,
 *   email?: string,
 *   initial_balance_minor?: number,
 *   current_balance_minor: number,
 *   total_stakes_minor: number,
 *   total_payouts_minor: number,
 *   net_deposits_minor?: number,
 *   contracts_count: number
 * }>} rows
 */
export function computeWalletConsistencyReport(rows) {
  const checkedUsers = [];
  const divergences = [];

  for (const row of rows) {
    const initialMinor = Number(
      row.initial_balance_minor !== undefined
        ? row.initial_balance_minor
        : DEFAULT_INITIAL_DEMO_BALANCE_MINOR
    );
    const netDepositsMinor = Number(row.net_deposits_minor || 0);
    const totalStakesMinor = Number(row.total_stakes_minor || 0);
    const totalPayoutsMinor = Number(row.total_payouts_minor || 0);
    const currentBalanceMinor = Number(row.current_balance_minor || 0);

    const expectedBalanceMinor =
      initialMinor + netDepositsMinor - totalStakesMinor + totalPayoutsMinor;
    const diffMinor = currentBalanceMinor - expectedBalanceMinor;

    const entry = {
      user_id: row.user_id,
      email: row.email || null,
      contracts_count: Number(row.contracts_count || 0),
      initial_balance_minor: initialMinor,
      net_deposits_minor: netDepositsMinor,
      total_stakes_minor: totalStakesMinor,
      total_payouts_minor: totalPayoutsMinor,
      expected_balance_minor: expectedBalanceMinor,
      current_balance_minor: currentBalanceMinor,
      diff_minor: diffMinor,
      consistent: diffMinor === 0,
    };

    checkedUsers.push(entry);
    if (diffMinor !== 0) {
      divergences.push(entry);
    }
  }

  return {
    generated_at: new Date().toISOString(),
    read_only: true,
    total_users_with_contracts: checkedUsers.length,
    consistent_users_count: checkedUsers.length - divergences.length,
    divergent_users_count: divergences.length,
    divergences,
    users: checkedUsers,
  };
}

/**
 * Executa a consulta read-only no PostgreSQL para todos os usuários com contratos desde sinceIso.
 */
export async function runWalletConsistencyAudit(pgPool, { sinceIso = DEFAULT_BC0BE5A_CUTOFF_ISO } = {}) {
  const sql = `
    WITH contract_totals AS (
      SELECT
        c.user_id,
        COUNT(*)::int AS contracts_count,
        COALESCE(SUM(c.stake_minor), 0)::bigint AS total_stakes_minor,
        COALESCE(SUM(CASE WHEN c.status = 'SETTLED' THEN COALESCE(c.payout_minor, 0) ELSE 0 END), 0)::bigint AS total_payouts_minor
      FROM contracts c
      WHERE c.created_at >= $1
      GROUP BY c.user_id
    )
    SELECT
      u.id AS user_id,
      u.email,
      u.demo_balance_minor AS current_balance_minor,
      ct.contracts_count,
      ct.total_stakes_minor,
      ct.total_payouts_minor
    FROM contract_totals ct
    JOIN users u ON u.id = ct.user_id
    ORDER BY ct.contracts_count DESC, u.id ASC
  `;

  const res = await pgPool.query(sql, [sinceIso]);
  return computeWalletConsistencyReport(res.rows);
}

async function main() {
  const sinceIso = process.env.WALLET_AUDIT_SINCE || DEFAULT_BC0BE5A_CUTOFF_ISO;
  const dbUrl =
    process.env.DATABASE_URL ||
    'postgresql://synth_migrator:dev_secret_pw_123@127.0.0.1:5432/broker_platform';

  let Pool;
  try {
    const pgMod = require('../../node_modules/.pnpm/pg@8.23.1/node_modules/pg');
    Pool = (pgMod.default || pgMod).Pool;
  } catch {
    const pgMod = require('pg');
    Pool = (pgMod.default || pgMod).Pool;
  }

  const pool = new Pool({
    connectionString: dbUrl,
    max: 2,
    connectionTimeoutMillis: 3000,
  });

  try {
    await pool.query('BEGIN TRANSACTION READ ONLY');
    const report = await runWalletConsistencyAudit(pool, { sinceIso });
    await pool.query('ROLLBACK');
    console.log(JSON.stringify({ status: 'ok', since: sinceIso, ...report }, null, 2));
  } catch (err) {
    const fallbackReport = computeWalletConsistencyReport([]);
    console.log(
      JSON.stringify(
        {
          status: 'db_unreachable_or_offline',
          since: sinceIso,
          note: `Conexão PostgreSQL indisponível neste host (${err.message}); execute com DATABASE_URL apontando para o banco de produção/staging.`,
          ...fallbackReport,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
