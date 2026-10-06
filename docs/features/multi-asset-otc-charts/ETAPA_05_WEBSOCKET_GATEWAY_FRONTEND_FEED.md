# Subetapa 5: WebSocket Gateway & Feed de Conexão Única com De-duplicação

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação Frontend:** `frontend-realtime-agent`  
**Implementação Backend:** `backend-implementation-agent`  
**Segurança & Rate Limit:** `security-reviewer`  
**Verificador Independente:** `post-implementation-verifier` (Skill 10: V-11, V-13)  
**Status:** HOMOLOGADO E APROVADO (GATE 5 PASS)

---

## 1. Objetivo da Subetapa
Resolver o desafio de multiplexação de dados em tempo real em interfaces de trading com múltiplos gráficos:
- **Conexão Única por Aba (`V-11`)**: Exatamente 1 conexão WebSocket aberta por aba do navegador, multiplexando até 4 gráficos simultâneos.
- **De-duplicação Inteligente no Cliente**: Quando múltiplos gráficos visualizam o mesmo ativo (ex.: `EURUSD_OTC` em tempos gráficos distintos), o frontend mantém 1 única subscrição TCP com o gateway via contagem de referências (`refCount`).
- **Controle de Conexões em Cluster Redis**: Limite estrito de no máximo 5 conexões por usuário (`sub`) gerenciado atomicamente via chave Redis `ws:conns:{sub}` com TTL e heartbeat de 15s.
- **Teto de Ativos por Conexão**: Máximo de 10 ativos subscritos por conexão individual.
- **Zero Preço Simulado no Cliente (`A-07`)**: Strikes, linhas de expiração e velas derivam 100% dos eventos recebidos do servidor.

---

## 2. Os 6 Passos de Execução da Subetapa 5

1. **Passo 1 (Gateway WebSocket Multi-Ativos no Backend)**:
   Implementar no `services/websocket-gateway/` o parser de mensagens `{ "action": "subscribe", "symbols": [...] }` e `{ "action": "unsubscribe", "symbols": [...] }` com validação de payload via Zod.
2. **Passo 2 (Controle de Cota Distribuída via Redis TTL)**:
   Implementar controle atômico no Redis (`INCR` com `EXPIRE 60s` na conexão; heartbeat a cada 15s renovando TTL). Se o contador exceder 5 para o mesmo `sub`, rejeitar a conexão com código de fechamento `4429 (Too Many Connections)`.
3. **Passo 3 (Limitação de 10 Ativos por Conexão)**:
   No handler de subscrição, validar o tamanho do conjunto de símbolos da sessão. Se `session.symbols.size + newSymbols.length > 10`, rejeitar a subscrição adicional com erro amigável.
4. **Passo 4 (Cliente Singleton de Conexão Única no Frontend)**:
   Implementar `TradingWebSocketClient.ts` em `apps/web/src/` com padrão singleton compartilhado por todos os gráficos e componentes da UI.
5. **Passo 5 (Tabela de Referências e Despacho de Eventos Local)**:
   Criar estrutura `refCount = new Map<string, number>()` e barramento EventEmitter em memória. Emitir comando `subscribe` ao servidor apenas quando `refCount == 1`; emitir `unsubscribe` apenas quando `refCount == 0`.
6. **Passo 6 (Suíte de Testes Automatizada do Gate 5)**:
   Executar `tests/test-multi-05-ws-single-connection.mjs` e `tests/unit/gateway-distributed-connection-limit.test.ts`.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Fan-out de Ticks e De-duplicação)**:
  - Abrir 4 gráficos virtuais no cliente apontando para 2 pares repetidos (`EURUSD_OTC` x2, `BTCUSD_OTC` x2).
  - Provar que apenas 2 mensagens de subscrição saem pela rede, e que o gateway entrega os ticks em tempo real sem atrasos acumulados.
- **Segurança (Limite de 5 Conexões e Ataque Sybil)**:
  - Abrir 5 conexões simultâneas com o mesmo token de usuário em 2 instâncias distintas do gateway.
  - Tentar abrir a 6ª conexão: deve ser rejeitada com código 4429.
  - Tentar subscrever 11 ativos na mesma conexão: o 11º ativo deve ser rejeitado pelo gateway.
- **Caos (Queda Abrupta com Kill -9)**:
  - Matar um processo cliente sem fechamento limpo TCP (`kill -9`). O heartbeat para de bater e o contador no Redis expira via TTL em 60s, liberando a vaga do usuário.

---

## 4. Garantias Pós-Implementação (Skill 10)

- **`V-11`**: Limites do WebSocket respeitados (5 conexões/usuário no cluster, 10 ativos/conexão, de-duplicação no cliente e zero buraco de `sequence`).
- **`V-13`**: Integridade da suíte; testes originais preservados sem enfraquecimento.

---

## 5. Critérios de Passagem do Quality Gate 5
- Executar `node tests/test-multi-05-ws-single-connection.mjs` $\to$ Exit Code 0.
- Executar `npx tsx --test tests/unit/gateway-distributed-connection-limit.test.ts` $\to$ Exit Code 0.
- Homologação do `security-reviewer` e do `post-implementation-verifier` emitindo veredito **`APROVADO`**.
