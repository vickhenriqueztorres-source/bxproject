# Subetapa 2: Heartbeat de Conexão & Confiabilidade de Link WebSocket

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `backend-implementation-agent`  
**Agente Frontend:** `frontend-realtime-agent`  
**Agente de Testes:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`  
**Invariantes Protegidas:** M-06 (WebSocket Feed), D-04 (Pub/Sub apenas fan-out), B-16 (Limite de conexões)

---

## 1. Escopo e Objetivos da Subetapa
Tornar o silêncio de rede mensurável através do protocolo padrão da indústria (RFC 6455 + Application-level heartbeat). Substituir timeouts lentos de 45 segundos por um heartbeat ativo com **intervalo de 30s e timeout de resposta de 5s**. Se o cliente não responder em 5 segundos, a conexão é encerrada com código 4408 e o cliente aciona o backoff exponencial com reconexão imediata.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 2.1: Calibração de Heartbeat no WebSocket Gateway
- **Ação:** No [`services/websocket-gateway/src/index.ts`](file:///D:/brokerproject/services/websocket-gateway/src/index.ts), configurar:
  * `HEARTBEAT_INTERVAL_MS = 30000` (envio a cada 30 segundos).
  * `HEARTBEAT_TIMEOUT_MS = 5000` (tempo limite de resposta do pong).
- **Critério de Aceite:** Servidor envia frame `{ type: "ping" }` a cada 30s.

### Passo 2.2: Implementação de Timeout de Resposta com Aborto Estrito (4408)
- **Ação:** Ao enviar o `ping`, armazena-se um timeout timer de 5s. Se a mensagem `{ type: "pong" }` não chegar dentro de 5s, o socket é fechado imediatamente com `socket.close(4408, "Heartbeat timeout")`.
- **Critério de Aceite:** Conexões "zumbis" (dead TCP links) são purgadas em no máximo 5 segundos após o ping.

### Passo 2.3: Heartbeat Ativo no Servidor de Desenvolvimento (`dev-live-feed.mjs`)
- **Ação:** Atualizar [`scripts/dev-live-feed.mjs`](file:///D:/brokerproject/scripts/dev-live-feed.mjs) para incluir a mesma máquina de estados de heartbeat ping/pong ativa a cada 30s com timeout de 5s.
- **Critério de Aceite:** O feed de desenvolvimento espelha com 100% de paridade o comportamento do gateway corporativo Fastify.

### Passo 2.4: Resposta Imediata de Pong no Cliente Frontend
- **Ação:** No [`TradingFeedManager.ts`](file:///D:/brokerproject/apps/web/src/feed/TradingFeedManager.ts), registrar handler para responder `{ type: "pong" }` instantaneamente no momento da chegada do `{ type: "ping" }`.
- **Critério de Aceite:** Latência do pong no cliente $\le 5\text{ ms}$ em condições locais.

### Passo 2.5: Ping do Lado do Cliente (Client-Initiated Heartbeat)
- **Ação:** O cliente também mantém um timer próprio: se não receber nenhuma mensagem do servidor (seja tick, snapshot ou ping) por mais de 35 segundos (30s + 5s margem), o cliente considera a conexão morta, fecha o socket e executa `scheduleReconnect()`.
- **Critério de Aceite:** Se o servidor travar sem enviar TCP FIN, o cliente detecta a queda em até 35s.

### Passo 2.6: Liberação Atômica de Contadores no Redis
- **Ação:** Quando o socket fecha por timeout de heartbeat (4408), garantir decremento imediato da chave `ws:conn:{userId}` no Redis para evitar vazamento de limite de 5 conexões (B-16, V-11).
- **Critério de Aceite:** Usuário não fica bloqueado com 4429 após timeout de conexão.

---

## 3. Testes Obrigatórios da Subetapa

### 3.1 Teste de Heartbeat Saudável
* Iniciar conexão WebSocket, aguardar 30s, responder pong no tempo e confirmar que a conexão permanece aberta sem interrupção.

### 3.2 Teste de Timeout Forçado (Silêncio de Pong)
* Iniciar cliente de teste que ignora o frame `{ type: "ping" }`.
* Verificar que o servidor fecha a conexão em exatamente 5 segundos com código 4408.

### 3.3 Teste de Caos de Desconexão Abrupta
* Simular queda de link TCP via proxy de interrupção ou `socket.destroy()`.
* Verificar que o `TradingFeedManager` inicia o algoritmo de backoff exponencial e restabelece a sessão sem intervenção humana.

---

## 4. Critérios Formais de Aceite (Quality Gate)
1. Conexões sem resposta a ping encerradas em 5 segundos cravados.
2. Reconexão automática resiliente com reassinatura transparente de ativos.
3. Teste aprovado pelo `qa-resilience-agent`.
