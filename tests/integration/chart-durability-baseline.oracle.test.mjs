// AC-GRAF-00-2: Dado um símbolo e 20 escritores com a mesma cabeça,
// quando competem no repository real, então exatamente 1 tick/outbox é confirmado.
// AC-GRAF-00-3: Dada falha real de INSERT na outbox, quando persiste um tick,
// então a falha é comprovada e state/tick/outbox permanecem idênticos ao antes.
// AC-GRAF-00-4: Dadas duas cabeças concorrentes, cada hash confirmado corresponde
// à sequence persistida e à cabeça anterior, sem duplicatas nem lacunas.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { TickRepository } from '../../services/tick-engine/src/persistence/tick-repository.ts';
import { assertNotProduction, createEphemeralPostgres } from '../helpers/chart-durability-postgres.mjs';

assertNotProduction();
let environment;
const baseSql = await readFile(new URL('../../db/migrations/0001_initial_schema.sql', import.meta.url), 'utf8');
const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');
const symbol = 'QA_DURABILITY';
const genesis = hash(`genesis|${symbol}`);
const tickTime = new Date('2026-10-14T12:00:00.000Z');
const price = '100.010000';
const nextHash = hash(`${genesis}|${symbol}|1|${tickTime.toISOString()}|${price}`);

// AC-GRAF-00-5: Dado um tick válido, quando outro cliente consulta a mesma base,
// então recupera exatamente preço, sequence e hash confirmados.
// AC-GRAF-00-6: Dado um tick válido, quando hash/prev_hash/sequence é adulterado,
// então a fronteira rejeita a tentativa e nenhum estado/outbox muda.
// AC-GRAF-00-7: Dadas falhas reais em state/ticks/outbox, a transação reverte tudo.

before(async () => { environment = await createEphemeralPostgres(); }, { timeout: 120_000 });
after(async () => { if (environment) await environment.dispose(); }, { timeout: 65_000 });

async function schemaFixture(body) {
  const schema = `qa_${randomUUID().replaceAll('-', '')}`;
  await environment.pool.query(`CREATE SCHEMA ${schema}`);
  const pool = environment.createPool({ options: `-c search_path=${schema},public`, max: 20 });
  try {
    await pool.query(baseSql);
    await body(pool, () => environment.createPool({ options: `-c search_path=${schema},public`, max: 2 }));
  } finally {
    await pool.end();
    await environment.pool.query(`DROP SCHEMA ${schema} CASCADE`);
  }
}

async function seed(pool, asset = symbol) {
  await pool.query(`INSERT INTO indices
    (symbol,name,base_price,volatility,mean_reversion_speed) VALUES ($1,'QA',100,0.0015,0.05)`, [asset]);
  await pool.query('INSERT INTO index_state(symbol,last_price,last_hash) VALUES ($1,100,$2)', [asset, hash(`genesis|${asset}`)]);
  return new TickRepository(pool);
}

async function snapshot(pool, asset = symbol) {
  return (await pool.query(`SELECT
    (SELECT row_to_json(s) FROM index_state s WHERE symbol=$1) AS state,
    (SELECT count(*)::int FROM ticks WHERE symbol=$1) AS ticks,
    (SELECT count(*)::int FROM outbox_events WHERE payload->>'symbol'=$1) AS events`, [asset])).rows[0];
}

test('[M-03][AC-GRAF-00-5] a committed tick and outbox survive a new PostgreSQL client', async () => {
  await schemaFixture(async (pool, newPool) => {
    const repo = await seed(pool);
    assert.deepEqual(await repo.persistTickAndOutbox(symbol, price, tickTime, genesis, nextHash), { sequence: 1n });
    const independent = newPool();
    try {
      const recovered = await new TickRepository(independent).fetchIndexState(symbol);
      assert.equal(recovered.lastPrice, price);
      assert.equal(recovered.lastSequence, 1n);
      assert.equal(recovered.lastHash, nextHash);
      const state = await snapshot(independent);
      assert.equal(state.ticks, 1); assert.equal(state.events, 1);
      const event = (await independent.query('SELECT payload FROM outbox_events')).rows[0].payload;
      assert.deepEqual(event, { symbol, sequence: '1', price, ts: tickTime.toISOString(), prev_hash: genesis, hash: nextHash });
    } finally { await independent.end(); }
  });
});

test('[M-02][AC-GRAF-00-2] replaying the same head twice commits exactly one effect', async () => {
  await schemaFixture(async pool => {
    const repo = await seed(pool);
    await repo.persistTickAndOutbox(symbol, price, tickTime, genesis, nextHash);
    const beforeReplay = await snapshot(pool);
    await assert.rejects(repo.persistTickAndOutbox(symbol, price, tickTime, genesis, nextHash));
    assert.deepEqual(await snapshot(pool), beforeReplay);
  });
});

for (const [operation, table] of [['UPDATE', 'index_state'], ['INSERT', 'ticks'], ['INSERT', 'outbox_events']]) {
  test(`[M-03][AC-GRAF-00-7] a real ${table} trigger failure rolls back tick, state and outbox`, async () => {
    await schemaFixture(async pool => {
      const repo = await seed(pool);
      const beforeFailure = await snapshot(pool);
      await pool.query(`CREATE SEQUENCE qa_failure_probe;
        CREATE FUNCTION qa_forced_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN PERFORM nextval('qa_failure_probe');
          RAISE EXCEPTION 'QA_FORCED_${table}' USING ERRCODE='P0001'; END $$;
        CREATE TRIGGER qa_fail BEFORE ${operation} ON ${table}
        FOR EACH ROW EXECUTE FUNCTION qa_forced_failure()`);
      await assert.rejects(repo.persistTickAndOutbox(symbol, price, tickTime, genesis, nextHash), {
        code: 'P0001', message: `QA_FORCED_${table}`,
      });
      const probe = (await pool.query('SELECT is_called FROM qa_failure_probe')).rows[0];
      assert.equal(probe.is_called, true, 'sequence proves the failure trigger actually ran despite rollback');
      assert.deepEqual(await snapshot(pool), beforeFailure);
    });
  });
}

for (const corruption of ['prev_hash', 'hash', 'sequence']) {
  test(`[M-04][AC-GRAF-00-6] a ${corruption} mismatch is rejected without a partial write`, async () => {
    await schemaFixture(async pool => {
      const repo = await seed(pool);
      await repo.persistTickAndOutbox(symbol, price, tickTime, genesis, nextHash);
      const beforeCorruption = await snapshot(pool);
      const secondTime = new Date('2026-10-14T12:00:01.000Z');
      const prev = corruption === 'prev_hash' ? genesis : nextHash;
      const seq = corruption === 'sequence' ? 99 : 2;
      const candidateHash = corruption === 'hash' ? '0'.repeat(64)
        : hash(`${prev}|${symbol}|${seq}|${secondTime.toISOString()}|${price}`);
      await assert.rejects(repo.persistTickAndOutbox(symbol, price, secondTime, prev, candidateHash), {
        message: corruption === 'prev_hash' ? /^TICK_(PREV_HASH_MISMATCH|HEAD_CONFLICT)$/ : 'TICK_HASH_MISMATCH',
      });
      assert.deepEqual(await snapshot(pool), beforeCorruption);
    });
  });
}

test('[M-04][AC-GRAF-00-4] hashes of confirmed concurrent ticks match their actual sequences', async () => {
  await schemaFixture(async pool => {
    const repo = await seed(pool);
    await repo.persistTickAndOutbox(symbol, price, tickTime, genesis, nextHash);
    const secondTime = new Date('2026-10-14T12:00:01.000Z');
    const secondHash = hash(`${nextHash}|${symbol}|2|${secondTime.toISOString()}|${price}`);
    await Promise.allSettled(Array.from({ length: 20 }, () =>
      repo.persistTickAndOutbox(symbol, price, secondTime, nextHash, secondHash)));
    const rows = (await pool.query('SELECT * FROM ticks WHERE symbol=$1 ORDER BY sequence', [symbol])).rows;
    assert.equal(rows.length, 2, 'one second head must commit; absence of rows cannot prove integrity');
    let previousHash = genesis;
    for (const [index, row] of rows.entries()) {
      assert.equal(row.sequence, String(index + 1));
      assert.equal(row.prev_hash, previousHash);
      assert.equal(row.hash, hash(`${previousHash}|${symbol}|${row.sequence}|${row.ts.toISOString()}|${row.price}`));
      previousHash = row.hash;
    }
    assert.equal((await snapshot(pool)).events, rows.length);
  });
});

test('[M-02][AC-GRAF-00-2] 20 writers sharing one head produce exactly one confirmed effect', async t => {
  await schemaFixture(async pool => {
    const repo = await seed(pool);
    const results = await Promise.allSettled(Array.from({ length: 20 }, () =>
      repo.persistTickAndOutbox(symbol, price, tickTime, genesis, nextHash)));
    const accepted = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected').map(r => ({
      code: r.reason.code, message: r.reason.message,
    }));
    t.diagnostic(JSON.stringify({ accepted: accepted.length, rejected: failures.length, failures }));
    assert.equal(accepted.length, 1, 'stale or simultaneous heads must be rejected by the persistence boundary');
    const state = await snapshot(pool);
    assert.equal(state.ticks, 1); assert.equal(state.events, 1);
    assert.equal(state.state.last_sequence, 1);
  });
});

// AC-GRAF-00-8: Dado preço fora da string decimal canônica, quando persistido,
// então TICK_PRICE_NOT_CANONICAL e nenhuma mudança de state/tick/outbox.
for (const invalidPrice of ['100.01', '100.0000001', 'NaN', 'Infinity', '-100.000000', '0.000000']) {
  test(`[M-04][AC-GRAF-00-8] noncanonical price ${invalidPrice} is rejected before persistence`, async () => {
    await schemaFixture(async pool => {
      const repo = await seed(pool);
      const beforeInvalid = await snapshot(pool);
      const matchingHash = hash(`${genesis}|${symbol}|1|${tickTime.toISOString()}|${invalidPrice}`);
      await assert.rejects(repo.persistTickAndOutbox(symbol, invalidPrice, tickTime, genesis, matchingHash), {
        message: 'TICK_PRICE_NOT_CANONICAL',
      });
      assert.deepEqual(await snapshot(pool), beforeInvalid);
    });
  });
}

// AC-GRAF-00-9: Dadas duas cabeças de símbolos distintos e 20 concorrentes por
// símbolo, então existe 1 efeito por símbolo e nenhuma contaminação entre eles.
test('[M-02][M-04][AC-GRAF-00-9] competing symbols retain independent heads and outbox payloads', async () => {
  await schemaFixture(async pool => {
    const symbols = [symbol, 'QA_SECOND_DURABILITY'];
    const repo = await seed(pool);
    await seed(pool, symbols[1]);
    const results = await Promise.all(symbols.map(async asset => {
      const prev = hash(`genesis|${asset}`);
      const candidate = hash(`${prev}|${asset}|1|${tickTime.toISOString()}|${price}`);
      const attempts = await Promise.allSettled(Array.from({ length: 20 }, () =>
        repo.persistTickAndOutbox(asset, price, tickTime, prev, candidate)));
      return { asset, prev, candidate, accepted: attempts.filter(r => r.status === 'fulfilled').length };
    }));
    for (const result of results) {
      assert.equal(result.accepted, 1, `exactly one head must commit for ${result.asset}`);
      const state = await snapshot(pool, result.asset);
      assert.equal(state.ticks, 1); assert.equal(state.events, 1);
      assert.equal(state.state.last_hash, result.candidate);
      const event = (await pool.query(`SELECT payload FROM outbox_events WHERE payload->>'symbol'=$1`, [result.asset])).rows[0].payload;
      assert.equal(event.symbol, result.asset);
      assert.equal(event.prev_hash, result.prev);
      assert.equal(event.hash, result.candidate);
    }
  });
});

// AC-GRAF-00-10: Dada conexão interrompida dentro da transação, a injeção é
// provada pelo PID/sequence e todos os efeitos somem; um cliente novo retoma.
test('[M-03][R-03][AC-GRAF-00-10] terminating the transaction backend rolls back and permits recovery', async t => {
  await schemaFixture(async (pool, newPool) => {
    const repo = await seed(pool);
    const beforeDisconnect = await snapshot(pool);
    const observePoolError = error => t.diagnostic(`pool connection error: ${error.code ?? error.message}`);
    pool.on('error', observePoolError);
    await pool.query(`CREATE SEQUENCE qa_terminated_pid;
      CREATE FUNCTION qa_terminate_connection() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM setval('qa_terminated_pid',pg_backend_pid());
        PERFORM pg_terminate_backend(pg_backend_pid()); RETURN NEW; END $$;
      CREATE TRIGGER qa_terminate BEFORE INSERT ON outbox_events
      FOR EACH ROW EXECUTE FUNCTION qa_terminate_connection()`);
    await assert.rejects(repo.persistTickAndOutbox(symbol, price, tickTime, genesis, nextHash),
      error => ['57P01', 'ECONNRESET'].includes(error.code) || /connection (terminated|error)/i.test(error.message));
    const independent = newPool();
    try {
      const probe = (await independent.query('SELECT last_value,is_called FROM qa_terminated_pid')).rows[0];
      assert.equal(probe.is_called, true);
      assert(Number(probe.last_value) > 0);
      const active = await independent.query('SELECT pid FROM pg_stat_activity WHERE pid=$1', [probe.last_value]);
      assert.equal(active.rowCount, 0, 'the PostgreSQL backend must actually be gone');
      t.diagnostic(`terminated PostgreSQL PID ${probe.last_value}; rollback checked through independent client`);
      assert.deepEqual(await snapshot(independent), beforeDisconnect);
      await independent.query('DROP TRIGGER qa_terminate ON outbox_events');
      const recovered = new TickRepository(independent);
      assert.deepEqual(await recovered.persistTickAndOutbox(symbol, price, tickTime, genesis, nextHash), { sequence: 1n });
      const final = await snapshot(independent);
      assert.equal(final.ticks, 1); assert.equal(final.events, 1);
    } finally { await independent.end(); pool.removeListener('error', observePoolError); }
  });
});

// AC-GRAF-00-11: Dado símbolo desconhecido ou payload SQL como valor,
// então INDEX_STATE_MISSING, sem alteração nos símbolos e tabelas existentes.
for (const unknown of ['QA_UNKNOWN', "QA'; DROP TABLE ticks;--"]) {
  test(`[S-05][AC-GRAF-00-11] unknown symbol ${unknown} cannot mutate another symbol`, async () => {
    await schemaFixture(async pool => {
      const repo = await seed(pool);
      const beforeUnknown = await snapshot(pool);
      const prev = hash(`genesis|${unknown}`);
      const candidate = hash(`${prev}|${unknown}|1|${tickTime.toISOString()}|${price}`);
      await assert.rejects(repo.persistTickAndOutbox(unknown, price, tickTime, prev, candidate), { message: 'INDEX_STATE_MISSING' });
      assert.deepEqual(await snapshot(pool), beforeUnknown);
      assert.equal((await pool.query("SELECT to_regclass('ticks')::text AS name")).rows[0].name, 'ticks');
    });
  });
}

// AC-GRAF-00-12: Dado hash de outro preço, timestamp ou símbolo, então a
// fronteira recusa TICK_HASH_MISMATCH sem alterar o estado confirmado.
for (const changed of ['price', 'timestamp', 'symbol']) {
  test(`[M-04][AC-GRAF-00-12] a hash bound to another ${changed} cannot be persisted`, async () => {
    await schemaFixture(async pool => {
      const repo = await seed(pool);
      const beforeHash = await snapshot(pool);
      const otherPrice = changed === 'price' ? '100.020000' : price;
      const otherTime = changed === 'timestamp' ? '2026-10-14T12:00:01.000Z' : tickTime.toISOString();
      const otherSymbol = changed === 'symbol' ? 'QA_OTHER_DURABILITY' : symbol;
      const candidate = hash(`${genesis}|${otherSymbol}|1|${otherTime}|${otherPrice}`);
      await assert.rejects(repo.persistTickAndOutbox(symbol, price, tickTime, genesis, candidate), { message: 'TICK_HASH_MISMATCH' });
      assert.deepEqual(await snapshot(pool), beforeHash);
    });
  });
}

// AC-GRAF-00-13: Dado timestamp inválido, então TICK_TIMESTAMP_INVALID
// e zero alteração em state, ticks e outbox.
test('[M-04][AC-GRAF-00-13] an invalid timestamp is rejected explicitly before writing', async () => {
  await schemaFixture(async pool => {
    const repo = await seed(pool);
    const beforeTime = await snapshot(pool);
    await assert.rejects(repo.persistTickAndOutbox(symbol, price, new Date('invalid'), genesis, nextHash), {
      message: 'TICK_TIMESTAMP_INVALID',
    });
    assert.deepEqual(await snapshot(pool), beforeTime);
  });
});
