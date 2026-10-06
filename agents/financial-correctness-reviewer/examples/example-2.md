# Example 2 — T09 abertura de contrato aprovada

Revisão de um `POST /contracts` que preserva as invariantes. O exemplo mostra como justificar
`N/A`, como registrar um achado de outro domínio sem julgá-lo e como aprovar com um achado `BAIXO`.

## Handoff recebido

```yaml
task_id: T09
agent: financial-correctness-reviewer
objective: Revisar abertura de contrato e reserva de stake.
context:
  - diff: services/api/src/contracts/open-contract.ts
  - diff: db/migrations/0004_contracts.up.sql
  - evidência do QA: "contracts.int.test.ts → [I-03] mesma chave 20× em paralelo → 1 contrato, 1 reserva"
skills: [01-project-context, 02-financial-invariants, 05-resilience-patterns]
acceptance_criteria:
  - Mesma Idempotency-Key gera um contrato e uma reserva.
  - Reserva só é feita pelo worker a partir do outbox.
budget: { max_steps: 20, max_tokens: 80000, timeout: 10m }
```

## Trechos revisados

```sql
-- db/migrations/0004_contracts.up.sql
CREATE TABLE contracts (
  id               uuid PRIMARY KEY,
  user_id          text   NOT NULL,
  idempotency_key  text   NOT NULL,
  request_hash     text   NOT NULL,
  stake_minor      bigint NOT NULL CHECK (stake_minor > 0),
  status           text   NOT NULL CHECK (status IN ('CREATED','OPEN','EXPIRING','SETTLED','CANCELLED','FAILED_COMPENSATION','FAILED_RETRYABLE')),
  entry_sequence   bigint NOT NULL,
  entry_price      bigint NOT NULL,
  expires_at       timestamptz NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
```

```ts
// services/api/src/contracts/open-contract.ts
18  return db.tx(async (t) => {
19    const existing = await t.oneOrNone(
20      'SELECT * FROM contracts WHERE user_id = $1 AND idempotency_key = $2', [sub, key])
21    if (existing) return replay(existing, requestHash)          // 422 se hash diferente
22    const tick = await t.one('SELECT sequence, price_minor, ts FROM ticks WHERE symbol = $1 ORDER BY sequence DESC LIMIT 1', [dto.symbol])
23    const contract = await t.one(`INSERT INTO contracts (...) VALUES (...)
24      ON CONFLICT (user_id, idempotency_key) DO NOTHING RETURNING *`, [...])
25      ?? await t.one('SELECT * FROM contracts WHERE user_id = $1 AND idempotency_key = $2', [sub, key])
26    await t.none('INSERT INTO outbox (aggregate_id, type, payload) VALUES ($1, $2, $3)',
27      [contract.id, 'RESERVE_STAKE', { reference: `reserve:${contract.id}`, amount_minor: dto.stake_minor }])
28    return contract
29  })
```

## Raciocínio

| Ponto | Verificação | Resultado |
|-------|-------------|-----------|
| Duplo clique | `UNIQUE (user_id, idempotency_key)` + `ON CONFLICT DO NOTHING` + releitura | 1 contrato |
| Concorrência | Duas transações paralelas: a segunda cai no `ON CONFLICT` e relê | 1 contrato, 1 outbox |
| Reserva | Só outbox na transação; Blnk chamado pelo worker com `reserve:{id}` | I-04 e I-03 ok |
| Dinheiro | `bigint` em `stake_minor` e `entry_price` | FC-08 ok |
| Preço de entrada | Último tick **persistido** no Postgres, não cache | Coerente com B-08 |
| Status | Só `CREATED` no insert; `CHECK` com a máquina de estados | FC-07 ok |

Achado de outro domínio: `GET /contracts/:id` (fora do diff) não foi lido; mas o `replay` da linha 21
devolve o contrato pela chave do mesmo `sub` — sem risco de BOLA aqui. Nada para o `security-reviewer`
nesta linha; a nota abaixo registra só a verificação recomendada.

## Saída

```yaml
task_id: T09
agent: financial-correctness-reviewer
status: DONE
summary: >
  Revisão de open-contract.ts e da migration 0004. APROVADO. Idempotência garantida por UNIQUE
  escopado por user_id + ON CONFLICT; reserva só via outbox com reference reserve:{id}; dinheiro em
  bigint; status restrito pela máquina de estados. Um achado BAIXO sobre o CHECK de status.
artifacts: []
evidence:
  - services/api/src/contracts/open-contract.ts:18-29 lido
  - db/migrations/0004_contracts.up.sql lido (UNIQUE, CHECK, bigint)
  - bash agents/financial-correctness-reviewer/scripts/health-check.sh → 0 FAIL
  - evidência do QA "[I-03] 20× em paralelo → 1 contrato, 1 reserva" conferida no arquivo de teste
acceptance_criteria_met:
  - { criterion: "Mesma chave → 1 contrato e 1 reserva", met: true, evidence: "0004:12 UNIQUE; open-contract.ts:24" }
  - { criterion: "Reserva só pelo worker via outbox", met: true, evidence: "open-contract.ts:26-27" }
confidence_score: 0.92
review:
  scope: [services/api/src/contracts/open-contract.ts, db/migrations/0004_contracts.up.sql]
  invariants:
    I-01: { result: PASS, evidence: "nenhum saldo no Postgres; saldo só no Blnk (D-02)" }
    I-02: { result: N/A, evidence: "T09 só grava a intenção; pernas source/destination ficam no worker (T04)" }
    I-03: { result: PASS, evidence: "0004:12 UNIQUE (user_id, idempotency_key); outbox com reserve:{id}" }
    I-04: { result: PASS, evidence: "open-contract.ts:18-29 contrato + outbox no mesmo db.tx" }
    I-05: { result: N/A, evidence: "reconciliação é T11" }
    I-06: { result: N/A, evidence: "subtask não tem fluxo de correção" }
  findings:
    - severity: BAIXO
      location: db/migrations/0004_contracts.up.sql:7
      problem: CHECK aceita qualquer status em qualquer ordem; a máquina de estados só é garantida pelo código
      scenario: UPDATE manual de SETTLED para OPEN passaria no banco
      violates: [FC-07]
  verdict: APROVADO
decisions_cited: [D-02, D-12, I-01, I-03, I-04, R-01, B-05, FC-07, FC-08]
pending:
  - nenhum
handoff_notes:
  - "security-reviewer: confirmar que o DTO de POST /contracts rejeita entry_price e user_id (S-05) — não revisado aqui"
```

## Por que `N/A` em I-02

T09 grava apenas a intenção (`RESERVE_STAKE` no outbox). As pernas `user:available → user:reserved`
são executadas pelo Wallet Adapter (T04). Marcar `PASS` aqui seria afirmar algo que não foi lido;
marcar `FAIL` seria cobrar de T09 o que é de T04.
