# Subetapa 04.2 (Gate T2) — Liquidação Oficial pelo Tick do Banco (`ts >= expires_at`) e Blindagem RBAC/BOLA nas Rotas da Arena

## 1. Objetivo
Erradicar a fraude de vitória ditada pelo cliente (`body.result || "WIN"`), ancorar a abertura (`entry_price` / `entry_tick_sequence`) e liquidação (`exit_price` / `exit_tick_sequence` do primeiro tick oficial `ts >= expires_at`) das ordens da Arena na tabela `ticks` do PostgreSQL e blindar todas as rotas sensíveis de [`services/api/src/routes/arena.ts`](file:///d:/brokerproject/services/api/src/routes/arena.ts) contra acesso anônimo, BOLA/IDOR e abuso de endpoints `/dev/*` em produção.

## 2. Agentes e Skills Envolvidos
- **`backend-implementation-agent`** (`02-financial-invariants`, `03-synthetic-market-engine`, `04-security-iam`)
- **`financial-correctness-reviewer`** (`02-financial-invariants`, `09-ai-failure-map`)
- **`security-reviewer`** (`04-security-iam`, `09-ai-failure-map`)
- **`qa-resilience-agent`** (`06-testing-quality`, `10-post-implementation-verification`)

## 3. Escopo de Arquivos
- **Alterado**: [`services/api/src/services/tournament-arena-service.ts`](file:///d:/brokerproject/services/api/src/services/tournament-arena-service.ts) (`openArenaTrade` e `settleArenaTrade` consultando `ticks` quando `this.pool` está ativo)
- **Alterado**: [`services/api/src/routes/arena.ts`](file:///d:/brokerproject/services/api/src/routes/arena.ts) (`authPreHandler` em `/settle`, guarda de produção em `/dev/*`, proteção BOLA/IDOR nas rotas `/wallet/real/*` e bloqueio de manipulação de `result` pelo cliente quando conectado ao banco)
- **Oráculo**: [`tests/integration/doc04-subetapa2-arena-settlement-security.oracle.test.mjs`](file:///d:/brokerproject/tests/integration/doc04-subetapa2-arena-settlement-security.oracle.test.mjs)

## 4. Invariantes e Garantias Testadas no Gate T2
1. **[I-03 / M-03 — Liquidação Oficial pelo Primeiro Tick `ts >= expires_at`]**:
   - Quando `this.pool` está conectado, `openArenaTrade` captura `entry_price` e `entry_tick_sequence` do último tick oficial do ativo (`ts <= opened_at`).
   - `settleArenaTrade` busca o primeiro tick oficial onde `symbol = order.symbol AND ts >= order.expires_at ORDER BY ts ASC, sequence ASC LIMIT 1`:
     - Se ainda não existe tick `ts >= expires_at`, rejeita com `ARENA_SETTLEMENT_TICK_NOT_AVAILABLE` (`409`).
     - Calcula `WIN` / `LOSS` / `DRAW` exclusivamente pela comparação entre `exit_price` e `entry_price` conforme `order.direction` (`UP` vs `DOWN`), **ignorando qualquer `result` enviado pelo cliente**.
2. **[S-01 / S-02 / S-03 — Autenticação, RBAC e Proteção BOLA/IDOR]**:
   - `POST /api/v1/arena/tournaments/:id/settle` exige autenticação (`401` sem token válido).
   - `POST /api/v1/arena/tournaments/dev/spawn` e `POST /api/v1/arena/tournaments/:id/dev/fast-forward` retornam `403 PRODUCTION_FORBIDDEN` quando `process.env.NODE_ENV === "production"`.
   - `POST /api/v1/arena/wallet/real/deposit/confirm`, `POST /api/v1/arena/wallet/real/withdraw/:txId/complete` e `POST /api/v1/arena/wallet/real/withdraw/:txId/cancel` verificam se `tx.user_id === user.id` (ou `user.role === "ADMIN"`), bloqueando com `403 FORBIDDEN_BOLA` tentativas de confirmar/completar/cancelar transação de outro usuário.
   - `POST /api/v1/arena/tournaments/:id/trades/:tradeId/settle` verifica se `order.user_id === user.id` (ou `user.role === "ADMIN"`), bloqueando BOLA entre participantes.
3. **[Regressão Zero]**: `services/api/test/arena-phase1-phase2.unit.test.ts` (que instancia `TournamentArenaService` em memória sem `pool`) continua passando 100%.

## 5. Plano de Rollback
Reverter `services/api/src/services/tournament-arena-service.ts` e `services/api/src/routes/arena.ts` para o estado do Gate T1.
