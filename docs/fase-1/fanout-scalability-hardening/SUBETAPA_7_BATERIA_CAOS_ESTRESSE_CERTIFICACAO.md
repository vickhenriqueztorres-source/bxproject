# Subetapa 7: Bateria de Caos, Carga & Certificação Final de Fan-Out

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de QA:** `qa-resilience-agent`  
**Agente Revisor Geral:** `broker-architect-agent`  
**Agente Verificador Independente:** `post-implementation-verifier`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`  
**Invariantes:** V-01 a V-13 (Protocolo de Garantias Pós-Implementação)

---

## 1. Escopo e Objetivos da Subetapa
Submeter toda a arquitetura de distribuição em tempo real à bateria mais hostil de testes:
- **C-12:** Avalanche de Fan-Out (100 clientes x 36 ativos sob publicação contínua).
- **C-13:** Rajada de Volatilidade e Coalescing (100 ticks em 100ms comprimidos em 2 emissões limpas).
- **C-14:** Cliente Tóxico / Lento isolado e expulso após 5s sem afetar os outros 50 clientes sadios.
- **C-15:** Particionamento balanceado de sharding multi-nó.
- **Auditoria Contábil V-01 a V-13:** Verificação matemática de que nenhum preço fantasma atingiu settlement e que o Ledger Blnk permaneceu inviolado.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 7.1: Bateria de Caos C-12 (Avalanche de Fan-Out com 100 Clientes)
- **Ação:** 100 clientes conectados assinando simultaneamente 36 ativos. Tick emitido no Redis Pub/Sub.
- **Critério de Aceite:**
  * O gerador emite exatamente 1 mensagem no Redis.
  * O gateway faz fan-out local para os 100 clientes em < 15ms.
  * Zero saturação ou vazamento de sockets.

### Passo 7.2: Bateria de Caos C-13 (Rajada Massiva e Coalescing de 50ms)
- **Ação:** Injetar rajada de 100 ticks em 100ms do par `BTCUSD_OTC`.
- **Critério de Aceite:**
  * Exatamente 2 emissões consolidadas (a cada 50ms).
  * 98 ticks intermediários descartados com segurança.
  * O último preço entregue ao trader corresponde exatamente ao tick 100 (mais fresco).

### Passo 7.3: Bateria de Caos C-14 (Isolamento e Purga de Cliente Tóxico)
- **Ação:** Simular 50 clientes saudáveis e 1 cliente tóxico com leitura bloqueada (`bufferedAmount > 64KB`).
- **Critério de Aceite:**
  * O cliente tóxico é pausado no 1º milissegundo de saturação.
  * Os 50 clientes normais continuam recebendo ticks a 1Hz sem atraso.
  * Aos 5 segundos de saturação ininterrupta, o cliente tóxico é desconectado com código `4429`.

### Passo 7.4: Bateria de Caos C-15 (Sharding Consistente Multi-Nó)
- **Ação:** Particionar os 36 ativos entre 3 instâncias de mensageria.
- **Critério de Aceite:** Cada nó recebe ~12 ativos. Roteamento imutável e determinístico.

### Passo 7.5: Auditoria de Pós-Condições Financeiras e Anti-Cross (V-01 a V-13)
- **Ação:** Validação das 13 garantias pós-implementação:
  * Nenhuma violação contábil no Ledger Blnk (soma zero preservada).
  * Preço de settlement obtido exclusivamente do PostgreSQL e não do canal visual de fan-out.

### Passo 7.6: Certificação Formal Independente
- **Ação:** Executar a bateria completa e emitir relatório de aprovação assinado pelos agentes.
- **Critério de Aceite:** 100% de aprovação sem nenhuma advertência pendente.
