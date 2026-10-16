import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { canonicalHash, genesisHash } from './core.mjs';

const LEASE_MS = 3_000;
const leaseKey = symbol => `lease:tick_leader:${symbol}`;
const renewLease = 'if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE",KEYS[1],ARGV[2]) else return 0 end';
const releaseLease = 'if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end';

function decimal6(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(value)) {
    throw new Error('INVALID_PRICE_DECIMAL');
  }
  const [whole, fraction = ''] = value.split('.');
  const result = `${whole}.${fraction.padEnd(6, '0')}`;
  if (BigInt(whole + fraction.padEnd(6, '0')) === 0n) throw new Error('INVALID_PRICE_DECIMAL');
  return result;
}

function headFrom(row) {
  const isRawGenesis = typeof row.last_hash === 'string' && row.last_hash.startsWith('genesis|');
  const normalizedHash = isRawGenesis ? genesisHash(row.symbol) : row.last_hash;
  return {
    symbol: row.symbol,
    sequence: Number(row.last_sequence),
    price: decimal6(String(row.last_price)),
    hash: normalizedHash,
    ts: row.last_ts?.toISOString() ?? null,
  };
}

function checkHead(row, latest) {
  const isRawGenesis = typeof row.last_hash === 'string' && row.last_hash.startsWith('genesis|');
  const validHash = /^[0-9a-f]{64}$/.test(row.last_hash) || isRawGenesis;
  if (!Number.isSafeInteger(Number(row.last_sequence)) || Number(row.last_sequence) < 0 ||
      !Number.isSafeInteger(Number(row.lease_epoch)) || Number(row.lease_epoch) < 0 ||
      !validHash) throw new Error('INDEX_STATE_INVALID');
  if (Number(row.last_sequence) === 0) {
    const expectedGenesis = genesisHash(row.symbol);
    if (latest) throw new Error('INDEX_STATE_DIVERGED');
    if (row.last_hash !== expectedGenesis && !isRawGenesis) throw new Error('INDEX_STATE_DIVERGED');
    return;
  }
  if (!latest || Number(latest.sequence) !== Number(row.last_sequence) ||
      latest.hash !== row.last_hash || decimal6(String(latest.price)) !== decimal6(String(row.last_price)) ||
      latest.ts.getTime() !== row.last_ts?.getTime()) throw new Error('INDEX_STATE_DIVERGED');
}

/**
 * Durable store for the active development feed. The supplied pgPool remains caller-owned.
 * initialize(assets) validates every catalog symbol and returns Map<symbol, head>.
 * produceTick(symbol, makePrice) returns a committed tick, or null when another
 * instance owns the symbol or the current second already has a committed tick.
 * makePrice(previousDecimalString) runs under the index_state row lock and must
 * synchronously return a positive decimal string with at most six fractional digits.
 */
export function createLiveMarketStore({ pgPool, redisUrl, instanceId, enableTickOutbox = true }) {
  if (!pgPool?.connect || !pgPool?.query || typeof redisUrl !== 'string' || !redisUrl ||
      typeof instanceId !== 'string' || !instanceId) throw new Error('LIVE_MARKET_STORE_CONFIG_REQUIRED');

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    commandTimeout: 2_000,
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  redis.on('error', () => {});
  const owner = `${instanceId}:${randomUUID()}`;
  const epochs = new Map();
  const symbols = new Set();
  const dbSymbolMap = new Map();
  let initialized = false;
  let closed = false;
  let lastPersistDurationMs = 0;
  const persistDurationSamplesMs = [];
  let inFlightPersistOps = 0;
  let droppedTicksTotal = 0;
  let lastAuditDiffsTotal = 0;

  function recordPersistDuration(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    lastPersistDurationMs = durationMs;
    persistDurationSamplesMs.push(durationMs);
    if (persistDurationSamplesMs.length > 120) {
      persistDurationSamplesMs.shift();
    }
  }

  function getDbSymbol(sym) {
    return dbSymbolMap.get(sym) || sym;
  }

  async function resolveActualDbSymbol(sym) {
    try {
      const res = await pgPool.query(
        `SELECT symbol FROM indices WHERE symbol = $1 OR symbol = ('SYNTH_' || $1)
         ORDER BY CASE WHEN symbol = $1 THEN 0 ELSE 1 END LIMIT 1`,
        [sym]
      );
      if (res.rowCount > 0) return res.rows[0].symbol;
    } catch {}
    return sym;
  }

  function assertReady(symbol) {
    if (!initialized || closed) throw new Error('LIVE_MARKET_STORE_NOT_READY');
    if (!symbols.has(symbol)) throw new Error('UNKNOWN_SYMBOL');
  }

  async function dbHead(symbol, verify = false) {
    const dbSym = getDbSymbol(symbol);
    const result = await pgPool.query(`SELECT s.symbol,s.last_sequence,s.last_price,s.last_hash,s.last_ts,s.lease_epoch,
        i.status FROM index_state s JOIN indices i USING(symbol) WHERE s.symbol=$1`, [dbSym]);
    if (result.rowCount !== 1) throw new Error('INDEX_STATE_MISSING');
    const row = result.rows[0];
    if (row.status !== 'ACTIVE' && row.status !== 'PAUSED') throw new Error('INDEX_UNAVAILABLE');
    if (verify) {
      const latest = await pgPool.query(`SELECT sequence,price,hash,ts FROM ticks
        WHERE symbol=$1 ORDER BY sequence DESC LIMIT 1`, [dbSym]);
      checkHead(row, latest.rows[0]);
    }
    return headFrom(row);
  }

  async function initialize(assets) {
    if (initialized || closed || !Array.isArray(assets) || assets.length === 0) {
      throw new Error('LIVE_MARKET_STORE_INITIALIZE_INVALID');
    }
    await redis.connect();
    if (await redis.ping() !== 'PONG') throw new Error('REDIS_UNAVAILABLE');
    const heads = new Map();
    for (const asset of assets) {
      const symbol = typeof asset === 'string' ? asset : asset?.symbol;
      if (typeof symbol !== 'string' || !/^[A-Z0-9_]{1,32}$/.test(symbol) || heads.has(symbol)) {
        throw new Error('INVALID_ASSET_CATALOG');
      }
      const actualDbSym = await resolveActualDbSymbol(symbol);
      dbSymbolMap.set(symbol, actualDbSym);
      heads.set(symbol, await dbHead(symbol, true));
    }
    for (const symbol of heads.keys()) symbols.add(symbol);
    initialized = true;
    return heads;
  }

  async function claim(symbol) {
    const key = leaseKey(symbol);
    const dbSym = getDbSymbol(symbol);
    if (epochs.has(symbol)) {
      const renewed = await redis.eval(renewLease, 1, key, owner, LEASE_MS);
      if (renewed === 1) return epochs.get(symbol);
      epochs.delete(symbol);
    }
    if (await redis.set(key, owner, 'PX', LEASE_MS, 'NX') !== 'OK') return null;
    try {
      const redisEpoch = await redis.incr(`lease:epoch:${symbol}`);
      const result = await pgPool.query(`UPDATE index_state
        SET lease_epoch=GREATEST(lease_epoch+1,$2::bigint),lease_leader=$3,updated_at=NOW()
        WHERE symbol=$1 RETURNING lease_epoch`, [dbSym, redisEpoch, owner]);
      if (result.rowCount !== 1) throw new Error('INDEX_STATE_MISSING');
      const epoch = Number(result.rows[0].lease_epoch);
      if (!Number.isSafeInteger(epoch)) throw new Error('LEASE_EPOCH_UNSAFE');
      epochs.set(symbol, epoch);
      return epoch;
    } catch (error) {
      await redis.eval(releaseLease, 1, key, owner).catch(() => {});
      throw error;
    }
  }

  async function produceTick(symbol, makePrice) {
    assertReady(symbol);
    if (typeof makePrice !== 'function') throw new Error('PRICE_GENERATOR_REQUIRED');
    const epoch = await claim(symbol);
    if (epoch === null) return null;
    const dbSym = getDbSymbol(symbol);
    const t0 = performance.now();
    inFlightPersistOps += 1;
    const client = await pgPool.connect();
    let transaction = false;
    let broken = false;
    let connectionError;
    const onConnectionError = error => { connectionError = error; broken = true; };
    client.on('error', onConnectionError);
    try {
      await client.query('BEGIN');
      transaction = true;
      const state = await client.query(`SELECT s.last_sequence,s.last_price,s.last_hash,s.last_ts,
        s.lease_epoch,s.lease_leader,i.status FROM index_state s JOIN indices i USING(symbol)
        WHERE s.symbol=$1 FOR UPDATE OF s`, [dbSym]);
      if (state.rowCount !== 1) throw new Error('INDEX_STATE_MISSING');
      const row = state.rows[0];
      // A paused index must keep ticking until already-open contracts can settle.
      if (row.status !== 'ACTIVE' && row.status !== 'PAUSED') throw new Error('INDEX_UNAVAILABLE');
      if (Number(row.lease_epoch) !== epoch || row.lease_leader !== owner) throw new Error('FENCED');
      const latest = await client.query(`SELECT sequence,price,hash,ts FROM ticks
        WHERE symbol=$1 ORDER BY sequence DESC LIMIT 1`, [dbSym]);
      checkHead({ ...row, symbol: dbSym }, latest.rows[0]);
      const now = Date.now();
      if (Number(row.last_sequence) > 0 && row.last_ts &&
          Math.floor(now / 1_000) <= Math.floor(row.last_ts.getTime() / 1_000)) {
        await client.query('ROLLBACK');
        transaction = false;
        return null;
      }
      const sequence = Number(row.last_sequence) + 1;
      if (!Number.isSafeInteger(sequence)) throw new Error('TICK_SEQUENCE_UNSAFE');
      const candidate = makePrice(decimal6(String(row.last_price)));
      if (candidate && typeof candidate.then === 'function') throw new Error('ASYNC_PRICE_GENERATOR_FORBIDDEN');
      const price = decimal6(candidate);
      const minNextMs = Number(row.last_sequence) > 0 && row.last_ts
        ? (Math.floor(row.last_ts.getTime() / 1_000) + 1) * 1_000
        : 0;
      const ts = new Date(Math.max(now, minNextMs)).toISOString();
      const prevHash = (typeof row.last_hash === 'string' && row.last_hash.startsWith('genesis|'))
        ? genesisHash(dbSym)
        : row.last_hash;
      const hash = canonicalHash(prevHash, dbSym, sequence, ts, price);
      const tick = { symbol, sequence, price, ts, prev_hash: prevHash, hash };
      await client.query(`INSERT INTO ticks(symbol,sequence,price,ts,prev_hash,hash)
        VALUES ($1,$2,$3,$4,$5,$6)`, [dbSym, sequence, price, ts, prevHash, hash]);
      const updated = await client.query(`UPDATE index_state SET last_sequence=$2,last_price=$3,
        last_hash=$4,last_ts=$5,updated_at=NOW()
        WHERE symbol=$1 AND lease_epoch=$6 AND lease_leader=$7`,
      [dbSym, sequence, price, hash, ts, epoch, owner]);
      if (updated.rowCount !== 1) throw new Error('FENCED');
      if (enableTickOutbox) {
        await client.query(`INSERT INTO outbox_events(event_type,payload)
          VALUES ('TICK',$1::jsonb)`, [JSON.stringify(tick)]);
      }
      const bucket = new Date(Math.floor(Date.parse(ts) / 60_000) * 60_000).toISOString();
      await client.query(`INSERT INTO candles(symbol,interval,bucket_start,open,high,low,close,volume)
        SELECT $1::varchar(32),'1m',$2::timestamptz,
          (array_agg(price ORDER BY sequence ASC))[1],MAX(price),MIN(price),
          (array_agg(price ORDER BY sequence DESC))[1],COUNT(*)::bigint
        FROM ticks WHERE symbol=$1::varchar(32) AND ts >= $2::timestamptz
          AND ts < $2::timestamptz + interval '1 minute'
        ON CONFLICT(symbol,interval,bucket_start) DO UPDATE SET
          open=EXCLUDED.open,high=EXCLUDED.high,low=EXCLUDED.low,
          close=EXCLUDED.close,volume=EXCLUDED.volume`, [dbSym, bucket]);
      if (await redis.eval(renewLease, 1, leaseKey(symbol), owner, LEASE_MS) !== 1) {
        epochs.delete(symbol);
        throw new Error('LEASE_LOST');
      }
      await client.query('COMMIT');
      transaction = false;
      recordPersistDuration(performance.now() - t0);
      return tick;
    } catch (error) {
      droppedTicksTotal += 1;
      if (transaction) {
        try { await client.query('ROLLBACK'); }
        catch { broken = true; }
      }
      if (error.message === 'FENCED' || error.message === 'LEASE_LOST') epochs.delete(symbol);
      if (connectionError) throw new AggregateError([error, connectionError], 'TICK_CONNECTION_ERROR');
      throw error;
    } finally {
      inFlightPersistOps = Math.max(0, inFlightPersistOps - 1);
      client.release(broken);
      client.removeListener('error', onConnectionError);
    }
  }

  async function produceTicksBatch(batchItems) {
    if (!initialized || closed) throw new Error('LIVE_MARKET_STORE_NOT_READY');
    if (!Array.isArray(batchItems) || batchItems.length === 0) {
      return { committedTicks: [], persistDurationMs: 0 };
    }

    const seenSymbols = new Set();
    const normalizedItems = [];
    for (const item of batchItems) {
      const symbol = item?.symbol;
      const makePrice = item?.makePrice || item?.computeNextPrice;
      assertReady(symbol);
      if (typeof makePrice !== 'function') throw new Error('PRICE_GENERATOR_REQUIRED');
      if (seenSymbols.has(symbol)) continue;
      seenSymbols.add(symbol);
      normalizedItems.push({ symbol, dbSym: getDbSymbol(symbol), makePrice });
    }

    // Ordena por dbSym ASC para garantir aquisição de lease e FOR UPDATE sem deadlock
    normalizedItems.sort((a, b) => a.dbSym.localeCompare(b.dbSym));

    const claimedItems = [];
    for (const item of normalizedItems) {
      const epoch = await claim(item.symbol);
      if (epoch !== null) {
        claimedItems.push({ ...item, epoch });
      }
    }

    if (claimedItems.length === 0) {
      return { committedTicks: [], persistDurationMs: 0 };
    }

    const t0 = performance.now();
    inFlightPersistOps += 1;
    const client = await pgPool.connect();
    let transaction = false;
    let broken = false;
    let connectionError;
    const onConnectionError = error => { connectionError = error; broken = true; };
    client.on('error', onConnectionError);

    try {
      await client.query('BEGIN');
      transaction = true;

      const dbSyms = claimedItems.map(item => item.dbSym);
      const stateRes = await client.query(
        `SELECT s.symbol, s.last_sequence, s.last_price, s.last_hash, s.last_ts,
                s.lease_epoch, s.lease_leader, i.status
         FROM index_state s
         JOIN indices i USING (symbol)
         WHERE s.symbol = ANY($1::varchar[])
         ORDER BY s.symbol ASC
         FOR UPDATE OF s`,
        [dbSyms]
      );

      const stateByDbSym = new Map();
      for (const row of stateRes.rows) {
        stateByDbSym.set(row.symbol, row);
      }

      const latestRes = await client.query(
        `SELECT DISTINCT ON (symbol) symbol, sequence, price, hash, ts
         FROM ticks
         WHERE symbol = ANY($1::varchar[])
         ORDER BY symbol ASC, sequence DESC`,
        [dbSyms]
      );
      const latestByDbSym = new Map();
      for (const row of latestRes.rows) {
        latestByDbSym.set(row.symbol, row);
      }

      const committedTicks = [];
      const now = Date.now();

      for (const item of claimedItems) {
        const row = stateByDbSym.get(item.dbSym);
        if (!row) throw new Error('INDEX_STATE_MISSING');
        if (row.status !== 'ACTIVE' && row.status !== 'PAUSED') continue;
        if (Number(row.lease_epoch) !== item.epoch || row.lease_leader !== owner) {
          epochs.delete(item.symbol);
          continue;
        }

        checkHead({ ...row, symbol: item.dbSym }, latestByDbSym.get(item.dbSym));

        if (
          Number(row.last_sequence) > 0 &&
          row.last_ts &&
          Math.floor(now / 1_000) <= Math.floor(row.last_ts.getTime() / 1_000)
        ) {
          continue;
        }

        const sequence = Number(row.last_sequence) + 1;
        if (!Number.isSafeInteger(sequence)) throw new Error('TICK_SEQUENCE_UNSAFE');

        const candidate = item.makePrice(decimal6(String(row.last_price)));
        if (candidate && typeof candidate.then === 'function') {
          throw new Error('ASYNC_PRICE_GENERATOR_FORBIDDEN');
        }
        const price = decimal6(candidate);
        const minNextMs =
          Number(row.last_sequence) > 0 && row.last_ts
            ? (Math.floor(row.last_ts.getTime() / 1_000) + 1) * 1_000
            : 0;
        const ts = new Date(Math.max(now, minNextMs)).toISOString();
        const prevHash =
          typeof row.last_hash === 'string' && row.last_hash.startsWith('genesis|')
            ? genesisHash(item.dbSym)
            : row.last_hash;
        const hash = canonicalHash(prevHash, item.dbSym, sequence, ts, price);
        const tick = { symbol: item.symbol, sequence, price, ts, prev_hash: prevHash, hash };

        await client.query(
          `INSERT INTO ticks(symbol,sequence,price,ts,prev_hash,hash)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [item.dbSym, sequence, price, ts, prevHash, hash]
        );
        const updated = await client.query(
          `UPDATE index_state
           SET last_sequence=$2,last_price=$3,last_hash=$4,last_ts=$5,updated_at=NOW()
           WHERE symbol=$1 AND lease_epoch=$6 AND lease_leader=$7`,
          [item.dbSym, sequence, price, hash, ts, item.epoch, owner]
        );
        if (updated.rowCount !== 1) {
          epochs.delete(item.symbol);
          throw new Error('FENCED');
        }
        if (enableTickOutbox) {
          await client.query(
            `INSERT INTO outbox_events(event_type,payload)
             VALUES ('TICK',$1::jsonb)`,
            [JSON.stringify(tick)]
          );
        }
        const bucket = new Date(Math.floor(Date.parse(ts) / 60_000) * 60_000).toISOString();
        await client.query(
          `INSERT INTO candles(symbol,interval,bucket_start,open,high,low,close,volume)
           SELECT $1::varchar(32),'1m',$2::timestamptz,
             (array_agg(price ORDER BY sequence ASC))[1],MAX(price),MIN(price),
             (array_agg(price ORDER BY sequence DESC))[1],COUNT(DISTINCT sequence)::bigint
           FROM ticks WHERE symbol=$1::varchar(32) AND ts >= $2::timestamptz
             AND ts < $2::timestamptz + interval '1 minute'
           ON CONFLICT(symbol,interval,bucket_start) DO UPDATE SET
             open=EXCLUDED.open,high=EXCLUDED.high,low=EXCLUDED.low,
             close=EXCLUDED.close,volume=EXCLUDED.volume`,
          [item.dbSym, bucket]
        );

        if (await redis.eval(renewLease, 1, leaseKey(item.symbol), owner, LEASE_MS) !== 1) {
          epochs.delete(item.symbol);
          throw new Error('LEASE_LOST');
        }

        committedTicks.push(tick);
      }

      if (committedTicks.length === 0) {
        await client.query('ROLLBACK');
        transaction = false;
        return { committedTicks: [], persistDurationMs: performance.now() - t0 };
      }

      await client.query('COMMIT');
      transaction = false;
      const persistDurationMs = performance.now() - t0;
      recordPersistDuration(persistDurationMs);
      return { committedTicks, persistDurationMs };
    } catch (error) {
      droppedTicksTotal += claimedItems.length;
      if (transaction) {
        try { await client.query('ROLLBACK'); }
        catch { broken = true; }
      }
      if (connectionError) throw new AggregateError([error, connectionError], 'TICK_CONNECTION_ERROR');
      throw error;
    } finally {
      inFlightPersistOps = Math.max(0, inFlightPersistOps - 1);
      client.release(broken);
      client.removeListener('error', onConnectionError);
    }
  }

  async function loadHead(symbol) {
    assertReady(symbol);
    return dbHead(symbol, true);
  }

  async function readTicksSince(symbol, sequence, limit = 1_000) {
    assertReady(symbol);
    if (!Number.isSafeInteger(sequence) || sequence < 0 || !Number.isInteger(limit) || limit < 1 || limit > 10_000) {
      throw new Error('INVALID_TICK_CURSOR');
    }
    const dbSym = getDbSymbol(symbol);
    const result = await pgPool.query(`SELECT sequence,price,ts,prev_hash,hash FROM ticks
      WHERE symbol=$1 AND sequence>$2 ORDER BY sequence ASC LIMIT $3`, [dbSym, sequence, limit]);
    return result.rows.map(row => ({
      symbol, sequence: Number(row.sequence), price: decimal6(String(row.price)),
      ts: row.ts.toISOString(), prev_hash: row.prev_hash, hash: row.hash,
    }));
  }

  const CANDLE_INTERVAL_SECONDS = Object.freeze({
    '5s': 5,
    '15s': 15,
    '30s': 30,
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1_800,
    '1h': 3_600,
  });

  async function loadCandles(symbol, limit = 10_080) {
    assertReady(symbol);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10_080) throw new Error('INVALID_CANDLE_LIMIT');
    const dbSym = getDbSymbol(symbol);
    const result = await pgPool.query(`SELECT bucket_start,open,high,low,close,volume FROM candles
      WHERE symbol=$1 AND interval='1m' ORDER BY bucket_start DESC LIMIT $2`, [dbSym, limit]);
    return result.rows.reverse().map(row => ({
      time: Math.floor(row.bucket_start.getTime() / 1_000),
      open: decimal6(String(row.open)), high: decimal6(String(row.high)),
      low: decimal6(String(row.low)), close: decimal6(String(row.close)),
      volume: Number(row.volume),
    }));
  }

  async function loadSeededCandles(symbol, limit = 10_080) {
    assertReady(symbol);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10_080) throw new Error('INVALID_CANDLE_LIMIT');
    const dbSym = getDbSymbol(symbol);
    const result = await pgPool.query(
      `SELECT bucket_start, open, high, low, close, volume
       FROM candles
       WHERE symbol = $1 AND interval = '1m_seed'
       ORDER BY bucket_start DESC
       LIMIT $2`,
      [dbSym, limit]
    );
    return result.rows.reverse().map(row => ({
      time: Math.floor(row.bucket_start.getTime() / 1_000),
      open: decimal6(String(row.open)),
      high: decimal6(String(row.high)),
      low: decimal6(String(row.low)),
      close: decimal6(String(row.close)),
      volume: Number(row.volume),
      legacy: true,
      provenance: 'legacy_visual',
    }));
  }

  async function saveSeededCandles(symbol, bars) {
    assertReady(symbol);
    if (!Array.isArray(bars) || bars.length === 0) return 0;
    const dbSym = getDbSymbol(symbol);
    const CHUNK_SIZE = 2000;
    let insertedTotal = 0;

    for (let offset = 0; offset < bars.length; offset += CHUNK_SIZE) {
      const slice = bars.slice(offset, offset + CHUNK_SIZE);
      const bucketStarts = [];
      const opens = [];
      const highs = [];
      const lows = [];
      const closes = [];
      const volumes = [];

      for (const b of slice) {
        const timeSec = Number(b.time);
        if (!Number.isFinite(timeSec) || timeSec <= 0) continue;
        bucketStarts.push(new Date(timeSec * 1000).toISOString());
        opens.push(decimal6(String(b.open)));
        highs.push(decimal6(String(b.high)));
        lows.push(decimal6(String(b.low)));
        closes.push(decimal6(String(b.close)));
        volumes.push(Math.max(1, Math.floor(Number(b.volume) || 60)));
      }
      if (bucketStarts.length === 0) continue;

      const res = await pgPool.query(
        `INSERT INTO candles (symbol, interval, bucket_start, open, high, low, close, volume)
         SELECT
           $1::varchar(32),
           '1m_seed'::varchar(8),
           u.bucket_start,
           u.open,
           u.high,
           u.low,
           u.close,
           u.volume
         FROM UNNEST(
           $2::timestamptz[],
           $3::numeric[],
           $4::numeric[],
           $5::numeric[],
           $6::numeric[],
           $7::bigint[]
         ) AS u(bucket_start, open, high, low, close, volume)
         ON CONFLICT (symbol, interval, bucket_start) DO NOTHING`,
        [dbSym, bucketStarts, opens, highs, lows, closes, volumes]
      );
      insertedTotal += Number(res.rowCount || 0);
    }
    return insertedTotal;
  }

  async function ensureHeadPriceContinuity(symbol, targetPriceStr, { clearStaleBeforeSec = null } = {}) {
    assertReady(symbol);
    const dbSym = getDbSymbol(symbol);
    const formattedTarget = decimal6(String(targetPriceStr));
    const epoch = await claim(symbol);
    if (epoch === null) return await dbHead(symbol, false);

    const client = await pgPool.connect();
    let transaction = false;
    try {
      await client.query('BEGIN');
      transaction = true;
      const state = await client.query(
        `SELECT s.last_sequence, s.last_price, s.last_hash, s.last_ts,
                s.lease_epoch, s.lease_leader, i.status
         FROM index_state s
         JOIN indices i USING (symbol)
         WHERE s.symbol = $1
         FOR UPDATE OF s`,
        [dbSym]
      );
      if (state.rowCount !== 1) throw new Error('INDEX_STATE_MISSING');
      const row = state.rows[0];

      if (clearStaleBeforeSec !== null && Number.isFinite(Number(clearStaleBeforeSec))) {
        const cutoffIso = new Date(Number(clearStaleBeforeSec) * 1000).toISOString();
        await client.query(
          `DELETE FROM candles WHERE symbol = $1 AND bucket_start < $2::timestamptz`,
          [dbSym, cutoffIso]
        );
      }

      if (Number(row.last_sequence) === 0) {
        await client.query(
          `UPDATE index_state
           SET last_price = $2, updated_at = NOW()
           WHERE symbol = $1`,
          [dbSym, formattedTarget]
        );
        await client.query('COMMIT');
        transaction = false;
        return await dbHead(symbol, false);
      }

      const currentPriceDec = decimal6(String(row.last_price));
      if (currentPriceDec === formattedTarget) {
        await client.query('COMMIT');
        transaction = false;
        return headFrom({ ...row, symbol: dbSym });
      }

      // Se houve gap-fill ou saneamento de preço fora de [0.5*base, 2.0*base], grava 1 tick encadeado de continuidade
      const sequence = Number(row.last_sequence) + 1;
      const now = Date.now();
      const minNextMs = row.last_ts ? (Math.floor(row.last_ts.getTime() / 1_000) + 1) * 1_000 : now;
      const ts = new Date(Math.max(now - 1000, minNextMs)).toISOString();
      const prevHash =
        typeof row.last_hash === 'string' && row.last_hash.startsWith('genesis|')
          ? genesisHash(dbSym)
          : row.last_hash;
      const hash = canonicalHash(prevHash, dbSym, sequence, ts, formattedTarget);

      await client.query(
        `INSERT INTO ticks(symbol, sequence, price, ts, prev_hash, hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dbSym, sequence, formattedTarget, ts, prevHash, hash]
      );
      await client.query(
        `UPDATE index_state
         SET last_sequence = $2, last_price = $3, last_hash = $4, last_ts = $5, updated_at = NOW()
         WHERE symbol = $1`,
        [dbSym, sequence, formattedTarget, hash, ts]
      );
      const bucket = new Date(Math.floor(Date.parse(ts) / 60_000) * 60_000).toISOString();
      await client.query(
        `INSERT INTO candles(symbol, interval, bucket_start, open, high, low, close, volume)
         SELECT $1::varchar(32), '1m', $2::timestamptz,
           (array_agg(price ORDER BY sequence ASC))[1], MAX(price), MIN(price),
           (array_agg(price ORDER BY sequence DESC))[1], COUNT(DISTINCT sequence)::bigint
         FROM ticks WHERE symbol = $1::varchar(32) AND ts >= $2::timestamptz
           AND ts < $2::timestamptz + interval '1 minute'
         ON CONFLICT(symbol, interval, bucket_start) DO UPDATE SET
           open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
           close = EXCLUDED.close, volume = EXCLUDED.volume`,
        [dbSym, bucket]
      );

      await client.query('COMMIT');
      transaction = false;
      return {
        symbol,
        sequence,
        price: formattedTarget,
        hash,
        ts,
      };
    } catch (err) {
      if (transaction) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async function rebuildCandles(symbol, { interval = '1m', fromTs = null, toTs = null } = {}) {
    assertReady(symbol);
    const intervalSec = CANDLE_INTERVAL_SECONDS[interval];
    if (!intervalSec) throw new Error('INVALID_CANDLE_INTERVAL');
    const fromIso = fromTs !== null && fromTs !== undefined ? new Date(fromTs).toISOString() : null;
    const toIso = toTs !== null && toTs !== undefined ? new Date(toTs).toISOString() : null;
    if ((fromIso !== null && Number.isNaN(Date.parse(fromIso))) ||
        (toIso !== null && Number.isNaN(Date.parse(toIso)))) {
      throw new Error('INVALID_CANDLE_RANGE');
    }

    const dbSym = getDbSymbol(symbol);
    const client = await pgPool.connect();
    let transaction = false;
    try {
      await client.query('BEGIN');
      transaction = true;
      await client.query(`SELECT symbol FROM index_state WHERE symbol = $1::varchar(32) FOR UPDATE`, [dbSym]);

      await client.query(
        `DELETE FROM candles c
         WHERE c.symbol = $1::varchar(32)
         AND c.interval = $2::varchar(8)
         AND ($4::timestamptz IS NULL OR c.bucket_start >= $4::timestamptz)
         AND ($5::timestamptz IS NULL OR c.bucket_start < $5::timestamptz)
         AND NOT EXISTS (
           SELECT 1 FROM ticks t
           WHERE t.symbol = $1::varchar(32)
             AND ($4::timestamptz IS NULL OR t.ts >= $4::timestamptz)
             AND ($5::timestamptz IS NULL OR t.ts < $5::timestamptz)
             AND to_timestamp(floor(extract(epoch from t.ts) / $3::int) * $3::int) = c.bucket_start
         )`,
        [dbSym, interval, intervalSec, fromIso, toIso]
      );

      const upserted = await client.query(
        `INSERT INTO candles (symbol, interval, bucket_start, open, high, low, close, volume)
         SELECT
           $1::varchar(32) AS symbol,
           $2::varchar(8) AS interval,
           to_timestamp(floor(extract(epoch from ts) / $3::int) * $3::int) AS bucket_start,
           (array_agg(price ORDER BY sequence ASC))[1] AS open,
           MAX(price) AS high,
           MIN(price) AS low,
           (array_agg(price ORDER BY sequence DESC))[1] AS close,
           COUNT(DISTINCT sequence)::bigint AS volume
         FROM ticks
         WHERE symbol = $1::varchar(32)
           AND ($4::timestamptz IS NULL OR ts >= $4::timestamptz)
           AND ($5::timestamptz IS NULL OR ts < $5::timestamptz)
         GROUP BY floor(extract(epoch from ts) / $3::int)
         ORDER BY bucket_start ASC
         ON CONFLICT (symbol, interval, bucket_start) DO UPDATE SET
           open = EXCLUDED.open,
           high = EXCLUDED.high,
           low = EXCLUDED.low,
           close = EXCLUDED.close,
           volume = EXCLUDED.volume
         RETURNING bucket_start, open, high, low, close, volume`,
        [dbSym, interval, intervalSec, fromIso, toIso]
      );

      await client.query('COMMIT');
      transaction = false;
      return upserted.rows.map(row => ({
        time: Math.floor(row.bucket_start.getTime() / 1_000),
        open: decimal6(String(row.open)),
        high: decimal6(String(row.high)),
        low: decimal6(String(row.low)),
        close: decimal6(String(row.close)),
        volume: Number(row.volume),
      }));
    } catch (error) {
      if (transaction) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function queryOfficialCandles(symbol, { interval = '1m', limit = 1_440, beforeSec = null } = {}) {
    assertReady(symbol);
    const intervalSec = CANDLE_INTERVAL_SECONDS[interval];
    if (!intervalSec) throw new Error('INVALID_CANDLE_INTERVAL');
    if (!Number.isInteger(limit) || limit < 1 || limit > 10_080) throw new Error('INVALID_CANDLE_LIMIT');
    if (beforeSec !== null && beforeSec !== undefined && (!Number.isInteger(beforeSec) || beforeSec <= 0)) {
      throw new Error('INVALID_CANDLE_BEFORE');
    }
    const result = await pgPool.query(
      `SELECT
         floor(extract(epoch from ts) / $2::int)::bigint * $2::int AS time_sec,
         (array_agg(price ORDER BY sequence ASC))[1] AS open,
         MAX(price) AS high,
         MIN(price) AS low,
         (array_agg(price ORDER BY sequence DESC))[1] AS close,
         COUNT(DISTINCT sequence)::bigint AS volume
       FROM ticks
       WHERE symbol = $1::varchar(32)
         AND ($3::bigint IS NULL OR floor(extract(epoch from ts) / $2::int)::bigint * $2::int < $3::bigint)
       GROUP BY floor(extract(epoch from ts) / $2::int)
       ORDER BY time_sec DESC
       LIMIT $4::int`,
      [symbol, intervalSec, beforeSec, limit]
    );
    return result.rows.reverse().map(row => ({
      time: Number(row.time_sec),
      open: decimal6(String(row.open)),
      high: decimal6(String(row.high)),
      low: decimal6(String(row.low)),
      close: decimal6(String(row.close)),
      volume: Number(row.volume),
      legacy: false,
      provenance: 'official',
    }));
  }

  async function pruneMarketStorage({
    tickRetentionMs = 30 * 24 * 3_600 * 1_000,
    outboxRetentionMs = 24 * 3_600 * 1_000,
    batchLimit = 5_000,
  } = {}) {
    if (!initialized || closed) throw new Error('LIVE_MARKET_STORE_NOT_READY');
    if (!Number.isSafeInteger(tickRetentionMs) || tickRetentionMs < 60_000) {
      throw new Error('INVALID_TICK_RETENTION');
    }
    if (!Number.isSafeInteger(outboxRetentionMs) || outboxRetentionMs < 60_000) {
      throw new Error('INVALID_OUTBOX_RETENTION');
    }
    if (!Number.isInteger(batchLimit) || batchLimit < 1 || batchLimit > 50_000) {
      throw new Error('INVALID_PRUNE_BATCH_LIMIT');
    }

    const tickCutoffIso = new Date(Date.now() - tickRetentionMs).toISOString();
    const outboxCutoffIso = new Date(Date.now() - outboxRetentionMs).toISOString();

    const outboxRes = await pgPool.query(
      `WITH doomed_outbox AS (
         SELECT id
         FROM outbox_events
         WHERE event_type = 'TICK'
           AND (status = 'PROCESSED' OR created_at < $1::timestamptz)
         ORDER BY created_at ASC
         LIMIT $2::int
         FOR UPDATE SKIP LOCKED
       )
       DELETE FROM outbox_events o
       USING doomed_outbox d
       WHERE o.id = d.id`,
      [outboxCutoffIso, batchLimit]
    );

    const ticksRes = await pgPool.query(
      `WITH doomed_ticks AS (
         SELECT t.id
         FROM ticks t
         JOIN index_state s ON s.symbol = t.symbol
         WHERE t.ts < $1::timestamptz
           AND t.sequence < s.last_sequence
           AND NOT EXISTS (
             SELECT 1
             FROM contracts c
             WHERE c.symbol = t.symbol
               AND (
                 (c.status = 'OPEN' AND t.ts >= c.opened_at)
                 OR (c.exit_tick_sequence IS NOT NULL AND c.exit_tick_sequence = t.sequence)
               )
           )
         ORDER BY t.ts ASC, t.sequence ASC
         LIMIT $2::int
         FOR UPDATE OF t SKIP LOCKED
       )
       DELETE FROM ticks t
       USING doomed_ticks d
       WHERE t.id = d.id`,
      [tickCutoffIso, batchLimit]
    );

    const retentionRes = await pruneProcessedAndArchivedOutbox(pgPool, {
      retentionDays: 7,
      batchLimit,
    });

    return {
      prunedOutboxCount: Number(outboxRes.rowCount || 0) + Number(retentionRes.deletedCount || 0),
      prunedTicksCount: Number(ticksRes.rowCount || 0),
      tickCutoffIso,
      outboxCutoffIso,
    };
  }

  async function verifyMarketAuditIntegrity({ symbols: requestedSymbols } = {}) {
    if (!initialized || closed) throw new Error('LIVE_MARKET_STORE_NOT_READY');
    const targetSymbols =
      Array.isArray(requestedSymbols) && requestedSymbols.length > 0
        ? requestedSymbols.filter(s => symbols.has(s))
        : [...symbols];

    let hashChainBreaks = 0;
    let candleDiffCount = 0;
    let settlementDiffCount = 0;
    let checkedTicks = 0;
    let checkedCandles = 0;
    let checkedContracts = 0;
    const details = [];

    for (const sym of targetSymbols) {
      const dbSym = getDbSymbol(sym);
      const stateRes = await pgPool.query(
        `SELECT symbol, last_sequence, last_price, last_hash, last_ts
         FROM index_state WHERE symbol = $1`,
        [dbSym]
      );
      if (stateRes.rowCount !== 1) {
        hashChainBreaks += 1;
        details.push({ type: 'INDEX_STATE_MISSING', symbol: sym });
        continue;
      }
      const stateRow = stateRes.rows[0];
      const lastSeq = Number(stateRow.last_sequence);

      const ticksRes = await pgPool.query(
        `SELECT sequence, price, ts, prev_hash, hash
         FROM ticks
         WHERE symbol = $1
         ORDER BY sequence ASC`,
        [dbSym]
      );
      const tickRows = ticksRes.rows;

      // 1. Verificação de Hash-Chain e Head
      if (lastSeq === 0) {
        if (tickRows.length > 0) {
          hashChainBreaks += 1;
          details.push({ type: 'UNEXPECTED_TICKS_AT_GENESIS', symbol: sym });
        }
      } else {
        if (tickRows.length === 0) {
          hashChainBreaks += 1;
          details.push({ type: 'HEAD_TICK_MISSING', symbol: sym });
        } else {
          const headTick = tickRows[tickRows.length - 1];
          if (
            Number(headTick.sequence) !== lastSeq ||
            headTick.hash !== stateRow.last_hash ||
            decimal6(String(headTick.price)) !== decimal6(String(stateRow.last_price)) ||
            headTick.ts.getTime() !== stateRow.last_ts?.getTime()
          ) {
            hashChainBreaks += 1;
            details.push({ type: 'HEAD_STATE_MISMATCH', symbol: sym });
          }
        }

        for (let i = 0; i < tickRows.length; i++) {
          checkedTicks += 1;
          const t = tickRows[i];
          const seq = Number(t.sequence);
          const priceStr = decimal6(String(t.price));
          const tsIso = t.ts.toISOString();
          const expectedHash = canonicalHash(t.prev_hash, dbSym, seq, tsIso, priceStr);
          if (t.hash !== expectedHash) {
            hashChainBreaks += 1;
            details.push({ type: 'TICK_HASH_MISMATCH', symbol: sym, sequence: seq });
          }
          if (seq === 1 && t.prev_hash !== genesisHash(dbSym)) {
            hashChainBreaks += 1;
            details.push({ type: 'GENESIS_PREV_HASH_MISMATCH', symbol: sym, sequence: seq });
          }
          if (i > 0) {
            const prevT = tickRows[i - 1];
            const prevSeq = Number(prevT.sequence);
            if (seq === prevSeq + 1 && t.prev_hash !== prevT.hash) {
              hashChainBreaks += 1;
              details.push({ type: 'HASH_CHAIN_LINK_BROKEN', symbol: sym, sequence: seq });
            }
          }
        }
      }

      // 2. Verificação de Velas 1m derivadas dos ticks retidos
      if (tickRows.length > 0) {
        const expectedBuckets = new Map();
        const firstSeq = Number(tickRows[0].sequence);
        const minBucketMs = Math.floor(tickRows[0].ts.getTime() / 60_000) * 60_000;

        for (const t of tickRows) {
          const bucketMs = Math.floor(t.ts.getTime() / 60_000) * 60_000;
          if (firstSeq > 1 && bucketMs === minBucketMs) continue;
          const priceStr = decimal6(String(t.price));
          const priceNum = Number(priceStr);
          const existing = expectedBuckets.get(bucketMs);
          if (!existing) {
            expectedBuckets.set(bucketMs, {
              open: priceStr,
              highNum: priceNum,
              high: priceStr,
              lowNum: priceNum,
              low: priceStr,
              close: priceStr,
              volume: 1,
            });
          } else {
            if (priceNum > existing.highNum) {
              existing.highNum = priceNum;
              existing.high = priceStr;
            }
            if (priceNum < existing.lowNum) {
              existing.lowNum = priceNum;
              existing.low = priceStr;
            }
            existing.close = priceStr;
            existing.volume += 1;
          }
        }

        const candlesRes = await pgPool.query(
          `SELECT bucket_start, open, high, low, close, volume
           FROM candles
           WHERE symbol = $1 AND interval = '1m'`,
          [dbSym]
        );
        const persistedByBucketMs = new Map();
        for (const c of candlesRes.rows) {
          persistedByBucketMs.set(c.bucket_start.getTime(), c);
        }

        for (const [bucketMs, exp] of expectedBuckets.entries()) {
          checkedCandles += 1;
          const persisted = persistedByBucketMs.get(bucketMs);
          if (
            !persisted ||
            decimal6(String(persisted.open)) !== exp.open ||
            decimal6(String(persisted.high)) !== exp.high ||
            decimal6(String(persisted.low)) !== exp.low ||
            decimal6(String(persisted.close)) !== exp.close ||
            Number(persisted.volume) !== exp.volume
          ) {
            candleDiffCount += 1;
            details.push({
              type: 'CANDLE_DIFF',
              symbol: sym,
              bucket: new Date(bucketMs).toISOString(),
            });
          }
        }
      }

      // 3. Verificação de Contratos SETTLED contra o primeiro tick oficial ts >= expires_at
      const contractsRes = await pgPool.query(
        `SELECT id, direction, result, stake_minor, payout_minor,
                entry_price, exit_price, exit_tick_sequence, expires_at
         FROM contracts
         WHERE (symbol = $1 OR symbol = $2) AND status = 'SETTLED'`,
        [dbSym, sym]
      );

      for (const c of contractsRes.rows) {
        checkedContracts += 1;
        const offTickRes = await pgPool.query(
          `SELECT sequence, price, ts
           FROM ticks
           WHERE symbol = $1 AND ts >= $2
           ORDER BY ts ASC, sequence ASC
           LIMIT 1`,
          [dbSym, c.expires_at]
        );
        if (offTickRes.rowCount !== 1) {
          settlementDiffCount += 1;
          details.push({ type: 'SETTLEMENT_OFFICIAL_TICK_MISSING', symbol: sym, contractId: c.id });
          continue;
        }
        const offTick = offTickRes.rows[0];
        if (
          c.exit_tick_sequence !== null &&
          Number(c.exit_tick_sequence) !== Number(offTick.sequence)
        ) {
          settlementDiffCount += 1;
          details.push({ type: 'SETTLEMENT_EXIT_SEQ_DIFF', symbol: sym, contractId: c.id });
          continue;
        }
        if (
          c.exit_price === null ||
          decimal6(String(c.exit_price)) !== decimal6(String(offTick.price))
        ) {
          settlementDiffCount += 1;
          details.push({ type: 'SETTLEMENT_EXIT_PRICE_DIFF', symbol: sym, contractId: c.id });
          continue;
        }
        const entryNum = Number(c.entry_price);
        const exitNum = Number(offTick.price);
        let expectedResult;
        if (exitNum === entryNum) {
          expectedResult = c.result === 'TIE' ? 'TIE' : 'DRAW';
        } else if (
          (c.direction === 'UP' && exitNum > entryNum) ||
          (c.direction === 'DOWN' && exitNum < entryNum)
        ) {
          expectedResult = 'WIN';
        } else {
          expectedResult = 'LOSS';
        }
        if (c.result !== expectedResult) {
          settlementDiffCount += 1;
          details.push({ type: 'SETTLEMENT_RESULT_DIFF', symbol: sym, contractId: c.id });
          continue;
        }
        const stakeMinor = Number(c.stake_minor);
        const pct =
          c.payout_pct !== null && c.payout_pct !== undefined && Number.isFinite(Number(c.payout_pct))
            ? Number(c.payout_pct)
            : 85;
        const expectedPayoutMinor =
          expectedResult === 'WIN'
            ? stakeMinor + Math.floor((stakeMinor * pct) / 100)
            : expectedResult === 'LOSS'
              ? 0
              : stakeMinor;
        if (Number(c.payout_minor) !== expectedPayoutMinor) {
          settlementDiffCount += 1;
          details.push({ type: 'SETTLEMENT_PAYOUT_DIFF', symbol: sym, contractId: c.id });
          continue;
        }
      }
    }

    const totalDiffs = hashChainBreaks + candleDiffCount + settlementDiffCount;
    lastAuditDiffsTotal = totalDiffs;

    return {
      ok: totalDiffs === 0,
      hashChainBreaks,
      candleDiffCount,
      settlementDiffCount,
      totalDiffs,
      checkedSymbols: targetSymbols.length,
      checkedTicks,
      checkedCandles,
      checkedContracts,
      details,
    };
  }

  async function getPersistenceMetrics() {
    const outboxStats = await queryOutboxPendingMetrics(pgPool);

    let p99 = 0;
    if (persistDurationSamplesMs.length > 0) {
      const sorted = [...persistDurationSamplesMs].sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));
      p99 = sorted[idx];
    }

    return {
      tick_persist_ms: Number(lastPersistDurationMs.toFixed(3)),
      tick_persist_p99_ms: Number(p99.toFixed(3)),
      tick_persist_queue_depth: inFlightPersistOps,
      tick_dropped_total: droppedTicksTotal,
      outbox_pending_total: outboxStats.outbox_pending_total,
      outbox_oldest_pending_seconds: outboxStats.outbox_oldest_pending_seconds,
      outbox_oldest_pending_alert: outboxStats.outbox_oldest_pending_alert,
      market_audit_diffs_total: lastAuditDiffsTotal,
    };
  }

  async function close() {
    if (closed) return;
    closed = true;
    await Promise.all([...epochs.keys()].map(symbol =>
      redis.eval(releaseLease, 1, leaseKey(symbol), owner).catch(() => {})));
    epochs.clear();
    redis.disconnect();
  }

  return {
    initialize,
    produceTick,
    produceTicksBatch,
    loadHead,
    readTicksSince,
    loadCandles,
    loadSeededCandles,
    saveSeededCandles,
    ensureHeadPriceContinuity,
    rebuildCandles,
    queryOfficialCandles,
    pruneMarketStorage,
    verifyMarketAuditIntegrity,
    getPersistenceMetrics,
    close,
  };
}

/**
 * Passo 2 de P0-2: Arquiva eventos PENDING antigos (anteriores a cutoffIso) em lotes
 * de 10.000 usando FOR UPDATE SKIP LOCKED para evitar locks longos e reprocessamento cego.
 */
export async function archiveLegacyPendingOutbox(
  pgPool,
  { cutoffIso = new Date().toISOString(), batchLimit = 10_000, maxBatches = 500 } = {}
) {
  if (!pgPool?.query) throw new Error('PG_POOL_REQUIRED');
  if (!Number.isInteger(batchLimit) || batchLimit < 1 || batchLimit > 50_000) {
    throw new Error('INVALID_ARCHIVE_BATCH_LIMIT');
  }

  let totalArchived = 0;
  let batchesExecuted = 0;

  while (batchesExecuted < maxBatches) {
    const res = await pgPool.query(
      `WITH legacy_batch AS (
         SELECT id
         FROM outbox_events
         WHERE status = 'PENDING'
           AND created_at < $1::timestamptz
         ORDER BY created_at ASC
         LIMIT $2::int
         FOR UPDATE SKIP LOCKED
       )
       UPDATE outbox_events o
       SET status = 'ARCHIVED',
           processed_at = NOW()
       FROM legacy_batch b
       WHERE o.id = b.id
       RETURNING o.id`,
      [cutoffIso, batchLimit]
    );

    const archivedInBatch = Number(res.rowCount || 0);
    if (archivedInBatch === 0) break;
    totalArchived += archivedInBatch;
    batchesExecuted += 1;
    if (archivedInBatch < batchLimit) break;
  }

  return {
    totalArchived,
    batchesExecuted,
    cutoffIso,
  };
}

/**
 * Passo 3 de P0-2: Job de retenção que apaga PROCESSED e ARCHIVED com mais de 7 dias
 * em lotes usando FOR UPDATE SKIP LOCKED (preserva FAILED e PENDING).
 */
export async function pruneProcessedAndArchivedOutbox(
  pgPool,
  { retentionDays = 7, batchLimit = 10_000 } = {}
) {
  if (!pgPool?.query) throw new Error('PG_POOL_REQUIRED');
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error('INVALID_RETENTION_DAYS');
  }
  if (!Number.isInteger(batchLimit) || batchLimit < 1 || batchLimit > 50_000) {
    throw new Error('INVALID_PRUNE_BATCH_LIMIT');
  }

  const cutoffIso = new Date(Date.now() - retentionDays * 24 * 3_600 * 1000).toISOString();
  const res = await pgPool.query(
    `WITH doomed_outbox AS (
       SELECT id
       FROM outbox_events
       WHERE status IN ('PROCESSED', 'ARCHIVED')
         AND created_at < $1::timestamptz
       ORDER BY created_at ASC
       LIMIT $2::int
       FOR UPDATE SKIP LOCKED
     )
     DELETE FROM outbox_events o
     USING doomed_outbox d
     WHERE o.id = d.id`,
    [cutoffIso, batchLimit]
  );

  return {
    deletedCount: Number(res.rowCount || 0),
    cutoffIso,
  };
}

/**
 * Passo 4 de P0-2: Consulta outbox_pending_total e outbox_oldest_pending_seconds
 * com flag de alerta quando > 300s.
 */
export async function queryOutboxPendingMetrics(
  pgPool,
  { alertThresholdSeconds = 300 } = {}
) {
  let pendingOutboxCount = 0;
  let oldestPendingSeconds = 0;
  if (pgPool?.query) {
    try {
      const res = await pgPool.query(
        `SELECT COUNT(*)::int AS cnt,
                COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))), 0)::float AS oldest_pending_sec
         FROM outbox_events WHERE status = 'PENDING'`
      );
      pendingOutboxCount = Number(res.rows[0]?.cnt || 0);
      oldestPendingSeconds = Math.max(0, Number(res.rows[0]?.oldest_pending_sec || 0));
    } catch {}
  }

  return {
    outbox_pending_total: pendingOutboxCount,
    outbox_oldest_pending_seconds: Number(oldestPendingSeconds.toFixed(3)),
    outbox_oldest_pending_alert: oldestPendingSeconds > alertThresholdSeconds ? 1 : 0,
  };
}

