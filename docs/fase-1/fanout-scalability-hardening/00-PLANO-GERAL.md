# Plano Geral de Engenharia: Blindagem Definitiva de Fan-Out & Escalabilidade (Perigo 4)

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Arquiteto de Trading & Sistemas:** `broker-architect-agent`  
**Engenheiro Backend & Gateway:** `backend-implementation-agent`  
**Engenheiro Frontend:** `frontend-realtime-agent`  
**Engenheiro de QA & Resiliência:** `qa-resilience-agent`  
**Verificador Independente:** `post-implementation-verifier`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine` (Invariantes M-02, M-03, M-06), `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`  
**Invariantes:** M-06 (WebSocket Feed) | D-04 (Pub/Sub Visual vs Stream) | V-11 (WebSocket Limits) | V-13 (Preservação Contábil)

---

## 1. Diagnóstico do Perigo: "Fan-Out Não Escala — Um Tick Vira N Mensagens"

### 1.1 O Que Acontece sem Blindagem?
Em uma plataforma com 36 ativos OTC e centenas de usuários simultâneos:
1. **Multiplicação Brutal de I/O:** Sem um backplane otimizado, se o tick engine tentar enviar mensagens diretamente para os clientes ou se o gateway fizer broadcast sem controle, cada tick gera uma avalanche de I/O ($N \times M$ mensagens).
2. **Falta de Coalescing:** Sob volatilidade ou rajadas de processamento, dezenas de ticks chegam em frações de milissegundo. Enviar todos os intermediários satura o canal de rede do cliente sem agregar valor, já que o usuário só necessita do preço mais recente no gráfico.
3. **Colapso por Cliente Lento (Sem Backpressure):** Se um único usuário estiver em uma rede 3G instável ou aba suspensa, o buffer do socket (`bufferedAmount`) cresce descontroladamente na RAM do gateway, consumindo memória e travando o loop de eventos para todos os outros clientes.
4. **Proliferação de Conexões:** Sem multiplexação de símbolos em lote, cada gráfico aberto exige requisições separadas, multiplicando o custo de handshake.
5. **Gargalo Vertical no Redis:** Sem sharding por símbolo, todo o throughput de Pub/Sub converge para um único nó Redis, criando gargalo de CPU em instâncias de núcleo único.

---

## 2. A Solução Arquitetural: As 5 Técnicas Combinadas da Indústria

```text
       [Tick Engine (36 Ativos)]
                  │
                  ▼ (1 publicação por tick)
       [Sharding Router: hash(symbol) % N]
         │                 │                 │
         ▼                 ▼                 ▼
  [Redis Nó 1]       [Redis Nó 2]       [Redis Nó 3]
  (Canais A-H)       (Canais I-Q)       (Canais R-Z)
         │                 │                 │
         └─────────────────┬─────────────────┘
                           │ (Assinatura Pub/Sub Backplane)
                           ▼
               [WebSocket Gateway Local]
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
 [Tick Coalescer]                    [Backpressure Guard]
 (Janela 50ms: manda mais            (Limite 64KB: pausa se
  recente, descarta intermediários)   saturado, desconecta se lento)
       │                                       │
       └───────────────────┬───────────────────┘
                           │
                           ▼ (Multiplexado: 1 socket = N símbolos)
                [N Clientes Conectados]
```

### Detalhamento das 5 Técnicas:
1. **Técnica 1 — Redis Pub/Sub como Backplane:** O gerador publica **uma única vez** no canal `market:ticks:{symbol}`; o Gateway assina e realiza a entrega aos clientes locais, desacoplando completamente a produção da distribuição.
2. **Técnica 2 — Coalescing Temporal (50ms por Símbolo):** A cada 50ms por símbolo, o gateway despacha o tick com maior sequência e carimbo de tempo, descartando com segurança os intermediários acumulados na janela.
3. **Técnica 3 — Backpressure com Limite de 64KB:** Se `socket.bufferedAmount > 64KB`, o gateway pausa o envio de deltas visuais para o socket, aguarda o evento `drain`, e encerra clientes que permaneçam saturados após 5 segundos (`4429 Slow Client`).
4. **Técnica 4 — Multiplexação (1 WebSocket, N Símbolos em Batch):** Suporte nativo à subscrição de múltiplos símbolos em lote (`{"type":"subscribe","symbols":["BTC","ETH","EUR"]}`) em uma única conexão TCP/WS.
5. **Técnica 5 — Sharding por Símbolo:** Distribuição consistente baseada em hash dos 36 ativos entre os nós de mensageria do cluster.

---

## 3. Matriz de Subetapas e Critérios Formais de Execução

| Subetapa | Escopo & Arquivos | Bateria de Testes |
|---|---|---|
| **Subetapa 1** | Redis Pub/Sub Backplane & Isolamento Produtor | `tests/test-subetapa-1-pubsub-backplane.mjs` (Prova de 1 publicação -> N receptores locais) |
| **Subetapa 2** | Motor de Coalescing (Janela 50ms) | `tests/test-subetapa-2-coalescing.mjs` (Rajada de 20 ticks em 30ms -> 1 tick emitido) |
| **Subetapa 3** | Backpressure & Proteção de Cliente Lento (64KB) | `tests/test-subetapa-3-backpressure.mjs` (Cliente saturado pausado e purgado sem OOM) |
| **Subetapa 4** | Multiplexação de Símbolos em Lote (1 Socket = N Ativos) | `tests/test-subetapa-4-multiplexing.mjs` (Batch subscribe atômico de múltiplos ativos) |
| **Subetapa 5** | Sharding por Símbolo (Escala Horizontal) | `tests/test-subetapa-5-symbol-sharding.mjs` (Distribuição balanceada entre N nós) |
| **Subetapa 6** | Métricas Prometheus Industriais de Fan-Out | `tests/test-subetapa-6-fanout-metrics.mjs` (Scraping de mensagens, descartes e backpressure) |
| **Subetapa 7** | Bateria de Caos C-12 a C-15, Carga & Certificação Final | `tests/test-subetapa-7-fanout-caos.mjs` (100 clientes x 36 ativos, cliente tóxico, V-01 a V-13) |

---

## 4. Regras Invioláveis de Governança
- **Invariante M-06:** Pub/Sub é exclusivamente para transmissão visual do feed; a fonte oficial de verdade para settlement e candles continua sendo o PostgreSQL e o Redis Stream (`D-04`).
- **Zero Regressão:** Todas as 21 subetapas anteriores (Staleness, Cross-Sync, Reconnect Storm) devem permanecer 100% verdes após cada modificação.
