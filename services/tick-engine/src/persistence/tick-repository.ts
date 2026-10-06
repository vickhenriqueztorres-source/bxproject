import pg from "pg";

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
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN;");

      const updateStateQuery = `
        UPDATE index_state
           SET last_sequence = last_sequence + 1,
               last_price = $2,
               last_hash = $3,
               updated_at = $4
         WHERE symbol = $1
        RETURNING last_sequence;
      `;
      const stateRes = await client.query(updateStateQuery, [symbol, price, hash, ts]);
      const sequence = BigInt(stateRes.rows[0].last_sequence);

      const insertTickQuery = `
        INSERT INTO ticks (symbol, sequence, price, ts, prev_hash, hash)
        VALUES ($1, $2, $3, $4, $5, $6);
      `;
      await client.query(insertTickQuery, [symbol, sequence.toString(), price, ts, prevHash, hash]);

      const insertOutboxQuery = `
        INSERT INTO outbox_events (event_type, payload)
        VALUES ('TICK_GENERATED', json_build_object(
          'symbol', $1,
          'sequence', $2::text,
          'price', $3,
          'ts', $4::text,
          'prev_hash', $5,
          'hash', $6
        ));
      `;
      await client.query(insertOutboxQuery, [symbol, sequence.toString(), price, ts.toISOString(), prevHash, hash]);

      await client.query("COMMIT;");
      return { sequence };
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  }
}
