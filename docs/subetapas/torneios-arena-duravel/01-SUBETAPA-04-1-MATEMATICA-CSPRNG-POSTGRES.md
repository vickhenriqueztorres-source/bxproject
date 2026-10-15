# Subetapa 04.1 (Gate T1) — Unificação Matemática Hare-Niemeyer, Erradicação de `Math.random` e Persistência Durável PostgreSQL (`0061` + `0062`)

## 1. Objetivo
Eliminar as divergências matemáticas entre frontend e backend, erradicar `Math.random()` dos serviços de torneio/carteira e conectar [`TournamentArenaService`](file:///d:/brokerproject/services/api/src/services/tournament-arena-service.ts) ao PostgreSQL real (`arena_tournaments`, `arena_participants`, `arena_ledger_events`, `user_bonus_grants`, `arena_trade_orders`, `arena_real_balances`, `arena_wallet_transactions`) com hidratação de estado (`hydrateFromDatabase`) capaz de recuperar 100% do torneio após `restart`.

## 2. Agentes e Skills Envolvidos
- **`backend-implementation-agent`** (`02-financial-invariants`, `08-database-foundation`)
- **`surgical-frontend-agent`** (`17-mudanca-cirurgica`)
- **`qa-resilience-agent`** (`06-testing-quality`, `10-post-implementation-verification`)

## 3. Escopo de Arquivos
- **Novo**: [`db/migrations/0062_arena_trade_orders.up.sql`](file:///d:/brokerproject/db/migrations/0062_arena_trade_orders.up.sql) e [`db/migrations/0062_arena_trade_orders.down.sql`](file:///d:/brokerproject/db/migrations/0062_arena_trade_orders.down.sql)
- **Alterado**: [`apps/web/src/arena/engine.ts`](file:///d:/brokerproject/apps/web/src/arena/engine.ts) (`TIER_WEIGHTS_BPS` e `podiumPrizes`)
- **Alterado**: [`services/api/src/services/tournament-arena-service.ts`](file:///d:/brokerproject/services/api/src/services/tournament-arena-service.ts) (CSPRNG + persistência PostgreSQL + `hydrateFromDatabase`)
- **Alterado**: [`scripts/dev-live-feed.mjs`](file:///d:/brokerproject/scripts/dev-live-feed.mjs) (substituição de `Math.random()` nas linhas 1857 e 1997 por `crypto.randomUUID()`)
- **Oráculo**: [`tests/integration/doc04-subetapa1-arena-persistence-math.oracle.test.mjs`](file:///d:/brokerproject/tests/integration/doc04-subetapa1-arena-persistence-math.oracle.test.mjs)

## 4. Invariantes e Garantias Testadas no Gate T1
1. **[I-02 / I-06 — Paridade Matemática Exata]**: `tierPrizes(poolCents, tier)` e `podiumPrizes(poolCents)` em [`apps/web/src/arena/engine.ts`](file:///d:/brokerproject/apps/web/src/arena/engine.ts) produzem exatamente o mesmo vetor em centavos inteiros que `calculateExactPrizeDistribution(poolCents, tier)` em [`services/wallet-adapter/src/blnk-client.ts`](file:///d:/brokerproject/services/wallet-adapter/src/blnk-client.ts) para `TOP_3`, `TOP_10`, `TOP_20` e `TOP_30`, para pools pares, ímpares e primos (`0`, `100`, `500`, `10_503`, `15_750`, `99_999`).
2. **[M-01 — Zero `Math.random()`]**: Nenhuma ocorrência de `Math.random` em `services/api/src/services/tournament-arena-service.ts` nem nas rotas de carteira/torneio de `scripts/dev-live-feed.mjs`.
3. **[DB-01 / I-01 / I-04 — Persistência Durável e Hidratação Pós-Restart]**:
   - Criação de torneio, depósito real, buy-in, rebuy, abertura de ordem, liquidação de ordem e liquidação final de torneio gravam duravelmente no PostgreSQL quando `this.pool` está conectado.
   - Após `TournamentArenaService.resetStateForTesting()` (simulando `pm2 restart`) e chamada a `await service.hydrateFromDatabase()`, o estado completo de torneios, participantes, saldos reais, ordens abertas/liquidadas, eventos de ledger (`arena_ledger_events`) e bônus (`user_bonus_grants`) é restaurado sem perda de 1 centavo.
4. **[Regressão Zero]**: Todos os 47 testes unitários existentes de `apps/web/src/arena` e os testes de `services/api/test/arena-phase1-phase2.unit.test.ts` continuam 100% verdes.

## 5. Plano de Rollback
Reverter alterações em `apps/web/src/arena/engine.ts`, `services/api/src/services/tournament-arena-service.ts`, `scripts/dev-live-feed.mjs` e remover `db/migrations/0062_arena_trade_orders.*`.
