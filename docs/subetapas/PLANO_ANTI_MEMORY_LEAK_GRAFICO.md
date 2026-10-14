# Plano Cirúrgico de Diagnóstico, Blindagem e Certificação Anti-Memory Leak (Lightweight Charts)

**Agente Líder:** `chart-trading-engineer`  
**Agente Executor:** `surgical-frontend-agent` (`cirurgiao`)  
**Guardião de Regressão & QA:** `regression-guardian-agent` / `qa-resilience-agent`  
**Skills Ativadas:** `11-chart-trading-tools`, `17-mudanca-cirurgica`, `06-testing-quality`

---

## 1. Diagnóstico Forense do Código Atual (O Que Já Está Certo vs. O Que Vaza Memória)

Analisamos 100% da camada gráfica (`IsolatedChartHost.tsx`, `PriceChart.tsx`, `TradingViewCanvas.tsx`, `ChartDrawingOverlay.tsx`, `OrderFlagsOverlay.tsx`, `TimeLinesOverlay.tsx`, `raf-updater.ts` e `TradingFeedManager.ts`) contra os problemas clássicos de **Memory Leak do TradingView Lightweight Charts (Issues #1507 e #1359)**:

> *"The most common source of memory leaks occurs when the chart widget is removed, but its resources are not fully released because your code holds a reference to it."*

### ✅ O Que Já Estava Correto no Projeto
1. **`IsolatedChartHost.tsx` (Linhas 262–272):**
   - Chama `resizeObserver.disconnect()`, remove listeners `webglcontextlost` / `webglcontextrestored`, invoca `chart.remove()` e anula `chartRef.current = null`, `candleSeriesRef.current = null` e `areaSeriesRef.current = null`.
2. **`OrderFlagsOverlay.tsx` (Linhas 46–50):**
   - Desinscreve `timeScale.unsubscribeVisibleTimeRangeChange(handleRangeChange)` protegido por `try/catch`.
3. **`useVisibilityPause.ts` & `useTickPulse.ts`:**
   - Desconectam `IntersectionObserver`, removem `visibilitychange` e limpam `clearTimeout` no unmount.

---

### 🚨 Os 6 Vetores de Memory Leak Encontrados na Auditoria

| ID | Arquivo | Linhas | Descrição Técnica do Vazamento (Causa Raiz) | Impacto após Horas de Uso |
| :--- | :--- | :--- | :--- | :--- |
| **ML-01** | `TradingViewCanvas.tsx` | 57–97, 125–143 | Chama `chart.remove()` no cleanup, **mas mantém referências retidas** em `chartRef.current`, `seriesRef.current` e `priceLineRef.current` (caso clássico da Issue #1359). Além disso, `loadHistory()` faz `fetch` assíncrono sem flag `cancelled`, podendo chamar `candlestickSeries.setData()` num gráfico já removido. | Retenção da instância inteira do `IChartApi`, canvas DOM detached e buffers internos na heap a cada troca de ativo ou unmount. |
| **ML-02** | `PriceChart.tsx` | 312–326, 190, 678 | No unmount do `PriceChart`, `observed.current.bars` (que armazena até `42.000` barras de 5s) e `observed.current.pending` **não são limpos (`.clear()`)**, e `rafUpdaterRef.current.reset()` não é chamado (apenas `cancel()`), mantendo `symbolSequences` na memória. Além disso, `indicatorSeriesMap` não remove as séries antes do `.clear()`. | Dezenas de milhares de objetos `CandlestickData` retidos em closures após desmontagem de células em Multi-Chart (`2x2`, `3x2`). |
| **ML-03** | `PriceChart.tsx` | 85, 740–788 | `strikeLinesMap` guarda `IPriceLine`, mas não registra em qual série (`candleSeries` vs `areaSeries`) a linha foi criada. Se o usuário alterna `chartType` (`candles` ↔ `line`) com ordens abertas, `activeSeries.removePriceLine(line)` tenta remover da série errada e a linha de strike fica **órfã eternamente** na série anterior. | Acúmulo infinito de `IPriceLine` órfãs no motor interno de renderização do Lightweight Charts. |
| **ML-04** | `PriceChart.tsx` | 351–439 | O efeito de `subscribeVisibleLogicalRangeChange` depende de `internalCandles`, reinscrevendo a closure a cada atualização de histórico. Além disso, o `setTimeout` assíncrono de `fetchHistoricalCandlesChunk` não checa flag `cancelled` no cleanup antes de invocar `setInternalCandles`. | Múltiplas reinscrições no `timeScale` e risco de atualização de estado e retenção de arrays de 3.500 velas após unmount. |
| **ML-05** | `IsolatedChartHost.tsx` & `ChartDrawingOverlay.tsx` | 262–272 / 60–70 | Em `IsolatedChartHost.tsx`, `latestCandlesRef.current` continua retendo o array de até 3.500 velas após unmount, e `chart.remove()` não está protegido por `try/catch`. Em `ChartDrawingOverlay.tsx`, `unsubscribeVisibleTimeRangeChange` não possui `try/catch` caso o chart já tenha sofrido dispose no mesmo ciclo de unmount. | Retenção do array `latestCandlesRef` e potencial interrupção da pilha de cleanup do React se o canvas já estiver disposto. |
| **ML-06** | `TradingFeedManager.ts` | 219–226, 364–396 | Quando um ativo entra em `symbolResyncing = true`, todos os ticks recebidos via WS vão para `symbolTickBuffers`. Se a rede oscilar ou o snapshot atrasar por horas, o buffer não possui teto máximo (`MAX_RESYNC_BUFFER_SIZE = 500`) nem timeout de segurança para liberar o estado `symbolResyncing`. | Crescimento contínuo de arrays de ticks em memória durante instabilidades prolongadas de rede. |

---

## 2. Plano de Correção Cirúrgica (Orçamento Estrito, Zero Regressão)

Seguindo a skill `17-mudanca-cirurgica`:
- **Nenhuma assinatura pública, prop ou comportamento visual será alterado.**
- **Apenas blindagem de cleanup, liberação de referências (`null` / `.clear()`) e tetos de memória.**

### Passo 1: Blindagem de `IsolatedChartHost.tsx` e `ChartDrawingOverlay.tsx` (ML-05)
1. Em `IsolatedChartHost.tsx`:
   - Envolver `chart.remove()` em `try { chart.remove(); } catch { /* ignore */ }` no cleanup do `useEffect`.
   - Limpar `latestCandlesRef.current = []` no cleanup do unmount para liberar imediatamente o array de velas da heap.
2. Em `ChartDrawingOverlay.tsx`:
   - Envolver `timeScale.subscribeVisibleTimeRangeChange` e `timeScale.unsubscribeVisibleTimeRangeChange` em `try/catch` defensivo (idêntico ao `OrderFlagsOverlay.tsx`).

### Passo 2: Blindagem de `PriceChart.tsx` (ML-02, ML-03, ML-04)
1. **Rastreamento exato da série nas linhas de strike (`ML-03`):**
   - Alterar `strikeLinesMap` para guardar `{ line: IPriceLine; series: ISeriesApi<any> }` (ou remover de ambas `candleSeries` e `areaSeries` + da série registrada), e ao alternar `chartType`, recriar as linhas de strike na série ativa após removê-las da série anterior.
2. **Desmontagem Total sem Referências Órfãs (`ML-02`):**
   - No cleanup de unmount do `PriceChart`, remover explicitamente todas as `strikeLinesMap`, todas as séries de `indicatorSeriesMap` via `chart.removeSeries(s)`, executar `observed.current.bars.clear()`, `observed.current.pending.clear()`, e chamar `rafUpdaterRef.current.reset()`.
3. **Estabilização do Listener de Scroll Retroativo (`ML-04`):**
   - Usar `internalCandlesRef` para ler o candle mais antigo dentro de `onVisibleLogicalRangeChanged` sem precisar reinscrever o listener no `timeScale` a cada mudança de `internalCandles`, e adicionar flag `let cancelled = false` no cleanup para abortar atualizações pós-unmount.

### Passo 3: Blindagem de `TradingViewCanvas.tsx` (ML-01)
1. Adicionar flag `let cancelled = false` no `useEffect([symbol])` para impedir que `loadHistory()` chame `setData()` se o componente já desmontou ou mudou de ativo.
2. No cleanup do `useEffect`:
   - Remover `priceLineRef.current` da série se existir (`seriesRef.current?.removePriceLine(priceLineRef.current)`).
   - Chamar `try { chart.remove(); } catch {}`.
   - Anular explicitamente `priceLineRef.current = null`, `seriesRef.current = null` e `chartRef.current = null`.

### Passo 4: Teto de Buffer de Resync em `TradingFeedManager.ts` (ML-06)
1. Limitar `symbolTickBuffers` a no máximo `MAX_RESYNC_BUFFER_SIZE = 500` ticks por símbolo (descartando o mais antigo via `shift()` se exceder) e garantir que, se o snapshot REST falhar, `symbolResyncing.set(symbol, false)` e `symbolTickBuffers.delete(symbol)` sejam limpos no `finally`/fallback para nunca travar em modo acumulação infinita.

---

## 3. Bateria de Testes de Certificação Anti-Memory Leak

Criaremos a suíte dedicada `tests/unit/chart-memory-leak-lifecycle.unit.test.ts` testando:
1. **Ciclo de 100 Mount/Unmount consecutivos (`IsolatedChartHost` / `TradingViewCanvas` / `PriceChart`):**
   - Verifica que `chart.remove()` é chamado exatamente 100 vezes, `ResizeObserver.disconnect()` 100 vezes, e todas as refs (`getChart()`, `getActiveSeries()`, `getCandleSeries()`, `getAreaSeries()`) retornam `null` após o unmount.
2. **Transição de `chartType` (`candles` ↔ `line`) com Contratos Abertos (`strikeLinesMap`):**
   - Verifica que 0 linhas de strike ficam órfãs na série anterior ao alternar o tipo de gráfico ou liquidar contratos.
3. **Limpeza de Buffers Observados e rAF no Unmount:**
   - Verifica que `observed.bars`, `observed.pending` e `RafChartUpdater` zeram completamente após o unmount.
4. **Teto de Memória no `TradingFeedManager` durante Resync Prolongado:**
   - Injeta 5.000 ticks durante estado de gap/resync e comprova que o buffer nunca ultrapassa o teto de segurança e drena corretamente.
