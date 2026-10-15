# Relatório Final — #11: Velas Reais (5s/15s/30s), Frequência de Tick e Abertura da Vela

**Status:** 100% CONCLUÍDO, VALIDADO E CERTIFICADO
**Data:** 2026-10-15

---

## 1. Resumo Executivo

Os três achados do relatório #11 foram integralmente resolvidos e certificados:
1. **[ALTO] Timeframes 5s/15s/30s reais no servidor:** Buffer circular `state.candles5s` alimentado a cada tick oficial (`applyTickToCandleBuffer`), com 15s/30s/1m derivados por soma exata (`aggregateCandlesToInterval`), entregando `source: "ticks"` e `last_sequence` por vela em `GET /candles?interval=5s|15s|30s`. No front, `getCandles` aceita intervalos terminados em `s`, a chave de cache do React Query inclui o `interval` (`['candles', symbol, interval]`), e `resampleCandles` só roda como fallback legado quando o servidor não devolve `source === 'ticks'`.
2. **[MÉDIO] Agendador alinhado a 1 Hz sem deriva:** `createAlignedTickScheduler` (`scripts/lib/aligned-tick-scheduler.mjs`) agenda cada tick para o próximo segundo exato do Unix epoch (`t0 + n × 1000ms`), pula slots perdidos sob engasgo do event loop sem gerar rajadas falsas (`missed_tick_slots_total`) e protege contra retrocesso de relógio NTP (`tick_clock_skew_corrections_total`).
3. **[MÉDIO] Regra única de abertura da vela e reconciliação Servidor × Cliente:** Implementada regra única em `@broker/shared` ([candles.ts](file:///d:/brokerproject/packages/shared/src/candles.ts)) e no motor do servidor ([candle-aggregation-engine.mjs](file:///d:/brokerproject/scripts/lib/candle-aggregation-engine.mjs)): `open = primeiro tick do período` (nunca `prevClose`), período sem tick não gera vela, velas fechadas usam sempre a versão do servidor e a vela corrente é reconciliada em [chart-scale-normalizer.ts](file:///d:/brokerproject/apps/web/src/chart/chart-scale-normalizer.ts) (`high = max`, `low = min`, `close` do lado com `last_sequence` maior).

---

## 2. Arquivos Criados e Modificados

- **[candles.ts](file:///d:/brokerproject/packages/shared/src/candles.ts)** *(novo)*: Regra única compartilhada (`bucketStartTime`, `applyTick`, `buildCandlesFromTicks`, `aggregateSubCandles`, `reconcileServerAndClientCandle`, `scaleOuParamsForFrequency`).
- **[index.ts](file:///d:/brokerproject/packages/shared/src/index.ts)**: Exportação pública do módulo `candles.js` em `@broker/shared`.
- **[candle-aggregation-engine.mjs](file:///d:/brokerproject/scripts/lib/candle-aggregation-engine.mjs)**: Propagação de `last_sequence` e `source: 'ticks'` em `aggregateCandlesToInterval`, `aggregateTicksToCandles` e `applyTickToCandleBuffer`, detecção resiliente de `baseStep` mesmo com períodos vazios, reconciliação `reconcileServerAndClientCandle` e calibração `scaleOuParamsForFrequency`.
- **[dev-live-feed.mjs](file:///d:/brokerproject/scripts/dev-live-feed.mjs)**: Inclusão de `last_sequence` e `source: 'ticks'` nas velas de 1m em `applyCommittedSymbolTick` e exposição das métricas Prometheus `tick_slot_jitter_ms`, `missed_tick_slots_total`, `ticks_per_5s_bucket` e `candle_mismatch_total` em `GET /metrics`.
- **[client.ts](file:///d:/brokerproject/apps/web/src/api/client.ts)**: Inclusão de `last_sequence?: number | null` e `source?: string` na interface `Candle`.
- **[candle-adapter.ts](file:///d:/brokerproject/apps/web/src/chart/candle-adapter.ts)**: Preservação de `last_sequence` e `source` em `CandlestickWithMeta`, `candleData` e `resampleCandles`.
- **[chart-scale-normalizer.ts](file:///d:/brokerproject/apps/web/src/chart/chart-scale-normalizer.ts)**: Reconciliação determinística da vela aberta por `last_sequence` em `mergeObservedCandles` e propagação em `safeCandleFromTick`.
- **[velas-reais-11-property-replay.test.mjs](file:///d:/brokerproject/tests/unit/velas-reais-11-property-replay.test.mjs)** *(novo)*: Suíte completa de testes baseados em propriedade (100 runs CSPRNG), replay de 1 hora (3.600 ticks a 1 Hz), calibração Ornstein-Uhlenbeck 1 Hz vs 4 Hz e testes de caos.

---

## 3. Resultados da Verificação

- **Property-Based Tests (100 sequências CSPRNG com buracos):** Soma `5s -> 15s/30s/1m` idêntica a agregar direto dos ticks (`diff = 0`).
- **Replay de 1 hora (3.600 ticks a 1 Hz):** `720` velas de 5s com `volume === 5` ticks cada, `240` velas de 15s, `120` velas de 30s, `60` velas de 1m e `diff = 0` entre buffer circular do servidor e rebuild direto.
- **Calibração 1 Hz vs 4 Hz (Risco 1):** `sigma_4Hz = sigma_1Hz / 2` e `theta_4Hz = 1 - (1 - theta_1Hz)^0.25 ≈ 0.001` validados com conservação exata da taxa de retenção por segundo.
- **Caos (Stall de 3.5s e Clock Skew de -800ms):** Pulo determinístico de slots perdidos (`missedSlots = 2`) sem rajada de ticks falsos e proteção monotônica sob retrocesso de relógio.
