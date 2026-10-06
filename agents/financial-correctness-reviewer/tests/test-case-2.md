# Test case 2 — Regra não decidida fixada no código e ledger espelho do PRD

Objetivo: verificar se o agente detecta uma regra de negócio inventada (arredondamento) e uma tabela
de ledger própria justificada pelo PRD, sem aceitar o argumento "é só espelho".

## Entrada

```yaml
task_id: T11
agent: financial-correctness-reviewer
objective: Revisar a reconciliação e o cálculo de payout usado por ela.
context:
  - diff: services/reconciler/src/reconcile.ts
  - diff: services/shared/src/payout.ts
  - diff: db/migrations/0007_ledger_mirror.up.sql
  - nota do backend: "criei ledger_entries como espelho do Blnk, como no PRD §7, para facilitar a reconciliação"
skills: [01-project-context, 02-financial-invariants, 05-resilience-patterns]
acceptance_criteria:
  - Job roda a cada 1 minuto com as 7 checagens.
  - Divergência gera métrica ledger_reconciliation_errors_total.
budget: { max_steps: 20, max_tokens: 80000, timeout: 10m }
```

```ts
// services/shared/src/payout.ts
3  export const profitMinor = (stake: bigint) => (stake * 85n) / 100n   // trunca para baixo
```

```sql
-- db/migrations/0007_ledger_mirror.up.sql
CREATE TABLE ledger_entries (id bigserial PRIMARY KEY, balance_id text, amount_minor bigint, created_at timestamptz);
```

```ts
// services/reconciler/src/reconcile.ts — cron '* * * * *', 7 checagens, metric.inc() em divergência
// checagem 5: compara o saldo do Blnk com SUM(ledger_entries.amount_minor)
```

## Comportamentos esperados

| # | Comportamento | Peso |
|---|---------------|------|
| 1 | Achado `ALTO` em `payout.ts:3`: divisão inteira fixa uma regra de arredondamento `<não definido no contexto>` (FC-11) | Obrigatório |
| 2 | Arredondamento listado em `pending`, sem propor `floor`, `round` ou "banker's rounding" | Obrigatório |
| 3 | `FAIL` I-01 para `ledger_entries`, citando `D-02` e FC-12, apesar da nota do PRD | Obrigatório |
| 4 | Explica o risco: checagem 5 compara o Blnk com uma cópia escrita pelo próprio sistema, não com os eventos do ledger | Obrigatório |
| 5 | Reconhece `PASS` para o intervalo de 1 min e para a métrica (critérios 1 e 2 atendidos) | Obrigatório |
| 6 | Reconhece que `bigint` é correto (FC-08 não é violado) | Obrigatório |
| 7 | `verdict: REPROVADO`; `status: DONE` | Obrigatório |
| 8 | Nenhuma sugestão de código | Obrigatório |

## Critério de aprovação

Todos os obrigatórios. Aprovar "porque é só espelho" ou escolher uma regra de arredondamento reprova o caso.
