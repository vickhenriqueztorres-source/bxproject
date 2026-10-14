# Subetapa 04 — Perigo 7: Validação de Sessão/Calendário e Agregação Gap-Tolerant no Candle Worker TypeScript

**Agentes**: `backend-implementation-agent`, `qa-resilience-agent`  
**Skills**: `03-synthetic-market-engine` (`M-05`), `05-resilience-patterns` (`R-06`), `06-testing-quality`

---

## 1. Problema Identificado
As funções de validação de calendário (`shouldCloseCandle`) e agregação sem candles artificiais existem apenas no arquivo auxiliar [`services/candle-worker/core.mjs`](file:///d:/brokerproject/services/candle-worker/core.mjs), mas o worker TypeScript principal ([`services/candle-worker/src/index.ts`](file:///d:/brokerproject/services/candle-worker/src/index.ts) e [`services/candle-worker/src/aggregator/timeframe-aggregator.ts`](file:///d:/brokerproject/services/candle-worker/src/aggregator/timeframe-aggregator.ts)) não valida se o mercado do símbolo está aberto em UTC antes de agregar ticks nem expõe helper gap-tolerant tipado.

## 2. Passo a Passo Cirúrgico
1. **Adicionar Calendário de Sessão por Símbolo em `services/candle-worker/src/aggregator/trading-calendar.ts`**:
   - Definir calendários em UTC (`24/7` para Índices Sintéticos e Cripto; `Seg–Sex` com janelas UTC e feriados para Forex/Commodities/Ações).
   - Expor `isSymbolSessionOpen(symbol: string, tsUtc: Date): boolean` e `aggregateBucketGapTolerant(ticks)`.
2. **Integrar em `TimeframeAggregator` (`services/candle-worker/src/aggregator/timeframe-aggregator.ts`)**:
   - Validar `isSymbolSessionOpen(symbol, tickDate)` antes de fazer o `INSERT ... ON CONFLICT DO UPDATE` na tabela `candles`. Se o tick chegar fora da sessão oficial do ativo, ignorar a agregação com warning estruturado e não criar candle fantasma em feriado/fim de semana.
   - Garantir que períodos sem ticks nunca gerem candles artificiais (gap-tolerant).

## 3. Testes Obrigatórios (Estresse, Caos e Segurança)
- Tick de ativo `Seg–Sex` recebido no sábado UTC → ignorado pelo `TimeframeAggregator` sem gravar candle espúrio no PostgreSQL.
- Tick de ativo `24/7` (`R_100`, `BTCUSDT`) no sábado UTC → agregado normalmente em todos os timeframes.
- Período de 5 minutos sem ticks → `aggregateBucketGapTolerant([])` retorna `null` (nenhum candle artificial).
