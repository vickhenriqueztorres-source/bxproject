import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLiveMarketStore } from '../services/tick-engine/live-market-store.mjs';
import { canonicalHash, genesisHash } from '../services/tick-engine/core.mjs';

function createMockMarketPgAndRedis({ initialAssets }) {
  const indicesMap = new Map();
  const stateMap = new Map();
  const ticksBySym = new Map();
  const candlesMap = new Map();
  const executedQueries = [];
  let failNextCommit = false;
  let forceFenceFailure = false;

  for (const a of initialAssets) {
    const dbSym = a.dbSym || a.symbol;
    indicesMap.set(dbSym, {
      symbol: dbSym,
      name: a.name || dbSym,
      status: 'ACTIVE',
      base_price: a.price,
      volatility: a.sigma || 0.001,
    });
    stateMap.set(dbSym, {
      symbol: dbSym,
      last_sequence: 0,
      last_price: Number(a.price).toFixed(6),
      last_hash: `genesis|${dbSym}`,
      last_ts: null,
      lease_leader: null,
      lease_epoch: 0,
    });
    ticksBySym.set(dbSym, []);
  }

  const redisLeases = new Map();
  let epochCounter = 0;

  const mockRedis = {
    status: 'wait',
    connect: async () => {
      mockRedis.status = 'ready';
    },
    ping: async () => 'PONG',
    set: async (key, owner) => {
      const cur = redisLeases.get(key);
      if (!cur || cur.owner === owner) {
        redisLeases.set(key, { owner });
        return 'OK';
      }
      return null;
    },
    incr: async () => {
      epochCounter += 1;
      return epochCounter;
    },
    eval: async (script, numKeys, key, owner, ttlOrArg) => {
      if (script.includes('PEXPIRE')) {
        if (forceFenceFailure) return 0;
        const cur = redisLeases.get(key);
        return cur && cur.owner === owner ? 1 : 0;
      }
      if (script.includes('DEL')) {
        redisLeases.delete(key);
        return 1;
      }
      return 1;
    },
    disconnect: () => {},
  };

  async function runQuery(sql, params = [], txSnapshot = null) {
    const norm = sql.replace(/\s+/g, ' ').trim();
    executedQueries.push(norm);

    if (norm === 'BEGIN') return { rowCount: 0, rows: [] };
    if (norm === 'COMMIT') {
      if (failNextCommit) {
        failNextCommit = false;
        throw new Error('CHAOS_PG_COMMIT_IO_ERROR');
      }
      return { rowCount: 0, rows: [] };
    }
    if (norm === 'ROLLBACK') {
      if (txSnapshot) {
        for (const [k, v] of txSnapshot.stateMap.entries()) stateMap.set(k, { ...v });
        for (const [k, v] of txSnapshot.ticksBySym.entries()) ticksBySym.set(k, v.map((t) => ({ ...t })));
      }
      return { rowCount: 0, rows: [] };
    }

    if (norm.includes('FROM pg_indexes')) {
      return { rowCount: 2, rows: [{ indexname: 'uq_ticks_symbol_sequence' }, { indexname: 'uq_candles_sym_int_bucket' }] };
    }
    if (norm.startsWith('ALTER TABLE index_state')) {
      return { rowCount: 0, rows: [] };
    }
    if (norm.includes('SELECT symbol FROM indices WHERE symbol =')) {
      const sym = params[0];
      const candidates = [sym, `SYNTH_${sym}`];
      const found = candidates.find((c) => indicesMap.has(c));
      return found ? { rowCount: 1, rows: [{ symbol: found }] } : { rowCount: 0, rows: [] };
    }
    if (norm.startsWith('INSERT INTO indices')) {
      return { rowCount: 1, rows: [] };
    }
    if (norm.startsWith('INSERT INTO index_state')) {
      return { rowCount: 1, rows: [] };
    }
    if (norm.startsWith('UPDATE index_state SET lease_epoch=')) {
      const [dbSym, redisEpoch, owner] = params;
      const st = stateMap.get(dbSym);
      if (!st) return { rowCount: 0, rows: [] };
      st.lease_epoch = Math.max(Number(st.lease_epoch) + 1, Number(redisEpoch));
      st.lease_leader = owner;
      return { rowCount: 1, rows: [{ lease_epoch: st.lease_epoch }] };
    }

    // SELECT s.last_sequence, s.last_price, s.last_hash, s.last_ts, i.status FROM index_state s JOIN indices i ... WHERE s.symbol=$1
    if (norm.includes('FROM index_state s') && norm.includes('WHERE s.symbol=$1')) {
      const dbSym = params[0];
      const st = stateMap.get(dbSym);
      const idx = indicesMap.get(dbSym);
      if (!st || !idx) return { rowCount: 0, rows: [] };
      return {
        rowCount: 1,
        rows: [{ ...st, status: idx.status }],
      };
    }

    // SELECT s.symbol, s.last_sequence ... WHERE s.symbol = ANY($1::varchar[])
    if (norm.includes('FROM index_state s') && norm.includes('ANY($1::varchar[])')) {
      const syms = params[0] || [];
      const rows = syms
        .map((sym) => {
          const st = stateMap.get(sym);
          const idx = indicesMap.get(sym);
          return st && idx ? { ...st, status: idx.status } : null;
        })
        .filter(Boolean);
      return { rowCount: rows.length, rows };
    }

    // Head tick lookup per symbol (LATERAL or single symbol)
    if (norm.includes('CROSS JOIN LATERAL') && norm.includes('FROM ticks')) {
      const syms = params[0] || [];
      const rows = [];
      for (const sym of syms) {
        const list = ticksBySym.get(sym) || [];
        if (list.length > 0) {
          rows.push({ ...list[list.length - 1] });
        }
      }
      return { rowCount: rows.length, rows };
    }

    if (norm.startsWith('SELECT sequence,price,hash,ts FROM ticks WHERE symbol=$1 ORDER BY sequence DESC LIMIT 1')) {
      const dbSym = params[0];
      const list = ticksBySym.get(dbSym) || [];
      if (list.length === 0) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [{ ...list[list.length - 1] }] };
    }

    if (norm.startsWith('INSERT INTO ticks')) {
      const [dbSym, sequence, price, ts, prevHash, hash] = params;
      const list = ticksBySym.get(dbSym) || [];
      list.push({
        symbol: dbSym,
        sequence: Number(sequence),
        price: String(price),
        ts: new Date(ts),
        prev_hash: prevHash,
        hash,
      });
      ticksBySym.set(dbSym, list);
      return { rowCount: 1, rows: [] };
    }

    if (norm.startsWith('UPDATE index_state') && norm.includes('SET last_sequence=$2')) {
      const [dbSym, sequence, price, hash, ts, epoch, owner] = params;
      const st = stateMap.get(dbSym);
      if (!st || Number(st.lease_epoch) !== Number(epoch) || st.lease_leader !== owner) {
        return { rowCount: 0, rows: [] };
      }
      st.last_sequence = Number(sequence);
      st.last_price = String(price);
      st.last_hash = hash;
      st.last_ts = new Date(ts);
      return { rowCount: 1, rows: [] };
    }

    if (norm.startsWith('INSERT INTO candles')) {
      return { rowCount: 1, rows: [] };
    }

    if (norm.includes('FROM outbox_events')) {
      return { rowCount: 1, rows: [{ cnt: 0, oldest_pending_sec: 0 }] };
    }

    throw new Error(`Unhandled query in mock market store: ${norm}`);
  }

  const mockPgPool = {
    query: (sql, params) => runQuery(sql, params, null),
    connect: async () => {
      const snapshot = {
        stateMap: new Map(Array.from(stateMap.entries()).map(([k, v]) => [k, { ...v }])),
        ticksBySym: new Map(
          Array.from(ticksBySym.entries()).map(([k, v]) => [k, v.map((t) => ({ ...t }))])
        ),
      };
      return {
        query: (sql, params) => runQuery(sql, params, snapshot),
        release: () => {},
        on: () => {},
        removeListener: () => {},
      };
    },
  };

  return {
    mockPgPool,
    mockRedis,
    stateMap,
    ticksBySym,
    executedQueries,
    setFailNextCommit: (val) => {
      failNextCommit = val;
    },
    setForceFenceFailure: (val) => {
      forceFenceFailure = val;
    },
  };
}

test('Subetapa 2.1 (Estrutural/Performance): live-market-store.mjs usa CROSS JOIN LATERAL indexado em vez de SELECT DISTINCT ON', () => {
  const src = fs.readFileSync(
    new URL('../services/tick-engine/live-market-store.mjs', import.meta.url),
    'utf8'
  );
  assert.equal(
    src.includes('SELECT DISTINCT ON (symbol)'),
    false,
    'SELECT DISTINCT ON (symbol) deve ser banido de produceTicksBatch para evitar External Merge Sort de 2.38s'
  );
  assert.equal(
    src.includes('CROSS JOIN LATERAL'),
    true,
    'produceTicksBatch deve utilizar UNNEST + CROSS JOIN LATERAL com ORDER BY sequence DESC LIMIT 1'
  );
});

test('Subetapa 2.2 (Estresse Multi-Ativo & Hash-Chain): produceTicksBatch persiste lote de 36 ativos mantendo sequência monotônica e cadeia SHA-256', async () => {
  const assets = [];
  for (let i = 1; i <= 36; i++) {
    const sym = i <= 6 ? `VOL_${i * 10}` : `ASSET_${i}_OTC`;
    const dbSym = i <= 6 ? `SYNTH_${sym}` : sym;
    assets.push({ symbol: sym, dbSym, price: 100 + i * 10, sigma: 0.001, precision: 4 });
  }

  const env = createMockMarketPgAndRedis({ initialAssets: assets });
  const store = createLiveMarketStore({
    pgPool: env.mockPgPool,
    redisClient: env.mockRedis,
    instanceId: 'test-leader-1',
    enableTickOutbox: false,
  });

  await store.initialize(assets);

  const batchItems = assets.map((a) => ({
    symbol: a.symbol,
    computeNextPrice: (prev) => (Number(prev) + 0.1234).toFixed(6),
  }));

  const res1 = await store.produceTicksBatch(batchItems);
  assert.equal(res1.committedTicks.length, 36);

  // Valida que todos os 36 ativos avançaram para sequence = 1 com hash-chain íntegra
  for (const a of assets) {
    const ticks = env.ticksBySym.get(a.dbSym);
    assert.equal(ticks.length, 1);
    const t = ticks[0];
    assert.equal(t.sequence, 1);
    assert.equal(t.prev_hash, genesisHash(a.dbSym));
    const expectedHash = canonicalHash(
      t.prev_hash,
      a.dbSym,
      1,
      t.ts.toISOString(),
      t.price
    );
    assert.equal(t.hash, expectedHash);
  }

  await store.close();
});

test('Subetapa 2.3 (Segurança / Fencing Token & Caos I/O): aborta e faz ROLLBACK atômico em perda de lease ou falha de commit', async () => {
  const assets = [
    { symbol: 'VOL_50', dbSym: 'SYNTH_VOL_50', price: 500, sigma: 0.001, precision: 4 },
    { symbol: 'EURUSD_OTC', dbSym: 'EURUSD_OTC', price: 1.08, sigma: 0.0005, precision: 5 },
  ];

  const env = createMockMarketPgAndRedis({ initialAssets: assets });
  const store = createLiveMarketStore({
    pgPool: env.mockPgPool,
    redisClient: env.mockRedis,
    instanceId: 'test-leader-chaos',
    enableTickOutbox: false,
  });

  await store.initialize(assets);

  // 1. Caos: falha de commit I/O no PostgreSQL -> ROLLBACK atômico, zero ticks gravados
  env.setFailNextCommit(true);
  await assert.rejects(
    () =>
      store.produceTicksBatch(
        assets.map((a) => ({
          symbol: a.symbol,
          computeNextPrice: (prev) => (Number(prev) + 0.01).toFixed(6),
        }))
      ),
    /CHAOS_PG_COMMIT_IO_ERROR/
  );
  assert.equal(env.ticksBySym.get('SYNTH_VOL_50').length, 0);
  assert.equal(env.stateMap.get('SYNTH_VOL_50').last_sequence, 0);

  // 2. Segurança: perda de lease (LEASE_LOST) durante o lote -> ROLLBACK atômico
  env.setForceFenceFailure(true);
  await assert.rejects(
    () =>
      store.produceTicksBatch(
        assets.map((a) => ({
          symbol: a.symbol,
          computeNextPrice: (prev) => (Number(prev) + 0.01).toFixed(6),
        }))
      ),
    /LEASE_LOST/
  );
  assert.equal(env.ticksBySym.get('SYNTH_VOL_50').length, 0);

  // 3. Recuperação pós-caos: quando lease e banco normalizam, produz sequence = 1 sem gap
  env.setForceFenceFailure(false);
  const recovered = await store.produceTicksBatch(
    assets.map((a) => ({
      symbol: a.symbol,
      computeNextPrice: (prev) => (Number(prev) + 0.05).toFixed(6),
    }))
  );
  assert.equal(recovered.committedTicks.length, 2);
  assert.equal(env.ticksBySym.get('SYNTH_VOL_50')[0].sequence, 1);

  const metrics = await store.getPersistenceMetrics();
  assert.ok(metrics.tick_dropped_total >= 4);

  await store.close();
});
