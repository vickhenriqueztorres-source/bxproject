"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandleRepository = void 0;
class CandleRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    /**
     * Salva ou atualiza a vela de forma idempotente no PostgreSQL (M-05, DB-04)
     * Se emitOutboxEvent for true, também cria evento CANDLE_CLOSED na mesma transação.
     */
    async upsertCandle(candle, emitOutboxEvent = false) {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const upsertSql = `
        INSERT INTO candles (symbol, interval, bucket_start, open, high, low, close, volume)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (symbol, interval, bucket_start)
        DO UPDATE SET
          high = GREATEST(candles.high, EXCLUDED.high),
          low = LEAST(candles.low, EXCLUDED.low),
          close = EXCLUDED.close,
          volume = EXCLUDED.volume;
      `;
            await client.query(upsertSql, [
                candle.symbol,
                candle.interval,
                candle.bucket_start,
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.volume
            ]);
            if (emitOutboxEvent) {
                const outboxSql = `
          INSERT INTO outbox_events (event_type, payload, status)
          VALUES ($1, $2, 'PENDING');
        `;
                const payload = JSON.stringify({
                    symbol: candle.symbol,
                    interval: candle.interval,
                    bucket_start: candle.bucket_start.toISOString(),
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume
                });
                await client.query(outboxSql, ["CANDLE_CLOSED", payload]);
            }
            await client.query("COMMIT");
        }
        catch (err) {
            await client.query("ROLLBACK");
            throw err;
        }
        finally {
            client.release();
        }
    }
    /**
     * Busca as últimas velas ordenadas por bucket_start ASC para um período
     */
    async getCandles(symbol, interval, from, to, limit = 500) {
        const query = `
      SELECT symbol, interval, bucket_start, open, high, low, close, volume
      FROM candles
      WHERE symbol = $1
        AND interval = $2
        AND bucket_start >= $3
        AND bucket_start <= $4
      ORDER BY bucket_start ASC
      LIMIT $5;
    `;
        const res = await this.pool.query(query, [symbol, interval, from, to, limit]);
        return res.rows.map(row => ({
            symbol: row.symbol,
            interval: row.interval,
            bucket_start: new Date(row.bucket_start),
            open: row.open.toString(),
            high: row.high.toString(),
            low: row.low.toString(),
            close: row.close.toString(),
            volume: parseInt(row.volume, 10)
        }));
    }
}
exports.CandleRepository = CandleRepository;
