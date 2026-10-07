# Subetapa 4: Multiplexação Completa (1 WebSocket, N Símbolos em Batch)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent` & `frontend-realtime-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `06-testing-quality`  
**Invariantes:** V-11 (1 conexão WebSocket por aba / max 10 ativos inscritos)

---

## 1. Escopo e Objetivos da Subetapa
Evoluir o protocolo de mensageria para permitir **multiplexação atômica** de até 10 símbolos em uma única conexão WebSocket.
- Suporte a subscrição em lote: `{"type": "subscribe", "symbols": ["BTCUSD_OTC", "ETHUSD_OTC", "EURUSD_OTC"]}`.
- O cliente mantém 1 único socket para todos os gráficos abertos na tela (grade 1x1, 2x1, 2x2).
- Redução de até 10x na contagem total de conexões TCP/WebSockets concorrentes no gateway.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 4.1: Extensão do Protocolo de Mensagem no Gateway
- **Ação:** Atualizar o parser de `subscribe` em `services/websocket-gateway/src/index.ts` e `scripts/dev-live-feed.mjs`:
  * Aceitar tanto `msg.symbol: string` quanto `msg.symbols: string[]`.
  * Validar o teto global de 10 ativos por conexão (`clientSubscriptions.size + incomingSymbols.length <= 10`).
- **Critério de Aceite:** O gateway inscreve todos os ativos enviados no array em uma única operação.

### Passo 4.2: Suporte a Batch Subscribe no `TradingFeedManager.ts`
- **Ação:** Adicionar o método `subscribeSymbols(symbols: string[])` no frontend para enviar todas as subscrições dos gráficos abertos em uma única mensagem agrupada.
- **Critério de Aceite:** Quando o layout multi-gráfico carrega, envia 1 mensagem JSON em vez de 4 ou 10 mensagens individuais.

### Passo 4.3: Teste de Subscrição em Lote (4 Símbolos Simultâneos)
- **Ação:** Enviar `{"type": "subscribe", "symbols": ["EURUSD_OTC", "BTCUSD_OTC", "ETHUSD_OTC", "SOLUSD_OTC"]}` em 1 socket.
- **Critério de Aceite:** O cliente passa a receber os ticks dos 4 ativos de forma multiplexada pelo mesmo canal.

### Passo 4.4: Teste de Borda: Rejeição ao Exceder 10 Símbolos
- **Ação:** Tentar inscrever 11 símbolos na mesma conexão.
- **Critério de Aceite:** O gateway rejeita a tentativa com mensagem de erro estruturada `{"type": "error", "message": "Max 10 symbol subscriptions per connection"}` preservando os 10 ativos válidos anteriores.

### Passo 4.5: Desinscrição em Lote (Batch Unsubscribe)
- **Ação:** Suportar `{"type": "unsubscribe", "symbols": [...]}` para liberação rápida de slots quando gráficos forem fechados ou alterados na grade.
- **Critério de Aceite:** O mapa de subscrições remove os ativos sem deixar vazamento de sockets nos sets.

### Passo 4.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-4-multiplexing.mjs`.
- **Critério de Aceite:** 100% dos testes aprovados comprovando a multiplexação estrita.
