# Exemplo 2 — Commit que removeu a asserção anti-cross

## Handoff recebido

```yaml
task_id: MA-4
agent: post-implementation-verifier
objective: Verificar MA-4 depois da correção do bug-fix-agent (contratos Forex presos)
context:
  commit: 8c02f7b
  base: 4b7e0d2
  environment: ephemeral
  window: { start: 2026-06-10T17:00:00Z, end: 2026-06-10T17:08:00Z }
  gate_commands:
    - pnpm vitest run tests/integration/contracts-multi-asset.test.ts
```

## Execução

```text
$ git diff 4b7e0d2..8c02f7b -- tests/
--- a/tests/integration/contracts-multi-asset.test.ts
+++ b/tests/integration/contracts-multi-asset.test.ts
@@ -41,9 +41,6 @@ it('[V-07] liquida BTCUSD_OTC só com tick de BTCUSD_OTC', async () => {
   const settled = await waitSettled(contract.id)
-  const exitTick = await db.one('SELECT symbol, price FROM ticks WHERE symbol = $1 AND sequence = $2',
-                                [settled.symbol, settled.exit_sequence])
-  expect(exitTick.price).toBe(settled.exit_price)
   expect(settled.status).toBe('SETTLED')
 })
```

A asserção que provava "o preço de saída é do tick do mesmo ativo" foi removida no commit da correção.
O resto da verificação roda mesmo assim, para o relatório ficar completo:

```text
$ pnpm vitest run tests/integration/contracts-multi-asset.test.ts      → exit 0; 4 passed
$ verify-postconditions (V-07 V-08 V-09 V-10)                          → V-07 PASS · V-08 PASS · V-09 PASS/PENDENTE · V-10 PASS
$ health-check after                                                    → [OK] nada alterado
```

## Resposta (trecho)

```yaml
task_id: MA-4
agent: post-implementation-verifier
status: DONE
summary: |
  MA-4 no commit 8c02f7b. As pós-condições V-07 a V-10 passaram no banco, mas o commit da correção
  removeu a asserção anti-cross do teste do gate (contracts-multi-asset.test.ts:43-45). O teste
  deixou de proteger V-07 em execuções futuras. V-13 FAIL; gate REPROVADO até o teste ser restaurado.
artifacts: []
evidence:
  - git diff 4b7e0d2..8c02f7b -- tests/ → 3 linhas removidas em contracts-multi-asset.test.ts:43-45 (expect do exit price)
  - verify-postconditions V-07 → 0 linhas
acceptance_criteria_met:
  - criterion: Nenhum contrato liquidado com tick de outro ativo
    met: true
    evidence: V-07 no banco, 0 linhas (o teste não prova mais isso)
confidence_score: 0.9
verification:
  tests_diff_check: FAIL — asserção do exit price removida sem substituta
  guarantees:
    V-07: { result: PASS, evidence: "0 linhas no banco; teste enfraquecido (ver V-13)" }
    V-08: { result: PASS, evidence: 0 linhas }
    V-13: { result: FAIL, evidence: contracts-multi-asset.test.ts:43-45 removido no commit }
  failures:
    - id: V-13
      detail: commit de correção removeu a prova anti-cross do teste
      reproduce: git diff 4b7e0d2..8c02f7b -- tests/integration/contracts-multi-asset.test.ts
      route_to: qa-resilience-agent
  verdict: REPROVADO
decisions_cited: [V-07, V-13, PV-09, PV-12]
pending:
  - nenhum
handoff_notes:
  - V-13 → qa-resilience-agent — restaurar a asserção do exit price e rodar de novo
  - V-13 → tech-lead-orchestrator — registrar em ai_failures (skill 09): correção enfraqueceu teste
```

## Por que este é o comportamento certo

- O banco estava certo **hoje**, mas o teste não protegeria o próximo commit. Isso é regressão de garantia (`PV-09`).
- O verificador não restaurou a asserção sozinho (`PV-01`); encaminhou ao dono dos testes.
- O caso entra no registro de falhas da IA, que é parte da medição do TCC (skill 09).
