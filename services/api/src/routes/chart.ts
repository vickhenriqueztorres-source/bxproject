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

const SYMBOL_ALIASES: Record<string, string> = {
  SYNTH_VOL_10: 'VOL_10',
  SYNTH_VOL_25: 'VOL_25',
  SYNTH_VOL_50: 'VOL_50',
  SYNTH_VOL_75: 'VOL_75',
  SYNTH_VOL_100: 'VOL_100',
  SYNTH_CRASH_BOOM_100: 'CRASH_BOOM_100',
};

function resolveSymbol(sym?: string): string {
  if (!sym) return 'VOL_50';
  return SYMBOL_ALIASES[sym] || sym;
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
    const symbol = resolveSymbol(request.query.symbol);

    // Busca no banco se existe
    let name = symbol;
    let description = "Índice de Volatilidad (24/7)";
    let pricescale = 10000;

    try {
      const res = await server.pg.query(
        "SELECT symbol, COALESCE(params->>'name', symbol) as name, COALESCE(params->>'subtitle', params->>'name', symbol) as description, COALESCE((params->>'precision')::int, 4) as precision FROM indices WHERE symbol = $1",
        [symbol]
      );
      if (res.rows.length > 0) {
        name = res.rows[0].symbol;
        description = res.rows[0].description || res.rows[0].name;
        if (res.rows[0].precision) {
          pricescale = Math.pow(10, res.rows[0].precision);
        }
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
    const { symbol: rawSymbol = "VOL_50", resolution = "1", from, to, countback } = request.query;
    const symbol = resolveSymbol(rawSymbol);

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

  // 6. GET /api/candles & GET /candles (Public Historical Candles with before & limit pagination - Subetapa 5)
  interface CandlesQuery {
    symbol?: string;
    interval?: string;
    limit?: string;
    before?: string;
  }

  const handleCandlesRequest = async (request: any, reply: any) => {
    const symbol = resolveSymbol(request.query.symbol);
    const interval = request.query.interval || "1m";
    const rawLimit = parseInt(request.query.limit || "1440", 10);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 1440 : rawLimit), 10080);
    const beforeSec = request.query.before ? parseInt(request.query.before, 10) : null;

    try {
      let query = `
        SELECT bucket_start, open, high, low, close, volume
        FROM candles
        WHERE symbol = $1 AND interval = $2
      `;
      const params: any[] = [symbol, interval];

      if (beforeSec && !isNaN(beforeSec) && beforeSec > 0) {
        query += ` AND bucket_start < $3 ORDER BY bucket_start DESC LIMIT $4;`;
        params.push(new Date(beforeSec * 1000), limit);
      } else {
        query += ` ORDER BY bucket_start DESC LIMIT $3;`;
        params.push(limit);
      }

      const res = await server.pg.query(query, params);
      const rows = res.rows.reverse(); // Ordem cronológica ASC

      const data = rows.map((r: any) => ({
        time: Math.floor(new Date(r.bucket_start).getTime() / 1000),
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: parseInt(r.volume, 10) || 1,
      }));

      reply.header("X-Total-Bars", String(data.length));
      reply.header("X-Has-More", String(data.length >= limit));
      reply.header("Cache-Control", "public, max-age=5");

      return data;
    } catch (err: any) {
      server.log.error(err, "Error fetching candles from database");
      return reply.status(500).send({ error: "Internal server error" });
    }
  };

  server.get<{ Querystring: CandlesQuery }>("/api/candles", handleCandlesRequest);
  server.get<{ Querystring: CandlesQuery }>("/candles", handleCandlesRequest);
};

