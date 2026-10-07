# Subetapa 3: Backpressure e Proteção contra Cliente Lento (Buffer 64KB)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent` & `broker-architect-agent`  
**Agente Revisor:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `06-testing-quality`  
**Invariantes:** V-11 (Connection Management) | Proteção de RAM e Prevenção de OOM

---

## 1. Escopo e Objetivos da Subetapa
Blindar o WebSocket Gateway contra conexões lentas (redes com alta perda de pacotes, clientes com abas em segundo plano suspensas ou renderização travada):
- Limite máximo de buffer por socket: 64KB (`65536` bytes em `socket.bufferedAmount`).
- Se o buffer exceder 64KB: **pausar imediatamente** o consumo e o envio de ticks visuais para esse socket.
- Quando o buffer drenar (evento `drain` do WebSocket): **retomar** o envio com o tick fresco.
- Se o socket permanecer saturado por mais de 5.000ms: **desconectar o cliente** com código `4429` ("Slow Client Backpressure Timeout").

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 3.1: Modelagem do Módulo `BackpressureGuard`
- **Ação:** Criar a classe `BackpressureGuard` com:
  * `MAX_BUFFERED_AMOUNT_BYTES = 64 * 1024` (64KB)
  * `SLOW_CLIENT_TIMEOUT_MS = 5000` (5 segundos)
  * Rastreamento de estado por socket: `{ isPaused, saturatedSince, totalDrains }`
- **Critério de Aceite:** Exportação TypeScript limpa com métodos `shouldSend(socket)`, `handleDrain(socket)` e `checkSlowClients()`.

### Passo 3.2: Integração com o Loop de Envio do WebSocket Gateway
- **Ação:** Antes de executar `socket.send(message)`, verificar `backpressureGuard.shouldSend(socket)`. Se o buffer estiver cheio, enfileirar ou pausar sem despejar mais bytes no socket.
- **Critério de Aceite:** `socket.bufferedAmount` nunca cresce descontroladamente além do limite.

### Passo 3.3: Tratamento do Evento `drain`
- **Ação:** Registrar listener para desarmar o estado pausado e retomar transmissões assim que o buffer do socket for esvaziado pelo kernel TCP.
- **Critério de Aceite:** O envio retoma de forma suave assim que a rede do cliente desobstrui.

### Passo 3.4: Desconexão Forçada por Timeout de Cliente Tóxico
- **Ação:** Implementar o temporizador de expulsão: clientes cujo buffer não drena em 5s são fechados com `socket.close(4429, "Slow client backpressure timeout")`.
- **Critério de Aceite:** Conexão terminada de forma limpa, liberando descritores de arquivo e memória do gateway.

### Passo 3.5: Teste de Isolamento de Cliente Lento
- **Ação:** Simular 1 cliente com buffer travado (> 64KB) e 10 clientes normais (buffer = 0).
- **Critério de Aceite:** Os 10 clientes normais continuam recebendo ticks a 1Hz sem qualquer aumento de latência; o cliente lento é isolado e encerrado aos 5s.

### Passo 3.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-3-backpressure.mjs`.
- **Critério de Aceite:** 100% dos testes aprovados com eliminação comprovada de risco de OOM.
