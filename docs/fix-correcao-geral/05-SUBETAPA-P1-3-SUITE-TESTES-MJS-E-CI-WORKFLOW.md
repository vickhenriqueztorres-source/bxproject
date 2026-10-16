# Subetapa 05 (P1-3) — Testes `.mjs` Integrados ao `pnpm test` e Pipeline `.github/workflows/ci.yml`

**Item:** `P1-3` (Alta Prioridade — Qualidade e Integração Contínua)  
**Agentes:** `qa-resilience-agent` + `backend-implementation-agent` (Implementação) | `regression-guardian-agent` + `post-implementation-verifier` (Revisão e Verificação)  
**Skills:** `06-testing-quality`, `07-production-operations`, `09-ai-failure-map`, `10-post-implementation-verification`

---

## 1. Diagnóstico do Problema

1. Os arquivos `.test.mjs` do repositório usam o runner nativo `node:test` (`import test from 'node:test'` e `import { describe, it } from 'node:test'`).
2. O `vitest.config.ts` só inclui arquivos `.test.{ts,tsx}` (e o Vitest não executa `import test from 'node:test'` nativamente da mesma forma que `node --test`).
3. No `package.json`, não existe script `test:mjs` nem `test` unificado, e não existe `.github/workflows/ci.yml`.
4. Além disso, 4 testes `.test.ts` antigos em `tests/unit/` ficaram defasados em relação às entregas recentes já em produção (`#11` velas reais com `last_sequence`, `#12` `serializeContract` com `entry_price`/`strike_price`, `#7` expansão LATAM de 6 para 18 países e 15 moedas, e timeout/hoisting de mock em 2 testes).

---

## 2. Decisão Técnica (Opção B Justificada)

Escolhemos a **Opção B** do prompt:
- **Justificativa:** Os testes `.test.mjs` utilizam `node:test` (`import test from 'node:test'`, `t.before`, `t.after`, subtestes `await t.test(...)`) e `node:assert/strict`, que são nativos do Node.js 22 e incompatíveis com a API de globals do Vitest.
- Portanto, criamos no `package.json`:
  - `"test:mjs"`: executa todos os testes unitários e de subetapa `.test.mjs` em `tests/*.test.mjs`, `tests/unit/*.test.mjs` e `scripts/**/*.test.mjs` via `node --test`.
  - `"test"`: executa `pnpm test:unit && pnpm test:mjs`, garantindo que um único comando `pnpm test` rode toda a suíte Vitest + toda a suíte `.mjs`.

---

## 3. Passo a Passo de Implementação

### Passo 1 — Atualização de `package.json` e Runner `scripts/run-mjs-tests.mjs`
- Como no Windows/PowerShell e no Linux (bash) a expansão de múltiplos globs com `**` no `node --test` pode variar conforme o shell, criar um runner leve e determinístico `scripts/run-mjs-tests.mjs` (ou passar os padrões suportados pelo Node 22) que descobre recursivamente todos os arquivos `tests/*.test.mjs`, `tests/unit/*.test.mjs` e `scripts/**/*.test.mjs` (e opcionalmente `tests/integration/p0-*.test.mjs`) e os executa via `run()` de `node:test` / `child_process`, falhando com `exit(1)` se qualquer teste falhar.
- Atualizar `package.json`:
  ```json
  "test": "pnpm test:unit && pnpm test:mjs",
  "test:unit": "vitest run tests/unit",
  "test:mjs": "node scripts/run-mjs-tests.mjs"
  ```

### Passo 2 — Alinhamento dos 4 Testes `.test.ts` Defasados em `tests/unit/`
Sem afrouxar nenhuma invariante (apenas refletindo as decisões já em produção na `main`):
1. `tests/unit/bmr-http-adapter.test.ts`: o contrato canônico de `POST /api/v1/contracts` (Relatório #12) retorna `{ id, expires_at, status, entry_price, strike_price }`.
2. `tests/unit/chart-boot-gap.test.ts`: `safeCandleFromTick` (Relatório #11) inclui `last_sequence` na vela criada a partir do tick.
3. `tests/unit/test-phase2-subetapa-1-schemas.test.ts`: a matriz LATAM expandida (Relatório #7, commit `0f89847`) possui 18 países e 15 moedas.
4. `tests/unit/client-no-simulated-quotes.test.ts` e `tests/unit/test-minimum-expiry-60s-certification.test.ts`: corrigir hoisting de `let mockGuestMode = false` (usando `vi.hoisted`) e limpar timers no teardown para evitar `ReferenceError` pós-teste, e ajustar timeout da varredura de arquivos estáticos para `15000ms`.

### Passo 3 — Criação de `.github/workflows/ci.yml`
Criar `.github/workflows/ci.yml` com:
- Triggers: `pull_request` e `push` (branches `main`, `fix/**`, `feat/**`).
- Node.js `22` + `pnpm/action-setup@v4` (pnpm `10.5.2`).
- Steps:
  1. `pnpm install --frozen-lockfile`
  2. `pnpm --filter @broker/shared build` (para tipos compartilhados)
  3. Typecheck (`pnpm --filter @broker/web exec tsc --noEmit`)
  4. `pnpm test:unit`
  5. `pnpm test:mjs`

---

## 4. Critérios de Aceite e Testes de Validação

1. `pnpm test` executa 100% dos testes Vitest (`test:unit`) + todos os testes `.test.mjs` (`test:mjs`) com exit code `0`.
2. Teste automatizado `tests/unit/p1-3-ci-and-test-runner.test.mjs` verifica a existência e validade de `.github/workflows/ci.yml` e dos scripts `test`, `test:unit` e `test:mjs` no `package.json`.
