# Subetapa 11.2 — Reconciliação Servidor × Cliente por `last_sequence` e Métricas Prometheus

## Objetivo
Garantir que o cliente reconcilie a vela corrente usando `last_sequence` (evitando pulos ao voltar o foco da aba ou refazer fetch) e expor no `/metrics` as métricas operacionais exigidas pelo relatório #11.

## Passo a Passo
1. Em `apps/web/src/api/client.ts`: adicionar `last_sequence?: number | null` e `source?: string` ao tipo `Candle`.
2. Em `apps/web/src/chart/candle-adapter.ts` e `apps/web/src/chart/chart-scale-normalizer.ts`:
   - Preservar `last_sequence` em `CandlestickWithSequence` durante `candleData`, `safeCandleFromTick`, `resampleCandles` e `mergeObservedCandles`.
   - Na reconciliação da vela corrente em `mergeObservedCandles`:
     - `open = serverBar.open` (ou `previous.open`);
     - `high = Math.max(serverBar.high, clientBar.high)`;
     - `low = Math.min(serverBar.low, clientBar.low)`;
     - `close` = `close` do lado com `last_sequence` maior.
   - Nas velas fechadas: prevalece a vela oficial do servidor (`preserveClosedHistory = true`), incrementando o contador de telemetria `candleMismatchTotal` se houver divergência em vela fechada completa.
3. Em `scripts/dev-live-feed.mjs`:
   - Calcular `ticks_per_5s_bucket` (último bucket fechado de 5s = 5 ticks a 1 Hz) e expor no `/metrics`:
     - `tick_slot_jitter_ms`
     - `ticks_per_5s_bucket`
     - `candle_mismatch_total`

## Critérios de Aceite
- Zero pulos de abertura/fechamento na vela atual quando o React Query refaz fetch no foco.
- Endpoint `/metrics` retorna `tick_slot_jitter_ms`, `ticks_per_5s_bucket` e `candle_mismatch_total`.
