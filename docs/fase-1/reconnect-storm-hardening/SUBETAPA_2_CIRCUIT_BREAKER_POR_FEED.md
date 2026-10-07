# Subetapa 2: Circuit Breaker por Feed (Máquina de Estados CLOSED / OPEN / HALF-OPEN)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `frontend-realtime-agent` & `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns` (Padrão R-04), `06-testing-quality`  
**Invariantes:** R-04 (Circuit Breaker) | V-11 (Resiliência WebSocket) | V-12 (Staleness Protection)

---

## 1. Escopo e Objetivos da Subetapa
Implementar um Circuit Breaker individual por feed/ativo e no enlace WebSocket para evitar martelar upstreams ou gateways inoperantes. Seguir estritamente as regras fixas:
- **Threshold de abertura:** 3 falhas consecutivas.
- **Tempo de espera no estado OPEN:** 30 segundos (30.000ms).
- **Meia-abertura (HALF-OPEN):** exatamente 1 tentativa de teste permitida.
- **Transição de Sucesso:** retorno imediato a `CLOSED` e reset do contador de falhas.
- **Transição de Falha em HALF-OPEN:** reabertura imediata em `OPEN` por mais 30 segundos.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 2.1: Modelagem da Máquina de Estados
- **Ação:** Definir os tipos e interfaces em TypeScript:
  * Estados: `'CLOSED' | 'OPEN' | 'HALF_OPEN'`
  * Configuração: `{ failureThreshold: 3, openDurationMs: 30000, halfOpenSuccessThreshold: 1 }`
- **Critério de Aceite:** Tipagem exportada e documentada.

### Passo 2.2: Implementação do Core em `apps/web/src/feed/circuit-breaker.ts`
- **Ação:** Desenvolver a classe `FeedCircuitBreaker` com métodos:
  * `canExecute(): boolean`
  * `recordSuccess(): void`
  * `recordFailure(): void`
  * `getState(): CircuitState`
  * `getTimeUntilRetryMs(): number`
- **Critério de Aceite:** O método `canExecute()` bloqueia com precisão requisições durante o período `OPEN`.

### Passo 2.3: Espelhamento no Backend (`services/api/src/services/circuit-breaker.ts`)
- **Ação:** Reutilizar ou espelhar a classe com as mesmas regras estritas para uso nos workers e adaptadores de upstream.
- **Critério de Aceite:** Compilação com `tsc` sem erros.

### Passo 2.4: Teste de Transições de Estado e Isolamento Multi-Ativo
- **Ação:** Validar que uma falha consecutiva de 3x em `ETHUSD_OTC` abre seu breaker específico, enquanto `BTCUSD_OTC` permanece `CLOSED`.
- **Critério de Aceite:** Zero contaminação cruzada entre estados de breakers de ativos diferentes.

### Passo 2.5: Teste de Temporização e Meia-Abertura (Cooldown Test)
- **Ação:** Simular abertura em $t=0$, verificar bloqueio até $t=29.999\text{ms}$. No instante $t=30.000\text{ms}$, verificar transição automática para `HALF_OPEN` permitindo exatamente 1 tentativa.
- **Critério de Aceite:** Tentativa de sucesso restaura `CLOSED`; tentativa falha reabre em `OPEN` até $t=60.000\text{ms}$.

### Passo 2.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-2-circuit-breaker.mjs`.
- **Critério de Aceite:** 100% dos testes aprovados antes do avanço para a Subetapa 3.
