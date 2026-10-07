# Subetapa 1: Redis Pub/Sub Backplane & Desacoplamento Produtor/Consumidor

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`  
**Invariantes:** M-03 (Persistir antes de publicar) | M-06 (WebSocket feed visual via Pub/Sub) | D-04 (Pub/Sub não armazena estado)

---

## 1. Escopo e Objetivos da Subetapa
Garantir o desacoplamento formal entre a geração de ticks (Tick Engine / outbox relay) e a distribuição aos clientes (WebSocket Gateways). O gerador publica **uma única vez** por tick no canal do Redis `market:ticks:{symbol}`, e cada instância de gateway realiza o fan-out local para os clientes conectados a ela, sem sobrecarregar a origem.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 1.1: Padronização dos Nomes de Canais
- **Ação:** Fixar a nomenclatura institucional de canais de Pub/Sub em conformidade com `03-synthetic-market-engine`:
  * Ticks de mercado: `market:ticks:{symbol}`
  * Eventos de liquidação/mercado: `market:events:{symbol}`
- **Critério de Aceite:** Nenhum nome fora do padrão `market:ticks:*` utilizado no código.

### Passo 1.2: Auditoria de Produção Única no Tick Engine
- **Ação:** Verificar que o Tick Engine e o Outbox Relay nunca enviam mensagens diretamente para sockets de clientes e realizam apenas um comando de publicação no Redis por tick gerado.
- **Critério de Aceite:** Zero conexões WebSocket de clientes abertas no processo do gerador de mercado.

### Passo 1.3: Assinatura e Fan-Out Local no Gateway
- **Ação:** Configurar o WebSocket Gateway com cliente Redis dedicado para escuta em padrão `psubscribe('market:ticks:*')`.
- **Critério de Aceite:** O gateway recebe os ticks pelo canal central e distribui unicamente aos sockets locais que possuem inscrição no respectivo `symbol`.

### Passo 1.4: Teste de Desacoplamento e Carga na Origem
- **Ação:** Simular 100 clientes conectados distribuídos em 2 gateways simulados. Emitir 1 tick no canal Redis.
- **Critério de Aceite:** O emissor executa exatamente 1 chamada de publicação; ambos os gateways capturam a mensagem e entregam aos 100 clientes sem amplificação de rede para a origem.

### Passo 1.5: Isolamento de Erro de Cliente do Processo de Geração
- **Ação:** Injetar erro forçado de rede em sockets locais durante o envio do tick.
- **Critério de Aceite:** Nenhuma falha em socket de cliente afeta a thread do Tick Engine ou o canal de mensageria Redis.

### Passo 1.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-1-pubsub-backplane.mjs`.
- **Critério de Aceite:** 100% dos testes aprovados (Exit code 0).
