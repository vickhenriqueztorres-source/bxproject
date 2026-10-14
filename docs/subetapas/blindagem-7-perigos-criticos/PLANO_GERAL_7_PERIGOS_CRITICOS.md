# Plano Geral — Fechamento 100% dos 7 Perigos Críticos de Feed, Fan-out, Settlement, Gráficos e Calendário

**Orquestrador**: `tech-lead-orchestrator`  
**Agentes Alocados**:
1. `broker-architect-agent` (Desenho de Sistemas de Trading e FMEA)
2. `backend-implementation-agent` (`services/websocket-gateway/**`, `services/api/**`, `services/settlement-worker/**`, `services/candle-worker/**`, `db/migrations/**`)
3. `chart-trading-engineer` & `surgical-frontend-agent` (`apps/web/src/feed/**`, `apps/web/src/chart/**`)
4. `financial-correctness-reviewer` (Invariantes `I-01` a `I-06` no Settlement e Reconciliador)
5. `qa-resilience-agent` & `regression-guardian-agent` (Testes de Estresse, Caos, Segurança e Regressão Zero)

**Skills Ativadas**:
- `01-project-context`
- `02-financial-invariants`
- `03-synthetic-market-engine`
- `05-resilience-patterns`
- `06-testing-quality`
- `08-database-foundation`
- `10-post-implementation-verification`
- `11-chart-trading-tools`
- `17-mudanca-cirurgica`

---

## 1. Diagnóstico Inicial e Escopo Cirúrgico

Da auditoria das **35 técnicas** exigidas nos **7 Perigos Críticos**, **25 técnicas** já estão ativas e testadas no código-fonte, e **5 lacunas cirúrgicas (Gaps A–E)** precisam ser integradas e provadas uma a uma:

1. **Subetapa 01 — Perigo 4 (Fan-out Escalável no WebSocket Gateway)**:
   - Plugar [`TickCoalescer`](file:///d:/brokerproject/services/websocket-gateway/src/coalescer.ts) (50ms), [`BackpressureGuard`](file:///d:/brokerproject/services/websocket-gateway/src/backpressure.ts) (pausa em `> 64KB`, resume no `drain`, desconecta slow consumer após `5s`) e [`SymbolShardingRouter`](file:///d:/brokerproject/services/websocket-gateway/src/sharding.ts) (`hash(symbol) % num_nodes`) dentro do loop real de [`services/websocket-gateway/src/index.ts`](file:///d:/brokerproject/services/websocket-gateway/src/index.ts).
2. **Subetapa 02 — Perigo 1 (Staleness por Símbolo + 5 Métricas de Feed no Prometheus)**:
   - Substituir o threshold fixo global por um mapa configurável por símbolo/classe de ativo (`STALENESS_THRESHOLD_BY_SYMBOL`: Sintéticos 24/7 = `3000ms` front / `5000ms` back, Cripto = `5000ms`, Forex OTC = `3000ms`, Commodities/Índices = `5000ms`) com função `getStalenessThresholdMs(symbol)` tanto no Frontend quanto no Backend.
   - Registrar e exportar as 5 métricas obrigatórias por símbolo (`tick_age_seconds`, `feed_gap_count`, `feed_latency_ms`, `staleness_alert`, `reconnect_count`) em [`services/api/src/services/metrics.ts`](file:///d:/brokerproject/services/api/src/services/metrics.ts).
3. **Subetapa 03 — Perigo 5 (Settlement Guard SQL, Validação Estrita de Tick de Saída e Reconciliador Multi-Símbolo)**:
   - Em [`services/settlement-worker/src/settlement/settler.ts`](file:///d:/brokerproject/services/settlement-worker/src/settlement/settler.ts): selecionar `symbol, sequence, price, ts`, validar `exitTick.symbol === contract.symbol`, `Number(exitTick.sequence) > Number(contract.entry_tick_sequence)` e rejeitar/alertar se o tick de saída estiver atrasado além da janela máxima de staleness de liquidação (`MAX_EXIT_TICK_DELAY_MS`).
   - Em [`db/migrations/`](file:///d:/brokerproject/db/migrations/0001_initial_schema.sql): criar migration e constraint/trigger `enforce_contract_state_machine()` impedindo que contratos `SETTLED` ou `CANCELLED` voltem para `OPEN` ou `EXPIRING` (Invariante `DB-03` e `I-04`).
   - Em [`services/settlement-worker/src/reconciliation/financial-reconciler.ts`](file:///d:/brokerproject/services/settlement-worker/src/reconciliation/financial-reconciler.ts): corrigir a query de auditoria de sequência e `prev_hash` para particionar por `symbol`, eliminando falsos alertas quando múltiplos ativos geram ticks simultaneamente.
4. **Subetapa 04 — Perigo 7 (Validação de Sessão/Calendário e Agregação Gap-Tolerant no Candle Worker TS)**:
   - Integrar a validação de calendário (`isMarketOpen` / `shouldAggregateTick`) e agregação sem candles artificiais diretamente em [`services/candle-worker/src/aggregator/timeframe-aggregator.ts`](file:///d:/brokerproject/services/candle-worker/src/aggregator/timeframe-aggregator.ts) e [`services/candle-worker/src/index.ts`](file:///d:/brokerproject/services/candle-worker/src/index.ts).
5. **Subetapa 05 — Perigo 6 (IntersectionObserver de Viewport e Limite de 6 Gráficos Simultâneos no Frontend)**:
   - Adicionar `IntersectionObserver` automático em [`PriceChart.tsx`](file:///d:/brokerproject/apps/web/src/chart/PriceChart.tsx) para pausar o loop de `requestAnimationFrame` quando o gráfico sai da área visível da tela, retomando com o estado mais recente ao voltar.
   - Adicionar controle de limite máximo de gráficos simultâneos (`MAX_CONCURRENT_CHARTS = 6`) em [`TradingFeedManager.ts`](file:///d:/brokerproject/apps/web/src/feed/TradingFeedManager.ts) e [`IsolatedChartHost.tsx`](file:///d:/brokerproject/apps/web/src/chart/IsolatedChartHost.tsx) para impedir degradação de CPU/memória.

---

## 2. Regra de Execução Sequencial (Gate por Subetapa)

Nenhuma subetapa seguinte pode ser iniciada até que a subetapa atual cumpra:
1. Diff cirúrgico revisado contra `17-mudanca-cirurgica`.
2. Suíte de testes unitários, estresse, caos e segurança da subetapa **100% VERDE**.
3. Suíte global de regressão do projeto **100% VERDE** (zero quebras no que já funcionava).
