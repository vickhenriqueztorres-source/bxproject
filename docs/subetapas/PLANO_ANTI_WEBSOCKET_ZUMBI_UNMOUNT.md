# Plano Cirúrgico de Diagnóstico, Blindagem e Certificação Contra WebSocket e Loops de Streaming Rodando Após Unmount (Issues #1341 / #1351)

**Agente Líder:** `chart-trading-engineer` & `frontend-realtime-agent`  
**Agente Executor:** `surgical-frontend-agent` (`cirurgiao`)  
**Guardião de Regressão & QA:** `regression-guardian-agent` / `qa-resilience-agent`  
**Skills Ativadas:** `03-synthetic-market-engine`, `11-chart-trading-tools`, `17-mudanca-cirurgica`, `06-testing-quality`

---

## 1. Diagnóstico Forense do Código Atual (Por que ocorre `Cannot read properties of null (reading 'getContext')` — Issues #1341 / #1351)

Auditamos o ciclo de vida completo entre o gerenciador WebSocket (`TradingFeedManager.ts`, `use-feed.ts`), o motor de batching em `requestAnimationFrame` (`RafChartUpdater` em `PriceChart.tsx`) e os componentes de canvas (`IsolatedChartHost.tsx` e `TradingViewCanvas.tsx`).

> **O que acontece (Issues #1341 / #1351):** O componente desmonta e destrói o `<canvas>` interno via `chart.remove()`, mas um callback assíncrono remanescente (mensagem WebSocket em voo, `fetch` de snapshot/histórico resolvendo atrasado, `setTimeout` inicial ou `requestAnimationFrame` pendente) tenta chamar `series.update()`, `series.setData()`, `createPriceLine()` ou `chart.timeScale()` na instância já descartada, disparando `Uncaught TypeError: Cannot read properties of null (reading 'getContext')`.

### 🚨 Os 5 Vetores Encontrados na Auditoria

| ID | Arquivo | Linhas | Causa Raiz Técnica Encontrada | Risco / Sintoma |
| :--- | :--- | :--- | :--- | :--- |
| **WS-01** | `IsolatedChartHost.tsx` & `PriceChart.tsx` | 23–41, 296–305, 1359 | `PriceChart.tsx` passa `onChartDispose={handleChartDispose}` para `<IsolatedChartHost />`, mas `IsolatedChartHost.tsx` **não declarava nem invocava `onChartDispose`** antes de `chart.remove()`. | Quando `IsolatedChartHost` executa `chart.remove()`, `PriceChart` não era notificado sincronicamente para cancelar o `RafChartUpdater` e anular `chartInstance.current` / `candleSeries.current`. |
| **WS-02** | `IsolatedChartHost.tsx` | 309–368, 412–425 | Os `useEffect` de atualização de `candles`, `chartType`, `timeframe` e o listener `visibilitychange` chamam `setData()`, `applyOptions()` e `scrollToRealTime()` sem flag `isDisposedRef` e sem `try/catch` em todos os ramos. | Qualquer atualização disparada na mesma batida de desmontagem tenta acessar o contexto 2D/WebGL já nulo (`getContext` of `null`). |
| **WS-03** | `TradingViewCanvas.tsx` | 127–171 | `seriesRef.current.update(...)` no efeito de `lastTick` e `createPriceLine`/`removePriceLine` no efeito de `activeContractPrice` não possuíam trava `isDisposedRef` nem `try/catch`. | Ticks WebSocket que chegam no exato instante do unmount chamam `.update()` num gráfico removido. |
| **WS-04** | `TradingFeedManager.ts` | 76–80, 363, 367–399, 510–520 | 1) `subscribeSymbol` agenda um `setTimeout(..., 0)` para emitir tick inicial sem cancelá-lo no `unsubscribe()` e sem checar se o callback ainda está inscrito. 2) `triggerSnapshotRebuild` faz `await fetch(...)` e, ao resolver, emite snapshot mesmo se o símbolo já sofreu `unsubscribe` ou `disconnect()` durante o voo HTTP. 3) O `setTimeout` de `initialDelay` em `connect()` não era salvo em `reconnectTimer`. | Callbacks de tick/snapshot são disparados para componentes já desmontados; conexões WebSocket podem abrir mesmo após `disconnect()`. |
| **WS-05** | `use-feed.ts` | 16–39 | Os callbacks registrados em `tradingFeedManager` (`onStatusChange`, `onSymbolStaleness`, `subscribePrivate`, `subscribeSymbol`) não verificavam flag `mounted` antes de invocar `setState`. | Re-renders fantasmas e warnings/erros em transições rápidas de página (ex: sair de `/` para `/ajustes` ou `/login`). |

---

## 2. Plano de Correção Cirúrgica (Orçamento Estrito, Zero Regressão)

Seguindo a skill `17-mudanca-cirurgica` (máximo de 5 arquivos de produção, sem alterar contratos públicos e mantendo 100% dos testes existentes verdes):

### Passo 1: Sincronização de Descarte em `IsolatedChartHost.tsx` (WS-01 e WS-02)
1. Adicionar `onChartDispose?: () => void;` em `IsolatedChartHostProps` e invocá-lo no cleanup do `useEffect` de mount **imediatamente antes** de `chart.remove()`.
2. Adicionar `isDisposedRef = useRef(false)` (marcado como `true` no início do cleanup de unmount).
3. Proteger todos os efeitos (`candles`, `symbol`, `chartType`, `timeframe`, `ResizeObserver`, `postMountRafId`, `visibilitychange`) com `if (isDisposedRef.current) return;` e blocos `try/catch`.

### Passo 2: Trava de Ciclo de Vida no Streaming Loop de `PriceChart.tsx` (WS-01)
1. Adicionar `isMountedRef = useRef(true)` (marcado como `false` no unmount e no `handleChartDispose`).
2. No callback de renderização do `rafUpdaterRef.current.push(tick, ...)`, abortar imediatamente no topo se `!isMountedRef.current || !chartInstance.current`.

### Passo 3: Blindagem Pós-Unmount em `TradingViewCanvas.tsx` (WS-03)
1. Adicionar `isDisposedRef = useRef(false)` (marcado como `true` no cleanup antes de `chart.remove()`).
2. Proteger `loadHistory`, `handleResize`, `useEffect([lastTick])` (`seriesRef.current.update`) e `useEffect([activeContractPrice])` (`createPriceLine`/`removePriceLine`) com `if (isDisposedRef.current) return;` e `try/catch`.

### Passo 4: Cancelamento Determinístico de Timers e In-Flight Snapshots em `TradingFeedManager.ts` e `use-feed.ts` (WS-04 e WS-05)
1. Em `TradingFeedManager.subscribeSymbol`: armazenar a referência do `setTimeout` inicial, limpá-la com `clearTimeout` dentro da função de `unsubscribe()` retornada, e validar `if (this.closed || !this.symbolSubscribers.get(symbol)?.has(callback)) return;` antes de invocar `callback`.
2. Em `TradingFeedManager.triggerSnapshotRebuild`: após o `await fetch(...)`, verificar `if (this.closed || !this.symbolSubscribers.has(symbol))` e abortar sem disparar `applySnapshotAndDrainBuffer` nem `sendSubscribe`.
3. Em `TradingFeedManager.applyTick` e `applySnapshotAndDrainBuffer`: abortar se `this.closed`, iterar sobre cópia segura `Array.from(callbacks)` verificando `callbacks.has(cb)` e isolar cada `cb(...)` com `try/catch`.
4. Em `TradingFeedManager.connect`: armazenar o timer de `initialDelay` em `this.reconnectTimer` para que `disconnect()` o cancele.
5. Em `use-feed.ts`: adicionar guarda `let mounted = true` (e `mounted = false` no cleanup) em todos os listeners do WebSocket.

---

## 3. Bateria de Testes Automatizados de Certificação (`tests/unit/chart-websocket-unmount-guard.test.ts`)

1. **`WS-UNMOUNT-01` (`IsolatedChartHost` + `PriceChart` — Rajada de Ticks WebSocket e rAF durante e após Unmount):**
   - Simula o `chart.remove()` destruindo o contexto interno do canvas (qualquer chamada subsequente a `series.update`, `series.setData`, `createPriceLine` ou `timeScale` lança `TypeError: Cannot read properties of null (reading 'getContext')`).
   - Dispara ticks em tempo real e frames `requestAnimationFrame` após o unmount e comprova **zero chamadas ao gráfico destruído e zero exceções**.
2. **`WS-UNMOUNT-02` (`TradingViewCanvas` — Ticks tardios, Fetch lento e Resize após Unmount):**
   - Desmonta `TradingViewCanvas` com `fetch` de histórico em voo e dispara ticks (`lastTick`) e `activeContractPrice` após o unmount; comprova que o chart removido nunca é tocado.
3. **`WS-UNMOUNT-03` (`TradingFeedManager` — Cancelamento de `subscribeSymbol`, Snapshot em voo e `disconnect()`):**
   - Comprova que ao chamar `unsubscribeSymbol()` ou `disconnect()`, nenhum callback de tick (nem `setTimeout` inicial, nem `triggerSnapshotRebuild` assíncrono, nem `onmessage` do WebSocket) é entregue ao componente desmontado, e que o frame `{ type: 'unsubscribe', symbol }` é enviado quando o último assinante sai.

---

## 4. Certificação de Implementação e Testes (`43/43 PASS`)

- `tests/unit/chart-websocket-unmount-guard.test.ts`: **3/3 PASS** (`WS-UNMOUNT-01`, `WS-UNMOUNT-02`, `WS-UNMOUNT-03`)
- `tests/unit/chart-zero-dimension-guard.test.ts`: **3/3 PASS**
- `tests/unit/chart-memory-leak-lifecycle.test.ts`: **4/4 PASS**
- `tests/unit/chart-boot-gap.test.ts`: **6/6 PASS**
- `tests/unit/chart-tail-hydration.test.ts`: **6/6 PASS**
- `apps/web/src/chart/isolated-chart-host.unit.test.ts`: **13/13 PASS**
- `apps/web/src/chart/chart-sandbox.unit.test.tsx`: **4/4 PASS**
- `apps/web/src/chart/pricechart-decoupling.unit.test.tsx`: **4/4 PASS**
