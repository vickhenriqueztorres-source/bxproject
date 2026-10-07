# Subetapa 5: Resiliência, Circuit Breaker e Caos (Tolerância a Falhas no Keycloak e Blnk)

**Agentes Responsáveis:** `qa-resilience-agent`, `backend-implementation-agent`  
**Skills:** `05-resilience-patterns`, `06-testing-quality`, `09-ai-failure-map`  
**Padrões Auditados:** Circuit Breaker, Exponential Backoff com Jitter, Timeout, Degradação Graciosa

---

## 1. Objetivo Técnico
Garantir que a plataforma não entre em colapso catastrófico caso os serviços externos de infraestrutura sofram indisponibilidade temporária:
1. **Falha do Keycloak:** Se o Keycloak demorar para responder ou cair após emitir o token, o cache do JWKS deve permitir que o backend continue validando tokens já emitidos por até seu TTL sem derrubar a API.
2. **Falha do Blnk Ledger:**
   - O `BlnkClient` implementa **Circuit Breaker** nativo: após 5 falhas consecutivas, o circuito abre por 10.000 ms, impedindo saturação de sockets e latência cascata.
   - Chamadas HTTP possuem timeout estrito de 3.000 ms.
   - Retries com backoff exponencial e full jitter: $t_{\text{backoff}} = 50 \times 2^{\text{attempt}} + \text{jitter}$.
3. **Degradação Graciosa em Ambiente Local/Dev:** Se o container do Blnk estiver em manutenção, a rota `/api/v1/wallet` responde com fallback seguro sem gerar erro 500 para o trader.

---

## 2. Passo a Passo da Implementação

### 2.1 Circuit Breaker do Blnk Client (`services/wallet-adapter/src/blnk-client.ts`)
```typescript
private isCircuitOpen(): boolean {
  return this.circuitOpenUntil > Date.now();
}

private recordFailure() {
  this.failureCount++;
  if (this.failureCount >= this.maxFailures) {
    this.circuitOpenUntil = Date.now() + this.resetTimeoutMs;
    console.warn(`[BlnkClient] Circuit Breaker tripped OPEN for ${this.resetTimeoutMs}ms`);
  }
}
```

### 2.2 Cache Remoto de JWKS (`services/api/src/plugins/auth.ts`)
A função `createRemoteJWKSet` da biblioteca `jose` mantém cache local em memória das chaves públicas do Keycloak, evitando round-trips de rede a cada requisição de endpoint protegido.

---

## 3. Matriz de Testes & Validação de Caos

### Teste de Caos C-01: Simulação de Queda do Blnk Ledger
- **Cenário:** Simular que o Blnk está fora do ar (porta inacessível).
- **Comportamento Esperado:**
  - 5 chamadas falham e acionam o Circuit Breaker.
  - A 6ª chamada é rejeitada imediatamente (`CIRCUIT_BREAKER_OPEN`) em < 1 ms sem tentar a rede.
  - O sistema se recupera automaticamente após o tempo de cooldown (`resetTimeoutMs`).

### Teste de Caos C-02: Timeout de Rede e Retry com Jitter
- **Cenário:** Endpoint do Blnk simula delay de 4.000 ms (acima do limite de 3.000 ms).
- **Comportamento Esperado:** O cliente aborta a conexão via `AbortController`, retenta com backoff e não trava a thread de execução do Node.js.

---

## 4. Critério de Aceite da Subetapa 5
- [x] Circuit Breaker do `BlnkClient` implementado e funcional.
- [x] Timeouts de 3s e retries com backoff exponencial e jitter ativos.
- [x] Cache de JWKS protegendo a API de indisponibilidades transitórias do Keycloak.
- [x] Teste de injeção de caos aprovado.
