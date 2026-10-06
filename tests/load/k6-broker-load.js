import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up para 50 VUs
    { duration: '1m', target: 100 },  // Sustentação em 100 VUs simultâneos
    { duration: '30s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    // Critérios de Aceite Subfase 7 (Passo 7.5)
    http_req_duration: ['p(95)<5', 'p(99)<10'], // Latência p95 < 5ms, p99 < 10ms
    http_req_failed: ['rate<0.01'],             // Taxa de falha 5xx < 0.01%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Consulta metadados do ativo (Chart UDF)
  const symbolRes = http.get(`${BASE_URL}/api/v1/chart/symbols?symbol=SYNTH_VOL_50`);
  check(symbolRes, {
    'symbols status is 200': (r) => r.status === 200,
  });

  // 2. Consulta histórico de velas
  const to = Math.floor(Date.now() / 1000);
  const from = to - 300;
  const historyRes = http.get(`${BASE_URL}/api/v1/chart/history?symbol=SYNTH_VOL_50&resolution=1&from=${from}&to=${to}`);
  check(historyRes, {
    'history status is 200': (r) => r.status === 200,
  });

  // 3. Submissão de ordem UP/DOWN com Idempotency-Key
  const idempotencyKey = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const payload = JSON.stringify({
    symbol: 'SYNTH_VOL_50',
    direction: Math.random() > 0.5 ? 'UP' : 'DOWN',
    stake_minor: 1000, // US$ 10,00
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'Authorization': 'Bearer k6-test-token',
    },
  };

  const orderRes = http.post(`${BASE_URL}/api/v1/contracts`, payload, params);
  check(orderRes, {
    'order accepted or risk capped': (r) => r.status === 201 || r.status === 422,
  });

  sleep(1);
}
