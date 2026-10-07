# Subetapa 6: Métricas Industriais & Telemetria Prometheus de Reconnect Storm

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `07-production-operations`  
**Invariantes:** Observabilidade de Produção | Telemetria Prometheus

---

## 1. Escopo e Objetivos da Subetapa
Expor métricas formais no endpoint `/metrics` do serviço de live feed e do WebSocket Gateway para detectar e auditar qualquer princípio de tempestade de reconexão em tempo real.
- Métricas:
  * `reconnect_attempts_total` (counter)
  * `reconnect_backoff_seconds` (gauge)
  * `circuit_breaker_state` (gauge: 0=CLOSED, 1=HALF-OPEN, 2=OPEN)
  * `token_bucket_available_tokens` (gauge: 0 a 10)
  * `reconnect_storm_alert` (gauge binário: 1 se taxa > 10/s ou breaker aberto)

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 6.1: Definição do Schema de Métricas Prometheus
- **Ação:** Documentar as 5 séries com seus respectivos rótulos (`HELP`, `TYPE`).
- **Critério de Aceite:** Schema compatível com OpenMetrics e Prometheus Scraper standard.

### Passo 6.2: Implementação no Endpoint `/metrics` de `scripts/dev-live-feed.mjs`
- **Ação:** Integrar o rastreamento em tempo real de tokens disponíveis, estados de breakers e taxa de reconexão por segundo.
- **Critério de Aceite:** Resposta HTTP 200 formatada em texto plano texto puro Prometheus.

### Passo 6.3: Implementação no WebSocket Gateway (`services/websocket-gateway/src/index.ts`)
- **Ação:** Adicionar rota `/metrics` ou exportar métricas de gateway para o coletor central.
- **Critério de Aceite:** Rastreio de conexões bloqueadas por token bucket.

### Passo 6.4: Teste de Scraping Nominal
- **Ação:** Executar scraping sob condições normais de operação.
- **Critério de Aceite:**
  * `reconnect_storm_alert` = 0.
  * `circuit_breaker_state` = 0 (CLOSED).
  * `token_bucket_available_tokens` = 10.

### Passo 6.5: Teste de Detecção de Tempestade e Alerta Ativo
- **Ação:** Injetar rajada de reconexão forçando esgotamento de tokens e abertura de circuit breaker.
- **Critério de Aceite:** `reconnect_storm_alert` comuta imediatamente para 1 e `circuit_breaker_state` para 2.

### Passo 6.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-6-reconnect-metrics.mjs`.
- **Critério de Aceite:** 100% de aprovação e latência de scraping < 10ms.
