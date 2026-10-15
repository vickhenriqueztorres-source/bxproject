import pg from "pg";
import { HashChain } from "../engine/hash-chain.js";

export interface IndexStateRow {
  symbol: string;
  lastSequence: bigint;
  lastPrice: string;
  lastHash: string;
  basePrice: number;
  volatility: number;
  meanReversionSpeed: number;
}

export class TickRepository {
  constructor(private readonly pool: pg.Pool) {}

  public async fetchIndexState(symbol: string): Promise<IndexStateRow> {
    const query = `
      SELECT i.symbol,
             s.last_sequence,
             s.last_price::text as last_price,
             s.last_hash,
             i.base_price::float as base_price,
             i.volatility::float as volatility,
             i.mean_reversion_speed::float as mean_reversion_speed
        FROM indices i
        JOIN index_state s ON s.symbol = i.symbol
       WHERE i.symbol = $1;
    `;
    const res = await this.pool.query(query, [symbol]);
    if (res.rows.length === 0) {
      throw new Error(`Index metadata not found for symbol: ${symbol}`);
    }
    const row = res.rows[0];
    return {
      symbol: row.symbol,
      lastSequence: BigInt(row.last_sequence),
      lastPrice: row.last_price,
      lastHash: row.last_hash,
      basePrice: row.base_price,
      volatility: row.volatility,
      meanReversionSpeed: row.mean_reversion_speed
    };
  }

  public async persistTickAndOutbox(
    symbol: string,
    price: string,
    ts: Date,
    prevHash: string,
    hash: string
  ): Promise<{ sequence: bigint }> {
    if (!/^(?:0|[1-9]\d{0,11})\.\d{6}$/.test(price) || price === "0.000000") {
      throw new Error("TICK_PRICE_NOT_CANONICAL");
    }
    if (!(ts instanceof Date) || !Number.isFinite(ts.getTime())) {
      throw new Error("TICK_TIMESTAMP_INVALID");
    }
    const client = await this.pool.connect();
    let connectionError: Error | undefined;
    let rollbackFailed = false;
    const onConnectionError = (error: Error) => { connectionError = error; };
    client.on("error", onConnectionError);
    try {
      await client.query("BEGIN;");

      const stateRes = await client.query(`
        SELECT last_sequence, last_hash FROM index_state WHERE symbol = $1 FOR UPDATE;
      `, [symbol]);
      if (stateRes.rows.length === 0) {
        throw new Error("INDEX_STATE_MISSING");
      }
      const state = stateRes.rows[0];
      if (state.last_hash !== prevHash) {
        throw new Error("TICK_PREV_HASH_MISMATCH");
      }
      const sequence = BigInt(state.last_sequence) + 1n;
      if (HashChain.computeTickHash(prevHash, symbol, sequence, ts, price) !== hash) {
        throw new Error("TICK_HASH_MISMATCH");
      }

      const insertTickQuery = `
        INSERT INTO ticks (symbol, sequence, price, ts, prev_hash, hash)
        VALUES ($1, $2, $3, $4, $5, $6);
      `;
      await client.query(insertTickQuery, [symbol, sequence.toString(), price, ts, prevHash, hash]);

      const updateStateQuery = `
        UPDATE index_state
           SET last_sequence = $5,
               last_price = $2,
               last_hash = $3,
               updated_at = $4
         WHERE symbol = $1;
      `;
      await client.query(updateStateQuery, [symbol, price, hash, ts, sequence.toString()]);

      const insertOutboxQuery = `
        INSERT INTO outbox_events (event_type, payload)
        VALUES ('TICK_GENERATED', json_build_object(
          'symbol', $1::text,
          'sequence', $2::text,
          'price', $3::text,
          'ts', $4::text,
          'prev_hash', $5::text,
          'hash', $6::text
        ));
      `;
      await client.query(insertOutboxQuery, [symbol, sequence.toString(), price, ts.toISOString(), prevHash, hash]);

      await client.query("COMMIT;");
      return { sequence };
    } catch (err) {
      try {
        await client.query("ROLLBACK;");
      } catch (rollbackError) {
        rollbackFailed = true;
        throw new AggregateError([err, rollbackError, ...(connectionError ? [connectionError] : [])],
          "Tick persistence connection error: rollback failed");
      }
      throw err;
    } finally {
      client.release(rollbackFailed || Boolean(connectionError));
      client.removeListener("error", onConnectionError);
    }
  }
}
