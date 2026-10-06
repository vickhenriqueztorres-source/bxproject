# Exemplo 2 — Chaos C-03 e teste de carga

- **Modo:** implementação
- **Agente:** `qa-resilience-agent`
- **Pedido:** "Provar que o Blnk fora por 3 minutos não perde nem duplica liquidação, e medir o `POST /contracts` sob carga."
- **Regras cobertas:** `R-04`, `R-05`, `I-02`, `I-03`, `I-05`, `M-02`, `D-13`

Ferramentas PROPOSTAS: Toxiproxy (falha de rede), Vitest (orquestração), k6 (carga). Ambiente: staging ou efêmero, nunca produção.

## Pós-condições comuns (Q-03)

```ts
// tests/support/post-conditions.ts
import { expect } from 'vitest'
import type { ChaosEnv } from './chaos-env'

export async function assertPostConditions(env: ChaosEnv) {
  expect(await env.reconcile()).toEqual({ divergences: 0 })

  expect(await env.ledgerSum()).toBe('0')

  const gaps = await env.db.query<{ n: number }>(`
    SELECT count(*)::int AS n FROM (
      SELECT sequence - lag(sequence) OVER (PARTITION BY symbol ORDER BY sequence) AS step
        FROM ticks
    ) t
    WHERE step IS NOT NULL AND step <> 1`)
  expect(gaps.rows[0].n).toBe(0)

  expect(await env.duplicateLedgerReferences()).toEqual([])
}
```

`reconcile` = `I-05`; `ledgerSum` soma todos os balances, incluindo a conta de origem do saldo inicial (`I-02`); `gaps` = `M-02`; referências duplicadas = `I-03`.

## Chaos C-03 — Blnk indisponível (Q-03)

```ts
// tests/chaos/C-03-blnk-down.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectChaosEnv, type ChaosEnv } from '../support/chaos-env'
import { assertPostConditions } from '../support/post-conditions'

const OUTAGE_MS = Number(process.env.CHAOS_OUTAGE_MS ?? 180_000)

let env: ChaosEnv
beforeAll(async () => { env = await connectChaosEnv() })
afterAll(async () => { await env.proxy('blnk').enable() })

describe('[C-03][R-04][R-05]', () => {
  it('[AC-42-8] Blnk fora: breaker abre, DLQ vazia, tudo liquida após a volta', async () => {
    const contracts = await env.openContracts(10, { waitUntil: 'OPEN' })

    await env.proxy('blnk').disable()

    await env.waitFor(async () => (await env.breakerState('blnk')) === 'OPEN', 30_000)
    await env.hold(OUTAGE_MS)

    expect(await env.streamLength('dlq:contracts:expiring')).toBe(0)
    expect(await env.streamLength('dlq:wallet:commands')).toBe(0)
    expect(await env.statuses(contracts)).not.toContain('SETTLED')

    await env.proxy('blnk').enable()

    await env.waitFor(
      async () => (await env.statuses(contracts)).every((s) => s === 'SETTLED'),
      40_000,
    )
    await assertPostConditions(env)
  }, OUTAGE_MS + 120_000)
})
```

- A espera do breaker em `OPEN` prova que a falha foi **realmente injetada**; sem ela, o teste poderia passar sem testar nada.
- `40_000` = meia-abertura do breaker (30 s, PROPOSTO em `05-resilience-patterns`) + prazo de liquidação (10 s, `I-05`).
- Esperar tempo real é aceitável aqui: a duração da falha é o próprio cenário. Em unit test, não (`Q-01`).

## Carga — `POST /contracts` e feed (Q-04)

```js
// tests/load/contracts.k6.js
import http from 'k6/http'
import ws from 'k6/ws'
import { check } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

const BASE = __ENV.BASE_URL
const WS_URL = __ENV.WS_URL
const SYMBOL = __ENV.SYMBOL
const USERS = JSON.parse(open('./synthetic-users.json'))
const tickDelay = new Trend('tick_delay_ms', true)
const sequenceGaps = new Counter('sequence_gaps')

export const options = {
  scenarios: {
    contracts: {
      executor: 'ramping-arrival-rate',
      exec: 'openContract',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      stages: [{ target: 50, duration: '5m' }, { target: 50, duration: '10m' }],
    },
    feed: { executor: 'constant-vus', exec: 'watchFeed', vus: 200, duration: '15m' },
  },
  thresholds: {
    'http_req_duration{name:POST /contracts}': ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.001'],
    checks: ['rate>0.999'],
    tick_delay_ms: ['p(95)<500'],
    sequence_gaps: ['count==0'],
  },
}

export function setup() {
  return { users: USERS }
}

export function openContract(data) {
  const user = data.users[__ITER % data.users.length]
  const res = http.post(
    `${BASE}/contracts`,
    JSON.stringify({ symbol: SYMBOL, direction: __ITER % 2 ? 'UP' : 'DOWN', stake: '1.00' }),
    {
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': uuidv4(),
      },
      tags: { name: 'POST /contracts' },
    },
  )
  check(res, { 'contrato criado (201)': (r) => r.status === 201 })
}

export function watchFeed(data) {
  const user = data.users[__VU % data.users.length]
  let last = null
  ws.connect(WS_URL, {}, (socket) => {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'auth', token: user.token }))
      socket.send(JSON.stringify({ type: 'subscribe', symbol: SYMBOL }))
    })
    socket.on('message', (raw) => {
      const msg = JSON.parse(raw)
      if (msg.type !== 'tick') return
      if (last !== null && msg.sequence !== last + 1) sequenceGaps.add(1)
      last = msg.sequence
      tickDelay.add(Date.now() - Date.parse(msg.created_at))
    })
    socket.setTimeout(() => socket.close(), 60_000)
  })
}
```

- Thresholds **reprovam** a execução (exit code ≠ 0) — não são só relatório. Valores PROPOSTOS em `references/api-guide.md`.
- Cada request tem `Idempotency-Key` própria; cada VU usa um usuário sintético diferente.
- `synthetic-users.json` é gerado no staging por um client `load-test` exclusivo do realm de staging — PROPOSTO; nunca existe em produção.
- Formato das mensagens WebSocket conforme `03-synthetic-market-engine`; `tick_delay_ms` depende de relógios sincronizados (NTP) entre gerador e k6.
- Ao final, rodar `assertPostConditions` contra o staging: carga que deixa divergência de saldo reprova, mesmo com latência boa.
