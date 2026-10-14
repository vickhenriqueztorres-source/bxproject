# Subetapa 03 — Certificação Final: Testes de Estresse, Segurança, Caos e Regressão (`60s` Inviolável)

**Agentes Responsáveis**: `qa-resilience-agent`, `post-implementation-verifier`, `regression-guardian-agent`, `security-reviewer`, `financial-correctness-reviewer`  
**Skills**: `02-financial-invariants`, `04-security-iam`, `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`  
**Pré-requisito**: Subetapas 01 e 02 100% implementadas e validadas.

---

## 1. Objetivo da Subetapa

Criar uma suíte dedicada de certificação (`tests/unit/test-minimum-expiry-60s-certification.test.ts`) e atualizar os scripts de integração para comprovar matematicamente sob **estresse massivo (10.000 cálculos e 500 validações simultâneas)**, **ataques de segurança (fuzzing de underflow/overflow/mass-assignment)** e **engenharia de caos (timestamps corrompidos, fronteiras exatas de milissegundo, clock skew extremo e rajadas concorrentes)** que nenhuma operação pode existir com expiração inferior a 60 segundos, sem quebrar nenhuma funcionalidade existente do sistema.

---

## 2. Passo a Passo Cirúrgico de Implementação

### Passo 3.1 — Criar Suíte de Certificação `tests/unit/test-minimum-expiry-60s-certification.test.ts`
1. **Bloco 1 — Segurança (`SEC-60S`)**:
   - Fuzzing exaustivo de todas as durações inteiras de `-100` a `59` segundos contra `OpenContractSchema`: 100% rejeitadas.
   - Fuzzing de valores não-inteiros e maliciosos (`59.999`, `60.001`, `NaN`, `Infinity`, `-Infinity`, `"60"`, `null`, `undefined`, `{}`): 100% rejeitados (exceto `undefined` que aciona o default de `60s` do servidor).
   - Tentativa de Mass Assignment (`expires_at`, `opened_at`, `payout_minor`, `entry_price`, `user_id`): 100% bloqueada por `.strict()`.
2. **Bloco 2 — Estresse de Alta Frequência (`STRESS-60S`)**:
   - Execução contínua de **10.000 chamadas** a `calculateExecutionExpiry` e `calculateExpirySlots` percorrendo cada segundo e sub-segundo ao longo de múltiplas horas para `1M_FIXED`, `CANDLE_1M` e `CANDLE_5M`:
     - Tempo total `< 150ms`.
     - Zero resultados com `durationMs < 60_000` ou `remainingSeconds < 60`.
   - Validação de **500 payloads concorrentes** via `OpenContractSchema.safeParse` com durações entre `60s` e `300s`.
3. **Bloco 3 — Engenharia de Caos (`CHAOS-60S`)**:
   - Fronteiras exatas de época (`00:00:00.000`, `:59.999`, `:00.001`, virada de ano, ano bissexto).
   - Entradas corrompidas (`NaN`, `Infinity`, `-Infinity`, timestamps negativos) em `calculateExecutionExpiry` e `formatSecondsToMmSs` sem lançar exceção e mantendo piso `>= 60_000ms`.
   - Simulação de `ContractService` sob dessincronia de relógio cliente/servidor (`Clock Skew` de `-24h` a `+24h`): `expires_at - opened_at` no servidor é sempre `>= 60_000ms`.
4. **Bloco 4 — Contrato End-to-End Cliente -> Schema (`E2E-60S`)**:
   - `openContract` chamado com tentativa de duração sub-60s (`15s`, `30s`, `45s`, `59s`) jamais envia `duration_seconds < 60` na rede; o payload resultante passa 100% no `OpenContractSchema`.

### Passo 3.2 — Alinhar Scripts de Integração Legados
- Atualizar `tests/integration/etapa-9-latencia-expiracao-resiliencia.test.mjs`, `tests/test-subetapa-5-dev-feed-admin.mjs` e `tests/test-synthetic-rename-certification.mjs` para refletir o piso de 60 segundos.

### Passo 3.3 — Rodar Regressão Completa
- Executar todos os testes unitários de trade, chart, auth, BMR e expiração para comprovar zero regressões no sistema.

---

## 3. Critério de Gate Final (100% Validado e Seguro)

- Todos os testes da nova suíte `tests/unit/test-minimum-expiry-60s-certification.test.ts` e todas as suítes de regressão do projeto passando com **0 falhas**.
