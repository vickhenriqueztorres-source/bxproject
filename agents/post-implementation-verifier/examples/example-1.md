# Exemplo 1 — MA-4: teste verde, pós-condição vermelha

## Handoff recebido

```yaml
task_id: MA-4
agent: post-implementation-verifier
objective: Verificar contratos e settlement multi-ativos antes do merge
context:
  commit: 4b7e0d2
  base: 1d9e3c0
  environment: ephemeral
  compose_project: verify-4b7e0d2
  window: { start: 2026-06-10T14:02:00Z, end: 2026-06-10T14:10:00Z }
  gate_commands:
    - pnpm vitest run tests/integration/contracts-multi-asset.test.ts
skills: [01-project-context, 06-testing-quality, 10-post-implementation-verification, 02-financial-invariants, 08-database-foundation]
acceptance_criteria:
  - Nenhum contrato liquidado com tick de outro ativo
  - Todo contrato vencido liquida em até 10 s
  - Reconciliação OK com divergência 0
  - Ativo PAUSED não recebe contrato novo
```

## Execução

```text
$ git rev-parse HEAD                                   → 4b7e0d2…
$ bash agents/post-implementation-verifier/scripts/health-check.sh before
fingerprint: 3e1f9a…   head: 4b7e0d2…   arquivos: 1.284
$ git diff 1d9e3c0..4b7e0d2 -- tests/                   → +1 arquivo novo, nenhuma asserção removida
$ docker compose -p verify-4b7e0d2 up -d --wait         → 9 serviços healthy
$ pnpm vitest run tests/integration/contracts-multi-asset.test.ts
  Tests 3 passed (3)  exit 0
$ CHECKS="V-07 V-08 V-09 V-10" ENVIRONMENT=ephemeral WINDOW_START=… WINDOW_END=… \
  bash skills/10-post-implementation-verification/scripts/verify-postconditions.sh
  V-07 PASS · V-08 FAIL (312) · V-09 Reconciliação PASS · Payout L/D PASS · WIN PENDENTE · V-10 PASS
$ docker compose -p verify-4b7e0d2 down -v
$ bash agents/post-implementation-verifier/scripts/health-check.sh after
[OK]   nada alterado — fingerprint igual e HEAD igual
```

## Resposta

```yaml
task_id: MA-4
agent: post-implementation-verifier
status: DONE
summary: |
  MA-4 verificada no commit 4b7e0d2, ambiente ephemeral. Testes do gate verdes (3/3), mas a
  pós-condição V-08 encontrou 312 contratos presos em FAILED_RETRYABLE, todos de ativos Forex.
  Anti-cross, reconciliação e ativo pausado passaram. WIN pendente (D-19). Nada alterado no repositório.
artifacts: []
evidence:
  - pnpm vitest run tests/integration/contracts-multi-asset.test.ts → exit 0; 3 passed
  - verify-postconditions V-07 → 0 linhas (9.814 SETTLED)
  - verify-postconditions V-08 → 312 linhas, status FAILED_RETRYABLE, symbols EURUSD_OTC, GBPUSD_OTC, …
  - verify-postconditions V-09 → reconciliation_runs OK, divergence_minor 0
  - health-check before/after → 3e1f9a… = 3e1f9a…
acceptance_criteria_met:
  - criterion: Nenhum contrato liquidado com tick de outro ativo
    met: true
    evidence: V-07, 0 linhas
  - criterion: Todo contrato vencido liquida em até 10 s
    met: false
    evidence: V-08, 312 linhas
  - criterion: Reconciliação OK com divergência 0
    met: true
    evidence: V-09, reconciliation_runs OK
  - criterion: Ativo PAUSED não recebe contrato novo
    met: true
    evidence: V-10, 0 linhas
confidence_score: 0.92
verification:
  commit: 4b7e0d2
  base: 1d9e3c0
  environment: ephemeral
  window: { start: 2026-06-10T14:02:00Z, end: 2026-06-10T14:10:00Z }
  fingerprint: { before: 3e1f9a…, after: 3e1f9a… }
  tests_diff_check: PASS — 1 arquivo novo, nenhuma asserção removida
  gate_runs:
    - { command: pnpm vitest run tests/integration/contracts-multi-asset.test.ts, exit_code: 0, attempt: 1, summary: 3 passed }
  guarantees:
    V-07: { result: PASS, evidence: 0 linhas }
    V-08: { result: FAIL, evidence: 312 contratos FAILED_RETRYABLE > 10 s, só Forex }
    V-09: { result: PASS, evidence: "reconciliação OK; LOSS/DRAW 0 linhas; WIN PENDENTE (D-19)" }
    V-10: { result: PASS, evidence: 0 linhas }
    V-13: { result: PASS, evidence: fingerprint igual; diff de testes sem enfraquecimento }
  failures:
    - id: V-08
      detail: 312 contratos presos; nenhum de Cripto, Commodities ou Sintéticos
      reproduce: consulta V-08 da skill 10 com a janela acima
      route_to: bug-fix-agent
  verdict: REPROVADO
decisions_cited: [V-07, V-08, V-09, V-10, V-13, D-19, PV-02, PV-08, PV-12]
pending:
  - D-19 — arredondamento do payout de WIN
handoff_notes:
  - V-08 → bug-fix-agent — "contratos Forex presos em FAILED_RETRYABLE; o teste do gate não cobre liquidação de Forex"
  - V-08 → qa-resilience-agent — "acrescentar ativo Forex ao teste de liquidação do gate"
```

## Por que este é o comportamento certo

- O teste verde não fechou o gate; a consulta no banco é que decide (`PV-02`).
- O verificador não abriu o settlement worker para achar a linha do bug (`PV-08`, `PV-11`).
- A lacuna do teste também foi encaminhada, para o mesmo defeito não voltar escondido.
