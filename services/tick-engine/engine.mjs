import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import pg from 'pg';
import { Counter, Gauge, Registry } from 'prom-client';
import { createServer } from 'node:http';
import { canonicalHash, createPriceGenerator, nextSequence } from './core.mjs';

const defaultSymbol = process.env.TICK_SYMBOL ?? 'SYNTH_VOL_50';
const redis = new Redis(process.env.REDIS_URL ?? 'redis://redis:6379', {
  lazyConnect: true,
  commandTimeout: 2000,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL_TICK,
  connectionTimeoutMillis: 3000,
  statement_timeout: 3000,
  query_timeout: 3000,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 10,
});

const registry = new Registry();
export const metrics = {
  leader: new Gauge({ name: 'tick_engine_is_leader', help: 'Current leader state', labelNames: ['symbol'], registers: [registry] }),
  age: new Gauge({ name: 'tick_engine_last_tick_age_seconds', help: 'Age of last tick', labelNames: ['symbol'], registers: [registry] }),
  ticks: new Counter({ name: 'tick_engine_ticks_total', help: 'Persisted ticks', labelNames: ['symbol'], registers: [registry] }),
  errors: new Counter({ name: 'tick_engine_errors_total', help: 'Tick engine errors', labelNames: ['symbol'], registers: [registry] }),
};

redis.on('error', () => { metrics.errors.inc({ symbol: 'redis' }); });
pool.on('error', () => { metrics.errors.inc({ symbol: 'pool' }); });

const owner = randomUUID();
const renewLua = 'if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE",KEYS[1],ARGV[2]) else return 0 end';
const releaseLua = 'if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end';
const generate = createPriceGenerator();

export class SymbolState {
  constructor(symbol) {
    this.symbol = symbol;
    this.leaseKey = `lease:tick-engine:${symbol}`;
    this.epochKey = `lease:epoch:${symbol}`;
    this.epoch = null;
    this.ownedEpoch = null;
    this.lastTickAt = null;
  }
}

export const symbolStates = new Map();

export function getSymbolState(symbol) {
  let state = symbolStates.get(symbol);
  if (!state) {
    state = new SymbolState(symbol);
    symbolStates.set(symbol, state);
  }
  return state;
}

export async function releaseLeadership(targetSymbol = defaultSymbol) {
  const state = getSymbolState(targetSymbol);
  state.ownedEpoch = null;
  state.epoch = null;
  metrics.leader.set({ symbol: targetSymbol }, 0);
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.eval(releaseLua, 1, state.leaseKey, owner);
    }
  } catch {
    // Ignore error on shutdown
  }
}

export async function renewLeasesInBackground(runningRef = { running: true }) {
  while (runningRef.running) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const activeStates = [...symbolStates.values()].filter((st) => st.epoch !== null);
    if (activeStates.length === 0) continue;

    try {
      if (redis.status === 'wait') await redis.connect();
      const pipeline = redis.pipeline();
      for (const st of activeStates) {
        pipeline.eval(renewLua, 1, st.leaseKey, owner, 3000);
      }
      const results = await pipeline.exec();
      if (!results) continue;

      for (let i = 0; i < activeStates.length; i++) {
        const [err, res] = results[i];
        const st = activeStates[i];
        if (err || res !== 1) {
          process.stderr.write(`LEASE_LOST ${st.symbol} ${st.epoch}\n`);
          st.epoch = null;
          metrics.leader.set({ symbol: st.symbol }, 0);
        }
      }
    } catch (error) {
      metrics.errors.inc({ symbol: 'batch_renew' });
      process.stderr.write(`LEASE_RENEW_ERROR ${error?.message ?? 'UNKNOWN'}\n`);
    }
  }
}

export async function claimLease(targetSymbol = defaultSymbol) {
  if (redis.status === 'wait') await redis.connect();
  const state = getSymbolState(targetSymbol);

  // Attempt to acquire Redis lease (PX 3000ms, NX)
  if ((await redis.set(state.leaseKey, owner, 'PX', 3000, 'NX')) !== 'OK') {
    return null;
  }

  if (state.ownedEpoch !== null) {
    state.epoch = state.ownedEpoch;
    metrics.leader.set({ symbol: targetSymbol }, 1);
    return state.epoch;
  }

  const acquiredEpoch = await redis.incr(state.epochKey);

  // Acquire client only for state check and lease update, releasing immediately
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dbState = await client.query(
      'SELECT last_sequence, last_hash FROM index_state WHERE symbol = $1 FOR UPDATE',
      [targetSymbol]
    );
    if (dbState.rowCount !== 1) throw new Error('INDEX_STATE_MISSING');

    const latest = await client.query(
      'SELECT sequence, hash FROM ticks WHERE symbol = $1 ORDER BY sequence DESC LIMIT 1',
      [targetSymbol]
    );
    if (
      latest.rowCount &&
      (String(latest.rows[0].sequence) !== String(dbState.rows[0].last_sequence) ||
        latest.rows[0].hash !== dbState.rows[0].last_hash)
    ) {
      throw new Error('INDEX_STATE_DIVERGED');
    }

    await client.query(
      'UPDATE index_state SET lease_epoch = $1 WHERE symbol = $2',
      [acquiredEpoch, targetSymbol]
    );
    await client.query('COMMIT');

    state.epoch = acquiredEpoch;
    state.ownedEpoch = acquiredEpoch;
    process.stderr.write(`LEASE_ACQUIRED ${targetSymbol} ${state.epoch}\n`);
    metrics.leader.set({ symbol: targetSymbol }, 1);
    return state.epoch;
  } catch (error) {
    await client.query('ROLLBACK');
    await redis.eval(releaseLua, 1, state.leaseKey, owner);
    await releaseLeadership(targetSymbol);
    throw error;
  } finally {
    client.release();
  }
}

export async function persistTick(targetSymbol = defaultSymbol) {
  const state = getSymbolState(targetSymbol);
  if (state.epoch === null || (await redis.eval(renewLua, 1, state.leaseKey, owner, 3000)) !== 1) {
    state.epoch = null;
    metrics.leader.set({ symbol: targetSymbol }, 0);
    return false;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT s.last_sequence, s.last_price, s.last_hash, s.last_ts, s.lease_epoch,
              i.params, i.status FROM index_state s JOIN indices i USING (symbol)
       WHERE s.symbol = $1 FOR UPDATE OF s`,
      [targetSymbol]
    );
    if (result.rowCount !== 1) throw new Error('INDEX_STATE_MISSING');
    const row = result.rows[0];
    if (Number(row.lease_epoch) !== state.epoch) throw new Error('FENCED');

    const sigma = Number(row.params.sigma);
    const precision = Number(row.params.precision);
    if (
      !Number.isFinite(sigma) ||
      sigma <= 0 ||
      !Number.isInteger(precision) ||
      precision < 0 ||
      precision > 6
    ) {
      throw new Error('INDEX_PARAMS_MISSING');
    }

    // PAUSED indices still emit official ticks for open contracts.
    const sequence = nextSequence(row.last_sequence);
    const now = new Date(Math.max(Date.now(), new Date(row.last_ts).getTime() + 1)).toISOString();
    const price = generate(String(row.last_price), sigma, precision);
    const prevHash = row.last_hash;
    const hash = canonicalHash(prevHash, targetSymbol, sequence, now, price);
    const tick = {
      symbol: targetSymbol,
      sequence,
      ts: now,
      price,
      prev_hash: prevHash,
      hash,
      lease_epoch: state.epoch,
    };

    await client.query(
      'INSERT INTO ticks (symbol, sequence, ts, price, prev_hash, hash, lease_epoch) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [targetSymbol, sequence, now, price, prevHash, hash, state.epoch]
    );
    await client.query(
      'UPDATE index_state SET last_sequence=$1,last_price=$2,last_hash=$3,last_ts=$4 WHERE symbol=$5 AND lease_epoch=$6',
      [sequence, price, hash, now, targetSymbol, state.epoch]
    );
    await client.query(
      'INSERT INTO outbox (topic, aggregate_id, sequence, dedupe_key, payload) VALUES ($1,$2,$3,$4,$5)',
      ['tick', targetSymbol, sequence, `tick:${targetSymbol}:${sequence}`, tick]
    );
    await client.query('COMMIT');

    metrics.ticks.inc({ symbol: targetSymbol });
    state.lastTickAt = Date.parse(now);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    metrics.errors.inc({ symbol: targetSymbol });
    throw error;
  } finally {
    client.release();
  }
}

export async function discoverActiveSymbols(poolInstance = pool) {
  const res = await poolInstance.query(
    "SELECT symbol, params, status FROM indices WHERE status IN ('ACTIVE', 'PAUSED') ORDER BY symbol ASC"
  );
  return res.rows.map((r) => r.symbol);
}

async function main() {
  if (!process.env.DATABASE_URL_TICK) throw new Error('DATABASE_URL_TICK_REQUIRED');

  createServer(async (_request, response) => {
    const now = Date.now();
    for (const [sym, st] of symbolStates) {
      if (st.lastTickAt !== null) {
        metrics.age.set({ symbol: sym }, Math.max(0, (now - st.lastTickAt) / 1000));
      }
    }
    response.writeHead(200, { 'content-type': registry.contentType });
    response.end(await registry.metrics());
  }).listen(9100);

  const runningRef = { running: true };
  process.on('SIGTERM', () => { runningRef.running = false; });

  const renewal = renewLeasesInBackground(runningRef);

  const isMultiSymbol = !process.env.TICK_SYMBOL || process.env.TICK_SYMBOL === 'ALL';

  if (!isMultiSymbol) {
    // Single symbol mode (backward compatibility)
    while (runningRef.running) {
      const state = getSymbolState(defaultSymbol);
      const wait = state.epoch === null ? 100 : Math.max(1, 1000 - (Date.now() % 1000));
      await new Promise((resolve) => setTimeout(resolve, wait));
      try {
        if (state.epoch === null) await claimLease(defaultSymbol);
        else await persistTick(defaultSymbol);
      } catch (error) {
        metrics.errors.inc({ symbol: defaultSymbol });
        process.stderr.write(`${error?.message ?? 'TICK_ERROR'}\n`);
        if (error?.message === 'FENCED') {
          await releaseLeadership(defaultSymbol);
        }
      }
    }
  } else {
    // Dynamic multi-symbol mode
    let lastDiscovery = 0;
    let activeSymbols = [];

    while (runningRef.running) {
      const now = Date.now();
      if (now - lastDiscovery > 5000) {
        try {
          activeSymbols = await discoverActiveSymbols(pool);
          lastDiscovery = now;
        } catch (error) {
          metrics.errors.inc({ symbol: 'discovery' });
        }
      }

      if (activeSymbols.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      for (const sym of activeSymbols) {
        const state = getSymbolState(sym);
        try {
          if (state.epoch === null) {
            await claimLease(sym);
          } else {
            // Check if 1000ms has elapsed for this symbol
            if (!state.lastTickAt || now - state.lastTickAt >= 990) {
              await persistTick(sym);
            }
          }
        } catch (error) {
          metrics.errors.inc({ symbol: sym });
          if (error?.message === 'FENCED') {
            await releaseLeadership(sym);
          }
        }
      }

      // Small tick resolution sleep (staggered loop)
      const nextSleep = Math.max(10, Math.floor(1000 / Math.max(1, activeSymbols.length)));
      await new Promise((resolve) => setTimeout(resolve, Math.min(nextSleep, 50)));
    }
  }

  await renewal;
  for (const sym of symbolStates.keys()) {
    await releaseLeadership(sym);
  }
  await Promise.all([redis.quit(), pool.end()]);
}

if (process.argv[1]?.endsWith('/engine.mjs')) {
  await main();
}
