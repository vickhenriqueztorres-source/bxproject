# Subetapa 5: Integração Completa no TradingFeedManager & Feedback Visual na UI

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `frontend-realtime-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `06-testing-quality`  
**Invariantes:** V-11 (WebSocket Connection Management) | V-12 (Staleness Overlay & Safety)

---

## 1. Escopo e Objetivos da Subetapa
Orquestrar as **4 técnicas combinadas** dentro do `TradingFeedManager.ts` e fornecer feedback visual claro na UI:
1. No startup: aplica `staggered-startup` (0 a 10s).
2. Na queda: verifica `circuit-breaker` do feed/conexão. Se `OPEN`, pausa reconexão por 30s.
3. Se permitido: aguarda token no `token-bucket` (teto de 10 tokens, 1/s).
4. Ao agendar: aplica `exponential-backoff` com **Full Jitter** canônico da AWS.
5. Na UI: exibe aviso explícito quando o circuit breaker estiver aberto: `⚠️ Conexão em Pausa de Segurança (30s)`.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 5.1: Refatoração do Ciclo de Reconexão do TradingFeedManager
- **Ação:** Substituir o método `scheduleReconnect` ingênuo pelo pipeline de 4 estágios:
  * Checagem do `circuitBreaker.canExecute()`
  * Requisição de token no `tokenBucket.waitForToken()`
  * Cálculo de delay via `calculateFullJitterDelay(attempt)`
  * Notificação do status aos ouvintes da UI
- **Critério de Aceite:** O fluxo respeita a ordem estrita sem loops infinitos ou deadlocks de promises.

### Passo 5.2: Callback de Estado do Circuit Breaker para a UI
- **Ação:** Adicionar evento de status na interface de callbacks:
  * `onCircuitBreakerStateChange(state: 'CLOSED' | 'OPEN' | 'HALF_OPEN', remainingCooldownMs: number)`
- **Critério de Aceite:** A UI recebe atualizações em tempo real a cada alteração de estado.

### Passo 5.3: Atualização do StalenessOverlay e MultiChartGrid
- **Ação:** Quando o circuit breaker estiver aberto, o overlay do gráfico exibe o banner:
  * `🔴 PAUSA DE SEGURANÇA (Circuit Breaker Aberto: 3 falhas consecutivas - retentando em Xs)`
- **Critério de Aceite:** O usuário final compreende claramente o motivo da pausa, eliminando cliques repetidos e pânico.

### Passo 5.4: Teste de Desconexão Forçada e Orquestração das 4 Camadas
- **Ação:** Simular 3 desconexões sucessivas do WebSocket Gateway.
- **Critério de Aceite:**
  * Tentativas 1 e 2 utilizam Full Jitter e Token Bucket.
  * Falha 3 aciona o Circuit Breaker (estado `OPEN`).
  * Nenhuma reconexão é disparada durante os 30 segundos subsequentes.

### Passo 5.5: Teste de Auto-Recuperação em HALF-OPEN
- **Ação:** Após 30 segundos, simular restabelecimento do gateway.
- **Critério de Aceite:** A tentativa em `HALF-OPEN` obtém sucesso, o circuito fecha para `CLOSED`, o banner é removido e as assinaturas de todos os ativos são restauradas.

### Passo 5.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-5-reconnect-manager-ui.mjs`.
- **Critério de Aceite:** 100% de aprovação comprovando a orquestração harmônica das 4 técnicas.
