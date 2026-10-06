# Example 2 — T17 caos C-08 encontra crédito duplicado

Cenário de caos que mata o Settlement Worker no meio de um lote. O teste prova a injeção, verifica
as pós-condições e encontra um defeito financeiro. O teste **fica vermelho**; o QA não toca no `src/`.

## Handoff recebido

```yaml
task_id: T17
agent: qa-resilience-agent
objective: Executar C-02 e C-08 no ambiente efêmero e reportar.
context:
  - ambiente: TARGET_ENV=ephemeral (compose + overlay tests/chaos/env/toxiproxy.yml)
  - versão: commit a1b2c3d (T10 aprovado pelo financial-correctness-reviewer em revisão estática)
skills: [01-project-context, 02-financial-invariants, 05-resilience-patterns, 06-testing-quality, 07-production-operations]
acceptance_criteria:
  - Cada contrato é liquidado exatamente uma vez após a morte do worker.
  - Pós-condições do Q-03 verdes ao final.
budget: { max_steps: 40, max_tokens: 150000, timeout: 45m }
```

## Teste

```ts
// tests/chaos/C-08-settlement-kill.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { assertNotProduction } from '../support/env'
import { startStack, killService, restartService, waitFor } from '../support/stack'
import { createSyntheticUser, uniqueSymbol, openContracts, effectsFor, assertPostConditions } from '../support/fixtures'

assertNotProduction()

describe('C-08 — matar Settlement Worker no meio do lote', () => {
  let stack: Awaited<ReturnType<typeof startStack>>
  beforeAll(async () => { stack = await startStack({ env: 'ephemeral' }) }, 180_000)

  it('[C-08][I-03][I-04] cada contrato liquidado exatamente 1×', async () => {
    const symbol = await uniqueSymbol(stack)
    const users = await Promise.all(Array.from({ length: 20 }, (_, i) => createSyntheticUser(stack, `c08-${i}`)))
    const contracts = await openContracts(stack, { users, symbol, perUser: 10, expiresAt: stack.clock.now() }) // 200, já vencidos

    await waitFor(() => stack.metrics.counter('settlements_total') >= 80)
    const before = await killService(stack, 'settlement-worker')            // kill -9
    const after = await restartService(stack, 'settlement-worker')
    expect(after.pid).not.toBe(before.pid)                                   // prova de injeção
    expect(before.settledAtKill).toBeGreaterThan(0)
    expect(before.settledAtKill).toBeLessThan(200)

    await waitFor(() => stack.db.count('contracts', { symbol, status: 'SETTLED' }) === 200, { timeout: 30_000 })

    for (const c of contracts) {
      const fx = await effectsFor(stack, c.id)
      expect(fx.settlement, `settlement de ${c.id}`).toHaveLength(1)
      expect(fx.credit.length, `créditos de ${c.id}`).toBe(c.result === 'WIN' ? 1 : 0)
    }
    await assertPostConditions(stack, { contracts, symbol })   // ledger 0, efeito 1×, reconciliação zerada, sequence, DLQ
  }, 300_000)
})
```

## Execução

```text
$ TARGET_ENV=ephemeral pnpm vitest run tests/chaos/C-02-wallet-kill-before-ack.test.ts tests/chaos/C-08-settlement-kill.test.ts
 ✓ [C-02][I-03][R-06] reentrega após kill antes do XACK → 1 transação          41.2s
 ✗ [C-08][I-03][I-04] cada contrato liquidado exatamente 1×                     63.8s
   AssertionError: créditos de 7f3e…a91: expected 2 to be 1
   effectsFor → credit:7f3e…a91:WIN:1, credit:7f3e…a91:WIN:2
   kill no pid 412 após 83 liquidações; novo pid 977
 Test Files 1 failed | 1 passed   (C-08 repetido 3× — falhou 3/3, determinístico)
```

O teste prova a injeção (PID 412 → 977, 83 liquidações antes do kill) e a falha é reproduzível.
A causa provável aparece na própria evidência: a `reference` do crédito leva um sufixo de tentativa.
O QA **não** abre o `settle.ts` para corrigir nem muda o teste para "aceitar 2 se o segundo for estornado".

## Saída

```yaml
task_id: T17
agent: qa-resilience-agent
status: DONE
summary: >
  C-02 e C-08 executados no ambiente efêmero com prova de injeção. C-02 verde. C-08 vermelho
  3/3: após kill -9 do settlement-worker, 1 dos 200 contratos recebeu 2 créditos de WIN com
  references diferentes (sufixo de tentativa). Defeito CRÍTICO roteado ao backend. Teste mantido
  vermelho; nenhum arquivo fora de tests/ alterado. Revisão estática anterior não pegou o caso.
artifacts:
  - tests/chaos/C-08-settlement-kill.test.ts
  - tests/chaos/C-02-wallet-kill-before-ack.test.ts
  - tests/acceptance/AC-T17.md
evidence:
  - TARGET_ENV=ephemeral pnpm vitest run C-02 → 1 passed (41.2s)
  - TARGET_ENV=ephemeral pnpm vitest run C-08 → 1 failed, 3/3 execuções (63.8s)
  - prova de injeção C-08 → pid 412 → 977; 83 liquidações antes do kill
  - bash agents/qa-resilience-agent/scripts/health-check.sh → 0 FAIL
acceptance_criteria_met:
  - { criterion: "Cada contrato liquidado exatamente 1× após a morte do worker", met: false, evidence: "C-08-settlement-kill.test.ts::[C-08] → failed (2 créditos)" }
  - { criterion: "Pós-condições do Q-03 verdes", met: false, evidence: "ledgerSum ≠ 0 após C-08 (assertPostConditions)" }
confidence_score: 0.95
test_results:
  unit: { passed: 0, failed: 0, todo: 0 }
  integration: { passed: 0, failed: 0, todo: 0 }
  chaos: { passed: 1, failed: 1, todo: 0 }
  load: { passed: 0, failed: 0, thresholds: [] }
rules_covered: [I-02, I-03, I-04, I-05, R-06]
coverage_gaps:
  - "C-01, C-03 a C-07 e 'reusar refresh token' (§10.3) — próximas execuções da T17"
defects:
  - id: DEF-T17-1
    severity: CRÍTICO
    test: tests/chaos/C-08-settlement-kill.test.ts::"[C-08][I-03][I-04] cada contrato liquidado exatamente 1×"
    reproduction: >
      200 contratos vencidos em 20 usuários sintéticos; kill -9 no settlement-worker após ~80
      liquidações; restart. Esperado: 1 crédito por WIN. Observado: contrato 7f3e…a91 com
      credit:<id>:WIN:1 e credit:<id>:WIN:2 — reference muda por tentativa (I-03, B-04).
    route_to: backend-implementation-agent
verdict: REPROVADO
decisions_cited: [I-03, I-04, B-04, Q-03, C-02, C-08, QA-01, QA-08, QA-10]
pending:
  - financial-correctness-reviewer: revisar T17 e reavaliar T10 à luz do DEF-T17-1
```
