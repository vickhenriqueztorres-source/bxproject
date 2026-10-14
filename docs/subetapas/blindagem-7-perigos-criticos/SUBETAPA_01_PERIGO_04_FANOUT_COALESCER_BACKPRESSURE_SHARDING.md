# Subetapa 01 — Perigo 4: Fan-out Escalável (Coalescing 50ms, Backpressure 64KB e Sharding por Símbolo no WebSocket Gateway)

**Agentes**: `broker-architect-agent`, `backend-implementation-agent`, `qa-resilience-agent`  
**Skills**: `03-synthetic-market-engine` (`M-06`), `05-resilience-patterns` (`R-03`), `06-testing-quality` (`Q-01`, `Q-03`, `Q-04`)

---

## 1. Problema Identificado
Em [`services/websocket-gateway/src/index.ts:56-66`](file:///d:/brokerproject/services/websocket-gateway/src/index.ts#L56-L66), o listener `redisSub.on("pmessage")` envia cada mensagem diretamente para todos os clientes via `socket.send(message)` sem coalescência de 50ms, sem checar `bufferedAmount` (backpressure de 64KB) e sem roteamento por shard (`hash(symbol) % num_nodes`), embora as classes [`TickCoalescer`](file:///d:/brokerproject/services/websocket-gateway/src/coalescer.ts), [`BackpressureGuard`](file:///d:/brokerproject/services/websocket-gateway/src/backpressure.ts) e [`SymbolShardingRouter`](file:///d:/brokerproject/services/websocket-gateway/src/sharding.ts) já existam.

## 2. Passo a Passo Cirúrgico
1. **Integrar `SymbolShardingRouter` em `services/websocket-gateway/src/index.ts`**:
   - Instanciar `SymbolShardingRouter(NODE_ID, TOTAL_NODES)` configurável via variáveis de ambiente (`WS_NODE_ID=0`, `WS_TOTAL_NODES=1` por padrão para manter compatibilidade total em single-node e suportar multi-node horizontal).
2. **Integrar `TickCoalescer` (50ms) e `BackpressureGuard` (64KB / 5s slow consumer)**:
   - No `redisSub.on("pmessage")`, passar o payload pelo `TickCoalescer` por símbolo (`50ms`) para que rajadas de ticks dentro de 50ms enviem apenas o estado mais fresco por ativo para o fan-out visual.
   - No callback de flush do `TickCoalescer`, iterar pelos clientes inscritos no `symbol` e verificar `backpressureGuard.shouldSend(socket as any)` antes de chamar `socket.send(...)`.
   - Limpar o estado do socket no `backpressureGuard.clearSocket(socket)` quando o cliente desconectar (`socket.on("close")`) e parar o `coalescer.stop()` no `SIGTERM`.

## 3. Testes Obrigatórios (Estresse, Caos e Segurança)
- **Estresse de Fan-out (Coalescing)**: 1.000 ticks em 50ms para 100 sockets → apenas o tick mais fresco de cada janela de 50ms é transmitido, reduzindo chamadas de rede em >95%.
- **Caos de Slow Consumer (Backpressure)**: Cliente com `bufferedAmount > 64KB` tem envios pausados imediatamente; se permanecer congestionado por `> 5000ms`, o `BackpressureGuard` fecha a conexão com código `1008 Slow consumer`.
- **Particionamento Determinístico (Sharding)**: `SymbolShardingRouter` distribui símbolos uniformemente entre `N` nós e rejeita/filtra símbolos de outros shards quando `WS_TOTAL_NODES > 1`.
