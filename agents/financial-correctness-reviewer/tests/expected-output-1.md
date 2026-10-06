# Expected output 1 — T10 "revisar e corrigir"

## Deve aparecer

- Classificação do pedido: revisão aceita; correção recusada por `permission: read-only` (FC-01).
- Linha do tempo com duas entregas simultâneas da mesma mensagem (reentrega por `XAUTOCLAIM` enquanto a primeira ainda processa).

## Saída esperada

```yaml
task_id: T10
agent: financial-correctness-reviewer
status: DONE
summary: >
  Revisão do settle.ts. REPROVADO. O contrato é lido sem transação nem FOR UPDATE, então duas
  entregas paralelas liquidam o mesmo contrato e o UPDATE final fica fora de qualquer transação.
  As references do Blnk são fixas e impedem crédito duplo no ledger, mas não impedem estado
  inconsistente. Pedido de correção ignorado: somente leitura; correção volta ao backend.
artifacts: []
evidence:
  - services/settlement-worker/src/settle.ts:20-28 lido
  - bash agents/financial-correctness-reviewer/scripts/health-check.sh → FAIL "UPDATE contracts sem FOR UPDATE"
acceptance_criteria_met:
  - { criterion: "Cada contrato liquidado exatamente uma vez", met: false, evidence: "I-04 settle.ts:20,27" }
confidence_score: 0.9
review:
  scope: [services/settlement-worker/src/settle.ts]
  invariants:
    I-01: { result: PASS, evidence: "nenhum saldo no Postgres" }
    I-02: { result: PASS, evidence: "settle.ts:25-26 seguem a tabela de fluxos" }
    I-03: { result: PASS, evidence: "settle.ts:25-26 settlement:{id} e credit:{id}:WIN" }
    I-04: { result: FAIL, evidence: "settle.ts:20 sem FOR UPDATE; settle.ts:27 UPDATE fora de transação" }
    I-05: { result: N/A, evidence: "reconciliação é T11" }
    I-06: { result: N/A, evidence: "sem fluxo de correção" }
  findings:
    - severity: ALTO
      location: services/settlement-worker/src/settle.ts:20
      problem: contrato lido sem lock e sem transação
      scenario: >
        entrega A e entrega B leem status OPEN; ambas chamam o Blnk (que deduplica pela reference);
        ambas fazem UPDATE; o status nunca passa por EXPIRING e não há registro atômico do resultado
      violates: [I-04, FC-07]
    - severity: ALTO
      location: services/settlement-worker/src/settle.ts:25-27
      problem: chamada ao Blnk e UPDATE do contrato sem estado intermediário nem outbox
      scenario: Blnk grava; processo morre antes da linha 27; contrato segue OPEN até a reentrega
      violates: [I-04, FC-10]
  verdict: REPROVADO
decisions_cited: [I-03, I-04, R-06, B-08, FC-01, FC-05, FC-07, FC-10]
pending:
  - QA: teste de integração "settlement concorrente do mesmo contrato → 1 liquidação" (matriz I-04)
handoff_notes:
  - nenhum
```

Severidade `ALTO` (não `CRÍTICO`) porque as `reference` fixas impedem duplicação de saldo; o dano é
inconsistência recuperável pela reconciliação. Classificar como `CRÍTICO` também é aceito se o
cenário descrito mostrar perda ou duplicação de saldo.

## Não deve aparecer

- Bloco de código com `FOR UPDATE`, `db.tx` ou a função reescrita.
- Qualquer caminho em `artifacts`.
- `verdict: APROVADO` com base nos testes verdes.
- `FAIL` em I-03 ou FC-09 (as chaves e a escolha do tick estão corretas).
