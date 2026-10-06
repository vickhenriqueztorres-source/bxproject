# Exemplo 2 — T10: alerta `ContractsStuckExpiring` em staging

Incidente em staging depois de um failover do Tick Engine. A correção óbvia viola B-08.

## Entrada (handoff do orquestrador)

```yaml
task_id: T10
agent: bug-fix-agent
objective: Contratos ficam presos em EXPIRING após failover do Tick Engine e acabam na DLQ.
defect_ref: alert:ContractsStuckExpiring (staging, 2026-10-02T14:03Z) + alert:FinancialDLQNotEmpty
owner: backend-implementation-agent
environment: staging
reproduction: >
  Failover do líder do Tick Engine (gap de 3 s sem ticks). 11 contratos com expires_at dentro do gap
  ficam EXPIRING; após N tentativas vão para a DLQ de contracts:expiring.
skills: [01-project-context, 02-financial-invariants, 03-synthetic-market-engine, 05-resilience-patterns, 07-production-operations]
acceptance_criteria:
  - Contrato com expires_at dentro de um gap de ticks liquida com o primeiro tick oficial após o gap
  - Nenhuma leitura de preço fora do Postgres no settlement
budget: { max_steps: 40, max_tokens: 120000, timeout: 30m }
```

## 1. Triagem e rollback

`E5` — incidente. Antes de corrigir, avaliar o rollback (FX-14, O-06): o último deploy (T15, dashboards)
não tocou o settlement e o comportamento existe desde T10. Um rollback não resolveria; seguir com a correção.

## 2. Reprodução (FX-01)

Loki, na janela do alerta:

```text
settlement-worker  level=warn  msg="exit tick not found, NACK"  contract_id=c_81…  attempt=5
settlement-worker  level=error msg="moved to DLQ"               contract_id=c_81…  stream=contracts:expiring
```

Teste de integração local (o QA mantém o arquivo, este agente só roda):

```text
$ pnpm vitest run tests/chaos/settlement.tick-gap.test.ts
✗ [C-03] contrato expira durante gap de 3 s → liquida com o primeiro tick após o gap
  expected status SETTLED, received EXPIRING (após 5 tentativas)
```

## 3. Hipóteses (FX-11)

| # | Hipótese | Experimento | Resultado |
|---|----------|-------------|-----------|
| 1 | O worker não recebe a mensagem | `XPENDING contracts:expiring` | Descartada: mensagem entregue e reentregue 5× |
| 2 | A consulta do tick de saída tem janela fechada | Ler `find-exit-tick.ts` | **Confirmada**: `ts < expires_at + interval '1 second'` |

## 4. Causa raiz (FX-02)

```text
contratos na DLQ
  ← NACK repetido até o limite de tentativas
  ← find-exit-tick.ts:14 só aceita tick em [expires_at, expires_at + 1 s)
  ← em gap > 1 s a janela fica vazia para sempre; §9.4 pede "primeiro tick com ts >= expires_at", sem limite superior
introduced_in: T10
```

## 5. Correções recusadas

| Proposta | Por que não |
|----------|-------------|
| Ler `tick:last:SYN100` do Redis quando não houver tick no banco | B-08 e D-04: preço oficial só do Postgres; Redis é distribuição |
| Usar o último tick **antes** de `expires_at` | Muda a regra de preço de saída (decisão, não correção) |
| Liquidar como `DRAW` quando não houver tick | FC-09: sem tick → NACK, nunca DRAW |
| Aumentar a janela para 10 s | Só muda o tamanho do gap que quebra; continua violando §9.4 |
| Aumentar `maxDeliveries` | Esconde o problema e atrasa a DLQ |

## 6. Regressão (FX-07)

O teste de caos do QA `[C-03]` é a regressão. A consulta também ganha um unit com um repositório em memória:

```ts
// services/settlement-worker/src/find-exit-tick.unit.test.ts
it('[DEF-T10-2] gap de 3 s após expires_at → usa o primeiro tick depois do gap', async () => {
  const ticks = inMemoryTicks([
    { sequence: 100n, ts: '2026-10-02T14:02:59.000Z', price_minor: 1_000_000n },
    { sequence: 101n, ts: '2026-10-02T14:03:03.000Z', price_minor: 1_000_420n },
  ]);
  const exit = await findExitTick(ticks, 'SYN100', new Date('2026-10-02T14:03:00.000Z'));
  expect(exit?.sequence).toBe(101n);
});
```

Antes da correção: `expected undefined to be 101n` (vermelho).

## 7. Correção mínima

```ts
// services/settlement-worker/src/find-exit-tick.ts (antes)
WHERE symbol = $1 AND ts >= $2 AND ts < $2 + interval '1 second'
ORDER BY ts, sequence LIMIT 1

// depois
WHERE symbol = $1 AND ts >= $2
ORDER BY ts, sequence LIMIT 1
```

O índice `(symbol, ts)` existente cobre a consulta. Diff: 1 arquivo de código e 1 de teste, 4 linhas.

## 8. Verificação (FX-09)

```text
$ pnpm vitest run services/settlement-worker/src/find-exit-tick.unit.test.ts → 1 passed
$ pnpm vitest run tests/chaos/settlement.tick-gap.test.ts                    → [C-03] passed
$ pnpm vitest run services/settlement-worker                                 → 38 passed
$ bash skills/03-synthetic-market-engine/scripts/health-check.sh services    → 0 FAIL
$ bash agents/backend-implementation-agent/scripts/health-check.sh .         → 0 FAIL
$ bash agents/bug-fix-agent/scripts/health-check.sh --base origin/main --defect DEF-T10-2 . → 0 FAIL
```

## 9. Dados afetados

Nenhum saldo ficou errado: os 11 contratos estão `EXPIRING` com o stake em `user:reserved`, como manda o fluxo.
Eles precisam de **redrive** da DLQ depois do deploy. O settlement é idempotente (`settlement:{id}`), mas
redrive de DLQ financeira é ação operacional com aprovação humana (R-05). Não é reparo de dados.

## Saída

```yaml
task_id: T10
agent: bug-fix-agent
status: DONE
summary: >
  ContractsStuckExpiring tinha como causa uma janela fechada de 1 s na busca do tick de saída
  (find-exit-tick.ts:14), contrária ao §9.4. Correção: primeiro tick com ts >= expires_at, sem limite
  superior. Recusadas: Redis tick:last, último tick antes da expiração, DRAW e janela maior. [C-03] e o
  unit [DEF-T10-2] estão verdes. Rollback não ajudaria (bug desde T10). 11 contratos aguardam redrive aprovado.
artifacts:
  - services/settlement-worker/src/find-exit-tick.ts
  - services/settlement-worker/src/find-exit-tick.unit.test.ts
evidence:
  - Loki janela 14:03Z → "exit tick not found, NACK" ×5 → DLQ
  - vitest settlement.tick-gap [C-03] → antes failed (EXPIRING); depois passed (SETTLED)
  - vitest find-exit-tick.unit → antes vermelho; depois 1 passed
  - health-check skill 03, backend e bug-fix → 0 FAIL
acceptance_criteria_met:
  - criterion: Contrato com expires_at dentro de um gap liquida com o primeiro tick oficial após o gap
    met: true
    evidence: tests/chaos/settlement.tick-gap.test.ts::"[C-03] …" → passed
  - criterion: Nenhuma leitura de preço fora do Postgres no settlement
    met: true
    evidence: health-check backend B-08 → 0 FAIL; find-exit-tick.ts consulta só a tabela ticks
confidence_score: 0.92
fixes:
  - defect_ref: alert:ContractsStuckExpiring
    category: E5
    reproduction:
      command: pnpm vitest run tests/chaos/settlement.tick-gap.test.ts
      before: EXPIRING após 5 tentativas → DLQ
      after: SETTLED com o tick sequence 101
    hypotheses:
      - { hypothesis: mensagem não entregue, experiment: XPENDING, result: descartada }
      - { hypothesis: janela fechada na consulta, experiment: leitura de find-exit-tick.ts, result: confirmada }
    root_cause:
      location: services/settlement-worker/src/find-exit-tick.ts:14
      chain: DLQ ← NACK até o limite ← janela [expires_at, +1 s) vazia em gap > 1 s
      introduced_in: T10
    change:
      files: [find-exit-tick.ts, find-exit-tick.unit.test.ts]
      lines_changed: 4
      migration: nenhuma
    regression_test:
      test: services/settlement-worker/src/find-exit-tick.unit.test.ts::"[DEF-T10-2] gap de 3 s após expires_at → usa o primeiro tick depois do gap"
      red_before: true
      green_after: true
    rules_checked: [B-08, I-04, M-02, R-05, R-06, FC-09]
data_repair: none
data_repair_plan:
  - nenhum (saldos corretos; stake segue em user:reserved)
rereview_required: [financial-correctness-reviewer, qa-resilience-agent]
rollback: revert do commit (sem migration)
decisions_cited: [D-04, B-08, FC-09, R-05, O-06, FX-02, FX-07, FX-14]
pending:
  - Redrive da DLQ contracts:expiring (11 mensagens) após o deploy, com aprovação humana (R-05)
  - Teto de espera por tick antes de alertar: <não definido no contexto>
```
