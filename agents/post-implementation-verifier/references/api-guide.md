# Guia de referência — post-implementation-verifier

## Posição na cadeia do §8

```text
implementador ─▶ qa-resilience-agent ─▶ revisores (financeiro, segurança) ─▶ post-implementation-verifier ─▶ merge
                                                                                     │
                                                                          FAIL ──────┴─▶ bug-fix-agent ─▶ (volta ao QA)
```

O verificador é o último passo antes do merge. Ele não substitui o `gate.sh`: o `gate.sh` roda os
comandos e grava a evidência; o verificador confirma que a evidência prova as garantias.

## Garantias por etapa

IDs `V-xx` da skill `10-post-implementation-verification`.

| `task_id` | Etapa | Garantias | Comandos de teste do gate (padrão) |
|-----------|-------|-----------|------------------------------------|
| `MA-1` | Seed de ativos | V-01, V-13 | `node tests/test-multi-01-db-seed.mjs` |
| `MA-2` | Tick Engine com N ativos | V-02, V-03, V-04, V-05, V-13 | `node tests/test-multi-02-tick-engine.mjs` |
| `MA-3` | Candle Worker e `/candles` | V-05, V-06, V-13 | `node tests/test-multi-03-candles-api.mjs` |
| `MA-4` | Contratos e settlement | V-07, V-08, V-09, V-10, V-13 | `pnpm vitest run tests/integration/contracts-multi-asset.test.ts` |
| `MA-5` | WebSocket único | V-11, V-13 | `pnpm vitest run tests/unit/ws-single-connection.test.ts` + teste de integração com 2 gateways |
| `MA-6` | Grade de gráficos | V-11 (cliente), V-13 | `pnpm vitest run tests/unit/multi-grid-layout.test.tsx` |
| `E1` | Ramp N_max | V-02–V-05, V-12, V-13 | `k6 run --summary-export summary.json tests/load/e1-ramp.js` |
| `E2` | WS fan-out | V-11, V-12, V-13 | `k6 run --summary-export summary.json tests/load/e2-ws-fanout.js` |
| `E3` | Pico com dinheiro | V-07–V-09, V-12, V-13 | `k6 run --summary-export summary.json tests/load/e3-money-peak.js` |
| `E4` | Caos C-01 / C-05 | V-02–V-13 | `bash tests/chaos/c01-leader-kill.sh`, `bash tests/chaos/c05-redis-restart.sh` |
| `T01`–`T18` | Fase 1 | Pelo componente tocado (skill 10, "Garantias por subetapa") | Os do `prompts/Txx.md` |

Os nomes de arquivo são os do plano multi-ativos. Se o handoff trouxer outros `gate_commands`, valem os do handoff.

## Critérios de ambiente

| Verificação | Aceito | Recusado (`BLOCKED — unsafe_environment`) |
|-------------|--------|-------------------------------------------|
| `ENVIRONMENT` | `ephemeral`, `ci` | Qualquer outro valor ou ausente |
| Projeto do Compose | `verify-<sha>` ou o do CI | `synth`, `default`, nome do ambiente compartilhado |
| URL do banco | `localhost`, `127.0.0.1`, host do CI | Contém `prod`, `production`, `staging`, endpoint RDS |
| Role do banco nas consultas | `auditor_ro` | Qualquer role com escrita |

## Comandos permitidos

| Tipo | Comandos |
|------|----------|
| Git (leitura) | `git rev-parse`, `git log`, `git diff`, `git show`, `git status` |
| Ambiente | `docker compose -p verify-<sha> up -d --wait`, `... down -v` |
| Testes | Exatamente os `gate_commands` do handoff |
| Pós-condições | `bash skills/10-post-implementation-verification/scripts/verify-postconditions.sh` |
| Triagem | `bash skills/10-post-implementation-verification/scripts/health-check.sh` |
| Fingerprint | `bash agents/post-implementation-verifier/scripts/health-check.sh before|after` |

Qualquer outro comando que escreva no repositório, no banco ou no Redis viola `PV-01`.

## Diff de testes (PV-09)

Procurar em `git diff <base>..<commit> -- tests/ '**/*.test.*' '**/*.spec.*' tests/load tests/chaos`:

| Sinal | Por que importa |
|-------|-----------------|
| Linha `expect(...)` removida sem substituta | Garantia deixou de ser testada |
| `.skip(` / `.only(` / `it.todo(` novo sem pendência declarada | Teste deixou de rodar |
| `retry` / `retries` / `retryTimes` novo | Flaky escondido |
| Threshold do k6 afrouxado (`p(95)<300` → `p(95)<900`) | SLO trocado sem decisão |
| Consulta de verificação trocada por mock | Pós-condição deixou de existir |

Achado de diff → `V-13 FAIL` e `handoff_notes` para o `qa-resilience-agent`, com o trecho do diff.

## Modelo de handoff (entrada)

```yaml
task_id: MA-4
agent: post-implementation-verifier
objective: Verificar a subetapa 4 (contratos e settlement multi-ativos) antes do merge
context:
  commit: 4b7e0d2
  base: 1d9e3c0
  environment: ephemeral
  compose_project: verify-4b7e0d2
  window: { start: 2026-06-10T14:02:00Z, end: 2026-06-10T14:10:00Z }
  gate_commands:
    - pnpm vitest run tests/integration/contracts-multi-asset.test.ts
  expected_catalog: docs/multi-ativos/catalogo.json   # só MA-1
skills: [01-project-context, 06-testing-quality, 10-post-implementation-verification, 02-financial-invariants, 08-database-foundation]
acceptance_criteria:
  - Nenhum contrato liquidado com tick de outro ativo (V-07)
  - Todo contrato vencido liquida em até 10 s (V-08)
  - Reconciliação OK com divergência 0 (V-09)
  - Ativo PAUSED não recebe contrato novo (V-10)
```

## Roteamento de falhas

| Garantia em `FAIL` | Destino |
|--------------------|---------|
| V-01 | `backend-implementation-agent` (seed) |
| V-02, V-03, V-04, V-05, V-06, V-07, V-08, V-10 | `bug-fix-agent` |
| V-09 (divergência no ledger) | `bug-fix-agent` + `financial-correctness-reviewer` (alerta) |
| V-11 | `bug-fix-agent` + `security-reviewer` (se for limite de conexão) |
| V-12 | `bug-fix-agent` (se o sistema não atende) ou `qa-resilience-agent` (se o threshold falta) |
| V-13 | `qa-resilience-agent` + orquestrador (o gate inteiro fica `INVÁLIDO`) |
| Ambiente | Orquestrador (`BLOCKED`) |
