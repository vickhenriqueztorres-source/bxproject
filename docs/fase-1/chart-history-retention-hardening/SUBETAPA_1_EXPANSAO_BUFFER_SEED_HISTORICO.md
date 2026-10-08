# Subetapa 1: Ampliação do Ring Buffer e Seed Profundo de Velas (24h a 48h)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`  
**Invariantes:** V-04 (OHLCV Idempotente) | V-05 (Isolamento de Ativos) | V-06 (Conformidade Ticks x Candles)

---

## 1. Escopo e Objetivos da Subetapa

Substituir o ring buffer truncado de 120 velas por um **buffer institucional de alta capacidade (1.440 a 2.880 velas de 1 minuto = 24h a 48h de histórico contínuo)** no motor de feed (`scripts/dev-live-feed.mjs`), acompanhado de um gerador de seed inicial com profundidade de 24 horas contínuas baseado em processos estocásticos Ornstein-Uhlenbeck:
- **Teto do Ring Buffer:** Elevado de `120` para `MAX_BUFFER_CANDLES = 2880` (48 horas).
- **Seed Inicial:** Elevado de `80` para `INITIAL_SEED_CANDLES = 1440` (24 horas completas).
- **Consumo de Memória:** $\approx 103.680$ objetos somando todos os 36 ativos ($\approx 10.5\text{ MB}$ de heap V8), perfeitamente seguro e sem risco de GC pauses ou OOM.

---

## 2. Passos de Execução Obrigatórios

### Passo 1.1: Parametrização e Constantes Globais de Capacidade
- **Ação:** No topo do motor de feed (`scripts/dev-live-feed.mjs`), introduzir as constantes canônicas de capacidade:
  ```javascript
  const CANDLE_BUFFER_MAX_SIZE = 2880; // 48 horas em velas de 1 minuto
  const CANDLE_BUFFER_INITIAL_SEED = 1440; // 24 horas de histórico no arranque
  ```
- **Critério de Aceite:** Constantes declaradas e exportadas, eliminando números mágicos (`80` e `120`) do código.

### Passo 1.2: Expansão do Gerador Determinístico de Velas (`generateSeededHistoricalCandles`)
- **Ação:** Atualizar o loop gerador para sintetizar 1.440 minutos retroativos a partir de `Date.now()`, alinhando cada bucket ao segundo zero UTC (`Math.floor(t / 60) * 60`).
- **Propriedades Exigidas:**
  1. Caminho estocástico de Ornstein-Uhlenbeck mantendo ancoragem em $\mu$ (preço base do ativo).
  2. Invariante OHLC em cada vela: $\text{low} \le \min(\text{open}, \text{close}) \le \max(\text{open}, \text{close}) \le \text{high}$.
  3. Preço de fechamento da vela $k$ exatamente igual ao preço de abertura da vela $k+1$ ($\text{close}_k = \text{open}_{k+1}$).
  4. Sequência temporal estritamente monotônica crescente.
- **Critério de Aceite:** 1.440 velas geradas em $<15\text{ms}$ por ativo sem gaps ou descontinuidades no preço.

### Passo 1.3: Atualização do Arranque dos 36 Ativos
- **Ação:** Na iteração de inicialização de `assetState`:
  ```javascript
  const initialCandles = generateSeededHistoricalCandles(
    item.symbol,
    item.price,
    item.precision,
    item.sigma,
    CANDLE_BUFFER_INITIAL_SEED
  );
  ```
- **Critério de Aceite:** Todos os 36 ativos iniciam com exatamente 1.440 velas carregadas no mapa de estado.

### Passo 1.4: Ampliação da Lógica de Manutenção do Buffer em Tempo Real
- **Ação:** Na agregação de novos ticks ao vivo (linha 936 de `scripts/dev-live-feed.mjs`):
  ```javascript
  state.candles.push(newBar);
  if (state.candles.length > CANDLE_BUFFER_MAX_SIZE) {
    state.candles.shift();
  }
  ```
- **Critério de Aceite:** O buffer aceita novas velas até 2.880 elementos antes de realizar o descarte FIFO da mais antiga.

### Passo 1.5: Suporte a Parâmetro `limit` Expandido no Endpoint REST
- **Ação:** No handler de `GET /candles` e `GET /api/candles`:
  ```javascript
  const rawLimit = parseInt(parsedUrl.searchParams.get('limit') || '500', 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 500 : rawLimit), CANDLE_BUFFER_MAX_SIZE);
  const data = state.candles.slice(-limit);
  ```
- **Critério de Aceite:** Endpoint atende requisições de `limit=500`, `limit=1000` ou `limit=1440` com status HTTP 200.

### Passo 1.6: Testes Automatizados da Subetapa
- **Ação:** Criar e executar teste unitário validando contagem de velas, ordenação temporal e tempo de arranque.
- **Critério de Aceite:** Teste passando 100% verde antes de avançar para a Subetapa 2.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Throughput e Memória):**
  - Gerar 1.440 velas para os 36 ativos simultaneamente. Medir tempo total de CPU ($< 200\text{ms}$) e consumo de RSS do processo Node.js ($< 120\text{MB}$).
- **Segurança (Validação de Limites):**
  - Disparar `GET /candles?symbol=EURUSD_OTC&limit=99999999`. O backend deve forçar o teto para `2880` sem estourar heap ou alocar memória indevida.
- **Caos (Restart Instantâneo):**
  - Reiniciar o processo de feed 10 vezes em rápida sucessão. A consistência das velas e o timestamp da última vela devem sempre coincidir com o minuto UTC atual.

---

## 4. Critérios de Aceite da Subetapa 1
- [ ] O seed inicial produz 1.440 velas para cada um dos 36 ativos no boot.
- [ ] O ring buffer suporta até 2.880 velas em RAM por ativo.
- [ ] Endpoint `/candles` responde requisições com `limit=1440` retornando 24 horas contínuas de barras.
- [ ] Zero impacto na latência do loop de ticks de 250ms/1s.
