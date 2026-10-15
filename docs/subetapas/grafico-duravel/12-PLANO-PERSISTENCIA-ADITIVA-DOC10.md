# 12 — Plano de Implementação Aditiva do Doc #10 (Persistência, Lote 1x/s, Retenção e Auditoria)

**Orquestrador**: `tech-lead-orchestrator`  
**Agentes Alocados**: `broker-architect-agent`, `backend-implementation-agent`, `qa-resilience-agent`, `financial-correctness-reviewer`, `security-reviewer`, `post-implementation-verifier`  
**Skills Ativas**: `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `08-database-foundation`, `10-post-implementation-verification`, `17-mudanca-cirurgica`

---

## Diretriz Inviolável de Execução

1. **Preservação de Invariantes e Compatibilidade**:
   - Nenhuma alteração destrutiva no schema de `ticks`, `candles`, `index_state`, `contracts` ou `outbox_events`.
   - Aleatoriedade permanece estritamente via CSPRNG (`crypto.randomBytes` / `crypto.randomInt`); `Math.random` e PRNGs previsíveis permanecem proibidos para geração de ticks oficiais.
   - Nenhum tick é publicado no WebSocket ou usado em contratos antes do `COMMIT` no PostgreSQL.
2. **Protocolo Etapa por Etapa (Gate Estrito)**:
   - Cada subetapa exige oráculo de teste real em PostgreSQL 16 + Redis 7 efêmeros rodando em **RED** antes da implementação e **100% GREEN** após o patch, sem regressão nas suítes existentes (Gates A, B e C).

---

## Subetapa 10.1 (Gate D1) — Retenção Segura e Limpeza em Lotes (`pruneMarketStorage`)

- **Risco Mitigado**: Risco A do Doc #10 (crescimento contínuo de `outbox_events` de ticks e `ticks` históricos levando ao esgotamento de disco do PostgreSQL).
- **Escopo Técnico (`services/tick-engine/live-market-store.mjs` + `scripts/dev-live-feed.mjs`)**:
  1. Implementar `pruneMarketStorage({ tickRetentionMs, outboxRetentionMs, batchLimit })` em `live-market-store.mjs`.
  2. Remover em lotes limitados (`LIMIT $batchLimit`, usando `FOR UPDATE SKIP LOCKED`) apenas eventos `outbox_events` onde `event_type = 'TICK'` e (`status = 'PROCESSED'` ou `created_at < NOW() - interval`), **preservando 100%** dos eventos financeiros (`RESERVE_STAKE`, `CONTRACT_SETTLED`) `PENDING` ou `FAILED`.
  3. Remover em lotes limitados (`LIMIT $batchLimit`, usando `FOR UPDATE SKIP LOCKED`) linhas de `ticks` com `ts < NOW() - tickRetentionInterval`, **preservando inviolavelmente**:
     - O último tick de cada ativo (`sequence = index_state.last_sequence`), garantindo que `checkHead` e o encadeamento `prev_hash -> hash` jamais quebrem.
     - Qualquer tick cujo `ts` seja posterior ou igual ao menor `opened_at` de contratos `OPEN` do ativo ou referenciado por `contracts.exit_tick_sequence`.
  4. Preservar 100% das velas de `1m` em `candles`.
- **Oráculo de Validação (`tests/integration/doc10-subetapa1-retention.oracle.test.mjs`)**:
  - **RED → GREEN**: Prova que `outbox_events` de `TICK` antigos e `ticks` expirados são limpos em lotes, enquanto o tick cabeça de cada ativo, ticks de contratos `OPEN`, eventos financeiros `PENDING` e todas as velas `1m` permanecem intactos e `produceTick` continua gerando o próximo tick sem quebra de hash.

---

## Subetapa 10.2 (Gate D2) — Escrita em Lote 1x/s (`produceTicksBatch`) para os 36 Ativos

- **Risco Mitigado**: Seção "Peso na VPS" e Risco J do Doc #10 (reduzir 36 transações PostgreSQL/s para 1 única transação/s no loop de 36 ativos).
- **Escopo Técnico (`services/tick-engine/live-market-store.mjs` + `scripts/dev-live-feed.mjs`)**:
  1. Implementar `produceTicksBatch(items)` em `live-market-store.mjs` mantendo `produceTick(symbol, makePrice)` intacto.
  2. Reivindicar/renovar os leases no Redis para os ativos elegíveis e abrir **1 única transação PostgreSQL (`BEGIN ... COMMIT`)** com lock ordenado (`ORDER BY s.symbol ASC FOR UPDATE OF s`) para impedir deadlocks.
  3. Validar `checkHead`, `lease_epoch` e `lease_leader` por ativo, gerar preços via CSPRNG e persistir `ticks`, `index_state`, `outbox_events` e `candles` (`1m`) de todos os ativos do segundo atual em **1 único `COMMIT`**, medindo `persistDurationMs`.
  4. Integrar `produceTicksBatch` em `runTickLoopCycle` de `scripts/dev-live-feed.mjs`.
- **Oráculo de Validação (`tests/integration/doc10-subetapa2-batch-ticks.oracle.test.mjs`)**:
  - **RED → GREEN**: Prova que 36 ativos são gravados atomicamente em 1 única transação (`pg_stat_database.xact_commit`), que 2 instâncias concorrentes em `produceTicksBatch` respeitam o fencing sem deadlock nem duplicação, e que falha induzida no lote reverte todos os ativos sem publicar nada no WebSocket.

---

## Subetapa 10.3 (Gate D3) — Auditoria Automática (`verifyMarketAuditIntegrity`) e Métricas de Persistência

- **Risco Mitigado**: Fase 6 ("Auditoria" e "Como garantir o resultado") e seção "Alertas" do Doc #10.
- **Escopo Técnico (`services/tick-engine/live-market-store.mjs` + `scripts/dev-live-feed.mjs`)**:
  1. Implementar `verifyMarketAuditIntegrity({ symbols })` em `live-market-store.mjs`:
     - Recalcula e verifica a cadeia `prev_hash -> hash` dos ticks retidos e a consistência com `index_state`.
     - Recalcula o OHLCV de `1m` para buckets cujos ticks completos estão retidos e compara com `candles` (`candleDiffCount = 0`).
     - Recalcula o resultado e `exit_tick_sequence` dos contratos `SETTLED` contra o 1º tick oficial com `ts >= expires_at` (`settlementDiffCount = 0`).
  2. Expor `GET /api/v1/audit/market-integrity` e as métricas Prometheus no `GET /metrics` de `scripts/dev-live-feed.mjs`:
     - `tick_persist_ms` e `tick_persist_p99_ms`
     - `tick_persist_queue_depth`
     - `tick_dropped_total`
     - `outbox_pending_total`
     - `market_audit_diffs_total`
- **Oráculo de Validação (`tests/integration/doc10-subetapa3-audit-metrics.oracle.test.mjs`)**:
  - **RED → GREEN**: Prova `diff = 0` em operação real (ticks, velas e contratos), prova detecção imediata quando um hash/vela/contrato é adulterado no banco de teste, e valida todas as métricas Prometheus em `/metrics`.

---

## 4. Resultado da Execução (100% Validado — RED → GREEN)

| Subetapa | Gate | Log RED (pré-patch) | Log GREEN (pós-patch) | Status |
|---|---|---|---|---|
| **Subetapa 10.1** — Retenção segura de `ticks` e expurgo de `outbox_events` (`pruneMarketStorage`) | Gate D1 | `tests/reports/grafico-duravel-baseline/doc10-subetapa1-retention-red.log` (`0/1`) | `tests/reports/grafico-duravel-baseline/doc10-subetapa1-retention-green.log` (`1/1 PASS, fail 0`) | **100% GREEN** |
| **Subetapa 10.2** — Escrita atômica em lote 1x/s dos 36 ativos (`produceTicksBatch`) | Gate D2 | `tests/reports/grafico-duravel-baseline/doc10-subetapa2-batch-red.log` (`0/1`) | `tests/reports/grafico-duravel-baseline/doc10-subetapa2-batch-green.log` (`1/1 PASS, fail 0`) | **100% GREEN** |
| **Subetapa 10.3** — Verificador contínuo de auditoria (`verifyMarketAuditIntegrity`) e métricas Prometheus (`/metrics` + `/api/v1/audit/market-integrity`) | Gate D3 | `tests/reports/grafico-duravel-baseline/doc10-subetapa3-audit-red.log` (`0/1`) | `tests/reports/grafico-duravel-baseline/doc10-subetapa3-audit-green.log` (`1/1 PASS, fail 0`) | **100% GREEN** |

