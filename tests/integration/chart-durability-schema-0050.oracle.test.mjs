// AC-GRAF-SCHEMA-0050-1: Dado PostgreSQL 16 vazio, quando 0001, 0010 e 0050
// são aplicadas nessa ordem, então os seis símbolos canônicos do feed ativo
// existem com preço inicial e precisão iguais aos seus seeds oficiais.
// AC-GRAF-SCHEMA-0050-2: Dados tick, cabeça e contrato de símbolos preexistentes,
// quando 0050 é aplicada, então nenhum deles é recriado, apagado ou reiniciado.
// AC-GRAF-SCHEMA-0050-3: Dado um símbolo canônico preexistente, quando 0050
// é aplicada, então seus parâmetros, status e preço de produção são preservados;
// seeds do feed são usados somente para símbolos ainda ausentes.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assertNotProduction, createEphemeralPostgres } from '../helpers/chart-durability-postgres.mjs';

assertNotProduction();
const migrations = await Promise.all([
  '0001_initial_schema.sql',
  '0010_seed_multi_assets.up.sql',
  '0050_rename_synthetic_indices.up.sql',
].map(name => readFile(new URL(`../../db/migrations/${name}`, import.meta.url), 'utf8')));
const feedSource = await readFile(new URL('../../scripts/dev-live-feed.mjs', import.meta.url), 'utf8');
const catalogSource = feedSource.match(/const ASSETS_CONFIG = \[([\s\S]*?)\n\];/)?.[1];
assert(catalogSource, 'The active feed catalog must be inspectable');
const canonicalSymbols = ['VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'CRASH_BOOM_100'];
const feedSeeds = new Map(canonicalSymbols.map(symbol => {
  const match = catalogSource.match(new RegExp(`\\{ symbol: '${symbol}', price: ([0-9.]+), precision: ([0-9]+), sigma: ([0-9.]+) \\}`));
  assert(match, `The active feed must define ${symbol} once`);
  return [symbol, { price: Number(match[1]).toFixed(Number(match[2])), precision: Number(match[2]) }];
}));
let environment;
before(async () => { environment = await createEphemeralPostgres(); }, { timeout: 120_000 });
after(async () => { if (environment) await environment.dispose(); }, { timeout: 65_000 });

async function isolatedSchema(body) {
  const schema = `qa_${randomUUID().replaceAll('-', '')}`;
  await environment.pool.query(`CREATE SCHEMA ${schema}`);
  const pool = environment.createPool({ options: `-c search_path=${schema},public`, max: 4 });
  try {
    await body(pool);
  } finally {
    try { await pool.query('ROLLBACK'); } finally {
      await pool.end();
      await environment.pool.query(`DROP SCHEMA ${schema} CASCADE`);
    }
  }
}

async function apply(pool, index) {
  await pool.query(migrations[index]);
}

async function readPreservedRows(pool, symbol) {
  const head = (await pool.query(`SELECT last_sequence, last_price, last_hash, last_ts, lease_epoch
    FROM index_state WHERE symbol=$1`, [symbol])).rows[0];
  const ticks = (await pool.query(`SELECT sequence,price,ts,prev_hash,hash
    FROM ticks WHERE symbol=$1 ORDER BY sequence`, [symbol])).rows;
  const contracts = (await pool.query(`SELECT id,user_id,symbol,direction,status,stake_minor,
    payout_minor,entry_price,exit_price,exit_tick_sequence,idempotency_key,opened_at,expires_at
    FROM contracts WHERE symbol=$1 ORDER BY id`, [symbol])).rows;
  return { head, ticks, contracts };
}

async function seedLivePosition(pool, symbol, price) {
  const timestamp = new Date('2026-10-14T12:00:00.000Z');
  const prior = (await pool.query('SELECT last_hash FROM index_state WHERE symbol=$1', [symbol])).rows[0].last_hash;
  const digest = createHash('sha256').update(`${prior}|${symbol}|1|${timestamp.toISOString()}|${price}`).digest('hex');
  await pool.query(`INSERT INTO ticks(symbol,sequence,price,ts,prev_hash,hash)
    VALUES($1,1,$2,$3,$4,$5)`, [symbol, price, timestamp, prior, digest]);
  await pool.query(`UPDATE index_state SET last_sequence=1,last_price=$2,last_hash=$3,last_ts=$4,
    lease_epoch=7 WHERE symbol=$1`, [symbol, price, digest, timestamp]);
  await pool.query(`INSERT INTO contracts(user_id,symbol,direction,status,stake_minor,payout_minor,
    entry_price,idempotency_key,opened_at,expires_at)
    VALUES($1,$2,'UP','OPEN',125,0,$3,$4,$5,$6)`,
  [randomUUID(), symbol, price, `qa-${symbol}`, timestamp, new Date('2026-10-14T12:01:00.000Z')]);
}

test('[DB-11][M-02][AC-GRAF-SCHEMA-0050-1] ordered migrations seed the six active-feed canonical symbols',
  { timeout: 120_000 }, async () => {
    await isolatedSchema(async pool => {
      await apply(pool, 0);
      await apply(pool, 1);
      await apply(pool, 2);
      const rows = (await pool.query(`SELECT i.symbol,i.name,i.base_price,i.params,s.last_sequence,s.last_price
        FROM indices i JOIN index_state s USING(symbol)
        WHERE i.symbol=ANY($1::text[]) ORDER BY i.symbol`, [canonicalSymbols])).rows;
      assert.equal(rows.length, canonicalSymbols.length, 'Every active-feed synthetic symbol must be seeded');
      for (const row of rows) {
        const expected = feedSeeds.get(row.symbol);
        assert(expected, `Unexpected canonical symbol ${row.symbol}`);
        assert(row.name?.length > 0, `${row.symbol} requires the legacy NOT NULL name`);
        assert.equal(row.last_sequence, '0', `${row.symbol} must start without official ticks`);
        assert.equal(Number(row.last_price).toFixed(expected.precision), expected.price,
          `${row.symbol} index_state seed differs from active feed`);
        assert.equal(Number(row.base_price).toFixed(expected.precision), expected.price,
          `${row.symbol} base price differs from active feed`);
        assert.equal(row.params.initial_price, expected.price, `${row.symbol} params seed differs from active feed`);
        assert.equal(row.params.precision, expected.precision, `${row.symbol} precision differs from active feed`);
      }
    });
  });

test('[DB-11][M-02][AC-GRAF-SCHEMA-0050-2][AC-GRAF-SCHEMA-0050-3] upgrade retains existing heads, ticks, contracts and configuration',
  { timeout: 120_000 }, async () => {
    await isolatedSchema(async pool => {
      await apply(pool, 0);
      await apply(pool, 1);
      const canonical = 'VOL_25';
      const existingPrice = '237.654300';
      const existingParams = { name: 'Existing V25', precision: 6, sigma: 0.00012,
        payout_pct: 80, initial_price: existingPrice };
      await pool.query(`INSERT INTO indices(symbol,name,status,base_price,volatility,
        mean_reversion_speed,params) VALUES($1,'Existing V25','PAUSED',$2,0.00012,0,$3)`,
      [canonical, existingPrice, existingParams]);
      await pool.query(`INSERT INTO index_state(symbol,last_sequence,last_price,last_hash,last_ts,lease_epoch)
        VALUES($1,0,$2,$3,$4,3)`,
      [canonical, existingPrice, 'genesis|VOL_25', new Date('2026-10-14T11:59:59.000Z')]);
      await seedLivePosition(pool, canonical, '238.000000');
      await seedLivePosition(pool, 'SYNTH_VOL_50', '1001.000000');
      const beforeCanonical = await readPreservedRows(pool, canonical);
      const beforeLegacy = await readPreservedRows(pool, 'SYNTH_VOL_50');
      const metadataBefore = (await pool.query(`SELECT name,status,base_price,volatility,
        mean_reversion_speed,params FROM indices WHERE symbol=$1`, [canonical])).rows[0];
      await apply(pool, 2);
      assert.deepEqual(await readPreservedRows(pool, canonical), beforeCanonical,
        'Canonical symbol history and open contract must survive upgrade byte-for-byte');
      assert.deepEqual(await readPreservedRows(pool, 'SYNTH_VOL_50'), beforeLegacy,
        'Legacy symbol history and open contract must survive upgrade byte-for-byte');
      assert.deepEqual((await pool.query(`SELECT name,status,base_price,volatility,
        mean_reversion_speed,params FROM indices WHERE symbol=$1`, [canonical])).rows[0], metadataBefore,
      'Canonical production configuration must not be reseeded');
      const newRows = (await pool.query(`SELECT i.symbol,i.params,s.last_sequence,s.last_price
        FROM indices i JOIN index_state s USING(symbol) WHERE i.symbol=ANY($1::text[])
        AND i.symbol<>$2`, [canonicalSymbols, canonical])).rows;
      assert.equal(newRows.length, canonicalSymbols.length - 1);
      for (const row of newRows) {
        assert.equal(row.last_sequence, '0');
        assert.equal(Number(row.last_price).toFixed(feedSeeds.get(row.symbol).precision), feedSeeds.get(row.symbol).price,
          `${row.symbol} new seed must agree with the active feed`);
        assert.equal(row.params.initial_price, feedSeeds.get(row.symbol).price);
      }
    });
  });
