import { FastifyPluginAsync } from "fastify";

interface HistoryQuery {
  symbol?: string;
  resolution?: string;
  from?: string;
  to?: string;
  countback?: string;
}

interface SymbolsQuery {
  symbol?: string;
}

export const chartRoutes: FastifyPluginAsync = async (server) => {
  // 1. GET /api/v1/chart/config (TradingView UDF Config)
  server.get("/api/v1/chart/config", async () => {
    return {
      supported_resolutions: ["1S", "1", "5", "15", "60"],
      supports_group_request: false,
      supports_marks: false,
      supports_search: false,
      supports_time: true,
      supports_timescale_marks: false
    };
  });

  // 2. GET /api/v1/chart/time (UTC Server Time in seconds)
  server.get("/api/v1/chart/time", async () => {
    return Math.floor(Date.now() / 1000);
  });

  // 3. GET /api/v1/chart/symbols (Symbol Metadata)
  server.get<{ Querystring: SymbolsQuery }>("/api/v1/chart/symbols", async (request, reply) => {
    const symbol = request.query.symbol || "SYNTH_VOL_50";

    // Busca no banco se existe
    let name = symbol;
    let description = "Synthetic Volatility Index (OTC)";
    let pricescale = 100000;

    try {
      const res = await server.pg.query("SELECT symbol, name FROM indices WHERE symbol = $1", [symbol]);
      if (res.rows.length > 0) {
        name = res.rows[0].symbol;
        description = res.rows[0].name;
      }
    } catch {
      // Fallback gracioso caso tabela não esteja populada ainda
    }

    return {
      name,
      ticker: name,
      description,
      type: "synthetic",
      session: "24x7",
      exchange: "BROKER",
      listed_exchange: "BROKER",
      timezone: "Etc/UTC",
      minmov: 1,
      pricescale,
      has_intraday: true,
      has_seconds: true,
      has_no_volume: false,
      supported_resolutions: ["1S", "1", "5", "15", "60"]
    };
  });

  // 4. GET /api/v1/chart/history (TradingView Bars)
  server.get<{ Querystring: HistoryQuery }>("/api/v1/chart/history", async (request, reply) => {
    const { symbol = "SYNTH_VOL_50", resolution = "1", from, to, countback } = request.query;

    if (!from || !to) {
      return reply.status(400).send({ s: "error", errmsg: "Missing 'from' or 'to' parameters" });
    }

    const fromSec = parseInt(from, 10);
    const toSec = parseInt(to, 10);
    const fromDate = new Date(fromSec * 1000);
    const toDate = new Date(toSec * 1000);

    // Mapeia resolução UDF para intervalo do banco
    let dbInterval = "1m";
    if (resolution === "1S" || resolution === "1s") {
      dbInterval = "1s";
    } else if (resolution === "5" || resolution === "15" || resolution === "60") {
      dbInterval = "5m";
    }

    const limit = countback ? Math.min(parseInt(countback, 10), 1000) : 500;

    try {
      const query = `
        SELECT bucket_start, open, high, low, close, volume
        FROM candles
        WHERE symbol = $1
          AND interval = $2
          AND bucket_start >= $3
          AND bucket_start <= $4
        ORDER BY bucket_start ASC
        LIMIT $5;
      `;

      const result = await server.pg.query(query, [symbol, dbInterval, fromDate, toDate, limit]);

      if (result.rows.length === 0) {
        return { s: "no_data" };
      }

      const t: number[] = [];
      const o: number[] = [];
      const h: number[] = [];
      const l: number[] = [];
      const c: number[] = [];
      const v: number[] = [];

      for (const row of result.rows) {
        t.push(Math.floor(new Date(row.bucket_start).getTime() / 1000));
        o.push(parseFloat(row.open));
        h.push(parseFloat(row.high));
        l.push(parseFloat(row.low));
        c.push(parseFloat(row.close));
        v.push(parseInt(row.volume, 10));
      }

      return {
        s: "ok",
        t,
        o,
        h,
        l,
        c,
        v
      };
    } catch (err: any) {
      server.log.error(err, "Error fetching chart history");
      return reply.status(500).send({ s: "error", errmsg: "Internal server error" });
    }
  });

  // 5. GET /api/v1/snapshot (Atomic Snapshot for Clean Rebuild on Gap - Subetapa 4)
  server.get<{ Querystring: { symbol?: string } }>("/api/v1/snapshot", async (request, reply) => {
    const symbol = request.query.symbol;
    if (!symbol) {
      return reply.status(400).send({ error: "Missing 'symbol' parameter" });
    }

    try {
      const res = await server.pg.query(
        `SELECT s.symbol, s.last_sequence, s.last_price, s.updated_at as last_ts, s.last_hash, i.status
         FROM index_state s
         JOIN indices i ON s.symbol = i.symbol
         WHERE s.symbol = $1`,
        [symbol]
      );

      if (res.rows.length === 0) {
        return reply.status(404).send({ error: "Symbol not found in index_state" });
      }

      const row = res.rows[0];
      const eventTime = new Date(row.last_ts).getTime();
      const arrivalTime = Date.now();
      return {
        symbol: row.symbol,
        sequence: Number(row.last_sequence),
        price: row.last_price,
        ts: new Date(row.last_ts).toISOString(),
        event_time: eventTime,
        arrival_time: arrivalTime,
        latency_ms: Math.max(0, arrivalTime - eventTime),
        hash: row.last_hash,
        status: row.status
      };
    } catch (err: any) {
      server.log.error(err, "Error fetching symbol snapshot");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
};

