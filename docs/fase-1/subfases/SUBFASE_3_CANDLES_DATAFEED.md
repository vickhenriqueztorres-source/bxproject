# Subfase 3: Agregador de Velas (OHLCV) & TradingView Datafeed REST

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `backend-implementation-agent`  
**Agente Revisor Financeiro:** `financial-correctness-reviewer`  
**Agente de Testes:** `qa-resilience-agent`  
**Subtasks do PRD:** T07, T12  
**Decisões Aplicadas:** D-03 (TradingView Lightweight Charts), D-04 (Redis Streams), D-05 (PostgreSQL estado forte), D-13 (Intervalos de agregação)  
**Invariantes Chave:** M-05 (Candle OHLCV derivado de ticks persistidos), M-06 (Datafeed e catch-up), B-17 (Consumer Groups), DB-04  

---

## 1. Escopo e Objetivos da Subfase
Desenvolver o serviço assíncrono `services/candle-worker` para agregar ticks provenientes do Redis Stream em estruturas de velas OHLCV (Open, High, Low, Close, Volume) para os timeframes padrão (1s, 1m, 5m), eliminando qualquer dependência de variáveis voláteis em memória RAM. Implementar a persistência contínua via `UPSERT` idempotente na tabela `candles` do PostgreSQL e expor os endpoints REST do protocolo TradingView UDF (`/history`, `/time`, `/config`) na Chart API em `services/api`.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 3.1: Configuração do Consumer Group no Redis Streams (`cg:candles`)
- **Ação:** Criar `services/candle-worker/src/stream/consumer-group.ts`:
  - Criação idempotente do Consumer Group no Redis:
    ```bash
    XGROUP CREATE stream:ticks:EURUSD_OTC cg:candles $ MKSTREAM
    ```
  - Consumo com `XREADGROUP GROUP cg:candles <consumer_id> BLOCK 1000 COUNT 50 STREAMS stream:ticks:EURUSD_OTC >`.
  - Mecanismo de recuperação de mensagens pendentes (PEL) via `XAUTOCLAIM` com `min-idle-time = 5000ms` para reatribuir ticks caso um worker morra no meio do processamento.
  - Confirmação com `XACK` executada **somente após** a persistência bem-sucedida no PostgreSQL ou no cache ativo.
- **Regras:** `B-17`, `R-06`.
- **Critério de Aceite:** O worker consome ticks do Redis Stream de forma contínua e recupera mensagens pendentes de nós que falharem.

---

### Passo 3.2: Agregação OHLCV em Tempo Real com Cache Ativo em Redis
- **Ação:** Criar `services/candle-worker/src/aggregator/timeframe-aggregator.ts`:
  - Cálculo do alinhamento temporal do bucket em UTC:
    $$\text{bucket\_start} = \lfloor \text{timestamp} / \text{interval\_ms} \rfloor \times \text{interval\_ms}$$
  - Manutenção do bucket ativo no Redis via Hash (`candle:active:{symbol}:{interval}:{bucket_start}`):
    ```lua
    -- Script Lua para atualização atômica do candle ativo em Redis
    local key = KEYS[1]
    local price = tonumber(ARGV[1])
    local exists = redis.call('EXISTS', key)

    if exists == 0 then
      redis.call('HSET', key, 'open', price, 'high', price, 'low', price, 'close', price, 'volume', 1)
      redis.call('EXPIRE', key, 300) -- TTL de 5 minutos
    else
      local high = tonumber(redis.call('HGET', key, 'high'))
      local low = tonumber(redis.call('HGET', key, 'low'))
      if price > high then redis.call('HSET', key, 'high', price) end
      if price < low then redis.call('HSET', key, 'low', price) end
      redis.call('HSET', key, 'close', price)
      redis.call('HINCRBY', key, 'volume', 1)
    end
    ```
- **Regras:** `M-05`.
- **Critério de Aceite:** A vela em formação no minuto atual reflete imediatamente as variações de máxima, mínima e último preço sem travar o worker.

---

### Passo 3.3: Fechamento de Vela e Persistência Idempotente no PostgreSQL
- **Ação:** Criar `services/candle-worker/src/persistence/candle-repository.ts`:
  - Quando um tick cruza o limite do bucket anterior (ex: entra no minuto seguinte), a vela anterior é selada e salva no PostgreSQL:
    ```sql
    INSERT INTO candles (symbol, interval, bucket_start, open, high, low, close, volume)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (symbol, interval, bucket_start)
    DO UPDATE SET
      high = GREATEST(candles.high, EXCLUDED.high),
      low = LEAST(candles.low, EXCLUDED.low),
      close = EXCLUDED.close,
      volume = candles.volume + EXCLUDED.volume;
    ```
  - Disparo de evento de outbox `CANDLE_CLOSED` para notificação de workers analíticos e histórico de gráfico.
- **Regras:** `M-05`, `DB-04`.
- **Critério de Aceite:** Reexecutar o mesmo lote de ticks 3 vezes resulta rigorosamente nos mesmos valores de vela no PostgreSQL, sem duplicação ou contagem inflada de volume.

---

### Passo 3.4: Implementação dos Endpoints REST TradingView UDF (`services/api`)
- **Ação:** Criar os endpoints da Chart API em `services/api/src/routes/chart/`:
  - `GET /api/v1/chart/config`: retorna resoluções suportadas (`["1S", "1", "5", "15", "60"]`) e flags UDF.
  - `GET /api/v1/chart/time`: retorna o timestamp atual do servidor em segundos UTC (sincronização de relógio para o TradingView).
  - `GET /api/v1/chart/symbols?symbol=EURUSD_OTC`: retorna metadados do ativo (precisão decimal, horários 24x7, tipo forex/sintético).
  - `GET /api/v1/chart/history`: retorna dados de velas passadas para desenhar o gráfico:
    ```json
    {
      "s": "ok",
      "t": [1775483940, 1775484000],
      "o": [1.48510, 1.48520],
      "h": [1.48550, 1.48590],
      "l": [1.48480, 1.48490],
      "c": [1.48520, 1.48560],
      "v": [115, 120]
    }
    ```
    Caso não existam barras para o intervalo solicitado, retorna `{"s": "no_data"}`.
- **Regras:** `D-03`, `B-10` (rotas públicas com rate limit de 120 req/min).
- **Critério de Aceite:** O endpoint responde requisições de 300 barras em menos de 50ms com formato perfeitamente compatível com o TradingView UDF.

---

### Passo 3.5: Mecanismo de Reindexação e Reconstrução de Histórico (Replay Job)
- **Ação:** Criar o script utilitário `services/candle-worker/src/scripts/rebuild-candles.ts`:
  - Lê a tabela `ticks` em blocos sequenciais a partir do primeiro `sequence` disponível.
  - Recalcula todas as velas OHLCV de 1 minuto e 5 minutos do zero.
  - Atualiza a tabela `candles` corrigindo qualquer inconsistência provocada por manutenções ou quedas prolongadas.
- **Regras:** `M-05` ("Candle é derivado dos ticks persistidos, reconstruível a qualquer momento").
- **Critério de Aceite:** Executar a reconstrução completa sobre 100.000 ticks gravados produz exatamente o mesmo resultado que a agregação em tempo real.

---

### Passo 3.6: Testes Automatizados de Agregação e Consistência OHLCV
- **Ação:** Criar testes em `services/candle-worker/test/`:
  - `aggregator.unit.test.ts`: alimenta 120 ticks com preços aleatórios e confere se `open`, `high`, `low`, `close` e `volume` batem com os valores esperados.
  - `redis-persistence.integration.test.ts`: testa concorrência com dois workers consumindo o mesmo stream via `cg:candles`.
  - `chart-api.integration.test.ts`: testa as rotas REST do UDF validando ordenação temporal crescente, paginação por timestamps `from` e `to`, e ausência de overlaps.
- **Regras:** `06-testing-quality`, QA-06.
- **Critério de Aceite:** Todas as suites de teste de agregação e datafeed executam com 100% de sucesso.

---

## 3. Validação e Critérios de Conclusão da Subfase
1. Ticks emitidos na Subfase 2 são consumidos pelo `Candle Worker` e transformados em velas de 1m no PostgreSQL.
2. Endpoint `GET /api/v1/chart/history` devolve velas formatadas consumíveis pelo TradingView.
3. Replay de ticks prova que os candles são 100% reproduzíveis.
4. Gate de qualidade da Subfase 3 marcado como `PASS`.
