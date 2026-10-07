# Subetapa 6: Métricas Industriais & Telemetria Prometheus de Fan-Out

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `07-production-operations`  
**Invariantes:** Observabilidade de Produção | Telemetria OpenMetrics

---

## 1. Escopo e Objetivos da Subetapa
Expor métricas formais no endpoint `/metrics` do live feed e do WebSocket Gateway para auditar o comportamento do motor de fan-out em tempo real:
- `fanout_messages_sent_total` (counter: total de mensagens emitidas aos sockets locais)
- `coalesced_ticks_dropped_total` (counter: ticks intermediários descartados pelo motor de 50ms)
- `backpressure_paused_clients` (gauge: clientes atualmente pausados por buffer > 64KB)
- `slow_clients_disconnected_total` (counter: clientes desconectados por saturação persistente)
- `fanout_active_subscriptions` (gauge: total de pares cliente-símbolo ativos)

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 6.1: Definição do Schema das Séries de Fan-Out
- **Ação:** Documentar as 5 métricas com seus tipos (`counter`, `gauge`) e descrições `HELP` padronizadas.
- **Critério de Aceite:** Conformidade estrita com a especificação Prometheus.

### Passo 6.2: Implementação em `scripts/dev-live-feed.mjs`
- **Ação:** Coletar contadores em tempo real no dispatcher e expor na resposta de `/metrics`.
- **Critério de Aceite:** Métricas atualizadas dinamicamente a cada tick e conexão.

### Passo 6.3: Implementação no WebSocket Gateway (`services/websocket-gateway/src/index.ts`)
- **Ação:** Integrar o rastreador de backpressure e de subscrições multiplexadas ao endpoint de telemetria.
- **Critério de Aceite:** Visibilidade completa sobre conexões pausadas.

### Passo 6.4: Teste de Scraping Nominal
- **Ação:** Realizar requisição GET em `/metrics` com sistema em repouso.
- **Critério de Aceite:**
  * `backpressure_paused_clients` = 0
  * `fanout_messages_sent_total` >= 0
  * `coalesced_ticks_dropped_total` >= 0

### Passo 6.5: Teste de Registro de Descartes de Coalescing e Backpressure
- **Ação:** Injetar rajada de ticks rápidos e simular 1 cliente saturado.
- **Critério de Aceite:**
  * `coalesced_ticks_dropped_total` incrementa proporcionalmente aos ticks intermediários descartados.
  * `backpressure_paused_clients` reflete o cliente em espera.

### Passo 6.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-6-fanout-metrics.mjs`.
- **Critério de Aceite:** 100% dos testes aprovados com tempo de resposta < 15ms.
