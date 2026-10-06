# Example 1 — T09 integração com dependências reais

Testes de integração do `POST /contracts` e do `GET /contracts/:id` com PostgreSQL, Redis, Keycloak
e Blnk reais. Cobre os obrigatórios do Q-02 que a T09 toca.

## Handoff recebido

```yaml
task_id: T09
agent: qa-resilience-agent
objective: Testar abertura de contrato, idempotência e autorização por objeto.
context:
  - commit: "feat(api): POST /contracts com Idempotency-Key e outbox RESERVE_STAKE"
  - arquivos: services/api/src/contracts/*.ts, db/migrations/0004_contracts.up.sql
skills: [01-project-context, 02-financial-invariants, 04-security-iam, 05-resilience-patterns, 06-testing-quality, 07-production-operations]
acceptance_criteria:
  - Mesma Idempotency-Key gera um contrato e uma reserva.
  - Usuário não acessa contrato de outro.
  - Body com campo de servidor é rejeitado.
budget: { max_steps: 30, max_tokens: 120000, timeout: 20m }
```

## Critérios escritos antes do teste

```text
AC-T09-1 — Repetição sequencial
Dado    usuário qa-a com saldo 1.000.000 e índice SYNTH_VOL_50 ativo
Quando  envia POST /contracts 2× com a mesma Idempotency-Key e o mesmo corpo
Então   as duas respostas têm o mesmo contract_id
E       existe 1 linha em contracts e 1 evento RESERVE_STAKE no outbox
Regras: I-03, B-05   Nível: integration

AC-T09-2 — Repetição concorrente
Quando  envia 20 POST /contracts em paralelo com a mesma chave
Então   20 respostas 201/200 com o mesmo contract_id; 1 contrato; 1 outbox
Regras: I-03, I-04   Nível: integration

AC-T09-3 — Objeto de outro usuário
Dado    contrato C de qa-a
Quando  qa-b faz GET /contracts/{C.id}
Então   404 com corpo idêntico ao de um id inexistente
Regras: S-04   Nível: integration

AC-T09-4 — Campo de servidor no body
Quando  POST /contracts com entry_price, status ou user_id no corpo
Então   400 e nenhuma linha criada
Regras: S-05   Nível: integration
```

## Teste

```ts
// services/api/test/integration/contracts.int.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startStack, type Stack } from '../../../../tests/support/stack'
import { createSyntheticUser, uniqueSymbol } from '../../../../tests/support/fixtures'

let stack: Stack
let symbol: string

beforeAll(async () => {
  stack = await startStack({ postgres: true, redis: true, keycloak: true, blnk: true }) // tags do Compose
  symbol = await uniqueSymbol(stack)
}, 120_000)
afterAll(() => stack.stop())

const body = (s: string) => ({ symbol: s, direction: 'UP', stake_minor: '1000' })

describe('POST /contracts', () => {
  it('[AC-T09-1][I-03] mesma chave 2× → mesmo contrato, 1 outbox', async () => {
    const a = await createSyntheticUser(stack, 't09-seq')
    const key = crypto.randomUUID()
    const r1 = await stack.api.post('/contracts', body(symbol), { token: a.token, idempotencyKey: key })
    const r2 = await stack.api.post('/contracts', body(symbol), { token: a.token, idempotencyKey: key })

    expect(r1.status).toBe(201)
    expect(r2.body.id).toBe(r1.body.id)
    expect(await stack.db.count('contracts', { user_id: a.sub })).toBe(1)
    expect(await stack.db.count('outbox', { aggregate_id: r1.body.id, type: 'RESERVE_STAKE' })).toBe(1)
  })

  it('[AC-T09-2][I-03][I-04] mesma chave 20× em paralelo → 1 contrato, 1 outbox', async () => {
    const a = await createSyntheticUser(stack, 't09-par')
    const key = crypto.randomUUID()
    const rs = await Promise.all(Array.from({ length: 20 }, () =>
      stack.api.post('/contracts', body(symbol), { token: a.token, idempotencyKey: key })))

    expect(new Set(rs.map((r) => r.body.id)).size).toBe(1)
    expect(await stack.db.count('contracts', { user_id: a.sub })).toBe(1)
    expect(await stack.db.count('outbox', { aggregate_id: rs[0].body.id })).toBe(1)
  })

  it('[AC-T09-4][S-05] campo de servidor no body → 400 e nada gravado', async () => {
    const a = await createSyntheticUser(stack, 't09-mass')
    for (const extra of [{ entry_price: '1' }, { status: 'SETTLED' }, { user_id: 'outro' }]) {
      const r = await stack.api.post('/contracts', { ...body(symbol), ...extra },
        { token: a.token, idempotencyKey: crypto.randomUUID() })
      expect(r.status).toBe(400)
    }
    expect(await stack.db.count('contracts', { user_id: a.sub })).toBe(0)
  })
})

describe('GET /contracts/:id', () => {
  it('[AC-T09-3][S-04] contrato de outro usuário → 404 idêntico ao inexistente', async () => {
    const a = await createSyntheticUser(stack, 't09-bola-a')
    const b = await createSyntheticUser(stack, 't09-bola-b')
    const c = await stack.api.post('/contracts', body(symbol), { token: a.token, idempotencyKey: crypto.randomUUID() })

    const alheio = await stack.api.get(`/contracts/${c.body.id}`, { token: b.token })
    const inexistente = await stack.api.get(`/contracts/${crypto.randomUUID()}`, { token: b.token })

    expect(alheio.status).toBe(404)
    expect(alheio.body).toEqual(inexistente.body)
  })
})
```

## Execução

```text
$ TARGET_ENV=ephemeral pnpm vitest run services/api/test/integration/contracts.int.test.ts
 ✓ [AC-T09-1][I-03] mesma chave 2× → mesmo contrato, 1 outbox            412ms
 ✓ [AC-T09-2][I-03][I-04] mesma chave 20× em paralelo → 1 contrato        689ms
 ✓ [AC-T09-4][S-05] campo de servidor no body → 400 e nada gravado        233ms
 ✓ [AC-T09-3][S-04] contrato de outro usuário → 404 idêntico              301ms
 Test Files 1 passed | Tests 4 passed   (repetido 3× — 0 flaky)
```

Prova de que o teste pega o bug: com o `UNIQUE (user_id, idempotency_key)` removido numa branch
descartável, o `[AC-T09-2]` fica vermelho com 4 contratos. A branch não é enviada.

## Saída

```yaml
task_id: T09
agent: qa-resilience-agent
status: DONE
summary: >
  Testes de integração de POST /contracts e GET /contracts/:id com Postgres, Redis, Keycloak e
  Blnk reais. 4 critérios escritos (AC-T09-1..4) e 4 testes verdes em 3 execuções. Mutação
  manual do UNIQUE confirmou que o teste paralelo pega a regressão. JWT inválido já coberto na T03.
artifacts:
  - tests/acceptance/AC-T09.md
  - services/api/test/integration/contracts.int.test.ts
evidence:
  - TARGET_ENV=ephemeral pnpm vitest run contracts.int.test.ts → 4 passed (3 execuções, 0 flaky)
  - mutação "sem UNIQUE" em branch descartável → [AC-T09-2] failed (4 contratos)
  - bash agents/qa-resilience-agent/scripts/health-check.sh → 0 FAIL
acceptance_criteria_met:
  - { criterion: "AC-T09-1/2 — mesma chave → 1 contrato e 1 reserva", met: true, evidence: "contracts.int.test.ts::[AC-T09-1], [AC-T09-2] → passed" }
  - { criterion: "AC-T09-3 — sem acesso a contrato alheio", met: true, evidence: "contracts.int.test.ts::[AC-T09-3] → passed" }
  - { criterion: "AC-T09-4 — campo de servidor rejeitado", met: true, evidence: "contracts.int.test.ts::[AC-T09-4] → passed" }
confidence_score: 0.93
test_results:
  unit: { passed: 0, failed: 0, todo: 0 }
  integration: { passed: 4, failed: 0, todo: 0 }
  chaos: { passed: 0, failed: 0, todo: 0 }
  load: { passed: 0, failed: 0, thresholds: [] }
rules_covered: [I-03, I-04, S-04, S-05, B-05]
coverage_gaps:
  - "R-01 outbox: relay publica 1× — pertence à T06, não testado aqui"
defects: []
verdict: APROVADO
decisions_cited: [D-12, Q-02, Q-05, QA-03, QA-06, QA-07, QA-12]
pending:
  - nenhum
```
