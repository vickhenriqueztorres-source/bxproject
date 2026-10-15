# Plano Geral — #11 Velas Reais (5s/15s/30s), Frequência de Tick e Abertura da Vela

**Data**: 15/10/2026  
**Orquestrador**: `tech-lead-orchestrator`  
**Agentes Selecionados**:
- `broker-architect-agent` + `backend-implementation-agent` (Skills: `03-synthetic-market-engine`, `05-resilience-patterns`)
- `chart-trading-engineer` (Skills: `11-chart-trading-tools`, `03-synthetic-market-engine`)
- `qa-resilience-agent` + `post-implementation-verifier` (Skills: `06-testing-quality`, `10-post-implementation-verification`)

---

## 1. Diagnóstico e Estado Inicial

1. **Agendador Alinhado (1 Hz)**: Já implementado em `scripts/lib/aligned-tick-scheduler.mjs`, mas suas métricas (`tick_slot_jitter_ms`, `ticks_per_5s_bucket`, `candle_mismatch_total`) ainda não estavam expostas no `/metrics` do Prometheus.
2. **Buffer de 5s e Derivação 15s/30s/1m**: Já implementado em `scripts/lib/candle-aggregation-engine.mjs` e `scripts/dev-live-feed.mjs`, mas `aggregateCandlesToInterval` ainda não propagava `last_sequence` e `source: "ticks"` para todas as barras agregadas de `15s`/`30s`.
3. **Regra Única em `packages/shared`**: A lógica `open = primeiro tick do período` estava separada entre backend e frontend; precisa ser canonizada em `packages/shared/src/candles.ts` (`applyTick`, `buildCandlesFromTicks`, `aggregateSubCandles`, `reconcileServerAndClientCandle`).
4. **Reconciliação Servidor × Cliente por `last_sequence`**: `mergeObservedCandles` em `apps/web/src/chart/chart-scale-normalizer.ts` precisa usar `last_sequence` para decidir o `close` da vela aberta (`high = max`, `low = min`, `close` do lado com `sequence` maior) e contabilizar `candle_mismatch_total` em velas fechadas.

---

## 2. Divisão em Subetapas

| Subetapa | Documento | Escopo |
|----------|-----------|--------|
| **11.1** | `01-SUBETAPA-11.1-REGRA-UNICA-SHARED-E-5S-BUFFER.md` | Regra única de vela (`applyTick`, `buildCandlesFromTicks`, `aggregateSubCandles`, `reconcileServerAndClientCandle`) em `@broker/shared` + propagação de `last_sequence` e `source: "ticks"` nas velas de 5s/15s/30s/1m no backend |
| **11.2** | `02-SUBETAPA-11.2-RECONCILIACAO-SEQUENCE-E-METRICAS-PROMETHEUS.md` | Reconciliação da vela corrente por `last_sequence` no frontend (`PriceChart.tsx`, `chart-scale-normalizer.ts`, `candle-adapter.ts`) + exposição de `tick_slot_jitter_ms`, `ticks_per_5s_bucket` e `candle_mismatch_total` no `/metrics` |
| **11.3** | `03-SUBETAPA-11.3-PROPERTY-TESTS-REPLAY-1H-CALIBRACAO-CAOS.md` | Property-based tests (milhares de ticks aleatórios: 5s → 15s/30s/1m == direto), Replay de 1h (3.600 ticks, diff = 0), calibração estatística 1Hz vs 4Hz e testes de caos/estresse |
