# Subetapa 02 — Correção Cirúrgica de Abertura de Novo Gráfico (Sem Compressão à Esquerda / Imagem 1)

**Agentes Alocados**: `chart-trading-engineer`, `surgical-frontend-agent`, `qa-resilience-agent`, `regression-guardian-agent`  
**Skills Ativadas**: `01-project-context`, `03-synthetic-market-engine`, `06-testing-quality`, `11-chart-trading-tools`, `17-mudanca-cirurgica`  
**Status**: Planejada — Execução após validação 100% da Subetapa 01

---

## 1. Diagnóstico Preciso da Causa Raiz (Imagem 1)

1. **Condição de Corrida entre o 1º Tick WebSocket e o Carregamento HTTP de Velas (`getCandles`)**:
   - Em [`IsolatedChartHost.tsx:620-663`](file:///d:/brokerproject/apps/web/src/chart/IsolatedChartHost.tsx#L620-L663):
     - Quando o usuário abre uma nova aba (ex.: `EUR/USD` = `EURUSD_OTC`), no **Render 1 (`t = 0ms`)**, `candlesQuery.data` ainda está buscando (`candles = []`). `symbolChanged` é `true`, `prevSymbolRef.current` é atualizado para `'EURUSD_OTC'` e `hadBarsRef.current = false`.
     - No **Render 2 (`t ~ 40ms`)**, chega 1 tick ao vivo para `EURUSD_OTC` antes da resposta HTTP de `getCandles`. `PriceChart.tsx:314-350` gera `resampledCandles` com `1` única barra a partir de `observed.current.bars`. Em `IsolatedChartHost`, `wasEmpty` é `true` e `cleanBars.length === 1 > 0`. O host define `hadBarsRef.current = true` e chama `scrollToRealTime()` sobre um dataset de **1 única barra** (posicionando o `visibleLogicalRange` no índice `0..1`).
     - No **Render 3 (`t ~ 250ms`)**, `getCandles('EURUSD_OTC', '1m')` retorna 1.440 / 2.880 velas históricas! `candleSeries.setData(cleanBars)` substitui a 1 barra por 1.440 barras. Porém, na linha 656:
       ```ts
       if (symbolChanged || timeframeChanged || (wasEmpty && cleanBars.length > 0))
       ```
       - `symbolChanged` é `false` (já mudou no Render 1);
       - `timeframeChanged` é `false`;
       - `wasEmpty` (`!hadBarsRef.current`) é `false` (pois o Render 2 tinha 1 barra!).
     - Resultado: `scrollToRealTime()` e o ajuste de viewport **NÃO são executados** quando o histórico real chega! O Lightweight Charts mantém a janela lógica ancorada perto do índice `0` (as primeiras barras históricas na extrema esquerda) ou espreme toda a série no canto esquerdo com um enorme vazio à direita (exatamente como na Imagem 1), só voltando ao normal segundos depois quando um evento secundário força o reenquadramento!

2. **Proteção Adicional em `PriceChart.tsx`**:
   - Em [`PriceChart.tsx:314-350`](file:///d:/brokerproject/apps/web/src/chart/PriceChart.tsx#L314-L350), quando `effectiveCandles` está vazio (`length === 0`) e o histórico HTTP ainda não chegou, emitir 1 única barra isolada de `observed.current.bars` para `setData` antes das velas históricas distorce a escala de tempo inicial.

---

## 2. Passo a Passo Cirúrgico da Implementação

### Passo 2.1 — Rastreamento de Hidratação de Histórico Completo em `IsolatedChartHost.tsx`
- Adicionar `prevBarCountRef = useRef<number>(0)` e `historyScrolledKeyRef = useRef<string>('')` em `IsolatedChartHost.tsx`.
- Ao trocar `symbol` ou `timeframe`, resetar `prevBarCountRef.current = 0` e `historyScrolledKeyRef.current = ''`.
- Detectar **`historyJustHydrated`**:
  - Ocorre quando `cleanBars.length >= 5` e (`prevBarCountRef.current < 5` ou `historyScrolledKeyRef.current !== `${symbol}:${timeframe}``).
- Quando `symbolChanged || timeframeChanged || (wasEmpty && cleanBars.length > 0) || historyJustHydrated`:
  1. Se `cleanBars.length >= 5`, marcar `historyScrolledKeyRef.current = `${symbol}:${timeframe}``.
  2. Chamar `chartRef.current.priceScale('right').applyOptions({ autoScale: true })`.
  3. Posicionar imediatamente a janela lógica visível nas últimas ~65 velas (`from: Math.max(0, cleanBars.length - 65), to: cleanBars.length + 3`) e invocar `chartRef.current.timeScale().scrollToRealTime()`.
  4. Atualizar `prevBarCountRef.current = cleanBars.length`.

### Passo 2.2 — Sincronização de Reset e Re-Ancoragem Instantânea em `PriceChart.tsx`
- Em `PriceChart.tsx`:
  - No `useEffect` que reage a `[resampledCandles, symbol, selectedCandleStepSec, chartType]` (`PriceChart.tsx:861-891`), hoje o código só re-ancora quando `prevResetKeyRef.current !== resetKey` e `resampledCandles.length > 0`. Se no primeiro render `resampledCandles.length === 1` (apenas 1 tick observado antes do HTTP), `prevResetKeyRef.current` já era consumido com 1 barra!
  - Ajustar a condição para que `prevResetKeyRef.current` só seja dado como "definitivamente hidratado" quando `resampledCandles.length >= 5` (ou re-executar o enquadramento `setVisibleLogicalRange` + `scrollToRealTime()` assim que `resampledCandles.length` saltar de `< 5` para `>= 5`).

---

## 3. Plano de Testes (Unitários, Estresse, Segurança e Caos)

Arquivo de teste dedicado: `apps/web/src/chart/subetapa-02-new-chart-tab-viewport-scale.unit.test.tsx`

1. **Teste Unitário 2.1 (Transição 0 -> 1 Tick -> 1440 Velas Históricas em Nova Aba `EURUSD_OTC`)**:
   - Simula a abertura de uma nova aba onde chega primeiro 1 barra de tick ao vivo e em seguida 1.440 velas históricas: comprova que `scrollToRealTime()` e `autoScale: true` são disparados na chegada do lote histórico, nunca deixando o gráfico preso no índice 0 à esquerda.
2. **Teste Unitário 2.2 (Determinismo da Decisão de Re-Escala na Hidratação)**:
   - Valida a função pura `shouldReanchorViewportOnDataUpdate({ symbolChanged, timeframeChanged, prevBarCount, nextBarCount, historyAlreadyHydrated })` em todos os cenários (troca de ativo, troca de timeframe, 1 tick -> histórico completo, updates normais de ticks subsequentes sem roubar o pan manual do usuário).
3. **Teste de Caos 2.3 (Timestamps Fora de Ordem, Velas Duplicadas e Gaps de Fim de Semana)**:
   - Injeta lotes de velas com timestamps fora de ordem, duplicados ou com gap de horas e verifica que `sanitizeCandles` + re-ancoragem produzem uma janela lógica final válida sem NaN ou compressão.
4. **Teste de Segurança 2.4 (Imunidade a Valores Numéricos Corrompidos / Infinity / NaN)**:
   - Injeta preços `NaN`, `Infinity`, `-100` e verifica que o pipeline descarta barras inválidas antes de tocar na escala do gráfico.
5. **Teste de Estresse 2.5 (100 Trocas Rápidas de Abas de Ativos com 1.500 Velas Cada)**:
   - Simula 100 aberturas/alternâncias consecutivas de abas (`VOL_50` <-> `EURUSD_OTC` <-> `GBPUSD_OTC` <-> `BTCUSD`) processando 1.500 velas por aba em `< 300ms`.
