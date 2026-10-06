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
  });
}

// Servidor HTTP: Health Check, REST Candles e UDF Chart History
const server = http.createServer((req, res) => {
  // Configuração universal de CORS para o frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  const clientSubscriptions = new Set();

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

      if (msg.type === 'subscribe') {
        const symbol = msg.symbol;
        if (!symbol || !assetState.has(symbol)) return;

        clientSubscriptions.add(symbol);
        const state = assetState.get(symbol);
        state.subscribers.add(ws);

        // Envia snapshot imediatamente para o gráfico
        const snap = {
          type: 'snapshot',
          symbol: state.symbol,
          sequence: state.sequence,
          ts: new Date().toISOString(),
          price: state.currentPrice,
        };
        ws.send(JSON.stringify(snap));
        ws.send(JSON.stringify({ type: 'subscribed', symbol }));
        return;
      }

      if (msg.type === 'unsubscribe') {
        const symbol = msg.symbol;
        if (symbol && assetState.has(symbol)) {
          clientSubscriptions.delete(symbol);
          assetState.get(symbol).subscribers.delete(ws);
          ws.send(JSON.stringify({ type: 'unsubscribed', symbol }));
        }
      }
    } catch {
      // Ignora frames malformados
    }
  });

  ws.on('close', () => {
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
      // Atualiza extremos da vela em formação
      const curHigh = parseFloat(lastBar.high);
      const curLow = parseFloat(lastBar.low);
      if (nextPriceNum > curHigh) lastBar.high = nextPrice;
      if (nextPriceNum < curLow) lastBar.low = nextPrice;
      lastBar.close = nextPrice;
      lastBar.volume += 1;
    } else {
      // Nova vela de 1 minuto
      const prevClose = lastBar ? lastBar.close : nextPrice;
      const newBar = {
        time: currentBucket,
        open: prevClose,
        high: nextPrice,
        low: nextPrice,
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
