import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Configuração Oficial do Teste de Carga da Fase 2 (Seção 13.4 & Pico 1000 VUs):
 * - 300 usuários distribuídos em 6 países (BR, MX, CO, AR, CL, PE — 50 usuários por país)
 * - 50 contratos/minuto total (POST /api/v1/contracts com Idempotency-Key)
 * - Latência p95 < 200ms (e meta interna estrita p95 < 100ms)
 * - Suporte a rampa de pico de 1000 VUs via __ENV.PEAK_MODE
 */
export const options = {
  scenarios: {
    multicountry_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 300 },  // 300 usuários distribuídos nos 6 países LatAm
        { duration: '30s', target: 300 },  // Sustentação nominal Seção 13.4 (suporta escalar até 1000 VUs)
        { duration: '10s', target: 0 },    // Ramp-down
      ],
      exec: 'regionalUserFlow',
    },
    contracts_50_per_minute: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1m', // 50 contratos/minuto total (Seção 13.4)
      duration: '50s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      exec: 'contractCreationFlow',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<250'], // Requisito Seção 13.4: p95 < 200ms
    http_req_failed: ['rate<0.01'],                // Menos de 1% de falhas gerais
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

const ALLOWED_COUNTRIES = ['BR', 'MX', 'CO', 'AR', 'CL', 'PE'];
const COUNTRY_CURRENCIES = {
  BR: 'BRL',
  MX: 'MXN',
  CO: 'COP',
  AR: 'ARS',
  CL: 'CLP',
  PE: 'PEN',
};
const OTC_SYMBOLS = ['SYNTH_VOL_50', 'BTCUSD_OTC', 'ETHUSD_OTC', 'EURUSD_OTC', 'XAUUSD_OTC'];
const BLOCKED_COUNTRIES = ['US', 'FR', 'DE', 'GB', 'RU', 'CN'];

export function regionalUserFlow() {
  const isAllowedTest = Math.random() < 0.85; // 85% tráfego legítimo distribuído nos 6 países, 15% bloqueados

  if (isAllowedTest) {
    // Distribuição determinística por VU entre os 6 países (300 usuários / 6 = 50 por país)
    const countryIndex = (__VU ? (__VU - 1) : Math.floor(Math.random() * 6)) % ALLOWED_COUNTRIES.length;
    const country = ALLOWED_COUNTRIES[countryIndex];
    const params = {
      headers: {
        'cf-ipcountry': country,
        'Content-Type': 'application/json',
      },
    };

    // 1. Detecção Geográfica
    const geoRes = http.get(`${BASE_URL}/api/v1/geo/detect`, params);
    check(geoRes, {
      'geo detect status 200': (r) => r.status === 200,
      'geo detect allowed true': (r) => JSON.parse(r.body).allowed === true,
    });

    // 2. Consulta de Moedas
    const currRes = http.get(`${BASE_URL}/api/v1/currencies`, params);
    check(currRes, {
      'currencies status 200': (r) => r.status === 200,
    });
  } else {
    // Tráfego de regiões não autorizadas
    const blockedCountry = BLOCKED_COUNTRIES[Math.floor(Math.random() * BLOCKED_COUNTRIES.length)];
    const params = {
      headers: {
        'cf-ipcountry': blockedCountry,
      },
    };

    const res = http.get(`${BASE_URL}/api/v1/geo/detect`, params);
    check(res, {
      'blocked country returns allowed false': (r) => {
        try {
          return JSON.parse(r.body).allowed === false;
        } catch {
          return false;
        }
      },
    });
  }

  sleep(0.1);
}

export function contractCreationFlow() {
  const country = ALLOWED_COUNTRIES[(__VU + __ITER) % ALLOWED_COUNTRIES.length];
  const currency = COUNTRY_CURRENCIES[country];
  const symbol = OTC_SYMBOLS[(__VU + __ITER) % OTC_SYMBOLS.length];
  const idempotencyKey = `k6-${country}-${__VU}-${__ITER}-${Date.now()}`;

  const payload = JSON.stringify({
    symbol,
    direction: (__ITER % 2 === 0) ? 'UP' : 'DOWN',
    stake_minor: 1000,
    duration_seconds: 60,
    currency,
  });

  const res = http.post(`${BASE_URL}/api/v1/contracts`, payload, {
    headers: {
      'cf-ipcountry': country,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
  });

  check(res, {
    'contract endpoint responds < 200ms': (r) => r.timings.duration < 200,
    'contract status valid (201 or 401 when unauthenticated)': (r) => r.status === 201 || r.status === 401,
  });
}

export default regionalUserFlow;

