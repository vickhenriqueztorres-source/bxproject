# Plano Geral e Subetapas — 04 Torneios & Arena Blitz (Unificação Backend + Persistência + Liquidação Oficial)

Data: 2026-10-15  
Orquestrador: `tech-lead-orchestrator`  
Agentes acionados: `codebase-mapper-agent`, `broker-architect-agent`, `financial-correctness-reviewer`, `security-reviewer`, `backend-implementation-agent`, `surgical-frontend-agent`, `qa-resilience-agent`, `regression-guardian-agent`, `post-implementation-verifier`.

---

## 1. Diagnóstico Forense Consolidado

1. **Achado 4.1 (Frontend 100% simulado no navegador)**:
   - `apps/web/src/arena/use-arena.ts` executa `join()`, `place()`, `settleUser()`, `rebuy()` e `finalize()` apenas em memória (`useRef<Store>`), sem chamar `/api/v1/arena/*` nem debitar/creditar carteira, perdendo 100% do estado em `F5`.
   - `use-arena.ts:389-394` aplica micro-variação local via PRNG `mulberry32` sobre `priceRef.current` a cada 250ms, mesmo quando há WebSocket conectado.
2. **Achado 4.2 (Backend desconectado e divergência matemática)**:
   - `TIER_WEIGHTS_BPS` diverge entre `@broker/wallet-adapter` (`TOP_10: [3500, 2000, 1200, 700, 700, 380x5]`) e `apps/web/src/arena/engine.ts` (`TOP_10: [2800, 1800, 1200, 900, ...]`).
   - `podiumPrizes` no frontend trunca com `Math.floor` e retém centavos residuais, enquanto o backend usa Hare-Niemeyer exato (`remainingEscrowMinor === 0`).
   - O servidor ativo (`scripts/dev-live-feed.mjs`) não expõe `/api/v1/arena/*`.
3. **Cinco Bombas Ocultas no Backend (`tournament-arena-service.ts` / `routes/arena.ts`)**:
   - **Bomba 1 (Fraude de Liquidação)**: `POST /api/v1/arena/tournaments/:id/trades/:tradeId/settle` aceita `result: "WIN"` vindo do cliente e `openArenaTrade` não grava `entry_price` oficial.
   - **Bomba 2 (Persistência Fantasma)**: `TournamentArenaService` mantém tudo em `Map` estático na RAM e nunca grava nas tabelas PostgreSQL (`0061`), além de faltar a tabela `arena_trade_orders`.
   - **Bomba 3 (Segurança / RBAC / BOLA)**: `/settle`, `/dev/spawn` e `/dev/fast-forward` estão sem autenticação/trava de ambiente, e `/wallet/real/deposit/confirm` / `/withdraw/:txId/*` não validam propriedade (`user_id`) nem RBAC.
   - **Bomba 4 (Poluição de Escrow por Bots)**: `seedArenaCompetitors` mistura fundos sintéticos no escrow real se não houver isolamento contábil claro.
   - **Bomba 5 (Violação CSPRNG)**: Uso de `Math.random()` em `tournament-arena-service.ts:664` e `scripts/dev-live-feed.mjs`.

---

## 2. Divisão em Subetapas com Gates RED → GREEN

### Subetapa 04.1 (Gate T1) — Unificação Matemática, CSPRNG e Persistência PostgreSQL (`0061` + `0062`)
- **Escopo**:
  1. Unificar `TIER_WEIGHTS_BPS` e Hare-Niemeyer (`TOP_3`, `TOP_10`, `TOP_20`, `TOP_30`) entre `services/wallet-adapter/src/blnk-client.ts` e `apps/web/src/arena/engine.ts` (garantindo soma = `10_000 bps` e `residual === 0` em todos os tiers, inclusive `TOP_3`).
  2. Substituir `Math.random()` por `crypto.randomInt` em `services/api/src/services/tournament-arena-service.ts` e `scripts/dev-live-feed.mjs`.
  3. Criar migration `db/migrations/0062_arena_trade_orders.up.sql` (e `.down.sql`) para persistir `arena_trade_orders` com `entry_price`, `entry_tick_sequence`, `entry_tick_hash`, `exit_price`, `exit_tick_sequence`, `exit_tick_hash`, e sincronizar `TournamentArenaService` com o PostgreSQL quando `pool` é fornecido (incluindo recuperação pós-restart a partir do banco).
- **Oráculo (`tests/integration/doc04-subetapa1-arena-persistence-math.oracle.test.mjs`)**:
  - Valida paridade matemática 100% entre `engine.ts` e `@broker/wallet-adapter` para `TOP_3`, `TOP_10`, `TOP_20`, `TOP_30`.
  - Valida persistência real em PostgreSQL 16 efêmero (`arena_tournaments`, `arena_participants`, `arena_trade_orders`, `arena_ledger_events`, `user_bonus_grants`) e recuperação completa do estado após `resetStateForTesting()` / restart do serviço.
  - Valida zero ocorrências de `Math.random` no backend da Arena.

### Subetapa 04.2 (Gate T2) — Liquidação Oficial pelo Tick do Banco (`ts >= expires_at`) e Blindagem de Segurança / RBAC / BOLA
- **Escopo**:
  1. `openArenaTrade`: quando `pool` está presente, busca o último tick oficial confirmado na tabela `ticks` do PostgreSQL para definir `entry_price`, `entry_tick_sequence` e `entry_tick_hash` no servidor (rejeitando se não houver tick oficial).
  2. `settleArenaTrade`: quando `pool` está presente, **ignora/rejeita qualquer `result` enviado pelo cliente** e liquida a ordem exclusivamente pelo **primeiro tick oficial em `ticks` onde `symbol = $1 AND ts >= expires_at ORDER BY ts ASC, sequence ASC LIMIT 1`** sob lock transacional (`FOR UPDATE`), aplicando o Momentum Streak 3x (+15%) a partir da 3ª vitória consecutiva.
  3. Blindagem de segurança em `services/api/src/routes/arena.ts`:
     - Exigir autenticação em `/api/v1/arena/tournaments/:id/settle`.
     - Bloquear `/dev/spawn` e `/dev/fast-forward` em `NODE_ENV === 'production'`.
     - Validar `tx.user_id === user.id` (ou `user.role === 'ADMIN'`) em `/wallet/real/deposit/confirm`, `/withdraw/:txId/complete` e `/withdraw/:txId/cancel` (bloqueando BOLA/IDOR com `403 FORBIDDEN`).
     - Na rota `POST /api/v1/arena/tournaments/:id/trades/:tradeId/settle`, proibir que o cliente force `"WIN"` contra o tick oficial do banco.
- **Oráculo (`tests/integration/doc04-subetapa2-arena-settlement-security.oracle.test.mjs`)**:
  - **Segurança / Anti-Fraude**: Cliente tenta enviar `result: "WIN"` num trade cujo primeiro tick `ts >= expires_at` caiu (preço menor em ordem `UP`) -> o servidor liquida como `LOSS` pelo tick oficial!
  - **Determinismo Temporal**: Trade antes de `expires_at` sem tick elegível não pode ser liquidado prematuramente (`TOURNAMENT_TRADE_NOT_EXPIRED_OR_NO_TICK`).
  - **BOLA / RBAC**: Usuário B tentando confirmar depósito ou cancelar saque do Usuário A recebe `403`; chamada a `/dev/spawn` com `NODE_ENV=production` recebe `403`.

### Subetapa 04.3 (Gate T3) — Rotas `/api/v1/arena/*` no Servidor Ativo (`scripts/dev-live-feed.mjs`) e Conexão do Frontend (`use-arena.ts`)
- **Escopo**:
  1. Expor no servidor ativo (`scripts/dev-live-feed.mjs`) os endpoints completos da Arena Blitz respaldados por PostgreSQL + Redis + Blnk:
     - `GET /api/v1/arena/tournaments` (lista salas ativas Bronze/Prata/Ouro ou cria salas padrão no boot).
     - `POST /api/v1/arena/tournaments/:id/join` (autenticado + `Idempotency-Key`, debita buy-in 30% rake / 70% escrow e registra participante em `arena_participants` + `arena_ledger_events`).
     - `POST /api/v1/arena/tournaments/:id/rebuy` (autenticado + `Idempotency-Key`, validação quádrupla + split 30/70).
     - `POST /api/v1/arena/tournaments/:id/trades` (autenticado, captura `entry_price` oficial de `ticks`, trava de 20%, freeze de último minuto e anti-mirror-hedging).
     - `POST /api/v1/arena/tournaments/:id/trades/:tradeId/settle` e sweeper automático no loop de ticks que liquida ordens vencidas com o primeiro tick oficial `ts >= expires_at`.
     - `GET /api/v1/arena/tournaments/:id/leaderboard` (retorna ranking real + `@Alpha_Quant` + radar da bolha).
     - `POST /api/v1/arena/tournaments/:id/settle` (distribui 100% do escrow via Hare-Niemeyer e grava `PRIZE_PAYOUT` / `BONUS_GRANT`).
  2. Atualizar `apps/web/src/arena/use-arena.ts` e `apps/web/src/api/client.ts`:
     - Remover a mutação local de `priceRef.current` por `mulberry32` quando o WebSocket oficial já recebeu ticks (`liveTick !== null`).
     - Sincronizar `join`, `place`, `rebuy` e `leaderboard` com `/api/v1/arena/*` de forma assíncrona não-bloqueante quando houver sessão/backend ativo, mantendo o estado síncrono otimista/determinístico para que **todos os 47 testes unitários existentes de UI (`npx vitest run apps/web/src/arena`) continuem passando 100% sem regressão**.
- **Oráculo (`tests/integration/doc04-subetapa3-active-feed-arena-e2e.oracle.test.mjs`)**:
  - Fluxo ponta a ponta contra `scripts/dev-live-feed.mjs` + PostgreSQL 16 + Redis 7 efêmeros: `join` -> `open trade` -> geração de ticks oficiais -> liquidação automática por tick oficial `ts >= expires_at` -> sobrevivência ao restart do processo (`F5` / restart do servidor) -> `settle` final com soma de prêmios = 100% do escrow (`remainingEscrowMinor === 0`).

---

## 3. Matriz de Execução e Evidências RED → GREEN (100% Concluído)

| Subetapa | Gate | Oráculo de Integração | Log RED | Log GREEN | Status |
|---|---|---|---|---|---|
| **Subetapa 04.1** | **Gate T1** | `tests/integration/doc04-subetapa1-arena-persistence-math.oracle.test.mjs` | `tests/reports/grafico-duravel-baseline/doc04-subetapa1-red.log` | `tests/reports/grafico-duravel-baseline/doc04-subetapa1-green.log` (`3/3 PASS`) | **100% VALIDADO (GREEN)** |
| **Subetapa 04.2** | **Gate T2** | `tests/integration/doc04-subetapa2-arena-settlement-security.oracle.test.mjs` | `tests/reports/grafico-duravel-baseline/doc04-subetapa2-red.log` | `tests/reports/grafico-duravel-baseline/doc04-subetapa2-green.log` (`2/2 PASS`) | **100% VALIDADO (GREEN)** |
| **Subetapa 04.3** | **Gate T3** | `tests/integration/doc04-subetapa3-active-feed-arena-e2e.oracle.test.mjs` | `tests/reports/grafico-duravel-baseline/doc04-subetapa3-red.log` | `tests/reports/grafico-duravel-baseline/doc04-subetapa3-green.log` (`2/2 PASS`) | **100% VALIDADO (GREEN)** |
| **Regressão Geral** | **Guardião** | `npx vitest run apps/web/src/arena` (`47/47 PASS`) + `pnpm --filter @broker/api test` (`34/34 PASS`) + `tsc --noEmit` (`0 erros`) | — | — | **100% ÍNTEGRO** |

