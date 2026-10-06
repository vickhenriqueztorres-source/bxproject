# API guide — backend-implementation-agent

Referência carregada sob demanda. Quando este arquivo e uma skill divergirem, **a skill vence**;
quando o PRD e uma decisão `D-xx` divergirem, **a decisão vence** (tabela abaixo).

## Mapa de subtasks

| # | Subtask | Skills | O que "pronto" exige deste agente |
|---|---------|--------|-----------------------------------|
| T01 | Docker Compose base | 01, 07 | Todos os serviços da seção 9.11 sobem com health check; Postgres e Redis sem porta pública |
| T02 | Keycloak: realm, OIDC + PKCE, MFA, roles | 01, 04 | Realm exportado em `infra/keycloak/`; roles `USER`, `AUDITOR`, `ADMIN`; brute force 5/15 min |
| T03 | API/BFF: JWT, RBAC, DTOs | 01, 04 | Middleware valida `iss`, `aud`, `exp`, `nbf`, `sub`, roles; DTOs com `additionalProperties: false` |
| T04 | Wallet Adapter + Blnk | 01, 02, 05 | Primeiro login cria balances `available`/`reserved` e credita 10.000 uma única vez |
| T05 | Tick Engine | 01, 03, 05 | Lease + fencing, CSPRNG, tick + outbox na mesma transação, hash encadeado |
| T06 | Outbox relay | 03, 05 | Publica no Stream (`XADD` com ID `{sequence}-0`) e depois no Pub/Sub; marca `published_at` |
| T07 | Candle Worker | 03, 05 | Consumer group `candle-workers`; candle reconstruível a partir dos ticks |
| T08 | WebSocket Gateway | 03, 04, 05 | JWT no handshake, snapshot, catch-up por `lastSequence`, limites 5 conexões / 10 símbolos |
| T09 | Contract Service | 02, 04, 05 | `POST /contracts` idempotente; outbox `RESERVE_STAKE`; estados da seção 9.2 |
| T10 | Scheduler + Settlement | 02, 03, 05 | `stream:contracts:expiry`; `FOR UPDATE`; WIN/LOSS/DRAW; chaves `settlement:` e `credit:` |
| T11 | Reconciliação | 02, 05 | Job de 1 min com as 7 checagens da seção 9.10; métrica `ledger_reconciliation_errors_total` |
| T12 | Chart API | 03 | `GET /candles` com credencial de banco somente leitura |
| T15 | Observabilidade | 07 | Métricas da seção 9.9, dashboards, alertas do PRD §12.2 |
| T16 | CI/CD | 06, 07 | Lint → testes → scan de segredos → scan de CVE → build → staging → smoke → prod com rollback |

## Divergências PRD × decisões

O PRD (Fase 0) foi escrito antes das decisões de stack. Aplicar sempre a coluna "Vigente".

| Tema | PRD diz | Vigente | Ação do agente |
|------|---------|---------|----------------|
| Ledger | Tabelas próprias `ledger_transactions`, `ledger_entries`, `wallet_accounts` (§7) | Blnk (D-02) | Não criar essas tabelas. O `type` do PRD vira `meta_data.type` na transação Blnk |
| Tick | `ticks(id BIGSERIAL, ...)` sem `sequence` (§7) | `PRIMARY KEY (symbol, sequence)` (skill 03) | Usar o schema da skill 03 |
| Estados do contrato | `CREATED, OPEN, EXPIRING, SETTLED, CANCELLED` | + `PENDING_RESERVE`, `FAILED_COMPENSATION`, `FAILED_RETRYABLE` (9.2) | Usar a lista vigente (abaixo) |
| Preço no evento | `"price": 1042.3187` (número) | String decimal canônica (skill 03) | Serializar como string |
| Distribuição | "Publica tick via Redis Pub/Sub" (§8.1) | Stream = fonte confiável; Pub/Sub = visual (D-04) | Relay publica nos dois, nessa ordem |
| Loop do gerador | `setInterval` + `rng.random()` (anexo de algoritmo) | Agendamento alinhado ao relógio + CSPRNG + retomada do último tick | Ver `examples/example-2.md` |
| Moeda | USD, US$ 10.000,00 | `D-18` (PRD US-03) | Adotar USD; saldo inicial `1_000_000` centavos |
| Símbolo | `SYNTH_VOL_50` (§3.1) | Skill 03 usa `SYNTH_1` ilustrativo | Adotar `SYNTH_VOL_50` |
| Stake | `100 ≤ stake_minor ≤ 10000` (US$ 1 a US$ 100) | PRD US-05 | Adotar |
| 2FA | No MVP (§3.1) e na Fase 2 (§16) | MFA obrigatório para `ADMIN`/`AUDITOR` (S-01) | Para `USER`: `<não definido no contexto>` |
| Idempotency-Key | `UNIQUE` global (§7) | Sem decisão de escopo | Usar `UNIQUE (user_id, idempotency_key)` — evita colisão entre usuários |

## Parâmetros do índice

| Parâmetro | Valor | Origem |
|-----------|-------|--------|
| `symbol` | `SYNTH_VOL_50` | PRD §3.1 |
| Intervalo | 1 tick/s | D-13 |
| `driftPerTick` (μ) | `0` | Anexo de algoritmo |
| `volatilityPerTick` (σ) | `0.0008` | PRD §8.2 |
| `jumpProbability` | `0.002` | PRD §8.2 |
| `jumpSize` | `±0.03` (50% cada sinal) | PRD §8.2 |
| Piso de preço | `1` | Anexo de algoritmo (`Math.max(nextPrice, 1)`) |
| Precisão | `NUMERIC(18,6)` | PRD §7 |
| Preço inicial | `<não definido no contexto>` — exemplos do PRD usam `1000` | — |

```text
S(t+1) = S(t) × (1 + μ + σ·Z + J)
Z ~ Normal(0,1) via Box-Muller sobre CSPRNG
J = 0 com prob. 0,998; ±0,03 com prob. 0,002
```

## Rotas

| Método e rota | Auth | Role | Rate limit | Observação |
|---------------|------|------|------------|------------|
| `POST /auth/*` | — | — | 5 logins / 15 min | Delegado ao Keycloak (D-01). A API não implementa login próprio |
| `GET /wallet` | JWT | `USER` | 30/min | Saldo `available` e `reserved` lidos do Blnk para o `sub` |
| `GET /wallet/transactions` | JWT | `USER` | 30/min | Paginado por cursor; só transações do `sub` |
| `GET /indices` | JWT | `USER` | 30/min | Fase 1: lista com um item |
| `GET /indices/:id` | JWT | `USER` | 30/min | Inclui `status` (`ACTIVE`/`PAUSED`) |
| `GET /candles` | JWT | `USER` | 30/min | Ver skill 03 |
| `WS /streams/ticks/:symbol` | JWT no 1º frame | `USER` | Reconexão limitada | Ver protocolo na skill 03 |
| `POST /contracts` | JWT | `USER` | 30/min | Exige `Idempotency-Key` |
| `GET /contracts` | JWT | `USER` | 30/min | `WHERE user_id = :sub` |
| `GET /contracts/:id` | JWT | `USER` | 30/min | `404` se não for do `sub` (não `403`, para não vazar existência) |
| `POST /contracts/:id/cancel` | JWT | `USER` | 30/min | Regra de cancelamento: `<não definido no contexto>` |
| `GET /admin/users`, `/admin/contracts`, `/admin/ledger` | JWT + MFA | `ADMIN`, `AUDITOR` | 30/min | `AUDITOR` só `GET` |
| `POST /admin/indices/:id/pause` | JWT + MFA | `ADMIN` | 30/min | Gera `audit_logs` |
| `POST /admin/users/:id/block` | JWT + MFA | `ADMIN` | 30/min | Gera `audit_logs` |

Não existe rota de ajuste de saldo na Fase 1 (B-14). Aprovação dupla (PRD §14.3) é Fase 3.

## DTO — `POST /contracts`

```http
POST /contracts
Authorization: Bearer <access_token>
Idempotency-Key: 6f1c2b8e-1d7a-4f0e-9c55-3a0b4e7d2a91
Content-Type: application/json

{ "symbol": "SYNTH_VOL_50", "direction": "UP", "stake_minor": 500 }
```

| Campo | Tipo | Regra |
|-------|------|-------|
| `symbol` | string | Igual a `SYNTH_VOL_50` e índice `ACTIVE` |
| `direction` | enum | `UP` ou `DOWN` |
| `stake_minor` | inteiro | `100 ≤ x ≤ 10000` e `≤ available` |
| Qualquer outro campo | — | `400 UNKNOWN_FIELD` (mass assignment, S-05) |

Resposta `201` (e a mesma resposta em replays com a mesma chave):

```json
{
  "id": "0b5e…",
  "symbol": "SYNTH_VOL_50",
  "direction": "UP",
  "stake_minor": 500,
  "entry_price": "1042.318700",
  "entry_sequence": 184223,
  "expires_at": "2026-10-02T23:01:00.000Z",
  "status": "PENDING_RESERVE"
}
```

| Código | Erro | Quando |
|--------|------|--------|
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Header ausente ou fora do formato UUID |
| 400 | `UNKNOWN_FIELD` / `INVALID_STAKE` | DTO inválido |
| 401 | `INVALID_TOKEN` | JWT inválido |
| 409 | `INDEX_PAUSED` | Índice pausado pelo admin |
| 422 | `IDEMPOTENCY_KEY_REUSED` | Mesma chave com corpo diferente |
| 422 | `INSUFFICIENT_FUNDS` | `stake_minor > available` |
| 429 | `RATE_LIMITED` | Acima de 30/min |
| 503 | `FEED_STALE` | Último tick com mais de 5 s (alerta do PRD §12.2) |

## Schema — contratos e auditoria

```sql
CREATE TABLE contracts (
  id               uuid        PRIMARY KEY,
  user_id          text        NOT NULL,                 -- sub do JWT
  symbol           text        NOT NULL,
  direction        text        NOT NULL CHECK (direction IN ('UP','DOWN')),
  stake_minor      bigint      NOT NULL CHECK (stake_minor BETWEEN 100 AND 10000),
  entry_price      numeric(18,6) NOT NULL,
  entry_sequence   bigint      NOT NULL,
  exit_price       numeric(18,6),
  exit_sequence    bigint,
  expires_at       timestamptz NOT NULL,
  status           text        NOT NULL CHECK (status IN (
                     'CREATED','PENDING_RESERVE','OPEN','EXPIRING','SETTLED',
                     'CANCELLED','FAILED_COMPENSATION','FAILED_RETRYABLE')),
  result           text        CHECK (result IN ('WIN','LOSS','DRAW')),
  payout_minor     bigint,
  idempotency_key  text        NOT NULL,
  request_hash     char(64)    NOT NULL,                 -- SHA-256 do corpo canônico
  created_at       timestamptz NOT NULL DEFAULT now(),
  settled_at       timestamptz,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX idx_contracts_user    ON contracts (user_id, created_at DESC);
CREATE INDEX idx_contracts_expiry  ON contracts (status, expires_at);

CREATE TABLE indices (
  symbol      text        PRIMARY KEY,                   -- 'SYNTH_VOL_50'
  status      text        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED')),
  params      jsonb       NOT NULL,                      -- σ, μ, jumpProbability, jumpSize
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id          bigserial   PRIMARY KEY,
  actor_id    text        NOT NULL,
  action      text        NOT NULL,
  target_type text        NOT NULL,
  target_id   text        NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Role da aplicação sem UPDATE/DELETE em audit_logs e ticks.
```

Ticks, candles, `index_state` e `outbox`: schema oficial em `skills/03-synthetic-market-engine/references/api-guide.md`.

## Máquina de estados

```text
CREATED → PENDING_RESERVE → OPEN → EXPIRING → SETTLED
PENDING_RESERVE → FAILED_COMPENSATION     (reserva não confirmada após N tentativas)
OPEN → CANCELLED                          (regra de cancelamento pendente)
EXPIRING → FAILED_RETRYABLE → EXPIRING    (retry do settlement)
```

Transição fora desta lista = erro de programação: lançar exceção, não "corrigir" o estado.

## Resultado e valores

| Resultado | Condição (UP) | Condição (DOWN) | Movimentos Blnk |
|-----------|---------------|-----------------|-----------------|
| WIN | `exit > entry` | `exit < entry` | `reserved → available` (stake) + `house_payout → available` (lucro) |
| LOSS | `exit < entry` | `exit > entry` | `reserved → house_revenue` (stake) |
| DRAW | `exit = entry` | `exit = entry` | `reserved → available` (stake) |

Lucro do WIN = `stake_minor × 85 / 100` em aritmética inteira. Regra de arredondamento quando
não for exato: `<não definido no contexto>` (ver `02-financial-invariants`).
`payout_minor` gravado no contrato = valor total devolvido ao `available` (stake + lucro).

## Redis

Chaves de tick, lease, Stream e Pub/Sub: tabela oficial da skill 03. Chaves adicionais deste agente:

| Chave | Tipo | Uso |
|-------|------|-----|
| `stream:contracts:expiry` | Stream | Scheduler publica contratos vencidos; grupo `settlement-workers` |
| `stream:contracts:expiry:dlq` | Stream | Mensagens que excederam o máximo de tentativas |
| `ratelimit:{sub}:{route}` | String com TTL | Janela de 60 s, limite 30 |

## Blnk

| Balance | Criado em | Chave da transação inicial |
|---------|-----------|----------------------------|
| `user:{sub}:available` | Primeiro login | `demo-credit:{sub}` (10.000 → `1_000_000` centavos) |
| `user:{sub}:reserved` | Primeiro login | — |
| `house_payout`, `house_revenue` | Setup do ambiente | — |

Origem do crédito inicial demo: `<não definido no contexto>` (ver `02-financial-invariants`).
Toda chamada: timeout, retry com backoff + jitter, circuit breaker (`05-resilience-patterns`).
