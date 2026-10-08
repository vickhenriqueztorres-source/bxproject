# Subetapa 3: Motor de Resampling Sub-Milissegundo no Frontend (Zero-Latency Switch)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `chart-trading-engineer`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `06-testing-quality`, `11-chart-trading-tools`  
**Invariantes:** V-04 (OHLCV Idempotente) | V-11 (Taxa de Quadros Fixa a 60 FPS)

---

## 1. Escopo e Objetivos da Subetapa

Implementar um pipeline de **reamostragem instantânea em memória local ($< 1.5\text{ms}$)** no componente `PriceChart.tsx` e `candle-adapter.ts`:
- Quando o operador clica para mudar de timeframe (ex: de `1m` para `5m`, ou de `5m` para `15s`), o gráfico **NÃO faz uma nova requisição HTTP** se os dados base já estiverem em memória.
- A função pura `resampleCandles` converte instantaneamente o buffer existente em centésimos de milissegundo, atualizando a série visual do Lightweight Charts sem travar o event loop do navegador e sem qualquer piscada de tela (*zero flicker*).

---

## 2. Passos de Execução Obrigatórios

### Passo 3.1: Otimização Algorítmica do `resampleCandles` em `candle-adapter.ts`
- **Ação:** Refatorar a agregação de 5m para usar iteração direta de array de alta performance sem alocação repetitiva de Maps intermediários:
  ```typescript
  export function resampleCandlesFast(
    candles: Candle[],
    timeframe: Timeframe
  ): CandlestickData<UTCTimestamp>[]
  ```
- **Critério de Aceite:** Processamento de 10.080 barras de 1m convertidas em 2.016 barras de 5m em tempo medido $< 1.5\text{ms}$ de CPU no Chrome V8.

### Passo 3.2: Cache de Séries Reamostradas por Timeframe em `PriceChart.tsx`
- **Ação:** Manter um mapa em `useRef<Map<Timeframe, CandlestickData<UTCTimestamp>[]>>`:
  * Ao trocar para um timeframe já computado no mesmo ativo, a troca é instantânea ($0\text{ms}$).
  * Ao chegar um tick novo, apenas a última barra do timeframe ativo é invalidada/atualizada.
- **Critério de Aceite:** Troca de abas de tempo sem atraso de frame (*0 dropped frames*).

### Passo 3.3: Suporte a Sub-Minutos (5s, 15s, 30s) sem Distorção
- **Ação:** Garantir que a interpolação geométrica de sub-minutos preserva o preço exato de fechamento e respeita $\text{low} \le \text{open}, \text{close} \le \text{high}$.
- **Critério de Aceite:** Invariantes matemáticas 100% preservadas.

### Passo 3.4: Sincronização Instantânea dos 10 Indicadores Técnicos
- **Ação:** Quando o timeframe muda, recalcular SMA, EMA, RSI, Bollinger, etc. sobre a nova série reamostrada em $< 2\text{ms}$ usando typed arrays.
- **Critério de Aceite:** Os indicadores acompanham a troca de timeframe instantaneamente.

### Passo 3.5: Transição Visual Suave sem Salto Temporal
- **Ação:** Manter a posição temporal relativa visível através de `timeScale().setVisibleRange()` ou `scrollToRealTime()` conforme o modo de visualização.
- **Critério de Aceite:** Transição fluida e contínua.

### Passo 3.6: Teste de Benchmark de Performance
- **Ação:** Criar teste unitário medindo tempo de execução para 10.080 barras convertidas em 5m, 15s e 30s.
- **Critério de Aceite:** Execução em $< 2.5\text{ms}$ em todos os cenários.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Cliques Frenéticos de Timeframe):**
  - Usuário clica repetidamente em `1m -> 5m -> 15s -> 1m -> 5m` 50 vezes em 5 segundos. Zero memory leaks, zero travamentos da thread principal.
- **Segurança (Validação de Tipos Numéricos):**
  - Dados com valores malformados são sanitizados sem lançar exceções não tratadas no React.
- **Caos (Troca no Momento Exato de um Tick):**
  - O tick chega no mesmo milissegundo da troca de timeframe. O `RafChartUpdater` sincroniza atomicamente no frame seguinte.

---

## 4. Critérios de Aceite da Subetapa 3
- [ ] Reamostragem em memória local em $< 1.5\text{ms}$.
- [ ] Troca de timeframes instantânea sem novas requisições de rede desnecessárias.
- [ ] Indicadores técnicos recalculados e renderizados sem jank.
