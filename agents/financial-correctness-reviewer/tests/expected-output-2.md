# Expected output 2 — T11 com arredondamento inventado e ledger espelho

## Saída esperada

```yaml
task_id: T11
agent: financial-correctness-reviewer
status: DONE
summary: >
  Revisão do reconciliador, do cálculo de lucro e da migration 0007. REPROVADO. O job roda a cada
  1 min com as 7 checagens e emite a métrica. Porém payout.ts fixa truncamento como regra de
  arredondamento, que não foi decidida, e a migration cria ledger_entries própria, contrariando
  D-02; a checagem 5 passa a comparar o Blnk com uma cópia do próprio sistema.
artifacts: []
evidence:
  - services/reconciler/src/reconcile.ts lido (cron 1 min, 7 checagens, metric.inc)
  - services/shared/src/payout.ts:3 lido
  - db/migrations/0007_ledger_mirror.up.sql lido
  - bash agents/financial-correctness-reviewer/scripts/health-check.sh → FAIL "tabela ledger_* própria"; WARN "arredondamento"
acceptance_criteria_met:
  - { criterion: "Job a cada 1 min com 7 checagens", met: true, evidence: "reconcile.ts cron '* * * * *'" }
  - { criterion: "Divergência gera métrica", met: true, evidence: "reconcile.ts metric.inc" }
confidence_score: 0.9
review:
  scope: [services/reconciler/src/reconcile.ts, services/shared/src/payout.ts, db/migrations/0007_ledger_mirror.up.sql]
  invariants:
    I-01: { result: FAIL, evidence: "0007_ledger_mirror.up.sql:1 tabela ledger_entries própria (D-02)" }
    I-02: { result: N/A, evidence: "T11 não grava transações" }
    I-03: { result: N/A, evidence: "T11 não executa efeito financeiro" }
    I-04: { result: N/A, evidence: "T11 não muda estado de contrato" }
    I-05: { result: FAIL, evidence: "checagem 5 compara com ledger_entries, não com os eventos do Blnk" }
    I-06: { result: N/A, evidence: "ações automáticas da reconciliação pendentes (§14)" }
  findings:
    - severity: ALTO
      location: services/shared/src/payout.ts:3
      problem: divisão inteira fixa truncamento como regra de arredondamento do lucro
      scenario: stake de 333 centavos paga 283; a regra oficial pode ser outra e todos os payouts ficariam errados
      violates: [FC-11]
    - severity: ALTO
      location: db/migrations/0007_ledger_mirror.up.sql:1
      problem: ledger próprio no Postgres, contrariando D-02 (saldo só no Blnk)
      scenario: duas fontes de verdade; correção feita em uma não aparece na outra
      violates: [I-01, FC-12]
    - severity: MÉDIO
      location: services/reconciler/src/reconcile.ts
      problem: checagem 5 valida o Blnk contra dado escrito pelo próprio sistema
      scenario: bug que grava errado nos dois lugares passa como "sem divergência"
      violates: [I-05]
  verdict: REPROVADO
decisions_cited: [D-02, I-01, I-05, FC-08, FC-11, FC-12]
pending:
  - Regra de arredondamento do lucro <não definido no contexto> — decisão do tech-lead-orchestrator
handoff_notes:
  - nenhum
```

## Não deve aparecer

- Recomendação de `floor`, `round`, `ceil` ou arredondamento bancário.
- `PASS` em I-01 com o argumento "é só espelho".
- `FAIL` por uso de `bigint` (é correto).
- Bloco de código corrigido.
