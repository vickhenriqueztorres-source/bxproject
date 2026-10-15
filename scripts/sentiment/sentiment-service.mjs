// Serviço isolado de Sentimento do Mercado ("Traders Mood")
// Lê posições abertas do PostgreSQL a cada 5s e mantém snapshot em memória com suavização Bayesiana (k=10) + EMA (~30s).

export const SENTIMENT_QUERY_SQL = `
  SELECT symbol, user_id,
         BOOL_OR(direction = 'UP')   AS has_up,
         BOOL_OR(direction = 'DOWN') AS has_down
  FROM contracts
  WHERE status = 'OPEN' AND expires_at > now()
  GROUP BY symbol, user_id
`.trim();

const DEFAULT_K = 10;
const DEFAULT_DT_SEC = 5;
const DEFAULT_HALF_LIFE_SEC = 30;
const MIN_SAMPLE_SIZE = 5;
const ERROR_LOG_THROTTLE_MS = 60_000;

/**
 * Suavização com k = 10:
 * raw = (up + k) / (up + down + 2k) * 100
 */
export function computeRaw(up, down, k = DEFAULT_K) {
  const safeUp = Number.isFinite(up) && up > 0 ? up : 0;
  const safeDown = Number.isFinite(down) && down > 0 ? down : 0;
  const safeK = Number.isFinite(k) && k >= 0 ? k : DEFAULT_K;
  const denom = safeUp + safeDown + 2 * safeK;
  if (denom <= 0) return 50;
  return ((safeUp + safeK) / denom) * 100;
}

/**
 * Média móvel exponencial:
 * ema = prev + α * (raw - prev), com α = 1 - exp(-dtSec / halfLifeSec)
 * Primeiro valor (prev == null ou não finito) = raw.
 */
export function nextEma(prev, raw, dtSec = DEFAULT_DT_SEC, halfLifeSec = DEFAULT_HALF_LIFE_SEC) {
  const safeRaw = Number.isFinite(raw) ? raw : 50;
  if (prev === null || prev === undefined || !Number.isFinite(prev)) {
    return safeRaw;
  }
  const dt = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : DEFAULT_DT_SEC;
  const hl = Number.isFinite(halfLifeSec) && halfLifeSec > 0 ? halfLifeSec : DEFAULT_HALF_LIFE_SEC;
  const alpha = 1 - Math.exp(-dt / hl);
  return prev + alpha * (safeRaw - prev);
}

/**
 * Agrega linhas de contratos abertos por ativo canônico e usuário distinto.
 * - 1 usuário com N contratos UP conta 1 (não N).
 * - Usuário com UP e DOWN no mesmo ativo canônico conta 0.5 em cada lado.
 * - Símbolos legados/aliases são canonicalizados com resolveSymbol().
 * - Se sample_size < 5: bulls_pct = 50 e low_sample = true.
 */
export function aggregateRows(rows, resolveSymbol = (s) => s, k = DEFAULT_K) {
  const resolver = typeof resolveSymbol === 'function' ? resolveSymbol : (s) => s;
  const usersBySymbol = new Map();

  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || !row.symbol || !row.user_id) continue;
      const canonical = resolver(String(row.symbol).trim());
      if (!canonical) continue;

      const userId = String(row.user_id).trim();
      if (!userId) continue;

      const rowUp =
        typeof row.has_up === 'boolean'
          ? row.has_up
          : String(row.direction || '').toUpperCase() === 'UP';
      const rowDown =
        typeof row.has_down === 'boolean'
          ? row.has_down
          : String(row.direction || '').toUpperCase() === 'DOWN';

      if (!rowUp && !rowDown) continue;

      let symbolUsers = usersBySymbol.get(canonical);
      if (!symbolUsers) {
        symbolUsers = new Map();
        usersBySymbol.set(canonical, symbolUsers);
      }

      const prevUser = symbolUsers.get(userId);
      if (!prevUser) {
        symbolUsers.set(userId, { has_up: rowUp, has_down: rowDown });
      } else {
        prevUser.has_up = prevUser.has_up || rowUp;
        prevUser.has_down = prevUser.has_down || rowDown;
      }
    }
  }

  const result = new Map();

  for (const [symbol, symbolUsers] of usersBySymbol.entries()) {
    let up = 0;
    let down = 0;

    for (const flags of symbolUsers.values()) {
      if (flags.has_up && flags.has_down) {
        up += 0.5;
        down += 0.5;
      } else if (flags.has_up) {
        up += 1;
      } else if (flags.has_down) {
        down += 1;
      }
    }

    const sample_size = symbolUsers.size;
    const raw = computeRaw(up, down, k);
    const low_sample = sample_size < MIN_SAMPLE_SIZE;
    const bulls_pct = low_sample ? 50 : Math.round(raw);

    const entry = {
      symbol,
      up,
      down,
      sample_size,
      raw,
      bulls_pct,
      low_sample,
    };

    result.set(symbol, entry);
    result[symbol] = entry;
  }

  return result;
}

// Estado interno do serviço singleton
let serviceEnabled = false;
let activeTimer = null;
let inFlight = false;
let lastErrorLogAt = 0;
let lastSnapshotTs = null;
let currentResolveSymbol = (s) => s;
const snapshotBySymbol = new Map();
const emaBySymbol = new Map();

export function stopSentimentService() {
  if (activeTimer) {
    clearInterval(activeTimer);
    activeTimer = null;
  }
  serviceEnabled = false;
  inFlight = false;
  lastErrorLogAt = 0;
  lastSnapshotTs = null;
  snapshotBySymbol.clear();
  emaBySymbol.clear();
}

export function startSentimentService({
  pgPool,
  resolveSymbol = (s) => s,
  enabled,
  intervalMs = 5000,
  nowFn = () => Date.now(),
  logger = console,
} = {}) {
  stopSentimentService();

  currentResolveSymbol = typeof resolveSymbol === 'function' ? resolveSymbol : (s) => s;

  const isExplicitlyDisabled =
    enabled === false ||
    (enabled === undefined &&
      (process.env.SENTIMENT_ENABLED === 'false' || process.env.SENTIMENT_ENABLED === '0'));

  if (isExplicitlyDisabled) {
    serviceEnabled = false;
    return {
      enabled: false,
      pollOnce: async () => null,
      stop: stopSentimentService,
    };
  }

  serviceEnabled = true;
  const dtSec = Math.max(1, intervalMs / 1000);

  async function pollOnce() {
    if (!serviceEnabled) return null;
    if (inFlight) {
      // Proteção contra sobreposição: se a consulta anterior não terminou, pula este ciclo.
      return null;
    }
    if (!pgPool || typeof pgPool.query !== 'function') {
      return null;
    }

    inFlight = true;
    try {
      const res = await pgPool.query(SENTIMENT_QUERY_SQL);
      const rows = res && Array.isArray(res.rows) ? res.rows : [];
      const aggregated = aggregateRows(rows, currentResolveSymbol, DEFAULT_K);
      const nowMs = nowFn();
      const tsIso = new Date(nowMs).toISOString();

      const allSymbols = new Set([...emaBySymbol.keys(), ...aggregated.keys()]);

      for (const symbol of allSymbols) {
        const agg = aggregated.get(symbol);
        const sampleSize = agg ? agg.sample_size : 0;
        const raw = agg ? agg.raw : computeRaw(0, 0, DEFAULT_K);

        const prevEma = emaBySymbol.has(symbol) ? emaBySymbol.get(symbol) : null;
        const ema = nextEma(prevEma, raw, dtSec, DEFAULT_HALF_LIFE_SEC);
        emaBySymbol.set(symbol, ema);

        const lowSample = sampleSize < MIN_SAMPLE_SIZE;
        const bullsPct = lowSample ? 50 : Math.round(ema);

        snapshotBySymbol.set(symbol, {
          symbol,
          bulls_pct: bullsPct,
          sample_size: lowSample ? 0 : sampleSize,
          low_sample: lowSample,
          ts: tsIso,
        });
      }

      lastSnapshotTs = tsIso;
      return snapshotBySymbol;
    } catch (err) {
      // Mantém o último snapshot em memória; registra erro com throttle de 1x/min; nunca lança exceção.
      const nowMs = nowFn();
      if (nowMs - lastErrorLogAt >= ERROR_LOG_THROTTLE_MS) {
        lastErrorLogAt = nowMs;
        try {
          logger.error('[SentimentService] Falha na consulta de posições abertas:', err?.message || err);
        } catch {
          // Ignora falha de logger
        }
      }
      return null;
    } finally {
      inFlight = false;
    }
  }

  // Dispara primeira leitura assíncrona sem bloquear o boot
  void pollOnce();

  activeTimer = setInterval(() => {
    void pollOnce();
  }, intervalMs);

  if (activeTimer && typeof activeTimer.unref === 'function') {
    activeTimer.unref();
  }

  return {
    enabled: true,
    pollOnce,
    stop: stopSentimentService,
  };
}

/**
 * Lê apenas do snapshot em memória, sem tocar no banco.
 * Retorna null se o serviço estiver desligado.
 */
export function getSentiment(symbol) {
  if (!serviceEnabled) return null;
  if (!symbol || typeof symbol !== 'string') return null;

  const canonical = currentResolveSymbol(symbol.trim());
  if (!canonical) return null;

  const existing = snapshotBySymbol.get(canonical);
  if (existing) {
    return {
      symbol: existing.symbol,
      bulls_pct: existing.bulls_pct,
      sample_size: existing.low_sample ? 0 : existing.sample_size,
      low_sample: existing.low_sample,
      ts: existing.ts,
    };
  }

  return {
    symbol: canonical,
    bulls_pct: 50,
    sample_size: 0,
    low_sample: true,
    ts: lastSnapshotTs || new Date().toISOString(),
  };
}
