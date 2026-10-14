# Subetapa 02 — Perigo 1: Staleness Timer por Símbolo e Exportação das 5 Métricas de Feed no Prometheus

**Agentes**: `backend-implementation-agent`, `chart-trading-engineer`, `qa-resilience-agent`  
**Skills**: `03-synthetic-market-engine` (`M-02`, `M-06`), `07-production-operations`, `06-testing-quality`

---

## 1. Problema Identificado
1. **Método 3 (Threshold de Staleness por Símbolo)**: Tanto no Frontend ([`TradingFeedManager.ts`](file:///d:/brokerproject/apps/web/src/feed/TradingFeedManager.ts)) quanto no Backend ([`contract-service.ts`](file:///d:/brokerproject/services/api/src/services/contract-service.ts)), o limite de staleness é fixo global (`4000ms` / `5000ms`), sem diferenciar a frequência esperada de cada ativo (ex: Índices Sintéticos 1 tick/s vs. Cripto vs. Forex OTC vs. Commodities).
2. **Método 7 (Métricas de Feed por Símbolo)**: Em [`services/api/src/services/metrics.ts`](file:///d:/brokerproject/services/api/src/services/metrics.ts), faltam as 5 métricas obrigatórias por símbolo (`tick_age_seconds`, `feed_gap_count`, `feed_latency_ms`, `staleness_alert`, `reconnect_count`).

## 2. Passo a Passo Cirúrgico
1. **Tabela e Helper `getStalenessThresholdMs(symbol)`**:
   - Criar helper determinístico por símbolo/categoria em [`apps/web/src/feed/TradingFeedManager.ts`](file:///d:/brokerproject/apps/web/src/feed/TradingFeedManager.ts) e [`services/api/src/services/contract-service.ts`](file:///d:/brokerproject/services/api/src/services/contract-service.ts):
     - Índices Sintéticos (`R_10`, `R_25`, `R_50`, `R_75`, `R_100`, `SYNTH-*`, `VOL-*`, `CRASH-*`, `BOOM-*`): `3000ms` (UI) / `5000ms` (Execução Backend).
     - Forex OTC (`EURUSD-OTC`, `GBPUSD-OTC`, `USDJPY-OTC`, etc.): `3500ms` (UI) / `5000ms` (Execução Backend).
     - Criptomoedas (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, etc.): `4000ms` (UI) / `5000ms` (Execução Backend).
     - Commodities/Ações (`XAUUSD`, `AAPL-OTC`, etc.): `4500ms` (UI) / `6000ms` (Execução Backend).
   - Permitir override explícito por símbolo (`setSymbolStalenessThreshold(symbol, ms)`).
2. **Exportação das 5 Métricas no Prometheus (`services/api/src/services/metrics.ts`)**:
   - Adicionar `tickAgeSeconds` (`Gauge` `synth_tick_age_seconds` / alias `tick_age_seconds` por `symbol`), `feedGapCount` (`Counter` `feed_gap_count` por `symbol`), `feedLatencyMs` (`Histogram` `feed_latency_ms` por `symbol`), `stalenessAlert` (`Gauge` `staleness_alert` por `symbol`) e `reconnectCount` (`Counter` `reconnect_count` por `symbol`).
   - Atualizar `ContractService.openContract` para registrar `tickAgeSeconds` e `stalenessAlert` em toda verificação de abertura de ordem.

## 3. Testes Obrigatórios (Estresse, Caos e Segurança)
- Validação de thresholds específicos por classe de símbolo (Sintético, Forex OTC, Cripto, Commodities) e bloqueio imediato de `SUBE`/`BAJA` e `POST /contracts` quando `tick_age > threshold(symbol)`.
- Verificação da exposição das 5 métricas no endpoint `/metrics` do Prometheus com labels `symbol` corretos.
