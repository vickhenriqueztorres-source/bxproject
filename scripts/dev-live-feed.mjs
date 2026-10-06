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

// Catálogo com os 36 ativos e configurações decimais
const ASSETS_CONFIG = [
  // Forex OTC (18)
  { symbol: 'EURUSD_OTC', price: 1.08542, precision: 5, sigma: 0.00015 },
  { symbol: 'GBPUSD_OTC', price: 1.29415, precision: 5, sigma: 0.00015 },
  { symbol: 'USDJPY_OTC', price: 153.820, precision: 3, sigma: 0.00015 },
  { symbol: 'USDCHF_OTC', price: 0.86510, precision: 5, sigma: 0.00015 },
  { symbol: 'AUDUSD_OTC', price: 0.65820, precision: 5, sigma: 0.00015 },
  { symbol: 'USDCAD_OTC', price: 1.38450, precision: 5, sigma: 0.00015 },
  { symbol: 'NZDUSD_OTC', price: 0.59820, precision: 5, sigma: 0.00015 },
  { symbol: 'EURGBP_OTC', price: 0.83850, precision: 5, sigma: 0.00015 },
  { symbol: 'EURJPY_OTC', price: 166.950, precision: 3, sigma: 0.00015 },
  { symbol: 'GBPJPY_OTC', price: 199.120, precision: 3, sigma: 0.00015 },
  { symbol: 'EURCAD_OTC', price: 1.50280, precision: 5, sigma: 0.00015 },
  { symbol: 'EURAUD_OTC', price: 1.64890, precision: 5, sigma: 0.00015 },
  { symbol: 'GBPAUD_OTC', price: 1.96620, precision: 5, sigma: 0.00015 },
  { symbol: 'GBPCAD_OTC', price: 1.79210, precision: 5, sigma: 0.00015 },
  { symbol: 'AUDCAD_OTC', price: 0.91120, precision: 5, sigma: 0.00015 },
  { symbol: 'AUDJPY_OTC', price: 101.250, precision: 3, sigma: 0.00015 },
  { symbol: 'CADJPY_OTC', price: 111.120, precision: 3, sigma: 0.00015 },
  { symbol: 'NZDJPY_OTC', price: 92.050, precision: 3, sigma: 0.00015 },

  // Cripto OTC (8)
  { symbol: 'BTCUSD_OTC', price: 64850.00, precision: 2, sigma: 0.00035 },
  { symbol: 'ETHUSD_OTC', price: 3450.00, precision: 2, sigma: 0.00040 },
  { symbol: 'SOLUSD_OTC', price: 152.40, precision: 2, sigma: 0.00050 },
  { symbol: 'BNBUSD_OTC', price: 585.00, precision: 2, sigma: 0.00030 },
  { symbol: 'XRPUSD_OTC', price: 0.5420, precision: 4, sigma: 0.00045 },
  { symbol: 'ADAUSD_OTC', price: 0.3540, precision: 4, sigma: 0.00045 },
  { symbol: 'DOGEUSD_OTC', price: 0.1240, precision: 4, sigma: 0.00060 },
  { symbol: 'AVAXUSD_OTC', price: 28.40, precision: 2, sigma: 0.00050 },

  // Commodities OTC (4)
  { symbol: 'XAUUSD_OTC', price: 2652.80, precision: 2, sigma: 0.00020 },
  { symbol: 'XAGUSD_OTC', price: 31.750, precision: 3, sigma: 0.00025 },
  { symbol: 'USOIL_OTC', price: 72.40, precision: 2, sigma: 0.00030 },
  { symbol: 'UKOIL_OTC', price: 76.20, precision: 2, sigma: 0.00030 },

  // Sintéticos (6)
  { symbol: 'SYNTH_VOL_10', price: 100.5420, precision: 4, sigma: 0.00010 },
  { symbol: 'SYNTH_VOL_25', price: 250.8410, precision: 4, sigma: 0.00025 },
  { symbol: 'SYNTH_VOL_50', price: 500.1250, precision: 4, sigma: 0.00050 },
  { symbol: 'SYNTH_VOL_75', price: 750.3200, precision: 4, sigma: 0.00075 },
  { symbol: 'SYNTH_VOL_100', price: 1000.4500, precision: 4, sigma: 0.00100 },
  { symbol: 'SYNTH_CRASH_BOOM_100', price: 1000.8200, precision: 4, sigma: 0.00120 },
];

const generator = createPriceGenerator();

// Estado dos ativos em memória
const assetState = new Map();
for (const item of ASSETS_CONFIG) {
  const gHash = genesisHash(item.symbol);
  assetState.set(item.symbol, {
    symbol: item.symbol,
    currentPrice: item.price.toFixed(item.precision),
    precision: item.precision,
    sigma: item.sigma,
    sequence: 1,
    prevHash: gHash,
    subscribers: new Set(),
  });
}

// Servidor HTTP para handshake do WebSocket e Health Check
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'dev-live-feed',
      activeAssets: assetState.size,
      connectedClients: wss.clients.size,
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
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

        // Envia snapshot imediatamente para o gráfico inicializar
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

// Intervalo de geração estocástica de ticks a 1 tick por segundo (1Hz)
setInterval(() => {
  const ts = new Date().toISOString();

  for (const [symbol, state] of assetState.entries()) {
    // Gera próximo preço via CSPRNG Box-Muller Martingale (M-01, M-02)
    const nextPrice = generator(state.currentPrice, state.sigma, state.precision);
    const nextSeq = nextSequence(state.sequence);
    const hash = canonicalHash(state.prevHash, symbol, nextSeq, ts, nextPrice);

    state.currentPrice = nextPrice;
    state.sequence = nextSeq;
    state.prevHash = hash;

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
  console.log(`📡 [DevLiveFeed] WebSocket & REST Feed ativo em ws://${HOST}:${PORT}/ticks (36 ativos)`);
});
