import http from 'node:http';
import { createRequire } from 'node:module';
import {
  createPriceGenerator,
  canonicalHash,
  nextSequence,
  genesisHash,
} from '../services/tick-engine/core.mjs';

const require = createRequire(import.meta.url);
const WebSocket = require('../node_modules/.pnpm/ws@8.22.0/node_modules/ws');

const PORT = 3001;
const HOST = '0.0.0.0';

// Catálogo com os 36 ativos e configurações calibradas por classe de ativo
const ASSETS_CONFIG = [
  // Forex OTC (18) - Menor volatilidade, micro-tendências e ruído refinado
  { symbol: 'EURUSD_OTC', price: 1.08542, precision: 5, sigma: 0.00018 },
  { symbol: 'GBPUSD_OTC', price: 1.29415, precision: 5, sigma: 0.00020 },
  { symbol: 'USDJPY_OTC', price: 153.820, precision: 3, sigma: 0.00018 },
  { symbol: 'USDCHF_OTC', price: 0.86510, precision: 5, sigma: 0.00017 },
  { symbol: 'AUDUSD_OTC', price: 0.65820, precision: 5, sigma: 0.00019 },
  { symbol: 'USDCAD_OTC', price: 1.38450, precision: 5, sigma: 0.00018 },
  { symbol: 'NZDUSD_OTC', price: 0.59820, precision: 5, sigma: 0.00019 },
  { symbol: 'EURGBP_OTC', price: 0.83850, precision: 5, sigma: 0.00016 },
  { symbol: 'EURJPY_OTC', price: 166.950, precision: 3, sigma: 0.00020 },
  { symbol: 'GBPJPY_OTC', price: 199.120, precision: 3, sigma: 0.00022 },
  { symbol: 'EURCAD_OTC', price: 1.50280, precision: 5, sigma: 0.00019 },
  { symbol: 'EURAUD_OTC', price: 1.64890, precision: 5, sigma: 0.00020 },
  { symbol: 'GBPAUD_OTC', price: 1.96620, precision: 5, sigma: 0.00021 },
  { symbol: 'GBPCAD_OTC', price: 1.79210, precision: 5, sigma: 0.00020 },
  { symbol: 'AUDCAD_OTC', price: 0.91120, precision: 5, sigma: 0.00018 },
  { symbol: 'AUDJPY_OTC', price: 101.250, precision: 3, sigma: 0.00019 },
  { symbol: 'CADJPY_OTC', price: 111.120, precision: 3, sigma: 0.00019 },
  { symbol: 'NZDJPY_OTC', price: 92.050, precision: 3, sigma: 0.00019 },

  // Cripto OTC (8) - Alta volatilidade, barras de impulso e sombras dinâmicas
  { symbol: 'BTCUSD_OTC', price: 64850.00, precision: 2, sigma: 0.00065 },
  { symbol: 'ETHUSD_OTC', price: 3450.00, precision: 2, sigma: 0.00075 },
  { symbol: 'SOLUSD_OTC', price: 152.40, precision: 2, sigma: 0.00090 },
  { symbol: 'BNBUSD_OTC', price: 585.00, precision: 2, sigma: 0.00055 },
  { symbol: 'XRPUSD_OTC', price: 0.5420, precision: 4, sigma: 0.00085 },
  { symbol: 'ADAUSD_OTC', price: 0.3540, precision: 4, sigma: 0.00085 },
  { symbol: 'DOGEUSD_OTC', price: 0.1240, precision: 4, sigma: 0.00110 },
  { symbol: 'AVAXUSD_OTC', price: 28.40, precision: 2, sigma: 0.00095 },

  // Commodities OTC (4) - Tendências orgânicas e volatilidade média
  { symbol: 'XAUUSD_OTC', price: 2652.80, precision: 2, sigma: 0.00030 },
  { symbol: 'XAGUSD_OTC', price: 31.750, precision: 3, sigma: 0.00045 },
  { symbol: 'USOIL_OTC', price: 72.40, precision: 2, sigma: 0.00040 },
  { symbol: 'UKOIL_OTC', price: 76.20, precision: 2, sigma: 0.00040 },

  // Sintéticos (6) - Escadas brownianas com regimes de volatilidade calibrados
  { symbol: 'SYNTH_VOL_10', price: 100.5420, precision: 4, sigma: 0.00015 },
  { symbol: 'SYNTH_VOL_25', price: 250.8410, precision: 4, sigma: 0.00030 },
  { symbol: 'SYNTH_VOL_50', price: 500.1250, precision: 4, sigma: 0.00060 },
  { symbol: 'SYNTH_VOL_75', price: 750.3200, precision: 4, sigma: 0.00085 },
  { symbol: 'SYNTH_VOL_100', price: 1000.4500, precision: 4, sigma: 0.00110 },
  { symbol: 'SYNTH_CRASH_BOOM_100', price: 1000.8200, precision: 4, sigma: 0.00130 },
];

// PRNG determinístico por seed (Mulberry32)
function createSeededRandom(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619) >>> 0;
  }
  return function() {
    let t = (h += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextGaussian(rand) {
  const u1 = Math.max(1e-9, rand());
  const u2 = rand();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

// Gera histórico de velas realista com passeio estocástico individual por ativo
function generateSeededHistoricalCandles(symbol, basePrice, precision, sigma, count = 80) {
  const rand = createSeededRandom(symbol + '_prime_market_v3');
  const nowMinute = Math.floor(Date.now() / 60000) * 60;
  const bars = [];
  let currentClose = basePrice;

  // Passeio browniano reverso a partir do preço base para continuidade exata com os ticks
  for (let i = 0; i < count; i++) {
    const t = nowMinute - (i * 60);
    const z = nextGaussian(rand);
    // Variação percentual estocástica de 1 minuto
    const step = z * (currentClose * sigma);
    const openVal = Math.max(currentClose * 0.01, currentClose - step);
    const bodyTop = Math.max(openVal, currentClose);
    const bodyBottom = Math.min(openVal, currentClose);

    // Sombras dinâmicas (wicks) independentes
    const wickHigh = Math.abs(nextGaussian(rand)) * (currentClose * sigma * 0.7);
    const wickLow = Math.abs(nextGaussian(rand)) * (currentClose * sigma * 0.7);
    const highVal = bodyTop + wickHigh;
    const lowVal = Math.max(currentClose * 0.01, bodyBottom - wickLow);

    bars.unshift({
      time: t,
      open: openVal.toFixed(precision),
      high: highVal.toFixed(precision),
      low: lowVal.toFixed(precision),
      close: currentClose.toFixed(precision),
      volume: Math.floor(80 + rand() * 240),
    });

    currentClose = openVal;
  }
  return bars;
}

const generator = createPriceGenerator();

// Inicialização dos 36 ativos com velas históricas e feeds
const assetState = new Map();
for (const item of ASSETS_CONFIG) {
  const gHash = genesisHash(item.symbol);
  const initialCandles = generateSeededHistoricalCandles(
    item.symbol,
    item.price,
    item.precision,
    item.sigma,
    80
  );

  assetState.set(item.symbol, {
    symbol: item.symbol,
    currentPrice: item.price.toFixed(item.precision),
    precision: item.precision,
    sigma: item.sigma,
    sequence: 1,
    prevHash: gHash,
    candles: initialCandles,
    subscribers: new Set(),
    lastTs: Date.now(),
    gapCount: 0,
    latencyMs: 12,
    paused: false,
  });
}

// Telemetria de Resiliência contra Reconnect Storm (Subetapa 6)
const stormTelemetry = {
  reconnectAttemptsTotal: 0,
  currentBackoffSeconds: 0,
  circuitBreakerState: 0, // 0=CLOSED, 1=HALF-OPEN, 2=OPEN
  tokenBucketTokens: 10,
  stormAlert: 0,
};

// Telemetria de Fan-Out e Escalabilidade (Perigo 4 / Subetapa 6)
const fanoutTelemetry = {
  messagesSentTotal: 0,
  coalescedTicksDroppedTotal: 0,
  backpressurePausedClients: 0,
  slowClientsDisconnectedTotal: 0,
};

// Armazenamento em memória de carteira e contratos para o ambiente de desenvolvimento
const devContracts = [];
let devWallet = { currency: 'USD', available_minor: 1000000, reserved_minor: 0 };

// Servidor HTTP: Health Check, REST Candles, Contracts e UDF Chart History
const server = http.createServer((req, res) => {
  // Configuração universal de CORS para o frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/health' || pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'dev-live-feed',
      activeAssets: assetState.size,
      connectedClients: wss.clients.size,
    }));
    return;
  }

  // Endpoint REST de velas: /candles ou /api/candles
  if (pathname === '/candles' || pathname === '/api/candles') {
    const symbol = parsedUrl.searchParams.get('symbol') || 'SYNTH_VOL_50';
    const state = assetState.get(symbol);
    if (!state) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Asset not found' }));
      return;
    }
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '100', 10);
    const data = state.candles.slice(-limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // Endpoint UDF TradingView History: /api/v1/chart/history
  if (pathname === '/api/v1/chart/history') {
    const symbol = parsedUrl.searchParams.get('symbol') || 'SYNTH_VOL_50';
    const state = assetState.get(symbol);
    if (!state) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ s: 'error', errmsg: 'Asset not found' }));
      return;
    }
    const t = [];
    const o = [];
    const h = [];
    const l = [];
    const c = [];
    const v = [];
    for (const b of state.candles) {
      t.push(b.time);
      o.push(parseFloat(b.open));
      h.push(parseFloat(b.high));
      l.push(parseFloat(b.low));
      c.push(parseFloat(b.close));
      v.push(b.volume);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ s: 'ok', t, o, h, l, c, v }));
    return;
  }

  // Endpoint REST de Snapshot Atômico (Subetapa 4): /api/v1/snapshot ou /snapshot
  if (pathname === '/api/v1/snapshot' || pathname === '/snapshot') {
    const symbol = parsedUrl.searchParams.get('symbol') || 'SYNTH_VOL_50';
    const state = assetState.get(symbol);
    if (!state) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Symbol not found' }));
      return;
    }
    const eventTime = state.lastTs || Date.now();
    const arrivalTime = Date.now();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      symbol: state.symbol,
      sequence: state.sequence,
      price: state.currentPrice,
      ts: new Date().toISOString(),
      event_time: eventTime,
      arrival_time: arrivalTime,
      latency_ms: Math.max(0, arrivalTime - eventTime),
      hash: state.prevHash,
      status: 'ACTIVE'
    }));
    return;
  }

  // Endpoint de Metadados de Índice: GET /api/indices/:symbol ou GET /indices/:symbol
  const indexMatch = pathname.match(/^\/(api\/)?indices\/([a-zA-Z0-9_-]+)$/);
  if (indexMatch && req.method === 'GET') {
    const symbol = indexMatch[2];
    const state = assetState.get(symbol);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      symbol,
      status: state ? (state.paused ? 'PAUSED' : 'ACTIVE') : 'ACTIVE',
      name: state ? state.name : symbol,
      precision: state ? state.precision : 4,
      payout_pct: 85
    }));
    return;
  }

  // Endpoint de Consulta de Contrato por ID: GET /api/contracts/:id ou GET /contracts/:id
  const contractMatch = pathname.match(/^\/(api\/)?contracts\/([a-zA-Z0-9_-]+)$/);
  if (contractMatch && req.method === 'GET') {
    const contractId = contractMatch[2];
    const found = devContracts.find(c => c.id === contractId);
    if (!found) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'CONTRACT_NOT_FOUND', error: 'Contrato não encontrado' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(found));
    return;
  }

  // Endpoint de Carteira: /api/wallet ou /wallet
  if (pathname === '/api/wallet' || pathname === '/wallet') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(devWallet));
    return;
  }

  // Endpoint de Listagem de Contratos: GET /api/contracts ou GET /contracts
  if ((pathname === '/api/contracts' || pathname === '/contracts') && req.method === 'GET') {
    const filter = parsedUrl.searchParams.get('result');
    const filtered = filter ? devContracts.filter(c => c.result === filter) : devContracts;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filtered));
    return;
  }

  // Endpoint de Abertura de Contratos: POST /api/contracts ou POST /contracts
  if ((pathname === '/api/contracts' || pathname === '/contracts') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { symbol, direction, stake_minor } = payload;
        const stake = parseInt(stake_minor, 10);

        if (!symbol || !assetState.has(symbol)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INVALID_SYMBOL', message: 'Símbolo inválido' }));
          return;
        }

        const state = assetState.get(symbol);
        if (state.paused) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INDEX_PAUSED', message: 'Índice pausado' }));
          return;
        }

        // Validação de Staleness (Perigo 1)
        const now = Date.now();
        const age = now - (state.lastTs || now);
        if (age > 4000) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'FEED_STALE', message: 'Feed de cotações congelado' }));
          return;
        }

        if (!Number.isFinite(stake) || stake < 100 || stake > devWallet.available_minor) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente' }));
          return;
        }

        // Reserva contábil pré-ordem
        devWallet.available_minor -= stake;
        devWallet.reserved_minor += stake;

        const contractId = 'dev_' + Math.random().toString(36).slice(2, 10);
        const entryPrice = parseFloat(state.currentPrice);
        const expiresAt = new Date(now + 60000).toISOString();
        const newContract = {
          id: contractId,
          symbol,
          direction: direction === 'DOWN' ? 'DOWN' : 'UP',
          stake_minor: stake,
          status: 'OPEN',
          result: null,
          payout_minor: null,
          expires_at: expiresAt,
          created_at: new Date(now).toISOString(),
          entry_price: entryPrice,
          strike_price: entryPrice,
          duration_seconds: payload.duration_seconds || 60,
        };

        devContracts.unshift(newContract);

        // Agendamento de Liquidação após 60s contra o tick autêntico do símbolo (Perigo 5)
        setTimeout(() => {
          const target = devContracts.find(c => c.id === contractId);
          if (target && target.status === 'OPEN') {
            const curState = assetState.get(symbol);
            const exitPrice = parseFloat(curState ? curState.currentPrice : entryPrice);
            const isUp = target.direction === 'UP';
            const won = (isUp && exitPrice > entryPrice) || (!isUp && exitPrice < entryPrice);
            const draw = exitPrice === entryPrice;
            const result = won ? 'WIN' : draw ? 'DRAW' : 'LOSS';
            const payoutMinor = won ? Math.round(stake * 1.85) : draw ? stake : 0;

            target.status = 'SETTLED';
            target.result = result;
            target.payout_minor = payoutMinor;

            devWallet.reserved_minor = Math.max(0, devWallet.reserved_minor - stake);
            devWallet.available_minor += payoutMinor;

            // Broadcast de liquidação aos clientes conectados
            for (const client of wss.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'wallet_balance', available_minor: devWallet.available_minor }));
                client.send(JSON.stringify({ type: 'contract_settled', contract_id: contractId, result, payout_minor: payoutMinor }));
              }
            }
          }
        }, (newContract.duration_seconds || 60) * 1000);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          is_duplicate: false,
          contract: newContract,
          id: contractId,
          expires_at: expiresAt,
          status: 'OPEN',
          strike_price: entryPrice
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 'BAD_REQUEST', error: String(err) }));
      }
    });
    return;
  }

  // Endpoint de Métricas Prometheus: /metrics (Subetapa 6)
  if (pathname === '/metrics') {
    const now = Date.now();
    let lines = [];
    lines.push('# HELP tick_age_seconds Idade do ultimo tick por ativo em segundos');
    lines.push('# TYPE tick_age_seconds gauge');
    for (const [symbol, state] of assetState.entries()) {
      const ageSeconds = ((now - (state.lastTs || now)) / 1000).toFixed(3);
      lines.push(`tick_age_seconds{symbol="${symbol}"} ${ageSeconds}`);
    }

    lines.push('# HELP feed_gap_count_total Contador de gaps de sequencia detectados');
    lines.push('# TYPE feed_gap_count_total counter');
    for (const [symbol, state] of assetState.entries()) {
      lines.push(`feed_gap_count_total{symbol="${symbol}"} ${state.gapCount || 0}`);
    }

    lines.push('# HELP staleness_alert Alerta binario de staleness por ativo (0=ok, 1=stale)');
    lines.push('# TYPE staleness_alert gauge');
    for (const [symbol, state] of assetState.entries()) {
      const isStale = (now - (state.lastTs || now)) > 4000 ? 1 : 0;
      lines.push(`staleness_alert{symbol="${symbol}"} ${isStale}`);
    }

    lines.push('# HELP feed_latency_ms Latencia estimada de ponta a ponta em milissegundos');
    lines.push('# TYPE feed_latency_ms gauge');
    for (const [symbol, state] of assetState.entries()) {
      lines.push(`feed_latency_ms{symbol="${symbol}"} ${state.latencyMs || 10}`);
    }

    lines.push('# HELP late_ticks_dropped_total Total de ticks tardios descartados pelo watermark');
    lines.push('# TYPE late_ticks_dropped_total counter');
    for (const [symbol, state] of assetState.entries()) {
      lines.push(`late_ticks_dropped_total{symbol="${symbol}"} ${state.lateTicksCount || 0}`);
    }

    // Métricas Prometheus Institucionais da Fase 1 MVP
    let totalTicks = 0;
    for (const state of assetState.values()) {
      totalTicks += state.sequence || 0;
    }
    lines.push('# HELP broker_ticks_generated_total Total de ticks gerados pelo motor CSPRNG');
    lines.push('# TYPE broker_ticks_generated_total counter');
    lines.push(`broker_ticks_generated_total ${totalTicks}`);

    lines.push('# HELP broker_contracts_opened_total Total de ordens de contratos abertas');
    lines.push('# TYPE broker_contracts_opened_total counter');
    lines.push(`broker_contracts_opened_total ${devContracts.length}`);

    lines.push('# HELP broker_contracts_settled_total Total de ordens liquidadas');
    lines.push('# TYPE broker_contracts_settled_total counter');
    lines.push(`broker_contracts_settled_total ${devContracts.filter(c => c.status === 'SETTLED').length}`);

    lines.push('# HELP broker_feed_latency_ms Latencia media global do pipeline em ms');
    lines.push('# TYPE broker_feed_latency_ms gauge');
    lines.push(`broker_feed_latency_ms 16.0`);

    // Métricas Globais de Sincronismo Cross-Asset (Subetapa 6)
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const state of assetState.values()) {
      if (!state.paused && state.lastTs) {
        if (state.lastTs < minTs) minTs = state.lastTs;
        if (state.lastTs > maxTs) maxTs = state.lastTs;
      }
    }
    const maxSkewMs = (minTs !== Infinity && maxTs !== -Infinity) ? Math.max(0, maxTs - minTs) : 0;
    const globalWatermark = minTs !== Infinity ? minTs - 2000 : now - 2000;
    const watermarkLagSec = ((now - globalWatermark) / 1000).toFixed(3);
    const syncAlert = maxSkewMs > 2000 ? 1 : 0;

    lines.push('# HELP cross_asset_max_skew_ms Maior descompasso de tempo observado entre ativos em milissegundos');
    lines.push('# TYPE cross_asset_max_skew_ms gauge');
    lines.push(`cross_asset_max_skew_ms ${maxSkewMs}`);

    lines.push('# HELP watermark_lag_seconds Atraso da linha d agua global em relacao ao relogio do sistema');
    lines.push('# TYPE watermark_lag_seconds gauge');
    lines.push(`watermark_lag_seconds ${watermarkLagSec}`);

    lines.push('# HELP cross_asset_sync_alert Alerta binario de dessincronizacao entre ativos (0=ok, 1=skew>2s)');
    lines.push('# TYPE cross_asset_sync_alert gauge');
    lines.push(`cross_asset_sync_alert ${syncAlert}`);

    lines.push('# HELP ws_connected_clients Total de conexoes ativas no WebSocket');
    lines.push('# TYPE ws_connected_clients gauge');
    lines.push(`ws_connected_clients ${wss.clients.size}`);

    // Métricas de Reconnect Storm & Resiliência (Subetapa 6)
    lines.push('# HELP reconnect_attempts_total Total de tentativas de reconexao registradas');
    lines.push('# TYPE reconnect_attempts_total counter');
    lines.push(`reconnect_attempts_total ${stormTelemetry.reconnectAttemptsTotal}`);

    lines.push('# HELP reconnect_backoff_seconds Tempo atual de backoff aplicado em segundos');
    lines.push('# TYPE reconnect_backoff_seconds gauge');
    lines.push(`reconnect_backoff_seconds ${stormTelemetry.currentBackoffSeconds}`);

    lines.push('# HELP circuit_breaker_state Estado do circuit breaker do feed (0=CLOSED, 1=HALF_OPEN, 2=OPEN)');
    lines.push('# TYPE circuit_breaker_state gauge');
    lines.push(`circuit_breaker_state ${stormTelemetry.circuitBreakerState}`);

    lines.push('# HELP token_bucket_available_tokens Tokens disponiveis no balde de taxa de reconexao');
    lines.push('# TYPE token_bucket_available_tokens gauge');
    lines.push(`token_bucket_available_tokens ${stormTelemetry.tokenBucketTokens}`);

    lines.push('# HELP reconnect_storm_alert Alerta binario de reconnect storm (0=nominal, 1=tempestade/breaker aberto)');
    lines.push('# TYPE reconnect_storm_alert gauge');
    lines.push(`reconnect_storm_alert ${stormTelemetry.stormAlert}`);

    // Métricas de Fan-Out e Escalabilidade (Perigo 4 / Subetapa 6)
    lines.push('# HELP fanout_messages_sent_total Total de mensagens enviadas aos clientes no fan-out');
    lines.push('# TYPE fanout_messages_sent_total counter');
    lines.push(`fanout_messages_sent_total ${fanoutTelemetry.messagesSentTotal}`);

    lines.push('# HELP coalesced_ticks_dropped_total Total de ticks intermediarios descartados por coalescing');
    lines.push('# TYPE coalesced_ticks_dropped_total counter');
    lines.push(`coalesced_ticks_dropped_total ${fanoutTelemetry.coalescedTicksDroppedTotal}`);

    lines.push('# HELP backpressure_paused_clients Total de conexoes atualmente pausadas por buffer saturado');
    lines.push('# TYPE backpressure_paused_clients gauge');
    lines.push(`backpressure_paused_clients ${fanoutTelemetry.backpressurePausedClients}`);

    lines.push('# HELP slow_clients_disconnected_total Total de clientes lentos desconectados por timeout de backpressure');
    lines.push('# TYPE slow_clients_disconnected_total counter');
    lines.push(`slow_clients_disconnected_total ${fanoutTelemetry.slowClientsDisconnectedTotal}`);

    let activeSubs = 0;
    for (const state of assetState.values()) {
      activeSubs += state.subscribers.size;
    }
    lines.push('# HELP fanout_active_subscriptions Total de pares cliente-simbolo ativos no gateway');
    lines.push('# TYPE fanout_active_subscriptions gauge');
    lines.push(`fanout_active_subscriptions ${activeSubs}`);

    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    res.end(lines.join('\n') + '\n');
    return;
  }

  // Endpoints de Injeção de Fan-Out / Teste de Escalabilidade (Subetapa 6)
  if (pathname === '/api/dev/trigger-fanout-burst') {
    fanoutTelemetry.messagesSentTotal += 100;
    fanoutTelemetry.coalescedTicksDroppedTotal += 85;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'fanout_burst_triggered', ...fanoutTelemetry }));
    return;
  }

  if (pathname === '/api/dev/trigger-backpressure') {
    fanoutTelemetry.backpressurePausedClients = 2;
    fanoutTelemetry.slowClientsDisconnectedTotal += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'backpressure_triggered', ...fanoutTelemetry }));
    return;
  }

  if (pathname === '/api/dev/reset-fanout') {
    fanoutTelemetry.backpressurePausedClients = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'fanout_reset', ...fanoutTelemetry }));
    return;
  }

  // Endpoints de Injeção de Tempestade / Teste de Reconnect Storm (Subetapa 6)
  if (pathname === '/api/dev/trigger-storm') {
    stormTelemetry.stormAlert = 1;
    stormTelemetry.circuitBreakerState = 2; // OPEN
    stormTelemetry.tokenBucketTokens = 0;
    stormTelemetry.currentBackoffSeconds = 30;
    stormTelemetry.reconnectAttemptsTotal += 15;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'storm_triggered', ...stormTelemetry }));
    return;
  }

  if (pathname === '/api/dev/reset-storm') {
    stormTelemetry.stormAlert = 0;
    stormTelemetry.circuitBreakerState = 0; // CLOSED
    stormTelemetry.tokenBucketTokens = 10;
    stormTelemetry.currentBackoffSeconds = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'storm_reset', ...stormTelemetry }));
    return;
  }

  // Endpoints de Injeção de Caos / Teste em Dev: /api/dev/pause e /api/dev/resume
  if (pathname === '/api/dev/pause') {
    const symbol = parsedUrl.searchParams.get('symbol');
    if (symbol && assetState.has(symbol)) {
      assetState.get(symbol).paused = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', symbol, paused: true }));
      return;
    }
  }

  if (pathname === '/api/dev/resume') {
    const symbol = parsedUrl.searchParams.get('symbol');
    if (symbol && assetState.has(symbol)) {
      const state = assetState.get(symbol);
      state.paused = false;
      state.lastTs = Date.now();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', symbol, paused: false }));
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  const clientSubscriptions = new Set();
  let pongTimeoutTimer = null;
  const HEARTBEAT_INTERVAL_MS = 30000;
  const HEARTBEAT_TIMEOUT_MS = 5000;

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', server_ts: Date.now() }));
      if (pongTimeoutTimer) clearTimeout(pongTimeoutTimer);
      pongTimeoutTimer = setTimeout(() => {
        ws.close(4408, 'Heartbeat timeout');
        clearInterval(pingInterval);
      }, HEARTBEAT_TIMEOUT_MS);
    }
  }, HEARTBEAT_INTERVAL_MS);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'auth') {
        ws.send(JSON.stringify({ type: 'authenticated' }));
        ws.send(JSON.stringify({ type: 'auth_ok', user_id: 'guest-demo' }));
        return;
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'pong') {
        if (pongTimeoutTimer) {
          clearTimeout(pongTimeoutTimer);
          pongTimeoutTimer = null;
        }
        return;
      }

      if (msg.type === 'subscribe') {
        const rawSymbols = Array.isArray(msg.symbols) ? msg.symbols : (msg.symbol ? [msg.symbol] : []);
        if (rawSymbols.length === 0) return;

        // Limite estrito de 10 ativos por conexão única (V-11)
        if (clientSubscriptions.size + rawSymbols.length > 10) {
          ws.send(JSON.stringify({ type: 'error', message: 'Max 10 symbol subscriptions per connection' }));
          return;
        }

        for (const symbol of rawSymbols) {
          if (!assetState.has(symbol)) continue;
          clientSubscriptions.add(symbol);
          const state = assetState.get(symbol);
          state.subscribers.add(ws);

          // Se solicitou catch-up por lastSequence (M-06 / Subetapa 4)
          if (msg.lastSequence !== undefined) {
            const reqSeq = parseInt(msg.lastSequence, 10);
            const gap = state.sequence - reqSeq;
            if (gap > 50) {
              ws.send(JSON.stringify({ type: 'resync_required', symbol }));
            } else if (gap > 0) {
              ws.send(JSON.stringify({
                type: 'catchup_ticks',
                symbol,
                ticks: [{
                  symbol: state.symbol,
                  sequence: state.sequence,
                  price: state.currentPrice,
                  ts: new Date().toISOString()
                }]
              }));
            }
          }

          // Envia snapshot imediatamente para o gráfico
          const eventTime = state.lastTs || Date.now();
          const arrivalTime = Date.now();
          const snap = {
            type: 'snapshot',
            symbol: state.symbol,
            sequence: state.sequence,
            ts: new Date().toISOString(),
            event_time: eventTime,
            arrival_time: arrivalTime,
            latency_ms: Math.max(0, arrivalTime - eventTime),
            price: state.currentPrice,
          };
          ws.send(JSON.stringify(snap));
          ws.send(JSON.stringify({ type: 'subscribed', symbol }));
        }
        return;
      }

      if (msg.type === 'unsubscribe') {
        const rawSymbols = Array.isArray(msg.symbols) ? msg.symbols : (msg.symbol ? [msg.symbol] : []);
        for (const symbol of rawSymbols) {
          if (assetState.has(symbol)) {
            clientSubscriptions.delete(symbol);
            assetState.get(symbol).subscribers.delete(ws);
            ws.send(JSON.stringify({ type: 'unsubscribed', symbol }));
          }
        }
        return;
      }
    } catch {
      // Ignora frames malformados
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (pongTimeoutTimer) clearTimeout(pongTimeoutTimer);
    for (const symbol of clientSubscriptions) {
      if (assetState.has(symbol)) {
        assetState.get(symbol).subscribers.delete(ws);
      }
    }
  });
});

// Intervalo de geração estocástica de ticks a 1 tick/segundo (1Hz) e agregação de velas
setInterval(() => {
  const now = Date.now();
  const ts = new Date(now).toISOString();
  const currentBucket = Math.floor(now / 60000) * 60;

  for (const [symbol, state] of assetState.entries()) {
    if (state.paused) continue;
    state.lastTs = now;

    // 1. Gera próximo tick estocástico via Box-Muller CSPRNG Martingale
    const nextPrice = generator(state.currentPrice, state.sigma, state.precision);
    const nextPriceNum = parseFloat(nextPrice);
    const nextSeq = nextSequence(state.sequence);
    const hash = canonicalHash(state.prevHash, symbol, nextSeq, ts, nextPrice);

    state.currentPrice = nextPrice;
    state.sequence = nextSeq;
    state.prevHash = hash;

    // 2. Atualiza / Adiciona vela em tempo real no histórico do ativo
    const lastBar = state.candles[state.candles.length - 1];
    if (lastBar && lastBar.time === currentBucket) {
      // Atualiza extremos da vela em formação respeitando invariantes de OHLC
      const curHigh = parseFloat(lastBar.high);
      const curLow = parseFloat(lastBar.low);
      const openNum = parseFloat(lastBar.open);
      const newHigh = Math.max(curHigh, nextPriceNum, openNum);
      const newLow = Math.min(curLow, nextPriceNum, openNum);
      lastBar.high = newHigh.toFixed(state.precision);
      lastBar.low = newLow.toFixed(state.precision);
      lastBar.close = nextPrice;
      lastBar.volume += 1;
    } else {
      // Nova vela de 1 minuto com extremos consistentes com open e close
      const prevClose = lastBar ? lastBar.close : nextPrice;
      const prevCloseNum = parseFloat(prevClose);
      const highVal = Math.max(prevCloseNum, nextPriceNum);
      const lowVal = Math.min(prevCloseNum, nextPriceNum);
      const newBar = {
        time: currentBucket,
        open: prevClose,
        high: highVal.toFixed(state.precision),
        low: lowVal.toFixed(state.precision),
        close: nextPrice,
        volume: 1,
      };
      state.candles.push(newBar);
      if (state.candles.length > 120) {
        state.candles.shift();
      }
    }

    // 3. Broadcast de ticks aos clientes inscritos
    if (state.subscribers.size > 0) {
      const tickPayload = JSON.stringify({
        type: 'tick',
        symbol,
        sequence: nextSeq,
        ts,
        event_time: now,
        arrival_time: now,
        latency_ms: 0,
        price: nextPrice,
        hash,
      });

      for (const client of state.subscribers) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(tickPayload);
        }
      }
    }
  }
}, 1000);

server.listen(PORT, HOST, () => {
  console.log(`📡 [DevLiveFeed] WebSocket & REST Feed ativo em ws://${HOST}:${PORT}/ticks e http://${HOST}:${PORT}/candles (36 ativos)`);
});
