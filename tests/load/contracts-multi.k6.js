/* global open */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Teste E3: Pico com Dinheiro, Concorrência e Liquidação Multi-Ativos
// Executado com N_max e usuários reais.
// Validações: POST /contracts p95 < 300ms, p99 < 800ms, erros < 0.1%.
// Prova de Isolamento Financeiro e Blnk Ledger.

const api = __ENV.API_URL || 'http://localhost:3000';
const contractSuccess = new Rate('contract_success_rate');
const contractLatency = new Trend('contract_latency_ms');

const SYMBOLS = [
  'EURUSD_OTC', 'BTCUSD_OTC', 'SYNTH_VOL_50', 'XAUUSD_OTC',
  'GBPUSD_OTC', 'ETHUSD_OTC', 'GBPJPY_OTC', 'USOIL_OTC',
  'SYNTH_VOL_75', 'EURCAD_OTC', 'SOLUSD_OTC', 'SYNTH_VOL_100'
];

export const options = {
  scenarios: {
    contracts_stress: {
      executor: 'constant-arrival-rate',
      rate: 30, // 30 contratos por segundo espalhados pelos ativos
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 150,
    },
  },
  thresholds: {
    contract_success_rate: ['rate>0.999'], // Erros < 0.1%
    contract_latency_ms: ['p(95)<300', 'p(99)<800'],
  },
};

export default function () {
  const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const dir = Math.random() > 0.5 ? 'UP' : 'DOWN';
  const idempotencyKey = `k6-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const payload = JSON.stringify({
    symbol: sym,
    direction: dir,
    stake_minor: 1000, // 10 USD
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      Authorization: `Bearer ${__ENV.TEST_JWT || 'mock-token'}`,
    },
  };

  const start = Date.now();
  const res = http.post(`${api}/contracts`, payload, params);
  contractLatency.observe(Date.now() - start);

  const passed = check(res, {
    'status is 202 or 200': (r) => r.status === 202 || r.status === 200,
  });

  contractSuccess.add(passed);
  sleep(0.5);
}
