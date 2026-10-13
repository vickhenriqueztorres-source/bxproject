# Subetapa 01: Normalização de Escala, Sementes Coerentes e Prevenção de Velas Gigantes e Gaps

**Responsável:** `chart-trading-engineer` & `broker-architect-agent`  
**Revisor:** `financial-correctness-reviewer` & `qa-resilience-agent`  
**Executor Cirúrgico:** `surgical-frontend-agent`  
**Garantia:** "NUNCA IMPLEMENTAR NADA SEM TESTES ROBUSTOS"

---

## 1. Problema Abordado (Problema 2 do Operador)
Quando um operador abre um novo gráfico ou troca de ativo na plataforma:
1. **Vela Enorme**: Ocorre quando a série de velas em semente (`generateSeedCandles`) termina num valor $P_{seed}$ arbitrário e chega um tick com preço de mercado $P_{real}$. O método `candleFromTick` mescla $P_{seed}$ e $P_{real}$, inflando a vela em centenas de pontos percentuais.
2. **Gap Enorme**: Ocorre por descontinuidade temporal entre o timestamp do seed e o primeiro tick real, gerando buracos visuais.
3. **Pequeno Demais (Microscópico)**: Ocorre porque o canvas reutilizado mantém o range vertical do ativo anterior (ex: BTCUSD a \$64.000 vs EURUSD a 1.0850) sem acionar o reset automático de autoscale (`rightPriceScale.applyOptions({ autoScale: true })` e `timeScale.fitContent()`).

---

## 2. Passo a Passo de Implementação

### Passo 1: Criação da Suíte de Testes Unitários e Estresse (TDD Primeiro)
- **Arquivo**: `apps/web/src/chart/chart-scale-normalizer.unit.test.ts`
- **Casos de Teste Obrigatórios**:
  - `NORM-01`: Normalização suave de semente quando o tick real difere da semente (elimina deformação de pavio/vela gigante).
  - `NORM-02`: Detecção e clamp de anomalia de escala em troca abrupta de ativos (ex: BTC 64.000 -> EURUSD 1.0854).
  - `NORM-03`: Alinhamento contíguo de timestamp entre semente e ticks para eliminar gap temporal.
  - `NORM-04`: Teste de Estresse com 5.000 ticks com variações estocásticas extremas e validação de que nenhuma vela excede amplitude máxima permitida.
  - `NORM-05`: Teste de Caos simulando ticks fora de ordem e saltos de preço irracionais (spikes).

### Passo 2: Implementação do Módulo Normalizador
- **Arquivo**: `apps/web/src/chart/chart-scale-normalizer.ts`
- Funções essenciais:
  - `normalizeSeedWithTick(candles: Candle[], tick: Tick | null): Candle[]`
  - `safeCandleFromTick(tick: Tick, previous: CandlestickData<UTCTimestamp> | null, timeframe: Timeframe): CandlestickData<UTCTimestamp> | null`
  - `enforceViewportAutoscale(chart: IChartApi, series: ISeriesApi<any>): void`

### Passo 3: Integração no `IsolatedChartHost.tsx` e `PriceChart.tsx`
- No `IsolatedChartHost.tsx`:
  - Ao receber novo `symbol`, forçar `rightPriceScale().applyOptions({ autoScale: true })` e `timeScale().fitContent()`.
- No `PriceChart.tsx`:
  - Usar `normalizeSeedWithTick` e `safeCandleFromTick` para garantir continuidade física dos dados.

### Passo 4: Execução e Validação dos Testes
- Rodar `npx vitest run apps/web/src/chart/chart-scale-normalizer.unit.test.ts`.
- Validar se 100% dos testes passam antes de avançar para a Subetapa 02.
