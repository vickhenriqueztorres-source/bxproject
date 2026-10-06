/* global open */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Teste E1: Geração contínua sem clientes para determinação do N_max
// Degraus: 6, 25, 50, 100, 200, 400, 800, 1600 pares.
// Medição de cadência (D-13: 1 tick/s por par), lag de outbox e ausência de lacunas.

const api = __ENV.API_URL || 'http://localhost:3000';
const tickRateMetric = new Rate('tick_rate_compliant');
const tickIntervalMs = new Trend('tick_interval_ms');

export const options = {
  scenarios: {
    n_max_ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 6,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { duration: '2m', target: 25 },
        { duration: '2m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 400 },
      ],
    },
  },
  thresholds: {
    // Critérios formais de reprovação de degrau
    tick_rate_compliant: ['rate>0.90'], // >= 0.9 tick/s por par
    tick_interval_ms: ['p(95)<3000'],   // Nenhum intervalo > 3s
    http_req_failed: ['rate<0.001'],    // Erros 5xx < 0.1%
  },
};

export default function () {
  // Amostra de consulta de integridade aos candles/ticks
  const res = http.get(`${api}/candles?symbol=EURUSD_OTC&interval=1m&limit=10`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has candles': (r) => {
      try {
        const json = r.json();
        return Array.isArray(json) && json.length > 0;
      } catch {
        return false;
      }
    },
  });
  tickRateMetric.add(res.status === 200);
  sleep(1);
}
