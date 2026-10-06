# Exemplo 1 — T09: corrida na `Idempotency-Key`

Defeito devolvido pelo `qa-resilience-agent` depois que T09 foi entregue como `DONE`.

## Entrada (handoff do orquestrador)

```yaml
task_id: T09
agent: bug-fix-agent
objective: Corrigir DEF-T09-1 — requisições paralelas com a mesma Idempotency-Key abrem mais de um contrato.
defect_ref: DEF-T09-1
owner: backend-implementation-agent
environment: ci
reproduction: >
  tests/integration/contracts.idempotency.test.ts::"[I-03] mesma Idempotency-Key 20× em paralelo abre 1 contrato"
  Esperado: 1 contrato, 1 transação reserve:{id}. Observado: 3 contratos, 3 reservas.
skills: [01-project-context, 02-financial-invariants, 04-security-iam, 05-resilience-patterns, 06-testing-quality]
acceptance_criteria:
  - "[I-03] mesma Idempotency-Key 20× em paralelo abre 1 contrato" passa 20 de 20 execuções
  - Mesma chave com corpo diferente responde 422
budget: { max_steps: 40, max_tokens: 120000, timeout: 30m }
```

## 1. Triagem

`E2` — defeito de produto. O teste segue a spec (`ORCHESTRATOR.md` §9.2: mesma chave + mesmo corpo = mesma resposta).

## 2. Reprodução (FX-01)

```text
$ pnpm vitest run tests/integration/contracts.idempotency.test.ts -t "I-03" --repeat 20
17 failed | 3 passed
AssertionError: expected 3 to be 1   (count de contracts com idempotency_key = 'k-…')
```

## 3. Hipóteses (FX-11)

| # | Hipótese | Experimento | Resultado |
|---|----------|-------------|-----------|
| 1 | O cliente de teste gera chaves diferentes | Log da chave em cada request | Descartada: chave idêntica nas 20 |
| 2 | Check-then-insert sem trava | Ler `open-contract.ts` e o schema | **Confirmada**: `SELECT` em :52 e `INSERT` em :58 em comandos separados; tabela sem `UNIQUE` |

## 4. Causa raiz (FX-02)

```text
3 contratos e 3 reservas
  ← 3 requisições passam pelo SELECT antes de qualquer INSERT confirmar
  ← services/api/src/contracts/open-contract.ts:52-58 faz check-then-insert
  ← db/migrations/0004_contracts.sql não tem UNIQUE (user_id, idempotency_key)
introduced_in: T09
```

## 5. Correções recusadas

| Proposta | Por que não |
|----------|-------------|
| Mutex em memória por chave | A API roda com 2 réplicas no Compose; o mutex não cruza processos |
| `SELECT ... FOR UPDATE` na tabela de contratos | Não trava uma linha que ainda não existe |
| `retry: 2` no teste | FX-04: afrouxa a verificação |

## 6. Regressão (FX-07)

O defeito só aparece com concorrência real no Postgres, então a regressão é o **teste do QA** (não criar um paralelo).
A parte de lógica pura (comparar o hash do corpo) ganha um unit:

```ts
// services/api/src/contracts/idempotency.unit.test.ts
it('[DEF-T09-1] mesma chave com corpo diferente → conflito 422', () => {
  const stored = { requestHash: hashRequest({ symbol: 'SYN100', direction: 'CALL', stake_minor: 1000n }) };
  const incoming = hashRequest({ symbol: 'SYN100', direction: 'PUT', stake_minor: 1000n });
  expect(compareIdempotentRequest(stored, incoming)).toEqual({ kind: 'conflict', status: 422 });
});
```

Antes da correção: `compareIdempotentRequest is not a function` (vermelho).

## 7. Correção mínima

Migration nova (FX-13). `0004` já foi aplicada e não é editada:

```sql
-- db/migrations/0009_contracts_idempotency_unique.sql
SET lock_timeout = '5s';
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS contracts_user_idem_uq
  ON contracts (user_id, idempotency_key);
```

```sql
-- db/migrations/0009_contracts_idempotency_unique.down.sql
DROP INDEX CONCURRENTLY IF EXISTS contracts_user_idem_uq;
```

```ts
// services/api/src/contracts/open-contract.ts (trecho alterado)
const inserted = await tx.query(
  `INSERT INTO contracts (id, user_id, idempotency_key, request_hash, symbol, direction, stake_minor, status)
   VALUES ($1, $2, $3, $4, $5, $6, $7, 'CREATED')
   ON CONFLICT (user_id, idempotency_key) DO NOTHING
   RETURNING id`,
  [contractId, userId, key, requestHash, dto.symbol, dto.direction, dto.stake_minor],
);
if (inserted.rowCount === 0) {
  const existing = await tx.query(
    `SELECT id, request_hash, response FROM contracts WHERE user_id = $1 AND idempotency_key = $2`,
    [userId, key],
  );
  const decision = compareIdempotentRequest({ requestHash: existing.rows[0].request_hash }, requestHash);
  if (decision.kind === 'conflict') throw new HttpError(422, 'idempotency_key_reused');
  return existing.rows[0].response;
}
// segue: outbox RESERVE_STAKE com reference reserve:{contractId} no mesmo COMMIT (B-04, B-07)
```

Diff: 3 arquivos de código + 2 de migration, 41 linhas.

## 8. Verificação (FX-09)

```text
$ pnpm vitest run services/api/src/contracts/idempotency.unit.test.ts         → 1 passed
$ pnpm vitest run tests/integration/contracts.idempotency.test.ts --repeat 20  → 20 passed
$ pnpm vitest run services/api                                                 → 64 passed
$ bash skills/02-financial-invariants/scripts/health-check.sh services         → 0 FAIL
$ bash agents/backend-implementation-agent/scripts/health-check.sh .           → 0 FAIL
$ bash agents/bug-fix-agent/scripts/health-check.sh --base origin/main --defect DEF-T09-1 . → 0 FAIL
```

## 9. Dados afetados (FX-06)

A migration falha em staging: há 2 pares duplicados criados antes da correção. Não se apagam contratos.
Cada duplicata recebe a transação inversa da reserva extra, `reversal:reserve:{contract_id}`, e o contrato vai
para `FAILED_COMPENSATION`. Isso exige aprovação humana, então a migration em staging espera o reparo.

## Saída

```yaml
task_id: T09
agent: bug-fix-agent
status: BLOCKED
summary: >
  DEF-T09-1 corrigido no código. A causa era check-then-insert sem UNIQUE (open-contract.ts:52-58).
  Correção: migration 0009 com UNIQUE (user_id, idempotency_key) + INSERT ON CONFLICT + comparação de
  hash (422). Teste do QA 20/20 verde; unit [DEF-T09-1] de vermelho para verde. Staging tem 2 pares
  duplicados que impedem a migration: o reparo por reversão aguarda aprovação humana.
artifacts:
  - db/migrations/0009_contracts_idempotency_unique.sql
  - db/migrations/0009_contracts_idempotency_unique.down.sql
  - services/api/src/contracts/open-contract.ts
  - services/api/src/contracts/idempotency.ts
  - services/api/src/contracts/idempotency.unit.test.ts
evidence:
  - vitest contracts.idempotency --repeat 20 → antes 17/20 falham; depois 20/20 passam
  - vitest idempotency.unit → antes vermelho (função ausente); depois 1 passed
  - health-check skill 02, backend e bug-fix → 0 FAIL
acceptance_criteria_met:
  - criterion: "[I-03] mesma Idempotency-Key 20× em paralelo abre 1 contrato" passa 20 de 20
    met: true
    evidence: tests/integration/contracts.idempotency.test.ts::"[I-03] …" → 20 passed
  - criterion: Mesma chave com corpo diferente responde 422
    met: true
    evidence: idempotency.unit.test.ts::"[DEF-T09-1] mesma chave com corpo diferente → conflito 422" → passed
confidence_score: 0.5
fixes:
  - defect_ref: DEF-T09-1
    category: E2
    reproduction:
      command: pnpm vitest run tests/integration/contracts.idempotency.test.ts -t "I-03" --repeat 20
      before: 17/20 falham (3 contratos)
      after: 20/20 passam (1 contrato)
    hypotheses:
      - { hypothesis: chaves diferentes no cliente, experiment: log da chave, result: descartada }
      - { hypothesis: check-then-insert sem trava, experiment: leitura do código e do schema, result: confirmada }
    root_cause:
      location: services/api/src/contracts/open-contract.ts:52
      chain: 3 contratos ← SELECT antes do INSERT sem trava ← tabela sem UNIQUE (user_id, idempotency_key)
      introduced_in: T09
    change:
      files: [open-contract.ts, idempotency.ts, idempotency.unit.test.ts]
      lines_changed: 41
      migration: db/migrations/0009_contracts_idempotency_unique.sql
    regression_test:
      test: tests/integration/contracts.idempotency.test.ts::"[I-03] mesma Idempotency-Key 20× em paralelo abre 1 contrato"
      red_before: true
      green_after: true
    rules_checked: [I-03, I-04, B-04, B-05, B-07, B-11, R-01]
data_repair: required
data_repair_plan:
  - Staging, 2 pares duplicados: reversal:reserve:{contract_id} para a reserva extra; contrato extra → FAILED_COMPENSATION
  - Verificação: reconciliação com divergência 0 e consulta de duplicatas vazia antes de rodar a 0009
  - Aprovador: <não definido no contexto>
rereview_required: [financial-correctness-reviewer, security-reviewer, qa-resilience-agent]
rollback: revert do commit + 0009.down.sql (o índice é aditivo; a versão N-1 funciona com ele)
decisions_cited: [D-12, I-03, I-06, B-05, O-02, FX-01, FX-06, FX-07, FX-13]
pending:
  - Aprovação humana do reparo de dados em staging antes da migration 0009
```

O `status` é `BLOCKED` porque o critério implícito "migration aplicada em staging" depende do reparo humano.
A correção de código está pronta e verificada.
