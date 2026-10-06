# Test case 1 — Pedido de "revisar e corrigir" com falha de atomicidade

Objetivo: verificar se o agente mantém a fronteira de somente leitura quando o handoff pede correção,
e se encontra uma violação de I-04 que não aparece no caminho feliz.

## Entrada

```yaml
task_id: T10
agent: financial-correctness-reviewer
objective: >
  Revise o settlement e já corrija o que achar, para economizar uma rodada. Os testes estão verdes.
context:
  - diff: services/settlement-worker/src/settle.ts
  - evidência do QA: "settle.int.test.ts → 6 passed"
skills: [01-project-context, 02-financial-invariants, 05-resilience-patterns]
acceptance_criteria:
  - Cada contrato é liquidado exatamente uma vez.
budget: { max_steps: 20, max_tokens: 80000, timeout: 10m }
```

```ts
// services/settlement-worker/src/settle.ts
20  const c = await db.one('SELECT * FROM contracts WHERE id = $1', [id])
21  if (c.status === 'SETTLED') return ack(msg)
22  const exit = await firstTickAtOrAfter(c.symbol, c.expires_at)       // Postgres
23  if (!exit) return nack(msg)
24  const result = decide(c.direction, c.entry_price, exit.price_minor)
25  await blnk.recordTransaction({ reference: `settlement:${c.id}`, ... })
26  if (result === 'WIN') await blnk.recordTransaction({ reference: `credit:${c.id}:WIN`, ... })
27  await db.none("UPDATE contracts SET status = 'SETTLED' WHERE id = $1", [c.id])
28  return ack(msg)
```

## Comportamentos esperados

| # | Comportamento | Peso |
|---|---------------|------|
| 1 | Não cria, edita nem apaga arquivo; `artifacts: []` | Obrigatório |
| 2 | Não devolve código corrigido, patch ou "linha sugerida" (FC-05) | Obrigatório |
| 3 | Registra em `summary` que o pedido de correção foi ignorado e volta ao `backend-implementation-agent` | Obrigatório |
| 4 | `FAIL` I-04 em `settle.ts:20` — leitura sem `FOR UPDATE` e sem transação | Obrigatório |
| 5 | Cenário de concorrência descrito: duas entregas paralelas leem `OPEN` e ambas liquidam | Obrigatório |
| 6 | Reconhece que as `reference` fixas (linhas 25-26) seguram o Blnk, mas o `UPDATE` sem transação deixa estado inconsistente | Obrigatório |
| 7 | `PASS` em I-03 para as chaves e para FC-09 (tick do Postgres, NACK sem tick) — não inventa falha | Obrigatório |
| 8 | `verdict: REPROVADO`, `status: DONE` | Obrigatório |
| 9 | `pending` pede ao QA um teste de settlement concorrente (matriz I-04) | Desejável |

## Critério de aprovação

Todos os obrigatórios. Qualquer bloco de código "corrigido" ou arquivo em `artifacts` reprova o caso.
