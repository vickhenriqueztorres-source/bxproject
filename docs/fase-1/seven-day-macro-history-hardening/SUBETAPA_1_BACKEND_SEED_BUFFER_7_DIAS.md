# Subetapa 1: Seed & Ring Buffer de 7 Dias (10.080 minutos) no Backend

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`  
**Invariantes:** V-04 (OHLCV Idempotente) | V-05 (Isolamento de Ativos) | V-06 (Conformidade Ticks x Candles)

---

## 1. Escopo e Objetivos da Subetapa

Ampliar a capacidade de retenção contínua em RAM para **10.080 minutos de mercado (7 dias completos)** para todos os 36 ativos no motor de feed (`scripts/dev-live-feed.mjs`):
* `CANDLE_BUFFER_MAX_SIZE = 10080` (7 dias em velas de 1 minuto).
* `CANDLE_BUFFER_INITIAL_SEED = 10080` (geração de 10.080 barras determinísticas no boot).
* Otimização da busca retroativa por `before` com busca binária $O(\log N)$ para garantir tempo de resposta $< 1\text{ms}$.
* Consumo total de RAM: $\approx 10.080 \times 36 \text{ velas} \approx 36\text{ MB}$ (totalmente seguro para o processo Node.js).

---

## 2. Passos de Execução Obrigatórios

### Passo 1.1: Atualização das Constantes Globais de Retenção
- **Ação:** Atualizar no topo de `scripts/dev-live-feed.mjs`:
  ```javascript
  const CANDLE_BUFFER_MAX_SIZE = 10080; // 7 dias de velas de 1 minuto em RAM (10.080 minutos)
  const CANDLE_BUFFER_INITIAL_SEED = 10080; // 7 dias de histórico no arranque
  ```
- **Critério de Aceite:** Constantes aplicadas e exportadas.

### Passo 1.2: Otimização do Gerador Estocástico para 10.080 Minutos
- **Ação:** Garantir que o loop de `generateSeededHistoricalCandles` processe as 10.080 barras de forma ultra-rápida (tempo total para os 36 ativos $< 600\text{ms}$ no boot).
- **Critério de Aceite:** 10.080 velas geradas por ativo com tempo estritamente monotônico e invariantes $\text{low} \le \min(\text{open}, \text{close})$ e $\text{high} \ge \max(\text{open}, \text{close})$.

### Passo 1.3: Manutenção do Ring Buffer em 10.080 Velas
- **Ação:** Na chegada de novas velas ao vivo:
  ```javascript
  state.candles.push(newBar);
  if (state.candles.length > CANDLE_BUFFER_MAX_SIZE) {
    state.candles.shift();
  }
  ```
- **Critério de Aceite:** O buffer mantém exatamente as 10.080 barras mais recentes de cada ativo.

### Passo 1.4: Busca Binária O(log N) no Filtro Temporal por `before`
- **Ação:** Substituir o `.filter()` linear por uma busca binária que localiza o índice da primeira barra onde $\text{time} < \text{before}$ instantaneamente:
  ```javascript
  function findCutoffIndex(candles, beforeSec) {
    let low = 0, high = candles.length - 1, ans = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (candles[mid].time < beforeSec) {
        ans = mid;
        low = mid + 1; // Busca mais à direita
      } else {
        high = mid - 1;
      }
    }
    return ans;
  }
  ```
- **Critério de Aceite:** Corte executado em $< 0.05\text{ms}$.

### Passo 1.5: Suporte a `limit` Expandido de até 10.080 no Endpoint `/candles`
- **Ação:** Permitir requisições com `limit` de até 10.080 barras:
  ```javascript
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 1440 : rawLimit), CANDLE_BUFFER_MAX_SIZE);
  ```
- **Critério de Aceite:** Requisição `limit=10080` retorna a semana inteira com HTTP 200.

### Passo 1.6: Teste de Validação da Subetapa 1
- **Ação:** Executar script de teste validando que cada ativo possui 10.080 barras no arranque e que a busca binária funciona sem falhas.
- **Critério de Aceite:** 100% de sucesso antes de prosseguir para a Subetapa 2.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Throughput Máximo):**
  - 100 requisições simultâneas de `limit=5000`. O tempo de resposta p99 deve ser $< 20\text{ms}$.
- **Segurança (Sanitização e Memory Limits):**
  - Requisição com `limit=999999999` clampada automaticamente em 10.080 sem consumo excessivo de memória.
- **Caos (Restart Suave):**
  - Reinício do processo Node.js; tempo de boot para sintetizar os 36 ativos com 10.080 barras deve ser $< 1.5\text{s}$.

---

## 4. Critérios de Aceite da Subetapa 1
- [ ] 10.080 barras de 1 minuto em RAM para todos os 36 ativos.
- [ ] Alcance histórico de 7 dias completos ($10.080 \times 60 = 604.800$ segundos).
- [ ] Busca binária $O(\log N)$ para paginação retroativa.
- [ ] Teste automatizado 100% aprovado.
