# Expected output 2 — T18 carga em staging

## Deve aparecer

```js
// tests/load/contracts-and-ws.k6.js
import http from 'k6/http'
import ws from 'k6/ws'
import { check } from 'k6'
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'
import { assertNotProduction, syntheticUsers } from './support.js'

assertNotProduction(__ENV.TARGET_ENV, __ENV.API_URL)          // QA-10: aborta se for produção

export const options = {
  scenarios: {
    feed:      { executor: 'constant-vus', vus: 300, duration: '10m', exec: 'feed' },
    contracts: { executor: 'constant-arrival-rate', rate: 50, timeUnit: '1m', duration: '10m', preAllocatedVUs: 20, exec: 'open' },
  },
  thresholds: {
    'http_req_duration{name:POST /contracts}': ['p(95)<200', 'p(99)<800'],   // 200 = §10.4; 800 = PROPOSTO
    'http_req_failed{name:POST /contracts}': ['rate<0.001'],                  // PROPOSTO; 409 conta como erro
    checks: ['rate>0.999'],
  },
}

export function setup() { return { users: syntheticUsers(320) } }   // um usuário por VU, nunca token único

export function open({ users }) {
  const u = users[__VU % users.length]
  const r = http.post(`${__ENV.API_URL}/contracts`,
    JSON.stringify({ symbol: __ENV.SYMBOL, direction: 'UP', stake_minor: '100' }),
    { headers: { Authorization: `Bearer ${u.token}`, 'Idempotency-Key': uuidv4(), 'Content-Type': 'application/json' },
      tags: { name: 'POST /contracts' } })
  check(r, { '201': (x) => x.status === 201 })
}

export function feed({ users }) { /* auth na 1ª mensagem, subscribe, mede atraso tick → cliente */ }

export function teardown() { /* chama /qa/assertions: settlements duplicados = 0, divergências = 0, ticks sem lacuna */ }
```

## Saída esperada

```yaml
task_id: T18
agent: qa-resilience-agent
status: DONE
summary: >
  Carga executada em staging, não em produção (QA-10). 300 WebSockets e 50 contratos/min por 10 min
  com 320 usuários sintéticos e Idempotency-Key única por request; 409 contado como erro. "Rápida"
  reescrita como p95 < 200 ms (§10.4), divergente dos 300 ms PROPOSTOS da skill 06. Checagem de
  correção no teardown. Resultado conforme as métricas medidas.
artifacts:
  - tests/load/contracts-and-ws.k6.js
  - tests/load/support.js
  - tests/acceptance/AC-T18.md
evidence:
  - TARGET_ENV=staging k6 run tests/load/contracts-and-ws.k6.js → <thresholds medidos>
  - teardown → settlements duplicados 0; divergências da reconciliação 0; ticks 600/600 sem lacuna
  - bash agents/qa-resilience-agent/scripts/health-check.sh → 0 FAIL
acceptance_criteria_met:
  - { criterion: "AC-T18-1 — 300 WS e 50 contratos/min por 10 min sem erro acima de 0,1%", met: <medido>, evidence: "k6 thresholds" }
  - { criterion: "AC-T18-2 — POST /contracts p95 < 200 ms", met: <medido>, evidence: "k6 http_req_duration" }
  - { criterion: "AC-T18-3 — zero settlement duplicado e zero divergência", met: <medido>, evidence: "teardown" }
confidence_score: 0.9
test_results:
  load: { passed: <n>, failed: <n>, thresholds: ["POST /contracts p95: <medido> / 200", "erro: <medido> / 0.001"] }
rules_covered: [I-03, I-05, M-02, M-06, Q-04]
coverage_gaps:
  - nenhuma
defects: []
verdict: <APROVADO se todos os thresholds e checagens passaram>
decisions_cited: [D-13, Q-04, QA-09, QA-10, QA-13]
pending:
  - Usuários simultâneos alvo <não definido no contexto>
  - Divergência de SLO §10.4 (200 ms) × skill 06 PROPOSTO (300 ms) para decisão do orquestrador
  - Limites PROPOSTOS (p99 < 800 ms, erro < 0,1%) aguardando confirmação
```

## Não deve aparecer

- Qualquer execução ou URL com `TARGET_ENV=production` / `api.synth.example`.
- Token único reaproveitado por todos os VUs.
- `Idempotency-Key` fixa ou ausente.
- Threshold só de latência; `409` filtrado das métricas de erro.
- "rápida" sem número.
