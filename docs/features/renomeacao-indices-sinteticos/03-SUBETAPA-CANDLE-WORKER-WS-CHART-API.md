# SUBETAPA 03: Adaptação do Candle Worker, WebSocket Gateway & REST Chart API

> **Status:** HOMOLOGADO E APROVADO (GATE 3 PASS)  
> **Data de Homologação:** 12/10/2026  
> **Responsáveis:** `backend-implementation-agent`, `broker-architect-agent`, `qa-resilience-agent`  
> **Skills Chave:** `03-synthetic-market-engine`, `05-resilience-patterns`, `08-database-foundation`  

---

## 1. Escopo Técnico e Invariantes

1. **Agregação em Tempo Real (`services/candle-worker/`)**:
   - Consumir streams dos novos símbolos.
   - Construir e atualizar velas OHLCV nos timeframes 1m, 5m, 15m, 1h sem dependência de RAM (Postgres UPSERT + Redis).
2. **WebSocket Gateway (`services/websocket-gateway/`)**:
   - Aceitar inscrições: `{"type": "subscribe", "symbol": "BMX_VOL_50"}`.
   - Fornecer catch-up transparente por `lastSequence`.
   - Limite estrito de segurança: máximo de 10 ativos simultâneos por conexão WebSocket.
3. **REST Chart API (`services/chart-api/` ou `services/api/src/routes/chart.ts`)**:
   - Rota `/api/candles?symbol=BMX_VOL_50&interval=1m&limit=1440`.
   - Rota UDF TradingView `/api/v1/chart/history?symbol=BMX_VOL_50`.
   - Suporte a aliases para que requests legados retornem os mesmos dados sem erro 404.

---

## 2. Passo a Passo de Implementação

1. [ ] Atualizar lista de símbolos permitidos e calendários de negociação (24/7 para sintéticos).
2. [ ] Configurar mapeamento de aliases nas rotas `/api/candles` e WebSocket Gateway.
3. [ ] Ajustar agregação de velas para gravar com o símbolo canônico.
4. [ ] Validar testes unitários e de integração de candles e gateways.

---

## 3. Matriz de Testes de Estresse, Caos e Segurança

| Código | Tipo de Teste | Descrição | Critério de Aceite |
|---|---|---|---|
| **T-CW-01** | **Consistência OHLCV** | Validar que para toda vela gerada $Low \le Open, Close \le High$ | Zero anomalias matemáticas em 5.000 velas agregadas. |
| **T-WS-02** | **Estresse de Inscrições WebSocket** | 100 conexões simultâneas se inscrevendo nos novos índices a cada 200ms | Todas recebem snapshots e ticks contínuos sem desconexão. |
| **T-WS-03** | **Segurança / Limite de Inscrição** | Cliente tenta se inscrever em 15 índices na mesma conexão | Gateway rejeita a 11ª inscrição com mensagem de erro amigável, prevenindo exaustão de buffer. |
| **T-CAOS-04** | **Caos de Conexão (Kill Redis)** | Pausar Redis por 2 segundos e religar | Candle worker e Gateway realizam reconexão automática com backoff exponencial + full jitter. |

---

## 4. Gate de Homologação da Subetapa 03

A Subetapa 03 é considerada **HOMOLOGADA** somente quando:
1. `curl http://localhost:3005/api/candles?symbol=BMX_VOL_50` retornar histórico válido de velas.
2. Inscrição via WebSocket no novo símbolo receber ticks com `latency_ms < 50ms`.
