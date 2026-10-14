# Subetapa 02 — Calculadora de Expiração (`expiry-calculator.ts`), Boleta (`OrderTicket.tsx`) e Cliente HTTP (`api/client.ts`)

**Agentes Responsáveis**: `frontend-realtime-agent`, `surgical-frontend-agent`, `compliance-risk-reviewer`  
**Skills**: `01-project-context`, `03-synthetic-market-engine`, `17-mudanca-cirurgica`, `18-zonas-sensiveis`  
**Pré-requisito**: Subetapa 01 100% implementada e validada.

---

## 1. Objetivo da Subetapa

Garantir que o frontend (calculadora de slots de expiração, boleta `OrderTicket` e adaptador HTTP `openContract` em `api/client.ts`) aplique de ponta a ponta o **piso mínimo de 60 segundos (`>= 60s` / `60_000ms`)**, sem jamais exibir ou enviar durações inferiores a 60 segundos, e preservando 100% da compatibilidade com os contratos de payload estrito (`AC-BMR-03`, `S-05`) e sessões reais.

---

## 2. Passo a Passo Cirúrgico de Implementação

### Passo 2.1 — Atualizar `apps/web/src/trade/expiry-calculator.ts`
- **Função `calculateExpirySlots(now, timeZoneOffsetHours)`**:
  - Slot `1M_FIXED` (`turbo_1m`): mantém `remainingSeconds: 60`, `durationSeconds: 60`, `targetEpochMs: nowMs + 60_000`.
  - Slot `CANDLE_1M` (`candle_1m`):
    - Como o piso mínimo é `60s`, se `rem1mSec < 60`, avança para o fechamento da vela seguinte (`cur1mEndMs + 60_000`).
    - `final1mSec = Math.max(60, Math.floor((target1mMs - nowMs) / 1000))`.
  - Slot `CANDLE_5M` (`candle_5m`):
    - Se `rem5mSec < 60`, avança para o próximo bloco de 5 minutos (`cur5mEndMs + 300_000`).
    - `final5mSec = Math.max(60, Math.floor((target5mMs - nowMs) / 1000))`.
- **Função `calculateExecutionExpiry(mode, nowMs)`**:
  - Sanitizar `nowMs` (fallback seguro para `Date.now()` se `!Number.isFinite(nowMs)`).
  - Em `CANDLE_1M`: `targetEpochMs = remSec < 60 ? cur1mEndMs + 60_000 : cur1mEndMs`.
  - Em `CANDLE_5M`: `targetEpochMs = remSec < 60 ? cur5mEndMs + 300_000 : cur5mEndMs`.
  - Em `1M_FIXED`: `targetEpochMs = safeNowMs + 60_000`.
  - Piso inviolável: `const durationMs = Math.max(60_000, diffMs);`

### Passo 2.2 — Atualizar `apps/web/src/trade/OrderTicket.tsx`
- Em `handleExecute`:
  - `const durationSeconds = Math.max(60, Math.min(300, Math.round(durationMs / 1000)));`
- No display de expiração (`formattedExpiryDisplay`):
  - Fallback seguro `'01:00'` em vez de `'00:21'`.

### Passo 2.3 — Atualizar `apps/web/src/api/client.ts`
- No fallback Guest Mode (`isGuestMode()`):
  - `const safeDurationSeconds = Math.max(60, Math.min(300, Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : 60));`
  - `const durationMs = Math.max(60_000, safeDurationSeconds * 1000);`
- Na requisição autenticada `POST /api/v1/contracts`:
  - Enviar `duration_seconds` somente quando for um inteiro válido no intervalo `[60, 300]` e (`durationSeconds !== 60 || expiryMode === 'duration'`), garantindo compatibilidade simultânea com `bmr-authenticated-contract.test.ts`, `bmr-http-adapter.test.ts`, `test-contract-custom-duration.test.ts` e `traderoom-real-session.unit.test.tsx`.

### Passo 2.4 — Atualizar Testes Unitários de Frontend e Sincronização
- Atualizar `apps/web/src/trade/expiry-calculator.unit.test.ts`, `apps/web/src/trade/smoke.unit.test.ts`, `apps/web/src/trade/ticket.unit.test.ts` e `tests/unit/test-contract-custom-duration.test.ts` para refletir o novo piso inviolável de **60 segundos** (`>= 60_000ms`).

---

## 3. Matriz de Testes da Subetapa 02 (Segurança, Estresse e Caos)

1. **Invariante Matemática de Expiração (`>= 60_000ms`)**:
   - Varredura de todos os 60 segundos de um minuto para `1M_FIXED`, `CANDLE_1M` e `CANDLE_5M`: `durationMs >= 60_000` em 100% dos casos.
2. **Segurança de Payload (`S-05`)**:
   - Caso uma duração `< 60` (ex: `30` ou `45`) ou `> 300` (ex: `3600`) seja passada para `openContract`, ela nunca é injetada indevidamente no body se violar o schema estrito.
3. **Caos na Calculadora**:
   - Passagem de `NaN` ou `Infinity` como `nowMs` em `calculateExecutionExpiry` recupera com segurança usando relógio válido e retorna `durationMs >= 60_000`.

---

## 4. Critério de Gate (Condição de Avanço para a Subetapa 03)

- Execução verde (`0 failed`) de:
  `npx vitest run apps/web/src/trade/expiry-calculator.unit.test.ts apps/web/src/trade/smoke.unit.test.ts apps/web/src/trade/ticket.unit.test.ts apps/web/src/trade/ticket-ergonomic.unit.test.tsx apps/web/src/trade/traderoom-real-session.unit.test.tsx tests/unit/bmr-authenticated-contract.test.ts tests/unit/bmr-http-adapter.test.ts tests/unit/test-contract-custom-duration.test.ts`
