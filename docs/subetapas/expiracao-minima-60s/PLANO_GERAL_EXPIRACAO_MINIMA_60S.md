# Plano Geral — Piso Inviolável de Expiração Mínima de 60 Segundos (`>= 60s`)

**Orquestrador**: `tech-lead-orchestrator`  
**Status**: EM EXECUÇÃO SEQUENCIAL POR GATES  
**Regra de Ouro (Invariante de Domínio)**: **O tempo mínimo de expiração de qualquer operação na plataforma é de 60 segundos (`duration_seconds >= 60`, `durationMs >= 60_000`).** Nenhuma operação pode ser exibida, calculada, enviada ou aceita pelo servidor com duração inferior a 60 segundos.

---

## 1. Alocação de Agentes Especialistas e Skills Ativadas

| Agente Especialista | Permissão | Escopo na Feature | Skills Ativadas |
| :--- | :--- | :--- | :--- |
| **`broker-architect-agent`** | `architecture-design` / `write-code` | Modelagem matemática do rollover de velas (`CANDLE_1M`, `CANDLE_5M`, `1M_FIXED`) e invariante temporal `expires_at - opened_at >= 60s`. | `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine` |
| **`backend-implementation-agent`** | `write-code` (`packages/shared/**`, `services/api/**`, `scripts/**`) | Atualização do `OpenContractSchema` (`min(60).max(300)`), blindagem em `ContractService.openContract` (`Math.max(60, ...)`) e `scripts/dev-live-feed.mjs`. | `02-financial-invariants`, `04-security-iam`, `05-resilience-patterns`, `08-database-foundation` |
| **`frontend-realtime-agent`** | `write-code` (`apps/web/src/trade/**`, `apps/web/src/api/**`) | Atualização de `expiry-calculator.ts` (piso `60s` e rollover quando `remSec < 60`), `OrderTicket.tsx` e `api/client.ts`. | `01-project-context`, `03-synthetic-market-engine`, `17-mudanca-cirurgica` |
| **`security-reviewer`** | `read-only` (Veto S-01 a S-06) | Auditoria de `OpenContractSchema.strict()`, prevenção de Mass Assignment (`S-05`), rejeição de payloads `< 60s`, floats, negativos, `NaN` e `Infinity`. | `04-security-iam`, `09-ai-failure-map` |
| **`financial-correctness-reviewer`** | `read-only` (Veto I-01 a I-06) | Garantia de que a autoridade temporal pertence ao servidor (`I-03`, `I-04`), sem manipulação de `expires_at` pelo cliente e preservação de `stake_minor` inteiro. | `02-financial-invariants`, `09-ai-failure-map` |
| **`qa-resilience-agent`** & **`regression-guardian-agent`** | `write-tests-only` / `read-only` | Execução dos testes de estresse, segurança, caos e regressão a cada subetapa antes de avançar para a próxima. | `06-testing-quality`, `10-post-implementation-verification`, `19-testes-de-regressao-visual` |

---

## 2. Diagnóstico Forense (Locais Exatos com Piso Antigo de 30s)

1. **`packages/shared/src/types.ts` (linha 11) e `packages/shared/dist/types.js` (linha 6)**:
   - Estado anterior: `duration_seconds: z.number().int().min(30).max(300).optional()`
   - Correção: `duration_seconds: z.number().int().min(60).max(300).optional()` (Piso inviolável de 60s).
2. **`services/api/src/services/contract-service.ts` (linhas 111–114) e `services/api/dist/services/contract-service.js` (linhas 72–74)**:
   - Estado anterior: `const safeDurationSeconds = Math.max(30, Math.min(300, requestedDuration));`
   - Correção: `const safeDurationSeconds = Math.max(60, Math.min(300, requestedDuration));`
3. **`scripts/dev-live-feed.mjs` (linhas 2653–2675)**:
   - Estado anterior: `safeDurationMs = Math.max(30_000, ...)` e rollover em `remSec < 30`.
   - Correção: `safeDurationMs = Math.max(60_000, ...)` e rollover em `remSec < 60`.
4. **`apps/web/src/trade/expiry-calculator.ts` (linhas 47–135)**:
   - Estado anterior: `calculateExpirySlots` e `calculateExecutionExpiry` aplicavam rollover em `remSec < 30` e piso `Math.max(30, ...)` / `Math.max(30_000, diffMs)`.
   - Correção: Rollover de vela quando `remSec < 60` e piso incondicional `Math.max(60, ...)` / `Math.max(60_000, diffMs)`.
5. **`apps/web/src/trade/OrderTicket.tsx` (linhas 162 e 277)**:
   - Estado anterior: `const durationSeconds = Math.max(30, Math.round(durationMs / 1000));` e fallback visual `'00:21'`.
   - Correção: `const durationSeconds = Math.max(60, Math.min(300, Math.round(durationMs / 1000)));` e fallback visual `'01:00'`.
6. **`apps/web/src/api/client.ts` (linhas 425–434 e 500–507)**:
   - Estado anterior: `durationMs = Math.max(30_000, durationSeconds * 1000)` e filtro `durationSeconds >= 30`.
   - Correção: `durationMs = Math.max(60_000, durationSeconds * 1000)`, `safeDurationSeconds = Math.max(60, durationSeconds)` e filtro estrito `durationSeconds >= 60 && durationSeconds <= 300`.

---

## 3. Divisão em Subetapas com Gate de Validação 100%

- **[SUBETAPA 01](./SUBETAPA_01_CONTRATO_DTO_E_MOTOR_BACKEND_60S.md)**: Contrato DTO Compartilhado (`@broker/shared`), `ContractService` e BFF (`dev-live-feed.mjs`) com Piso Inviolável de 60s.
- **[SUBETAPA 02](./SUBETAPA_02_CALCULADORA_EXPIRACAO_BOLETA_E_CLIENTE_60S.md)**: Calculadora de Expiração (`expiry-calculator.ts`), Boleta (`OrderTicket.tsx`) e Cliente HTTP (`api/client.ts`) com Piso Inviolável de 60s.
- **[SUBETAPA 03](./SUBETAPA_03_CERTIFICACAO_ESTRESSE_SEGURANCA_CAOS_60S.md)**: Certificação Final — Bateria de Testes de Estresse, Segurança, Caos e Regressão End-to-End (`>= 60s`).

> [!IMPORTANT]
> **Regra de Progressão**: Cada subetapa só é considerada concluída após 100% dos seus testes unitários, de segurança, estresse, caos e regressão passarem sem erros (`0 failed`).
