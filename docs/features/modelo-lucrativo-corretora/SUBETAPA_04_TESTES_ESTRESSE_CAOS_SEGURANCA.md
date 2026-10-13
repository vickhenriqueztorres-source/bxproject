# SUBETAPA 04 — Testes Rigorosos: Estresse, Caos, Segurança e Integridade Financeira

---

## 1. Objetivo Técnico
Submeter a nova funcionalidade de expiração lucrativa com piso inviolável de 30s a um conjunto agressivo de testes de estresse, simulação de caos e garantias de segurança antes do deploy.

---

## 2. Cenários de Teste

### 2.1. Testes de Segurança (Anti-Front-Running e Anti-Arbitragem)
- **Cenário 1 (Injeção de Duração Inválida)**:
  - Enviar payload malicioso com `duration_seconds: 5` ou `duration_seconds: -10`.
  - Critério de Aceite: A API rejeita com HTTP 400 `VALIDATION_ERROR` via Zod.
- **Cenário 2 (Tentativa de Bypass sem Duration)**:
  - Enviar payload sem `duration_seconds`.
  - Critério de Aceite: O servidor aplica o padrão de 60 segundos com sucesso.

### 2.2. Testes de Caos
- **Cenário 3 (Simulação de Desvio de Relógio / Clock Drift)**:
  - Enviar requisição com relógio de cliente descalibrado. O backend ignora timestamps de expiração fornecidos pelo cliente e ancora seu cálculo exclusivamente no `last_ts` do tick oficial gravado no PostgreSQL.
- **Cenário 4 (Feed Stale / Kill Switch)**:
  - Se o feed de cotações ficar sem novos ticks por mais de 5.000ms, a abertura é bloqueada e o Kill Switch é acionado no Redis.

### 2.3. Testes de Estresse
- **Cenário 5 (Carga Concorrente de 50 Ordens)**:
  - 50 ordens abertas com durações variadas (30s, 45s, 60s, 120s).
  - Todas devem ser inseridas no Sorted Set `contracts:pending` com pontuação `expiresAt.getTime()`.
  - `ExpiryDispatcher` deve despachar cada uma no momento exato e o `settler` liquidar com `FOR UPDATE SKIP LOCKED`.

### 2.4. Invariantes Financeiras (I-01 a I-06)
- Verificação de saldo no Blnk: cada contrato gera apenas uma reserva `reserve:{contract_id}` e uma liquidação `settlement:{contract_id}`.
