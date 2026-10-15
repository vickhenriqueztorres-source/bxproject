// AC-GRAF-00-1: Dado PostgreSQL 16 vazio, quando 0001 e 0010 rodam em ordem,
// então ambas terminam sem erro e o schema oferece params e last_ts.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertNotProduction, createEphemeralPostgres } from '../helpers/chart-durability-postgres.mjs';

assertNotProduction();
let environment;
after(async () => { if (environment) await environment.dispose(); }, { timeout: 65_000 });

test('[DB-11][AC-GRAF-00-1] ordered 0001+0010 migrations work on a new database', { timeout: 120_000 }, async () => {
  environment = await createEphemeralPostgres();
  const client = await environment.pool.connect();
  try {
    for (const migration of ['0001_initial_schema.sql', '0010_seed_multi_assets.up.sql']) {
      await client.query(await readFile(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    const result = await client.query(`SELECT params,s.last_ts FROM indices i
      JOIN index_state s USING(symbol) WHERE i.symbol='EURUSD_OTC'`);
    assert.equal(result.rowCount, 1);
    assert.equal(result.rows[0].params.precision, 5);
    assert(result.rows[0].last_ts instanceof Date);
  } finally { await client.query('ROLLBACK'); client.release(); }
});
