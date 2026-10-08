# tech-lead-orchestrator

Orquestrador da **Plataforma de Índices Sintéticos — Fase 1 (MVP Demo)**.

---

## 0. Papel do Orquestrador

```text
tech-lead-orchestrator
├── Lê issue/spec
├── Define plano e critérios de aceite
├── Escolhe agentes
├── Exige evidências e testes
└── Entrega PR para aprovação humana
```

Execução da Fase 1: `docs/fase-1/` contém a preparação humana, o prompt mestre do modo autônomo,
um prompt por subtask (T01–T18), a matriz de testes, o `gate.sh` e o roteiro de revisão e apresentação.

---

## 1. Componentes do Orquestrador

```text
Orquestrador
├── 1. Decompositor de Tarefas
├── 2. Router/Dispatcher
├── 3. Estado Global (Shared Memory)
├── 4. Agregador/Sintetizador
├── 5. Supervisor de Execução
├── 6. Pool de Workers Registrados
├── 7. Isolamento de Contexto
├── 8. Validação de Handoff (Trust Boundaries)
├── 9. Checkpoint & Resume
├── 10. Budget Caps & Loop Detection
└── 11. Instrumentação/Telemetria
```

### 1.1 Decompositor de Tarefas
Recebe a issue/spec e quebra em subtasks atribuíveis a um único agente especializado, cada uma com critérios de aceite.

### 1.2 Router/Dispatcher
Encaminha cada subtask ao worker registrado cujas `capabilities` correspondem ao tipo da tarefa, considerando `health status` e `historical accuracy`.

### 1.3 Estado Global (Shared Memory)
Armazena plano, subtasks, status, summaries retornados pelos workers, evidências e checkpoints.

### 1.4 Agregador/Sintetizador
Consolida os summaries e evidências de todos os workers em um único resultado (PR + relatório de evidências).

### 1.5 Supervisor de Execução
Acompanha o progresso de cada worker, aplica budget caps, detecta loops e aciona checkpoint/resume.

### 1.6 Pool de Workers Registrados
Catálogo de workers disponíveis com:

| Campo | Descrição |
|---|---|
| `capabilities` | O que cada worker faz |
| `health status` | online/offline, load atual |
| `historical accuracy` | Taxa de sucesso por tipo de task |

### 1.7 Isolamento de Contexto
- Cada worker tem seu próprio context window.
- Worker recebe apenas o necessário para sua subtask.
- Worker retorna apenas summary, não transcript completo.
- Previne overflow e contaminação cruzada.

### 1.8 Validação de Handoff (Trust Boundaries)
- Schema validation em cada fronteira agente→agente.
- Input do worker validado antes de executar.
- Output do worker validado antes de passar adiante.
- Rejeita (não coerciona) outputs malformados.

### 1.9 Checkpoint & Resume
- Estado persistido após cada worker completar.
- Permite retomar do último ponto válido se o orquestrador falhar.
- Evita restart completo da tarefa.

### 1.10 Budget Caps & Loop Detection
Hard limits em:

| Limite | Valor |
|---|---|
| Máximo de steps/iterações | 3 tentativas do implementador por subtask; 3 ciclos de correção por subtask; 2 reaberturas por defeito |
| Token spend total | Teto do plano da IDE; por sessão de worker, 400 mil tokens |
| Timeout por worker | 90 min (120 min em T05, T09 e T10); revisor 30 min |
| Timeout total | 48 h de relógio |
| Detecção de loops infinitos | ativo: mesma falha 3× seguidas, mesmo diff 2×, `state.yaml` igual em 3 sessões |

Valores da corrida autônoma da Fase 1; o procedimento completo está em `docs/fase-1/01-prompt-mestre.md`.

### 1.11 Instrumentação/Telemetria
Logging estruturado de:
- Cada prompt enviado.
- Cada tool call com argumentos.
- Cada mensagem inter-agente (conteúdo, timestamp, sender, recipient).
- Confidence scores.

---

## 2. Contrato de Handoff

### 2.1 Orquestrador → Worker

```yaml
task_id: string
agent: string                 # nome do agente registrado
objective: string             # o que deve ser feito
context: []                   # apenas o necessário para a subtask
skills: []                    # skills permanentes aplicáveis
acceptance_criteria: []       # critérios de aceite da subtask
budget:
  max_steps: <definir>
  max_tokens: <definir>
  timeout: <definir>
```

### 2.2 Worker → Orquestrador

```yaml
task_id: string
agent: string
status: DONE | FAILED | BLOCKED
summary: string               # apenas summary, não transcript
artifacts: []                 # arquivos, PR, diffs
evidence: []                  # testes executados, resultados, logs
acceptance_criteria_met: []   # critério → atendido / não atendido
confidence_score: number      # 0.0 – 1.0
```

---

## 3. Skills Permanentes (9)

```text
├── 01-project-context
│   ├── Stack
│   ├── Arquitetura
│   ├── Escopo da Fase 1
│   └── Decisões já tomadas
│
├── 02-financial-invariants
│   ├── Ledger append-only
│   ├── Double-entry
│   ├── Idempotência
│   ├── Transação ACID
│   ├── Reconciliação
│   └── Correção por reversão
│
├── 03-synthetic-market-engine
│   ├── CSPRNG
│   ├── Tick sequence
│   ├── Persistir antes de publicar
│   ├── Hash encadeado
│   ├── Candle OHLCV
│   └── WebSocket feed
│
├── 04-security-iam
│   ├── Keycloak / OIDC
│   ├── JWT validation
│   ├── RBAC
│   ├── BOLA / IDOR
│   ├── Mass assignment
│   └── Secrets
│
├── 05-resilience-patterns
│   ├── Outbox
│   ├── Retry + backoff
│   ├── Timeout
│   ├── Circuit breaker
│   ├── DLQ
│   └── Consumer groups
│
├── 06-testing-quality
│   ├── Unit tests
│   ├── Integration tests
│   ├── Chaos tests
│   ├── Load tests
│   └── Acceptance criteria
│
├── 07-production-operations
│   ├── Docker Compose
│   ├── CI/CD
│   ├── Logs e métricas
│   ├── Alertas
│   ├── Backups
│   └── Rollback
│
├── 08-database-foundation
│   ├── Topologia RDS Multi-AZ
│   ├── Schema e integridade no banco
│   ├── Roles, grants e RLS
│   ├── Migrations seguras
│   ├── Réplica, backup e DR
│   └── Observabilidade do banco
│
└── 09-ai-failure-map
    ├── Classes de falha da IA (F-01 a F-12)
    ├── Limites não delegáveis (L-01 a L-08)
    ├── Matriz de risco por subtask (T01 a T18)
    ├── Camadas de prevenção (P-01 a P-09)
    └── Protocolo de medição do TCC
```

A skill `09-ai-failure-map` é carregada pelo próprio orquestrador **antes de delegar** cada subtask: define guardas do prompt, testes-oráculo e evidência exigida.

---

## 4. Pool de Workers — Agentes Especializados (6)

| Agente | Capabilities | Permissão | Skills |
|---|---|---|---|
| `backend-implementation-agent` | API, Tick engine, Contratos, Settlement worker, Integração Blnk | Escreve código | 01, 02, 03, 04, 05, 08 |
| `frontend-realtime-agent` | React, Lightweight Charts, WebSocket, Carteira demo, Histórico | Escreve código | 01, 03, 04 |
| `financial-correctness-reviewer` | Revisa ledger, settlement, idempotência, reconciliação | Somente leitura | 01, 02, 05, 08, 09 |
| `security-reviewer` | Revisa auth, autorização, BOLA/IDOR, segredos | Somente leitura | 01, 04, 08, 09 |
| `qa-resilience-agent` | Cria testes, roda testes, testes de caos, testes de carga | Escreve apenas testes | 01, 05, 06, 07, 08, 09 |
| `bug-fix-agent` | Triagem, causa raiz, correção mínima, teste de regressão de defeitos já entregues | Escreve código (só na cadeia causal) | 01, 02, 03, 04, 05, 06, 07, 08 |
| `broker-architect-agent` | Arquiteto Chefe de Sistemas de Trading, FMEA, ADRs, Invariantes | Architecture & Code | 01, 02, 03, 05, 08, 09 |
| `post-implementation-verifier` | Verificador pós-implementação, provas SQL/Redis, fecha gates V-01 a V-13 | Somente leitura | 01, 02, 03, 06, 08, 09, 10 |
| `chart-trading-engineer` | Ferramentas gráficas de trading, overlays SVG/Canvas a 60 FPS, Fibonacci, indicadores matemáticos, testes geométricos | Escreve código (chart & feeds) | 01, 03, 06, 11 |

Registro no catálogo:

```yaml
- name: backend-implementation-agent
  capabilities: [api, tick-engine, contracts, settlement-worker, blnk-integration]
  permission: write-code
  health: { status: online, load: 0 }
  historical_accuracy: {}

- name: frontend-realtime-agent
  capabilities: [react, lightweight-charts, websocket, demo-wallet, history]
  permission: write-code
  health: { status: online, load: 0 }
  historical_accuracy: {}

- name: financial-correctness-reviewer
  capabilities: [review-ledger, review-settlement, review-idempotency, review-reconciliation]
  permission: read-only
  health: { status: online, load: 0 }
  historical_accuracy: {}

- name: security-reviewer
  capabilities: [review-auth, review-authorization, review-bola-idor, review-secrets]
  permission: read-only
  health: { status: online, load: 0 }
  historical_accuracy: {}

- name: qa-resilience-agent
  capabilities: [create-tests, run-tests, chaos-tests, load-tests]
  permission: write-tests-only
  health: { status: online, load: 0 }
  historical_accuracy: {}

- name: bug-fix-agent
  capabilities: [triage, root-cause-analysis, bug-fix, regression-test]
  permission: write-code
  health: { status: online, load: 0 }
  historical_accuracy: {}

- name: broker-architect-agent
  capabilities: [architecture-design, fmea-forensics, trading-systems-validation, adr-governance]
  permission: write-code
  health: { status: online, load: 0 }
  historical_accuracy: {}

- name: post-implementation-verifier
  capabilities: [post-conditions-verification, gate-audit, sql-redis-proof, invariant-proof]
  permission: read-only
  health: { status: online, load: 0 }
  historical_accuracy: {}

- name: chart-trading-engineer
  capabilities: [trading-drawings, technical-indicators, svg-canvas-overlays, coordinate-projection, 60fps-engine, chart-stress-chaos-tests]
  permission: write-code
  health: { status: online, load: 0 }
  historical_accuracy: {}
```

---

## 5. Fluxo

```text
Issue
  ↓
Orquestrador
  ↓
Plano + critérios
  ↓
Backend ou Frontend implementa
  ↓
QA cria/roda testes
  ↓
Financial + Security revisam
  ↓
Orquestrador consolida evidências
  ↓
Aprovação humana
  ↓
CI/CD
  ↓
Staging → Produção
```

| Etapa | Componente do orquestrador | Agente |
|---|---|---|
| Issue → Plano | Decompositor | — |
| Implementação | Router/Dispatcher + Supervisor | backend / frontend |
| Testes | Router/Dispatcher + Supervisor | qa-resilience-agent |
| Revisão | Router/Dispatcher + Validação de Handoff | financial-correctness-reviewer + security-reviewer |
| Correção | Router/Dispatcher + Budget Caps & Loop Detection | bug-fix-agent |
| Consolidação | Agregador/Sintetizador | — |
| Após cada etapa | Checkpoint & Resume + Telemetria | — |

### 5.1 Ciclo de correção

Erros encontrados **depois** que uma subtask foi entregue (`DONE`) não voltam ao implementador. O orquestrador os despacha ao `bug-fix-agent`. Erros durante a própria implementação continuam com o implementador, que roda o health-check antes do handoff.

```text
Defeito (QA defects · revisor REPROVADO · CI vermelho · health-check FAIL · alerta em staging)
  ↓
Orquestrador anexa defect_ref + reproduction + owner (route_to / handoff_notes)
  ↓
bug-fix-agent: triagem → reprodução → causa raiz → regressão vermelha → correção mínima → verificação
  ↓
QA reexecuta o teste original  +  revisor do domínio re-revisa (rereview_required)
  ↓
Orquestrador consolida → segue o fluxo normal (aprovação humana → CI/CD)
```

| Situação | Ação do orquestrador |
|---|---|
| `E8` teste errado | Devolve ao `qa-resilience-agent` |
| `E9` spec ou decisão | Escala para aprovação humana |
| `E10` ambiente | Trata como operação; sem mudança de código |
| `data_repair: required` | Reparo por reversão (`I-06`) só com aprovação humana; nunca automático |
| Defeito reaberto 2× | Escala para humano (loop detection, §1.10) |
| Incidente em produção | Rollback para N-1 primeiro (skill 07, O-06); correção depois, pelo pipeline |

---

## 6. Escopo da Fase 1

- Login e carteira demo.
- Um índice sintético.
- Tick engine com CSPRNG.
- Contrato subir/descer com expiração fixa.
- Ledger simples.
- Histórico e gráfico.
- Painel admin básico.
- Monitoramento básico.

### 6.1 Mapa de ferramentas

| Item da Fase 1 | O que usar | Repositório / ferramenta | Construído? | Agente |
|---|---|---|---|---|
| Login e carteira demo | Keycloak + Blnk | `keycloak/keycloak`, `blnkfinance/blnk` | Só integra | backend + frontend |
| Índice sintético | Próprio | — | **Sim** | backend |
| Tick engine com CSPRNG | Próprio | — | **Sim** | backend |
| Contrato subir/descer | Próprio | — | **Sim** | backend |
| Ledger simples | Blnk | `blnkfinance/blnk` | Integra e adapta | backend |
| Histórico e gráfico | Lightweight Charts + API | `tradingview/lightweight-charts` | Só integra | frontend |
| Painel admin básico | React Admin / Refine | `marmelab/react-admin`, `refinedev/refine` | Configura telas | frontend |
| Monitoramento básico | Prometheus + Grafana + Loki + Sentry | `prometheus/prometheus`, `grafana/grafana`, `grafana/loki` | Configura dashboards | qa-resilience / backend |

### 6.2 Stack

- **Keycloak** — login, cadastro, MFA/TOTP, sessões, tokens, RBAC, recuperação de senha.
- **Blnk** — carteira demo (`DEMO`, saldo inicial $ 10.000), ledger double-entry, histórico, snapshots, reconciliação.
- **TradingView Lightweight Charts** — gráfico (REST `/candles` para histórico + WebSocket `/ticks` para última vela).
- **Redis** — Streams (durabilidade/replay), Pub/Sub (fan-out visual), cache, rate limit, leader lease.
- **PostgreSQL / TimescaleDB** — estado forte e histórico.
- **Node.js/TypeScript ou Python/FastAPI** — serviços próprios.
- **React + Vite + TypeScript**, `oidc-client-ts`, TanStack Query, WebSocket client — front-end.
- **React Admin ou Refine** — painel admin.
- **Prometheus, Grafana, Loki, Sentry** — monitoramento.

---

## 7. Arquitetura (referência para `01-project-context`)

```text
┌──────────────────────────────────────────────────────────────┐
│                         FRONT-END                             │
│ React + Vite + TypeScript                                     │
│ TradingView Lightweight Charts                                │
│ oidc-client-ts + TanStack Query + WebSocket client            │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS / WSS
                            v
┌──────────────────────────────────────────────────────────────┐
│                       EDGE                                    │
│ Cloudflare / Nginx / Caddy                                    │
│ TLS • WAF • bot protection • rate limit • CORS • headers      │
└───────────────────────────┬──────────────────────────────────┘
                            │
        ┌───────────────────┴────────────────────┐
        v                                        v
┌──────────────────────┐              ┌──────────────────────────┐
│ Keycloak             │              │ API / BFF                │
│ OIDC • MFA • RBAC    │              │ JWT • autorização • REST │
└──────────────────────┘              └────────────┬─────────────┘
                                                   │
              ┌────────────────────────────────────┼────────────────────────────┐
              v                                    v                            v
┌──────────────────────────┐          ┌──────────────────────┐        ┌──────────────────────┐
│ Contract Service         │          │ Wallet Adapter       │        │ Chart API            │
│ Abre / cancela / liquida │◄────────►│ Blnk Ledger          │        │ Histórico e candles  │
└────────────┬─────────────┘          └──────────┬───────────┘        └──────────────────────┘
             │                                   │
             └────────────────┬──────────────────┘
                              v
                   ┌─────────────────────┐
                   │ PostgreSQL          │
                   │ estado forte        │
                   └──────────┬──────────┘
                              │
        ┌─────────────────────┼─────────────────────────────┐
        v                     v                             v
┌───────────��──────┐ ┌─��──────────────────┐       ┌──────────────────────────┐
│ Tick Engine      │ │ Candle Worker      │       │ Settlement Worker        │
│ Líder único      │ │ consumer group     │       │ consumer group + lock    │
│ CSPRNG           │ │ ticks → OHLCV      │       │ expiração + resultado    │
└────────┬─────────┘ └─────────┬──────────┘       └────────────┬─────────────┘
         │                     │                               │
         └─────────────────────┴───────────────┬───────────────┘
                                               v
                          ┌──────────────────────────────────────┐
                          │ Redis                                │
                          │ Streams: durabilidade e replay       │
                          │ Pub/Sub: fan-out visual              │
                          │ Cache: último tick e candles quentes │
                          │ Rate limit / leader lease            │
                          └──────────────────┬───────────────────┘
                                             v
                          ┌──────────────────────────────────────┐
                          │ WebSocket Gateway                    │
                          │ autentica JWT e faz fan-out          │
                          └──────────────────┬───────────────────┘
                                             v
                                        [Front-end]
```

### 7.1 Componentes e responsabilidades

| Componente | Responsabilidade | Agente |
|---|---|---|
| Front-end | UI, gráfico, carteira demo, histórico, WebSocket client | frontend-realtime-agent |
| Edge | TLS, WAF, bot protection, rate limit, CORS, headers | backend-implementation-agent |
| Keycloak | OIDC, MFA, RBAC | backend-implementation-agent |
| API / BFF | JWT, autorização, REST | backend-implementation-agent |
| Contract Service | Abre / cancela / liquida | backend-implementation-agent |
| Wallet Adapter | Integração com Blnk Ledger | backend-implementation-agent |
| Chart API | Histórico e candles | backend-implementation-agent |
| PostgreSQL | Estado forte | backend-implementation-agent |
| Tick Engine | Líder único, CSPRNG | backend-implementation-agent |
| Candle Worker | Consumer group, ticks → OHLCV | backend-implementation-agent |
| Settlement Worker | Consumer group + lock, expiração + resultado | backend-implementation-agent |
| Redis | Streams, Pub/Sub, cache, rate limit, leader lease | backend-implementation-agent |
| WebSocket Gateway | Autentica JWT e faz fan-out | backend-implementation-agent |
| Painel admin | Usuários, contratos, ledger, pausar índice, bloquear usuário, alertas | frontend-realtime-agent |
| Monitoramento | Prometheus, Grafana, Loki, Sentry | qa-resilience-agent / backend-implementation-agent |

---

## 8. Decomposição da Fase 1 em Subtasks

| # | Subtask | Implementa | Testa | Revisa | Skills |
|---|---|---|---|---|---|
| T01 | Docker Compose base (postgres, redis, keycloak, blnk, serviços, prometheus, grafana, loki) | backend | qa | security | 01, 07 |
| T02 | Keycloak: realm, OIDC + PKCE, MFA/TOTP, roles | backend | qa | security | 01, 04 |
| T03 | API/BFF: validação JWT (iss, aud, exp, nbf, sub, roles), RBAC, DTOs | backend | qa | security | 01, 04 |
| T04 | Wallet Adapter + Blnk: carteira `DEMO` com $ 10.000 | backend | qa | financial + security | 01, 02, 05 |
| T05 | Tick Engine: leader lease, CSPRNG, persistência + outbox, hash encadeado | backend | qa | financial | 01, 03, 05 |
| T06 | Outbox relay → Redis Stream + Pub/Sub | backend | qa | financial | 03, 05 |
| T07 | Candle Worker: consumer group, ticks → OHLCV | backend | qa | financial | 03, 05 |
| T08 | WebSocket Gateway: JWT, snapshot, catch-up por `lastSequence`, limites | backend | qa | security | 03, 04, 05 |
| T09 | Contract Service: `POST /contracts`, Idempotency-Key, reserva de stake, estados | backend | qa | financial + security | 02, 04, 05 |
| T10 | Scheduler + Settlement Worker: expiração, WIN/LOSS/DRAW, payout 85%, idempotência | backend | qa | financial | 02, 03, 05 |
| T11 | Reconciliação contínua (job a cada 1 minuto) | backend | qa | financial | 02, 05 |
| T12 | Chart API: `/candles` | backend | qa | — | 03 |
| T13 | Front-end: login OIDC, carteira demo, histórico, gráfico, WebSocket | frontend | qa | security | 01, 03, 04 |
| T14 | Painel admin (React Admin / Refine) | frontend | qa | security | 01, 04 |
| T15 | Observabilidade: métricas, dashboards, logs, alertas | backend | qa | — | 07 |
| T16 | CI/CD: lint, testes, scan de segredos, scan de CVE, build, staging, smoke, prod, rollback | backend | qa | security | 06, 07 |
| T17 | Testes de caos | — | qa | financial + security | 05, 06 |
| T18 | Testes de carga | — | qa | — | 06 |

---

## 9. Especificações de Referência por Subtask

### 9.1 Tick Engine (T05, T06)

```text
CSPRNG
  → gera retorno normal
  → aplica volatilidade
  → aplica salto opcional
  → calcula próximo preço
  → persiste tick
  → publica no Redis
```

Fluxo de tick:

```text
1. Tick Engine adquire lease de líder no Redis.
2. Lê último tick persistido.
3. Gera próximo preço com CSPRNG.
4. Persiste tick no Postgres dentro de transação.
5. Grava evento no outbox dentro da mesma transação.
6. Commit.
7. Outbox relay publica no Redis Stream.
8. Outbox relay publica no Redis Pub/Sub para visual.
9. Candle Worker consome Stream e atualiza OHLCV.
10. WebSocket Gateway consome Pub/Sub e envia ao front.
11. Se Pub/Sub falhar, front reconecta e pede catch-up por lastSequence.
```

Prevenção de tick duplicado:
- Constraint `PRIMARY KEY (symbol, sequence)` + trigger `ticks_chain` (`sequence` = anterior + 1, `prev_hash` = hash anterior), conforme `08-database-foundation/references/schema.md`.
- `eventId` único.
- Leader lease no Redis com TTL.
- Apenas um processo por índice escreve.
- Se a lease expirar, novo líder assume somente após confirmar último tick.

Recuperação:

```text
Worker reinicia
  → SELECT último tick por index_id
  → lê sequence e price
  → espera próximo intervalo
  → gera próximo tick
```

Se Redis cair:
- Tick continua sendo persistido no Postgres.
- UI marca feed como `STALE`.
- Ao voltar, Stream republica a partir do último evento confirmado.

### 9.2 Contrato (T09)

- `POST /contracts`
- Validação de saldo
- Reserva do stake
- Preço de entrada
- Expiração em 60 segundos
- Busca do tick de saída
- Cálculo de `WIN`, `LOSS` ou `DRAW`
- Payout de 85%
- Liquidação transacional
- Idempotência por `Idempotency-Key`

Abertura:

```text
POST /contracts
  → valida JWT, role e Idempotency-Key
  → verifica idempotência existente
  → valida stake, saldo e limites
  → lê último tick oficial do Postgres
  → cria contrato em transação
  → cria outbox: RESERVE_STAKE
  → commit
  → outbox relay chama Blnk
  → Blnk reserva stake com idempotência
  → contrato permanece OPEN
```

Estados:

```text
CREATED   → OPEN → EXPIRING → SETTLED
CREATED   → FAILED_COMPENSATION
OPEN      → CANCELLED
EXPIRING  → SETTLED
EXPIRING  → FAILED_RETRYABLE
```

Compensação (falha do Blnk após criação do contrato):

```text
1. Contrato permanece CREATED ou PENDING_RESERVE.
2. Outbox tenta novamente com backoff.
3. Após N tentativas, vai para DLQ.
4. Reconciliador compara contrato × ledger.
5. Se reserva não existir, contrato é cancelado.
6. Se reserva existir, contrato é promovido para OPEN.
```

### 9.3 Ledger (T04, T09, T10)

```text
Abrir contrato:
available --debit--> reserved

Ganhar:
reserved --debit--> available
house_payout --credit--> available

Perder:
reserved --debit--> house_revenue

Empatar:
reserved --debit--> available
```

### 9.4 Settlement (T10)

```text
1. Scheduler encontra contratos vencidos.
2. Publica evento em stream:contracts:expiry.
3. Settlement Worker consome com consumer group.
4. Faz SELECT ... FOR UPDATE no contrato.
5. Se SETTLED: ACK e retorna.
6. Busca primeiro tick oficial >= expires_at.
7. Se não existir: NACK e retry.
8. Calcula WIN / LOSS / DRAW.
9. Chama Blnk com chave idempotente.
10. Atualiza contrato para SETTLED.
11. ACK na Stream.
12. Publica notificação via outbox.
```

Chaves de idempotência:
- Settlement: `settlement:{contract_id}`
- Crédito: `credit:{contract_id}:{result}`

### 9.5 Redis (T06, T07, T10)

- Stream é fonte de trabalho confiável.
- Pub/Sub é apenas fan-out visual.
- Todo consumer é idempotente.
- Todo consumer usa consumer group.
- Mensagem pendente é monitorada.
- Após timeout, `XAUTOCLAIM` transfere para outro consumer.
- Mensagem permanentemente inválida vai para DLQ.

### 9.6 WebSocket (T08, T13)

Conexão:

```text
Cliente conecta
  → envia JWT
  → gateway valida assinatura, issuer, audience e exp
  → cliente informa symbol e lastSequence
  → gateway assina Pub/Sub
  → gateway busca dados faltantes
  → envia snapshot + updates ao vivo
```

Reconexão:

```text
WebSocket cai
  → front reconecta com backoff
  → envia lastSequence
  → gateway busca eventos faltantes no Stream/Postgres
  → envia catch-up
  → retoma updates ao vivo
```

Limites:
- Máximo 5 conexões por usuário.
- Máximo 10 símbolos por conexão.
- Ping/pong a cada 15 segundos.
- Desconexão após 45 segundos sem pong.
- Rate limit de reconexão.

### 9.7 Segurança (T02, T03, T08, T13, T14, T16)

Identidade:
- Keycloak OIDC + PKCE.
- Argon2id.
- MFA/TOTP.
- Access token curto.
- Refresh token rotativo.
- Revogação de sessão.
- Clock sincronizado via NTP.
- Validação de `iss`, `aud`, `exp`, `nbf`, `sub` e `roles`.

Autorização:
- RBAC no backend.
- `user_id` sempre do JWT.
- Autorização por objeto em todo endpoint.
- BOLA/IDOR bloqueado.
- Mass assignment bloqueado por DTO.
- Admin sem alteração direta de saldo.

Infra:
- HTTPS obrigatório.
- WAF e bot protection.
- Rate limit por IP, usuário e rota.
- CORS restrito.
- CSP e headers de segurança.
- Segredos em KMS/Vault.
- Banco sem exposição pública.
- Scan de dependências e segredos no CI.

Auditoria:
- `audit_logs` append-only.
- Hash encadeado nos ticks.
- Log de login, falha, permissão, contrato e settlement.
- Nenhum token, senha ou PII sensível em log.

### 9.8 Painel Admin (T14)

- Lista de usuários.
- Lista de contratos.
- Consulta de ledger.
- Pausar índice.
- Bloquear usuário.
- Ver alertas.

### 9.9 Observabilidade (T15)

Métricas:

```text
tick_engine_is_leader
tick_engine_last_tick_age_seconds
tick_engine_ticks_total
tick_engine_errors_total
redis_stream_lag
redis_stream_pending_messages
redis_stream_oldest_pending_age_seconds
websocket_connections_active
websocket_reconnects_total
contract_created_total
contract_open_total
contract_settlement_failed_total
contract_settlement_latency_ms
contract_pending_expiry_total
ledger_reconciliation_errors_total
api_http_5xx_total
api_request_latency_p95_ms
```

Métricas mínimas de negócio: ticks por segundo, latência de contrato, contratos abertos, erros 5xx, usuários conectados, divergência de saldo.

### 9.10 Reconciliação (T11)

Job a cada 1 minuto:

```text
1. Contratos OPEN cujo expires_at passou?
2. Contratos EXPIRING há mais de 10s?
3. Cada contrato OPEN tem reserva no ledger?
4. Cada contrato SETTLED tem settlement no ledger?
5. Saldo projetado = soma dos eventos do ledger?
6. Último tick do Stream = último tick do Postgres?
7. Candle fecha corretamente a partir dos ticks?
```

### 9.11 Deploy e CI/CD (T01, T16)

```yaml
services:
  postgres:
    image: postgres:16
  redis:
    image: redis:7
  keycloak:
    image: quay.io/keycloak/keycloak:26.0
  blnk:
    image: blnkfinance/blnk
  api:
    build: ./services/api
  tick-engine:
    build: ./services/tick-engine
  candle-worker:
    build: ./services/candle-worker
  settlement-worker:
    build: ./services/settlement-worker
  websocket-gateway:
    build: ./services/websocket-gateway
  frontend:
    build: ./apps/web
  prometheus:
    image: prom/prometheus
  grafana:
    image: grafana/grafana
  loki:
    image: grafana/loki
```

Ambientes:
- `dev`: local.
- `staging`: igual à produção, dados sintéticos.
- `prod`: acesso restrito, backups e monitoramento.

Pipeline:

```text
Lint
→ Testes unitários
→ Testes de integração
→ Scan de segredos
→ Scan de CVE
→ Build de imagem
→ Deploy em staging
→ Smoke tests
→ Deploy em produção com health check e rollback
```

---

## 10. Plano de Testes (qa-resilience-agent)

### 10.1 Unitários
- Cálculo de próximo tick.
- Cálculo de payout.
- Empate.
- Máquina de estados.
- Validação de stake.
- Autorização por objeto.

### 10.2 Integração
- Login + carteira demo.
- Abrir contrato.
- Repetir requisição com mesma chave.
- Expiração automática.
- Settlement único.
- Vitória, derrota e empate.

### 10.3 Caos
- Matar tick engine.
- Matar candle worker.
- Matar settlement worker.
- Derrubar Redis.
- Derrubar Postgres.
- Duplicar mensagem do Stream.
- Enviar tick fora de ordem.
- Reusar refresh token.

### 10.4 Carga
- 300 WebSockets.
- 50 contratos/minuto.
- 1 tick/segundo por índice.
- p95 < 200ms na abertura.
- Zero settlement duplicado.
- Zero divergência de saldo.

---

## 11. Definição de Pronto (critérios de aceite da Fase 1)

O orquestrador só entrega o PR final para aprovação humana com evidência para cada item:

| # | Critério | Evidência | Status |
|---|---|---|---|
| 1 | Tick engine tem líder único. | | ☐ |
| 2 | Tick é persistido antes de distribuído. | | ☐ |
| 3 | Tick duplicado é impossível no banco. | | ☐ |
| 4 | Candle é reconstrutível a partir dos ticks. | | ☐ |
| 5 | WebSocket reconecta e faz catch-up. | | ☐ |
| 6 | Contrato tem idempotência. | | ☐ |
| 7 | Settlement tem idempotência. | | ☐ |
| 8 | Ledger é append-only. | | ☐ |
| 9 | Reconciliação roda continuamente. | | ☐ |
| 10 | Falha de Redis não corrompe dinheiro. | | ☐ |
| 11 | Falha de worker não perde settlement. | | ☐ |
| 12 | Falha de Keycloak não quebra contratos já abertos. | | ☐ |
| 13 | Alertas cobrem todos os pontos críticos. | | ☐ |
| 14 | Testes de caos e carga passam. | | ☐ |

---

## 12. Estado Global — Modelo de Checkpoint

```yaml
run_id: string
issue: string
plan:
  - task_id: T01
    agent: backend-implementation-agent
    status: PENDING | RUNNING | DONE | FAILED | BLOCKED
    attempts: 0
    summary: ""
    evidence: []
    confidence_score: null
    checkpoint_at: null
budget_used:
  steps: 0
  tokens: 0
  elapsed: 0
definition_of_done:
  - id: 1
    met: false
    evidence: []
```

---

## 13. Telemetria — Formato de Evento

```json
{
  "run_id": "string",
  "task_id": "string",
  "timestamp": "ISO-8601",
  "sender": "string",
  "recipient": "string",
  "type": "prompt | tool_call | handoff | result",
  "content": "string",
  "tool": "string | null",
  "arguments": {},
  "confidence_score": 0.0,
  "ai_failures": [
    { "class": "F-xx", "detected_by": "P-xx", "severity": "CRITICA | ALTA | MEDIA | BAIXA" }
  ]
}
```

`ai_failures` segue a taxonomia de `09-ai-failure-map` e alimenta o registro do TCC (`references/tcc-protocol.md` daquela skill).

---

## 14. Seções Pendentes da Spec Original

Os itens abaixo aparecem como título na especificação, mas o conteúdo (tabelas) não veio no texto. Ficam reservados para preenchimento:

- 6.2 Falhas do settlement
- 7.1 Lista de Redis Streams
- 7.2 Lista de canais Pub/Sub
- 10.2 Alertas
- 11.2 Ações automáticas da reconciliação
