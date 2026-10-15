# Execução — gráfico durável

Data: 2026-10-14 (America/Fortaleza).
HEAD inicial: `264c9d0eeaffb4544af6a6944721abeaeb4b7733`.
Workspace contém alterações locais de terceiros em Arena, documentos e `scripts/dev-live-feed.mjs`; preservadas.

Escopo agora autorizado pelo dono: [continuidade do feed ativo, tick oficial, contratos e velas](00-ESCOPO-APROVADO-2026-10-14.md). O plano anterior de 11 etapas não autoriza frontend, retenção ou expansão operacional. As primeiras duas necessidades formam um gate único de corte porque restaurar o boot sem persistir cada tick ainda permitiria preços descartáveis.

## Checkpoint

| Subetapa / Gate | Estado | Evidência / log |
|---|---|---|
| 01 diagnóstico/baseline | VALIDADA | Mapeamento real do código + baseline Vitest/PostgreSQL registrado |
| 02 atomicidade `TickRepository` | VALIDADA | 24/24 oráculos em PostgreSQL 16 efêmero (`repository-post-patch2-run.log`) |
| 03 schema (`0001`→`0010`→`0050`) | VALIDADA (local/efêmero) | 3/3 oráculos de schema + upgrade/idempotência/rollback seguro |
| **Gate A** (Itens 1 e 2: Feed ativo, log oficial e único produtor) | **VALIDADA (100% GREEN)** | `active-feed-durability*.oracle.test.mjs` (5/5 PASS) + `active-feed-durability-stress-chaos-security.oracle.test.mjs` (7/7 PASS, `gate-a-stress-chaos-security-green.log`) |
| **Gate B** (Item 3: Contratos abertos e liquidação durável) | **VALIDADA (100% GREEN)** | RED pré-patch (`0/3`, `gate-b-contracts-red.log`) → GREEN pós-patch (`8/8 PASS` em `active-feed-contracts-settlement.oracle.test.mjs` + `subetapa-1-settlement-resilience.test.mjs`, `gate-b-contracts-green.log`) |
| **Gate C** (Item 4: Velas derivadas e corte de leitura) | **VALIDADA (100% GREEN)** | RED pré-patch (`0/2`, `gate-c-candles-red.log`) → GREEN pós-patch (`6/6 PASS` em `active-feed-candles-cutover.oracle.test.mjs` + `subetapa-4-candles-performance-build.test.mjs`, `gate-c-candles-green.log`) |
| **Gate D1 / Subetapa 10.1** (Retenção segura de `ticks` e expurgo de `outbox_events`) | **VALIDADA (100% GREEN)** | RED pré-patch (`0/1`, `doc10-subetapa1-retention-red.log`) → GREEN pós-patch (`1/1 PASS` em `doc10-subetapa1-retention.oracle.test.mjs`, `doc10-subetapa1-retention-green.log`) |
| **Gate D2 / Subetapa 10.2** (Escrita atômica em lote 1x/s dos 36 ativos `produceTicksBatch`) | **VALIDADA (100% GREEN)** | RED pré-patch (`0/1`, `doc10-subetapa2-batch-red.log`) → GREEN pós-patch (`1/1 PASS` em `doc10-subetapa2-batch-ticks.oracle.test.mjs`, `doc10-subetapa2-batch-green.log`) |
| **Gate D3 / Subetapa 10.3** (Verificador contínuo de auditoria e métricas Prometheus) | **VALIDADA (100% GREEN)** | RED pré-patch (`0/1`, `doc10-subetapa3-audit-red.log`) → GREEN pós-patch (`1/1 PASS` em `doc10-subetapa3-audit-metrics.oracle.test.mjs`, `doc10-subetapa3-audit-green.log`) |

## Baseline executado

- Node Windows 22.17.0; pnpm 10.5.2; Vitest instalado 3.2.7; PostgreSQL 16-alpine descartável; Redis 7-alpine descartável; Docker Engine 29.8.2 via WSL2.
- Vitest de mercado/frontend: 76 arquivos, 426 testes, 420 PASS e 6 FAIL preexistentes fora do escopo (tokens visuais/blur/tipografia/motion); duração reportada 46,48s.
- Typecheck `web`, `@broker/tick-engine` e `@broker/wallet-adapter` com `tsc --noEmit`: exit 0.
- Antes de editar produto (`TickRepository`): conjunto de 16 testes contra código real importado via tsx, 2 PASS/14 FAIL, log `repository-full-baseline-red.log`.
- Patch intermediário somente de casts: 24 testes, 4 PASS/20 FAIL, 16,51s, log `repository-casts-only-red.log`. Happy-path e três falhas de trigger passaram; 20 escritores confirmaram 20 ticks (esperado 1), comprovando a corrida encoberta pelo erro SQL.
- Caos real de sessão: `pg_terminate_backend` dentro da transação expôs `uncaughtException Connection terminated unexpectedly` no rollback.
- Após o patch de consistência em `TickRepository`, 24/24 testes passaram contra PostgreSQL 16 efêmero (`repository-post-patch2-run.log`).
- Oráculo do processo real detectou que o feed ignorava `DEV_FEED_PORT`: aplicado seam mínimo para porta efêmera sem tocar na porta `3001`.

## Execução e Validação dos 3 Gates do Escopo Aprovado ([`00-ESCOPO-APROVADO-2026-10-14.md`](./00-ESCOPO-APROVADO-2026-10-14.md))

### 1. Gate de Schema Local (`0001` → `0010` → `0050`) — 100% GREEN
- **Arquivos corrigidos**: [`db/migrations/0010_seed_multi_assets.up.sql`](../../../db/migrations/0010_seed_multi_assets.up.sql), [`db/migrations/0010_seed_multi_assets.down.sql`](../../../db/migrations/0010_seed_multi_assets.down.sql), [`db/migrations/0050_rename_synthetic_indices.up.sql`](../../../db/migrations/0050_rename_synthetic_indices.up.sql), [`db/migrations/0050_rename_synthetic_indices.down.sql`](../../../db/migrations/0050_rename_synthetic_indices.down.sql).
- **Oráculos executados**: `tests/integration/chart-durability-schema.oracle.test.mjs` e `tests/integration/chart-durability-schema-0050.oracle.test.mjs` (**3/3 PASS** em PostgreSQL 16 efêmero).

### 2. Gate A — Feed Ativo, Log Oficial e Único Produtor (Itens 1 e 2) — 100% GREEN
- **Arquivos implementados/corrigidos**: [`services/tick-engine/live-market-store.mjs`](../../../services/tick-engine/live-market-store.mjs) e [`scripts/dev-live-feed.mjs`](../../../scripts/dev-live-feed.mjs).
- **Garantias comprovadas**:
  - `bootstrapMarketState()` carrega `index_state`, `ticks` e `candles` do PostgreSQL antes de aceitar tráfego, sem recriar histórico oficial nem reiniciar preço/sequência em memória.
  - Cada tick oficial é gravado atomicamente em `ticks` + `index_state` + `outbox_events` + `candles` na mesma transação PostgreSQL antes de atualizar o estado ou publicar via WebSocket/REST.
  - Liderança única por símbolo via lease Redis (`SET key owner PX 3000 NX`) + fencing monotônico no PostgreSQL (`lease_epoch`, `lease_leader`).
  - Preservação do histórico visual pré-corte estritamente anterior à primeira vela oficial (`legacy: true, provenance: 'legacy_visual'`).
- **Oráculos executados**:
  - `active-feed-durability.oracle.test.mjs`, `active-feed-durability-restart.oracle.test.mjs`, `active-feed-durability-publish.oracle.test.mjs`, `active-feed-durability-concurrency.oracle.test.mjs`: **5/5 PASS**.
  - `active-feed-durability-stress-chaos-security.oracle.test.mjs` (fencing de 2 processos reais, expiração de lease Redis e takeover com `lease_epoch` maior, `pg_terminate_backend` durante commit sem fantasma, desconexão Redis sem corrupção, rajada de 36 ativos sem Math.random e sem regressão de sequence, preservação do legado pré-corte e higiene de segredos): **7/7 PASS** (`tests/reports/grafico-duravel-baseline/gate-a-stress-chaos-security-green.log`).

### 3. Gate B — Contratos Abertos e Liquidação pelo Tick Oficial (Item 3) — 100% GREEN
- **Evidência RED pré-patch**: `tests/reports/grafico-duravel-baseline/gate-b-contracts-red.log` (**0/3 PASS**: JWT inválido aceito com 201, contrato liquidado por RAM sem tick oficial em `ticks`, e falha `503` na perna `WIN_PROFIT` do Blnk marcando contrato `SETTLED`).
- **Arquivos corrigidos**:
  - [`services/wallet-adapter/src/blnk-client.ts`](../../../services/wallet-adapter/src/blnk-client.ts) (e build em `dist/blnk-client.js`): `recordIdempotentTransaction` trata `409 Conflict` em referências determinísticas (`reserve:${id}`, `settlement:${id}:...`) como conclusão idempotente, permitindo retomada segura de segunda perna (`WIN_PROFIT`) após falha parcial sem duplicar lançamentos.
  - [`scripts/lib/settlement-engine.mjs`](../../../scripts/lib/settlement-engine.mjs): `settleOpenContract` executa `SELECT ... FOR UPDATE` no contrato, busca exclusivamente no PostgreSQL (`ticks`) o primeiro tick oficial onde `symbol = $1 AND ts >= expires_at ORDER BY ts ASC, sequence ASC LIMIT 1` (mantendo o contrato `OPEN` quando ainda não existe tick elegível), confirma a liquidação no Blnk antes de comitar `status = 'SETTLED'`, `exit_tick_sequence` e `outbox_events` (`CONTRACT_SETTLED`), e nunca executa `UPDATE users SET demo_balance_minor` como contabilidade.
  - [`scripts/dev-live-feed.mjs`](../../../scripts/dev-live-feed.mjs): validação rigorosa de JWT (`HS256`, `timingSafeEqual`, `exp`, `sub`, `iss`, `aud`), rejeição `401` para `Authorization` inválido em `POST /contracts`, `GET /contracts` e `GET /contracts/:id`, prevenção de BOLA/IDOR por escopo `user_id`, bloqueio de mass assignment, exigência de `Idempotency-Key`, validação do tick de entrada confirmado em `ticks` e reserva contábil idempotente no Blnk.
- **Evidência GREEN pós-patch**: `tests/integration/active-feed-contracts-settlement.oracle.test.mjs` + `tests/subetapa-1-settlement-resilience.test.mjs`: **8/8 PASS, fail 0** (`tests/reports/grafico-duravel-baseline/gate-b-contracts-green.log`).

### 4. Gate C — Velas Derivadas dos Ticks e Corte de Leitura (Item 4) — 100% GREEN
- **Evidência RED pré-patch**: `tests/reports/grafico-duravel-baseline/gate-c-candles-red.log` (**0/2 PASS**: ausência de `rebuildCandles` e `/candles` aceitando query inválida `interval=999d` com `200`).
- **Arquivos corrigidos**:
  - [`services/tick-engine/live-market-store.mjs`](../../../services/tick-engine/live-market-store.mjs): adicionados `rebuildCandles` (reconstrução transacional idempotente de `candles` a partir de `ticks` sob lock `FOR UPDATE` em `index_state`, com buckets UTC `[início, fim)`, `open` pela menor `sequence`, `close` pela maior `sequence` e `volume = COUNT(DISTINCT sequence)`) e `queryOfficialCandles`.
  - [`scripts/lib/candle-aggregation-engine.mjs`](../../../scripts/lib/candle-aggregation-engine.mjs): `aggregateCandlesToInterval` blindado contra velas fora de ordem (`_minTime` / `_maxTime`) e timestamps duplicados (bitmask O(1) sem inflar volume), além de `aggregateTicksToCandles` para derivação de sub-minuto (`5s`, `15s`, `30s`) por `sequence`.
  - [`scripts/dev-live-feed.mjs`](../../../scripts/dev-live-feed.mjs): reconstrução de velas `1m` e hidratação de `tickHistory` a partir do PostgreSQL no `bootstrapMarketState()`; validação estrita (`400`) de `interval`, `limit` (`1..10080`) e `before` (`> 0`) em `/candles`, `/api/candles`, `/v2/candles` e `/api/v2/candles`; exposição de `/v2/candles` com velas 100% oficiais e preservação do legado visual (`legacy: true, provenance: 'legacy_visual'`) estritamente anterior ao corte oficial em `/candles`.
- **Evidência GREEN pós-patch**: `tests/integration/active-feed-candles-cutover.oracle.test.mjs` + `tests/subetapa-4-candles-performance-build.test.mjs`: **6/6 PASS, fail 0** (`tests/reports/grafico-duravel-baseline/gate-c-candles-green.log`).

## Execução e Validação Aditiva do Documento #10 ([`12-PLANO-PERSISTENCIA-ADITIVA-DOC10.md`](./12-PLANO-PERSISTENCIA-ADITIVA-DOC10.md))

### 5. Subetapa 10.1 (Gate D1) — Retenção Segura de `ticks` e Expurgo de `outbox_events` — 100% GREEN
- **Evidência RED pré-patch**: `tests/reports/grafico-duravel-baseline/doc10-subetapa1-retention-red.log` (**0/1 PASS**).
- **Implementação**: `pruneMarketStorage({ tickRetentionMs, outboxRetentionMs, batchLimit })` em [`services/tick-engine/live-market-store.mjs`](../../../services/tick-engine/live-market-store.mjs) e agendamento periódico não-bloqueante em [`scripts/dev-live-feed.mjs`](../../../scripts/dev-live-feed.mjs). Utiliza `FOR UPDATE SKIP LOCKED` em `outbox_events` (`event_type = 'TICK'`) e `FOR UPDATE OF t SKIP LOCKED` em `ticks`, preservando rigorosamente o head atual (`t.sequence = s.last_sequence`), ticks referenciados por contratos `OPEN` ou `exit_tick_sequence`, eventos financeiros (`RESERVE_STAKE`, `CONTRACT_SETTLED`) e todas as velas de `1m`.
- **Evidência GREEN pós-patch**: `tests/integration/doc10-subetapa1-retention.oracle.test.mjs`: **1/1 PASS, fail 0** (`tests/reports/grafico-duravel-baseline/doc10-subetapa1-retention-green.log`).

### 6. Subetapa 10.2 (Gate D2) — Escrita Atômica em Lote 1x/s dos 36 Ativos (`produceTicksBatch`) — 100% GREEN
- **Evidência RED pré-patch**: `tests/reports/grafico-duravel-baseline/doc10-subetapa2-batch-red.log` (**0/1 PASS**).
- **Implementação**: `produceTicksBatch(batchItems)` em [`services/tick-engine/live-market-store.mjs`](../../../services/tick-engine/live-market-store.mjs) e integração em `runTickLoopCycle` em [`scripts/dev-live-feed.mjs`](../../../scripts/dev-live-feed.mjs). Ordena os símbolos por `symbol ASC` antes de adquirir lease e `FOR UPDATE OF s` no PostgreSQL (eliminando deadlocks), valida `checkHead` e `lease_epoch` por ativo e grava todos os 36 ativos em 1 única transação PostgreSQL por segundo com rollback integral em caso de falha parcial.
- **Evidência GREEN pós-patch**: `tests/integration/doc10-subetapa2-batch-ticks.oracle.test.mjs`: **1/1 PASS, fail 0** (`tests/reports/grafico-duravel-baseline/doc10-subetapa2-batch-green.log`).

### 7. Subetapa 10.3 (Gate D3) — Verificador Contínuo de Auditoria e Métricas Prometheus de Persistência — 100% GREEN
- **Evidência RED pré-patch**: `tests/reports/grafico-duravel-baseline/doc10-subetapa3-audit-red.log` (**0/1 PASS**).
- **Implementação**: `verifyMarketAuditIntegrity` e `getPersistenceMetrics` em [`services/tick-engine/live-market-store.mjs`](../../../services/tick-engine/live-market-store.mjs), mais endpoint `GET /api/v1/audit/market-integrity` e métricas Prometheus (`tick_persist_ms`, `tick_persist_p99_ms`, `tick_persist_queue_depth`, `tick_dropped_total`, `outbox_pending_total`, `market_audit_diffs_total`) em `/metrics` em [`scripts/dev-live-feed.mjs`](../../../scripts/dev-live-feed.mjs).
- **Evidência GREEN pós-patch**: `tests/integration/doc10-subetapa3-audit-metrics.oracle.test.mjs`: **1/1 PASS, fail 0** (`tests/reports/grafico-duravel-baseline/doc10-subetapa3-audit-green.log`).
- **Suíte consolidada de regressão e typecheck**: `tests/subetapa-*.test.mjs` (**29/29 PASS**) e `tsc --noEmit` em `services/tick-engine`, `services/wallet-adapter` e `apps/web` (**exit 0**).


