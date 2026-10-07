# Subetapa 1: Exponential Backoff com Full Jitter (Fórmula Canônica AWS)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `frontend-realtime-agent` & `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns` (Padrão R-02), `06-testing-quality`  
**Invariantes:** R-02 (Retry Backoff Full Jitter) | V-11 (Resiliência de Conexão WebSocket)

---

## 1. Escopo e Objetivos da Subetapa
Substituir o algoritmo ingênuo de backoff por uma implementação robusta da **Fórmula Canônica da AWS de Full Jitter**:
$$\text{delay} = \text{random}(0, \min(\text{cap}, \text{base} \times 2^{\text{attempt}}))$$
com `base = 1000ms` (1s) e `cap = 60000ms` (60s). Sem piso fixo desnecessário, garantindo dispersão uniforme de tentativas no tempo para erradicar picos sincronizados de reconexão.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 1.1: Especificação Matemática e Parametrização Estrita
- **Ação:** Definir as constantes da fórmula canônica:
  * `DEFAULT_BASE_MS = 1000` (1 segundo)
  * `DEFAULT_CAP_MS = 60000` (60 segundos)
- **Critério de Aceite:** Para qualquer tentativa $n \ge 0$, o atraso gerado deve obrigatoriamente satisfazer $0 \le \text{delay} \le \min(\text{cap}, \text{base} \times 2^n)$.

### Passo 1.2: Implementação da Função de Full Jitter no Frontend
- **Ação:** Criar/atualizar `apps/web/src/feed/backoff.ts` com tipagem TypeScript estrita e suporte a injeção de gerador pseudoaleatório (para testes determinísticos).
- **Critério de Aceite:** Código compilando limpo via `tsc`, exportando `calculateFullJitterDelay(attempt, baseMs, capMs, randomFn)`.

### Passo 1.3: Espelhamento Institucional no Backend
- **Ação:** Criar `services/api/src/services/backoff.ts` com a mesma fórmula canônica para ser utilizado por workers, relays e handlers de retry de clientes e serviços.
- **Critério de Aceite:** Módulo idêntico, determinístico e testável no ecossistema do backend.

### Passo 1.4: Teste de Propriedades Limítrofes (Boundary & Ceiling Tests)
- **Ação:** Validar em testes unitários os casos de borda:
  * Tentativa 0: intervalo $[0, 1000\text{ms}]$.
  * Tentativa 1: intervalo $[0, 2000\text{ms}]$.
  * Tentativa 5: intervalo $[0, 32000\text{ms}]$.
  * Tentativa 6 em diante: teto estritamente limitado a $60000\text{ms}$ (nunca estoura o cap).
- **Critério de Aceite:** 1.000 amostras simuladas para cada tentativa sem nenhuma violação de intervalo.

### Passo 1.5: Prova Estatística de Des-correlação e De-sincronização
- **Ação:** Simular 10.000 clientes reconectando na tentativa 3 (intervalo $[0, 8000\text{ms}]$).
- **Critério de Aceite:** A distribuição das 10.000 amostras deve se espalhar uniformemente ao longo dos 8 segundos. O coeficiente de variação e a divisão em buckets de 500ms comprovam ausência de concentração ou pico sincronizado.

### Passo 1.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-1-full-jitter.mjs`.
- **Critério de Aceite:** Suíte executada com 100% de sucesso (Exit code 0) antes de autorizar a Subetapa 2.
