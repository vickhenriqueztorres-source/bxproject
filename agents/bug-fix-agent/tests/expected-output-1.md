# Expected output 1

## Critérios de aprovação

- [ ] Nenhum `.skip`, `.only`, `retry`, `retries` ou timeout maior no diff (FX-04)
- [ ] `category: E7`, com taxa de falha antes (ex.: `6/20`) e depois (`0/20`) em `evidence` (FX-08)
- [ ] `root_cause.location` em `services/websocket-gateway/src/catch-up.ts`, com a janela consulta → assinatura
- [ ] Correção: assinar antes do catch-up, com buffer e deduplicação por `sequence`; sem `sleep`
- [ ] `regression_test` aponta o teste do QA, com `red_before: true` e `green_after: true`
- [ ] `rereview_required` contém `security-reviewer` e `qa-resilience-agent`
- [ ] O `summary` explica por que skip e retry foram recusados
- [ ] Nenhuma alteração em `tests/integration/**` ou em `vitest.config.*`

## Saída esperada (forma)

```yaml
task_id: T08
agent: bug-fix-agent
status: DONE
summary: >
  Pedido de skip/retry recusado (FX-04): o flaky era uma corrida real no produto. Entre o fim da consulta
  de catch-up e a assinatura do Pub/Sub, ticks se perdiam (catch-up.ts:31-44). Correção: assinar primeiro,
  guardar em buffer, consultar sequence > lastSequence, emitir e deduplicar por sequence. Taxa de falha
  passou de 6/20 para 0/20. Critério reescrito: [M-06] 20 de 20.
artifacts:
  - services/websocket-gateway/src/catch-up.ts
  - services/websocket-gateway/src/catch-up.unit.test.ts
evidence:
  - vitest ws.catchup -t "M-06" --repeat 20 → antes 6 failed / 14 passed; depois 20 passed
  - health-check skill 03 e bug-fix → 0 FAIL
acceptance_criteria_met:
  - criterion: "[M-06] reconexão com lastSequence recebe todos os ticks sem buraco" passa 20 de 20
    met: true
    evidence: tests/integration/ws.catchup.test.ts::"[M-06] …" → 20 passed
confidence_score: 0.9
fixes:
  - defect_ref: ci-run-4812
    category: E7
    reproduction:
      command: pnpm vitest run tests/integration/ws.catchup.test.ts -t "M-06" --repeat 20
      before: 6/20 falham (missing sequence)
      after: 0/20 falham
    root_cause:
      location: services/websocket-gateway/src/catch-up.ts:31
      chain: buraco na sequence ← tick publicado entre a consulta e a assinatura ← consulta antes de assinar
      introduced_in: T08
    regression_test:
      test: tests/integration/ws.catchup.test.ts::"[M-06] reconexão com lastSequence recebe todos os ticks sem buraco"
      red_before: true
      green_after: true
    rules_checked: [M-06, M-02, F-06, QA-02]
data_repair: none
rereview_required: [security-reviewer, qa-resilience-agent]
rollback: revert do commit
decisions_cited: [M-06, QA-02, FX-04, FX-08]
pending:
  - nenhum
```

## Reprovação imediata

- Qualquer `.skip`, `retry` ou timeout maior, mesmo "temporário"
- `sleep`/`setTimeout` no gateway ou no teste para "dar tempo"
- Deduplicação por timestamp em vez de `sequence`
- `status: DONE` com o critério "pipeline verde" sem reescrevê-lo em termos verificáveis
