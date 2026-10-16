# Subetapa 02 (P0-2) — Outbox com 2 Milhões de Pendentes: Diagnóstico, Decisão, Arquivamento, Retenção 7d e Alerta

**Item:** `P0-2` (Crítico — Banco de Dados / Outbox / Operação)  
**Agentes:** `backend-implementation-agent` + `broker-architect-agent` (Implementação) | `financial-correctness-reviewer` + `qa-resilience-agent` + `post-implementation-verifier` (Revisão e Verificação)  
**Skills:** `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `07-production-operations`, `08-database-foundation`

---

## 1. Diagnóstico Forense (Passo 1)

### 1.1 Mapeamento de Produtores e Consumidores de `outbox_events` no Repositório (Grep Completo)

| `event_type` | Onde é gravado (Produtor) | Status inicial gravado | Quem consome no repositório? | Situação em Produção (`dev-live-feed.mjs`) |
|---|---|---|---|---|
| `'TICK'` | `services/tick-engine/live-market-store.mjs:229` (`produceTick`) e `l.398` (`produceTicksBatch`) | `'PENDING'` (default da tabela) | **Ninguém!** (`services/outbox-relay/src/index.ts:66` procura `event_type === 'TICK_GENERATED'`, não `'TICK'`). No monólito `dev-live-feed.mjs`, o próprio `runTickLoopCycle` já aplica os ticks em memória e faz broadcast WebSocket imediatamente após o commit. | Gera `36 ativos × 1 tick/s = 36 linhas PENDING/s` (`~129.600/hora`). O prune em `live-market-store.mjs:820` só apagava `TICK` mais velhos que `outboxRetentionMs` (default 24h = `3.110.400` linhas!), explicando os `~2.092.718` `PENDING` acumulados! |
| `'RESERVE_STAKE'` | `scripts/dev-live-feed.mjs:3077` e `services/api/src/services/contract-service.ts:334` | `'PROCESSED'` quando Blnk está ativo; `'PENDING'` quando Blnk está desligado (`dev-live-feed.mjs:3079`) | `services/outbox-relay/src/index.ts:94` (chama `activeBlnk.reserveStake`). Porém, no modo sem Blnk (`BLNK_ENABLED=false`), não há Blnk para chamar e o débito já é feito na transação PostgreSQL (P0-1). | Ficava eternamente em `'PENDING'` quando aberto sem Blnk, sem consumidor e sem entrar no prune (que filtrava `WHERE event_type = 'TICK'`). |
| `'CONTRACT_SETTLED'` | `scripts/lib/settlement-engine.mjs:399` e `services/settlement-worker/src/settlement-consumer.ts:184` | `'PROCESSED'` em `settlement-engine.mjs:400`; `'PENDING'` no worker separado | `services/outbox-relay/src/index.ts:106` (chama `activeBlnk.settleContract`). | Em `settlement-engine.mjs:400` já nasce `'PROCESSED'`, mas nunca era limpo porque o prune filtrava `WHERE event_type = 'TICK'`. |
| `'TICK_GENERATED'` | `services/tick-engine/src/persistence/tick-repository.ts:99` | `'PENDING'` | `services/outbox-relay/src/index.ts:66` | Usado apenas nos microsserviços isolados; não no monólito `dev-live-feed.mjs`. |
| `'CANDLE_CLOSED'` | `services/candle-worker/src/persistence/candle-repository.ts:44` | `'PENDING'` | **Ninguém** em `services/outbox-relay` | Usado apenas no candle-worker isolado. |

### 1.2 Script de Diagnóstico Read-Only (`scripts/diag/outbox-diagnostic.mjs`)
Executa em modo estritamente read-only:
```sql
SELECT event_type, status, count(*)::bigint AS total, min(created_at) AS min_created_at, max(created_at) AS max_created_at
FROM outbox_events
GROUP BY 1, 2
ORDER BY 1, 2;

SELECT pg_total_relation_size('outbox_events') AS total_bytes,
       pg_size_pretty(pg_total_relation_size('outbox_events')) AS total_pretty,
       pg_relation_size('outbox_events') AS table_bytes,
       pg_indexes_size('outbox_events') AS indexes_bytes;
```

---

## 2. Decisão Arquitetural Fundamentada (Passo 2)

Com base nas evidências do Passo 1, aplicamos a decisão híbrida exata do prompt:

1. **Opção B para `'TICK'` no `live-market-store.mjs` quando não há consumidor externo (`OUTBOX_WRITE_TICK_EVENTS`):**
   - No monólito em produção (`dev-live-feed.mjs`), ninguém consome `'TICK'` da tabela `outbox_events` (o broadcast WebSocket e o candle `1m` já são atualizados pelo próprio processo líder após o commit).
   - Gravar 36 linhas/segundo de `'TICK'` em `outbox_events` sem consumidor gera mais de 3 milhões de tuplas mortas por dia e infla o disco/autovacuum.
   - **Solução:** Controlar a gravação de `'TICK'` na `outbox_events` pela flag `OUTBOX_WRITE_TICK_EVENTS` (default: `'false'` no runtime contínuo; quando `'true'` ou quando `options.writeTickOutbox === true` nos testes-oráculo de durabilidade que inspecionam `outbox_events`, mantém a gravação).
   - Além disso, quando gravado sem relay externo no modo demo sem Blnk, `'RESERVE_STAKE'` em `dev-live-feed.mjs` já tem seu efeito financeiro liquidado na própria transação PostgreSQL (`UPDATE users SET demo_balance_minor = demo_balance_minor - $1`), devendo ser gravado como `'PROCESSED'` (`processed_at = NOW()`) quando `!blnkConfigured`, ou `'PENDING'` apenas se `BLNK_OUTBOX_ASYNC === 'true'`.
2. **Opção A + Arquivamento Seguro em Lotes de 10.000 (`archiveLegacyPendingOutbox`):**
   - Os pendentes antigos (`status = 'PENDING'` anteriores ao corte `cutoffIso`) **não podem ser reprocessados às cegas** (evitando duplicar reservas/liquidações antigas).
   - Função e utilitário CLI (`scripts/diag/outbox-archive-and-prune.mjs` + método em `liveMarketStore.archivePendingOutboxBefore({ cutoffIso, batchLimit = 10000 })`) que marca os eventos `PENDING` anteriores a `cutoffIso` como `status = 'ARCHIVED'`, `processed_at = NOW()` em lotes de `10.000` usando `FOR UPDATE SKIP LOCKED` (zero lock longo na tabela).
   - No `services/outbox-relay/src/index.ts`: atualizar o lote para `LIMIT 500` com `FOR UPDATE SKIP LOCKED`, backoff exponencial com jitter e transição para `FAILED` após 5 tentativas, suportando tanto `TICK_GENERATED` quanto `TICK`.

---

## 3. Retenção de 7 Dias em Lotes (Passo 3)

Atualizar `pruneMarketStorage` em `services/tick-engine/live-market-store.mjs` e criar função dedicada `pruneProcessedAndArchivedOutbox`:
- Apaga registros de `outbox_events` com `status IN ('PROCESSED', 'ARCHIVED')` e `created_at < NOW() - interval '7 days'` (configurável via `OUTBOX_RETENTION_DAYS=7`, default 7 dias para eventos de contrato/arquivados, e retenção curta para `TICK` processados/arquivados) em lotes (`LIMIT 10000 FOR UPDATE SKIP LOCKED`).
- Roda automaticamente no timer periódico do `dev-live-feed.mjs` a cada 60s.

---

## 4. Métrica `outbox_oldest_pending_seconds` e Alerta > 300s (Passo 4)

1. Em `services/tick-engine/live-market-store.mjs` (`getPersistenceMetrics()`):
   - Consultar:
     ```sql
     SELECT COUNT(*)::int AS cnt,
            COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))), 0)::float AS oldest_sec
     FROM outbox_events
     WHERE status = 'PENDING'
     ```
   - Retornar `outbox_pending_total` e `outbox_oldest_pending_seconds`.
2. Em `scripts/dev-live-feed.mjs` (`GET /metrics`):
   - Expor:
     ```prometheus
     # HELP outbox_pending_total Total de eventos pendentes na tabela outbox_events
     # TYPE outbox_pending_total gauge
     outbox_pending_total <valor>
     # HELP outbox_oldest_pending_seconds Idade em segundos do evento PENDING mais antigo na outbox_events
     # TYPE outbox_oldest_pending_seconds gauge
     outbox_oldest_pending_seconds <valor>
     # HELP outbox_lag_alert Alerta binario quando outbox_oldest_pending_seconds > 300 (0=ok, 1=alerta)
     # TYPE outbox_lag_alert gauge
     outbox_lag_alert <0|1>
     ```
3. Em `infra/prometheus/alerts.yml` (ou arquivo de regras de alerta do projeto):
   - Adicionar regra `OutboxOldestPendingHigh` (`outbox_oldest_pending_seconds > 300` por `5m`).

---

## 5. Bateria de Testes Obrigatórios (Unitário, Integração, Estresse, Segurança e Caos)

Arquivo: `tests/integration/p0-2-outbox-lifecycle-and-metrics.test.mjs`

1. **[Diagnóstico & Arquivamento em Lote]:**
   - Insere 25.000 eventos `PENDING` antigos (anteriores ao `cutoffIso`) e 50 eventos `PENDING` novos.
   - Executa o arquivamento em lotes de 10.000 (`FOR UPDATE SKIP LOCKED`): comprova que em 3 ciclos todos os 25.000 antigos viram `ARCHIVED` sem tocar nos 50 novos e sem reprocessar efeitos financeiros no Blnk/users.
2. **[Retenção de 7 Dias em Lote]:**
   - Insere eventos `PROCESSED` e `ARCHIVED` com `created_at` de 8 dias atrás e de 2 dias atrás.
   - Executa o job de retenção de 7 dias: comprova que apenas os registros com `> 7 dias` são removidos, mantendo os de 2 dias intactos.
3. **[Métricas e Alerta > 300s]:**
   - Com 0 pendentes: `outbox_pending_total === 0`, `outbox_oldest_pending_seconds === 0`, `outbox_lag_alert === 0`.
   - Com 1 evento `PENDING` criado há `350s`: `outbox_oldest_pending_seconds >= 350` e `outbox_lag_alert === 1`.
4. **[Caos & Concorrência (`FOR UPDATE SKIP LOCKED`)]:**
   - 4 workers concorrentes arquivando/processando lotes simultaneamente: zero deadlocks e zero eventos processados em duplicidade.
