# Subetapa 11.1 — Regra Única de Vela em `@broker/shared` e Propagação `last_sequence` / `source: "ticks"`

## Objetivo
Unificar matematicamente a construção e agregação de velas OHLCV em `packages/shared/src/candles.ts` e garantir que o backend (`scripts/lib/candle-aggregation-engine.mjs` e `scripts/dev-live-feed.mjs`) propague `last_sequence` e `source: "ticks"` em todas as velas de `5s`, `15s`, `30s` e `1m`.

## Passo a Passo
1. Criar `packages/shared/src/candles.ts` com:
   - `bucketStartTime(tsSec, stepSec)`
   - `applyTick(previous, tick, stepSec)` (`open` = 1º tick do período, `high = max`, `low = min`, `close` = tick de maior `sequence`)
   - `buildCandlesFromTicks(ticks, stepSec)`
   - `aggregateSubCandles(baseCandles, targetStepSec)`
   - `reconcileServerAndClientCandle(serverCandle, clientCandle)`
2. Exportar o módulo em `packages/shared/src/index.ts`.
3. Atualizar `aggregateCandlesToInterval` e `aggregateTicksToCandles` em `scripts/lib/candle-aggregation-engine.mjs` para preservar `last_sequence` (maior `last_sequence` do bucket) e `source: "ticks"` em velas sub-minuto.

## Critérios de Aceite e Testes
- Período sem tick não gera vela.
- `open` é sempre o primeiro tick do período `[início, início + passo)`.
- Somar velas de 5s para 15s, 30s e 1m produz resultado idêntico à agregação direta dos ticks.
