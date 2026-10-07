# Subetapa 3: Token Bucket Rate Limiter (Teto de Throughput de Reconexão)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `frontend-realtime-agent` & `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `06-testing-quality`  
**Invariantes:** R-02 (Retry Management) | V-11 (Connection Throttling)

---

## 1. Escopo e Objetivos da Subetapa
Implementar o algoritmo **Token Bucket** para impor um teto rígido de vazão de reconexões por segundo, tanto no cliente web quanto no WebSocket Gateway.
- **Capacidade do Balde:** 10 tokens.
- **Taxa de Reposição:** 1 token por segundo (1.000ms).
- **Custo:** 1 reconexão consome 1 token.
- **Comportamento quando Vazio:** Espera assíncrona até haver token disponível (`waitForToken()`).

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 3.1: Modelagem e Definição Matemática do Token Bucket
- **Ação:** Definir os parâmetros do balde:
  * `capacity = 10`
  * `refillRatePerSecond = 1`
  * Reposição baseada em tempo contínuo fracionário ($\Delta t = \text{now} - \text{lastRefill}$).
- **Critério de Aceite:** O número de tokens nunca excede 10 e nunca fica abaixo de 0.

### Passo 3.2: Implementação em `apps/web/src/feed/token-bucket.ts`
- **Ação:** Desenvolver a classe `TokenBucketRateLimiter` com métodos:
  * `tryConsume(tokens = 1): boolean`
  * `waitForToken(tokens = 1): Promise<void>`
  * `getAvailableTokens(): number`
- **Critério de Aceite:** Exportação TypeScript limpa com suporte a promises e timers canceláveis.

### Passo 3.3: Implementação no Gateway (`services/websocket-gateway/src/token-bucket.ts`)
- **Ação:** Implementar o rate limiter no gateway para limitar handshakes globais e rejeitar excessos com `429 Too Many Requests`.
- **Critério de Aceite:** Proteção simétrica cliente/servidor.

### Passo 3.4: Teste de Rajada Concorrente (Burst Test)
- **Ação:** Disparar 50 tentativas de reconexão simultâneas no instante $t=0$.
- **Critério de Aceite:** Exatamente 10 requisições consomem os tokens iniciais imediatamente; as 40 restantes são enfileiradas e liberadas à taxa exata de 1 a cada 1 segundo.

### Passo 3.5: Teste de Reposição Gradual e Recuperação de Balde
- **Ação:** Esvaziar o balde, aguardar 5 segundos e verificar se exatamente 5 tokens foram repostos.
- **Critério de Aceite:** O número de tokens disponíveis deve ser igual a 5. Aguardar mais 10 segundos e verificar o teto fixado em 10.

### Passo 3.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-3-token-bucket.mjs`.
- **Critério de Aceite:** 100% de aprovação comprovando teto de 10 reconexões/s.
