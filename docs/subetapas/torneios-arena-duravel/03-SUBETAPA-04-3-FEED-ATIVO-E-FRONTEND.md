# Subetapa 04.3 (Gate T3) — Conexão das Rotas `/api/v1/arena/*` no Processo Ativo (`scripts/dev-live-feed.mjs`), Sweeper de Expiração e Hidratação do `use-arena.ts`

## 1. Objetivo
Expor as rotas `/api/v1/arena/*` e `/api/v1/wallet/real/*` no servidor ativo ([`scripts/dev-live-feed.mjs`](file:///d:/brokerproject/scripts/dev-live-feed.mjs)) apoiadas pelo PostgreSQL real e pelo fluxo oficial de ticks, adicionar o sweeper automático que liquida ordens expiradas da Arena no loop de ticks e conectar [`apps/web/src/arena/use-arena.ts`](file:///d:/brokerproject/apps/web/src/arena/use-arena.ts) às rotas de backend eliminando a mutação local de preço (`mulberry32`) quando o feed ao vivo está conectado, preservando 100% da compatibilidade com os 47 testes unitários de frontend.

## 2. Agentes e Skills Envolvidos
- **`backend-implementation-agent`** (`01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`)
- **`surgical-frontend-agent`** (`17-mudanca-cirurgica`, `12-tokens-binmax`)
- **`regression-guardian-agent`** (`06-testing-quality`, `10-post-implementation-verification`)

## 3. Escopo de Arquivos
- **Alterado**: [`services/api/src/services/tournament-arena-service.ts`](file:///d:/brokerproject/services/api/src/services/tournament-arena-service.ts) (método `sweepExpiredArenaTrades` para liquidar automaticamente ordens `OPEN` com `expires_at <= now` usando o primeiro tick oficial `ts >= expires_at`)
- **Alterado**: [`scripts/dev-live-feed.mjs`](file:///d:/brokerproject/scripts/dev-live-feed.mjs) (montagem das rotas `/api/v1/arena/*` e `/api/v1/wallet/real/*`, hidratação inicial via `hydrateFromDatabase()` e chamada ao `sweepExpiredArenaTrades` no loop de mercado)
- **Alterado**: [`apps/web/src/arena/use-arena.ts`](file:///d:/brokerproject/apps/web/src/arena/use-arena.ts) (sincronização assíncrona não-bloqueante com `/api/v1/arena/*` e bloqueio do drift `mulberry32` quando `liveTick !== null`)
- **Oráculo**: [`tests/integration/doc04-subetapa3-active-feed-arena-e2e.oracle.test.mjs`](file:///d:/brokerproject/tests/integration/doc04-subetapa3-active-feed-arena-e2e.oracle.test.mjs)

## 4. Invariantes e Garantias Testadas no Gate T3
1. **[Fluxo E2E Real no Processo Ativo]**:
   - `GET /api/v1/arena/tournaments` retorna os torneios ativos hidratados do PostgreSQL.
   - `POST /api/v1/arena/tournaments/:id/join`, `POST /api/v1/arena/tournaments/:id/rebuy`, `POST /api/v1/arena/tournaments/:id/trades`, `GET /api/v1/arena/tournaments/:id/leaderboard` e `POST /api/v1/arena/tournaments/:id/settle` funcionam ponta a ponta em `scripts/dev-live-feed.mjs`.
2. **[Liquidação Automática por Tick Oficial]**:
   - Ordens abertas na Arena são liquidadas automaticamente pelo sweeper assim que o `liveMarketStore` produz o primeiro tick com `ts >= expires_at`, atualizando o saldo `T$`, o `streak` e o ranking sem depender de chamada manual do navegador.
3. **[Sobrevivência a Restart (F5 / `pm2 restart`)]**:
   - Reiniciar o processo `scripts/dev-live-feed.mjs` preserva 100% do torneio, participantes, ranking, ordens e saldos no PostgreSQL.
4. **[Regressão Zero]**:
   - Todos os 47 testes unitários de `apps/web/src/arena` e os 34 testes de `@broker/api` passam sem regressão.

## 5. Plano de Rollback
Reverter `scripts/dev-live-feed.mjs`, `apps/web/src/arena/use-arena.ts` e `services/api/src/services/tournament-arena-service.ts` para o estado do Gate T2.
