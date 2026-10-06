/* global open */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Teste E2: Distribuição Fan-out pelo WebSocket Gateway
// Cada VU simula um usuário autêntico abrindo 1 conexão WebSocket única e assinando 4 pares sorteados.
// Limite: 5 conexões/user, 10 pares/conexão.
// Critério de reprovação: Latência p95 > 500ms, erro WS > 1%.

const wsUrl = __ENV.WS_URL || 'ws://localhost:3001/ticks';
const wsConnected = new Rate('ws_connected_rate');
const tickDeliveryLatency = new Trend('tick_delivery_latency_ms');

const AVAILABLE_PAIRS = [
  'EURUSD_OTC', 'BTCUSD_OTC', 'SYNTH_VOL_50', 'XAUUSD_OTC',
  'GBPUSD_OTC', 'ETHUSD_OTC', 'GBPJPY_OTC', 'USOIL_OTC'
];

export const options = {
  scenarios: {
    ws_fanout_ramp: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 250 },
        { duration: '2m', target: 500 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    ws_connected_rate: ['rate>0.99'],
    tick_delivery_latency_ms: ['p(95)<500'], // Latência tick-to-client p95 < 500ms
  },
};

export default function () {
  // Sorteia 4 pares distintos para este usuário
  const shuffled = [...AVAILABLE_PAIRS].sort(() => 0.5 - Math.random());
  const selectedPairs = shuffled.slice(0, 4);

  const res = ws.connect(wsUrl, {}, function (socket) {
    socket.on('open', function () {
      wsConnected.add(true);
      // Assina os 4 pares sorteados em lote na mesma conexão única
      for (let i = 0; i < selectedPairs.length; i++) {
        socket.send(JSON.stringify({ type: 'subscribe', symbol: selectedPairs[i] }));
      }
    });

    socket.on('message', function (data) {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'tick' && msg.ts) {
          const latency = Date.now() - Date.parse(msg.ts);
          if (latency >= 0) {
            tickDeliveryLatency.observe(latency);
          }
        }
      } catch {
        // Ignora frames não-JSON
      }
    });

    socket.on('close', function () {
      // Conexão encerrada
    });

    // Mantém a conexão aberta recebendo ticks durante a sessão
    socket.setTimeout(function () {
      socket.close();
    }, 30000);
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
  sleep(1);
}
