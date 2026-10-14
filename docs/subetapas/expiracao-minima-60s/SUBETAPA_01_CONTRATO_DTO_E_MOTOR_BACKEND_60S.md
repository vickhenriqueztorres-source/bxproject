# Subetapa 01 — Contrato DTO Compartilhado (`@broker/shared`), `ContractService` e BFF (`60s` Inviolável)

**Agentes Responsáveis**: `backend-implementation-agent`, `security-reviewer`, `financial-correctness-reviewer`  
**Skills**: `01-project-context`, `02-financial-invariants`, `04-security-iam`, `05-resilience-patterns`  
**Pré-requisito**: Diagnóstico forense concluído no Plano Geral.

---

## 1. Objetivo da Subetapa

Garantir que a camada de validação de contratos (`OpenContractSchema`) e os motores de abertura de ordens no backend (`ContractService` e `scripts/dev-live-feed.mjs`) imponham o **piso mínimo inviolável de 60 segundos (`duration_seconds >= 60`)**, rejeitando qualquer tentativa de envio de durações inferiores a 60 segundos (incluindo `30s`, `45s`, `59s`, `0`, negativos, floats ou tipos inválidos) com erro de validação estrito (`S-05`).

---

## 2. Passo a Passo Cirúrgico de Implementação

### Passo 1.1 — Atualizar `OpenContractSchema` em `@broker/shared`
- **Arquivos**:
  - `packages/shared/src/types.ts`
  - `packages/shared/dist/types.js`
- **Alteração**:
  - Substituir `duration_seconds: z.number().int().min(30).max(300).optional()` por:
    ```ts
    duration_seconds: z.number().int().min(60).max(300).optional(), // 60s a 5min (Piso inviolável de 60s)
    ```
  - Manter `.strict()` para bloquear mass assignment (`expires_at`, `client_price`, `payout_minor`, `user_id`).

### Passo 1.2 — Atualizar `ContractService.openContract` no Backend API
- **Arquivos**:
  - `services/api/src/services/contract-service.ts`
  - `services/api/dist/services/contract-service.js`
- **Alteração**:
  - Substituir o clamp `Math.max(30, Math.min(300, requestedDuration))` por:
    ```ts
    const requestedDuration = dto.duration_seconds ?? 60;
    const safeDurationSeconds = Math.max(60, Math.min(300, requestedDuration));
    const expiresAt = new Date(baseTime.getTime() + safeDurationSeconds * 1000);
    ```

### Passo 1.3 — Atualizar `scripts/dev-live-feed.mjs`
- **Arquivo**:
  - `scripts/dev-live-feed.mjs`
- **Alteração**:
  - Elevar o piso de `target_expires_at` e `safeDurationMs` de `30_000` (30s) para `60_000` (60s).
  - Nos modos `CANDLE_1M` e `CANDLE_5M`, avançar para a próxima vela sempre que `remSec < 60` (garantindo que nenhuma ordem aberta expire em menos de 60 segundos).

### Passo 1.4 — Atualizar Testes Unitários de Schema e Caos do Modelo de Expiração
- **Arquivos**:
  - `tests/unit/test-profitable-expiry-model.test.ts`
  - `tests/unit/test-profitable-chaos-stress.test.ts`
- **Alteração**:
  - Validar que durações `< 60` (`0, -1, 5, 10, 15, 20, 25, 29, 30, 45, 59`) são estritamente bloqueadas pelo `OpenContractSchema`.
  - Validar que durações de `60` a `300` (`60, 75, 90, 120, 180, 300`) são aceitas.

---

## 3. Matriz de Testes da Subetapa 01 (Segurança, Estresse e Caos)

1. **Segurança (`S-05` Anti-Arbitragem & Mass Assignment)**:
   - Rejeição de `duration_seconds` em `[0, -1, -60, 1, 5, 15, 29, 30, 45, 59]`.
   - Rejeição de floats (`60.5`, `89.9`), strings (`"60"`), `null`, `NaN`, `Infinity`.
   - Rejeição de chaves extras (`expires_at`, `entry_price`, `payout_minor`, `user_id`).
2. **Estresse**:
   - Validação concorrente de 100 payloads válidos (`60s` a `300s`) em `< 50ms`.
3. **Caos (Clock Skew Invariance)**:
   - Relógio do cliente adiantado (+15 min) ou atrasado (-15 min) não afeta o `expires_at` calculado pelo servidor (`baseTime + safeDurationSeconds * 1000 >= baseTime + 60_000`).

---

## 4. Critério de Gate (Condição de Avanço para a Subetapa 02)

- Execução verde (`0 failed`) de:
  `npx vitest run tests/unit/test-profitable-expiry-model.test.ts tests/unit/test-profitable-chaos-stress.test.ts`
