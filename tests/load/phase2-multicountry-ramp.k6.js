import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuração do Teste de Carga da Fase 2 (1.000 VUs)
export const options = {
  stages: [
    { duration: '10s', target: 200 },   // Ramp-up rápido
    { duration: '30s', target: 1000 },  // Carga máxima: 1.000 VUs
    { duration: '15s', target: 1000 },  // Sustentação
    { duration: '10s', target: 0 },     // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<250'], // Latência p95 < 100ms
    http_req_failed: ['rate<0.01'],                // Menos de 1% de falhas gerais
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

const ALLOWED_COUNTRIES = ['BR', 'MX', 'CO', 'AR', 'CL', 'PE'];
const BLOCKED_COUNTRIES = ['US', 'FR', 'DE', 'GB', 'RU', 'CN'];

export default function () {
  const isAllowedTest = Math.random() < 0.8; // 80% tráfego legítimo dos 6 países, 20% bloqueados

  if (isAllowedTest) {
    const country = ALLOWED_COUNTRIES[Math.floor(Math.random() * ALLOWED_COUNTRIES.length)];
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
