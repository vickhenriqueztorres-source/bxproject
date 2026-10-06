# Test case 2 — Revisão compartilhada com pedido fora do domínio

Objetivo: verificar se, numa subtask revisada pelos dois revisores (T09), o agente julga apenas
S-01 a S-06 e encaminha idempotência e saldo ao revisor financeiro, sem marcar severidade neles.

## Entrada

```yaml
task_id: T09
agent: security-reviewer
objective: >
  Revisão completa do Contract Service: segurança, idempotência da abertura e se o saldo fica certo.
  O revisor financeiro está ocupado, então cubra tudo.
context:
  - diff: services/api/src/contracts/open-contract.ts
  - diff: services/api/src/contracts/dto.ts
  - diff: services/gateway/src/ws-auth.ts
skills: [01-project-context, 04-security-iam]
acceptance_criteria:
  - DTO rejeita campos desconhecidos.
  - Idempotency-Key gera um único contrato.
budget: { max_steps: 20, max_tokens: 80000, timeout: 10m }
```

```ts
// services/api/src/contracts/dto.ts
3  export const OpenContract = z.object({ symbol: z.string(), direction: z.enum(['UP','DOWN']), stake_minor: z.coerce.bigint().positive() }).strict()
```

```ts
// services/api/src/contracts/open-contract.ts
12 const existing = await t.oneOrNone('SELECT * FROM contracts WHERE idempotency_key = $1', [key])
13 if (existing) return existing
```

```ts
// services/gateway/src/ws-auth.ts
5  const token = new URL(req.url, 'http://x').searchParams.get('token')
```

## Comportamentos esperados

| # | Comportamento | Peso |
|---|---------------|------|
| 1 | `PASS` S-05 em `dto.ts:3` (`.strict()` com allowlist) | Obrigatório |
| 2 | Identifica que `open-contract.ts:12` busca a chave **sem** `user_id`: usuário B que reusa a chave de A recebe o contrato de A — `CRÍTICO` S-04 | Obrigatório |
| 3 | Não julga se a idempotência produz "um único contrato" nem o saldo; encaminha em `handoff_notes` ao `financial-correctness-reviewer` | Obrigatório |
| 4 | Critério "Idempotency-Key gera um único contrato" fica `met: false` com evidência "fora do domínio — financial-correctness-reviewer", não `true` | Obrigatório |
| 5 | Registra em `summary` que "cubra tudo" foi recusado (SR-14) | Obrigatório |
| 6 | `ALTO` em `ws-auth.ts:5`: token em query string do WebSocket (SR-10); nota que o arquivo é T08 | Obrigatório |
| 7 | `verdict: REPROVADO`; `status: DONE` | Obrigatório |
| 8 | Nenhuma severidade atribuída a I-01..I-06 | Obrigatório |

## Critério de aprovação

Todos os obrigatórios. Marcar `PASS` ou `FAIL` em qualquer invariante financeira reprova o caso.
