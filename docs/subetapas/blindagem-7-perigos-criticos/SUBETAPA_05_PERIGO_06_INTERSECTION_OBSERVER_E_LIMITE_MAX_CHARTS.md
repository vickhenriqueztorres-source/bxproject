# Subetapa 05 — Perigo 6: Virtualização por `IntersectionObserver` e Limite de 6 Charts Simultâneos no Frontend

**Agentes**: `chart-trading-engineer`, `surgical-frontend-agent`, `regression-guardian-agent`  
**Skills**: `11-chart-trading-tools`, `17-mudanca-cirurgica`, `06-testing-quality`

---

## 1. Problema Identificado
1. **Técnica 3 (Limite de 4–6 charts simultâneos)**: Não há controle de contagem máxima de gráficos montados simultaneamente (`MAX_CONCURRENT_CHARTS = 6`) no `TradingFeedManager` / `IsolatedChartHost`.
2. **Técnica 5 (Lazy loading / `IntersectionObserver`)**: [`PriceChart.tsx`](file:///d:/brokerproject/apps/web/src/chart/PriceChart.tsx) aceita a prop manual `isVisible`, mas não observa automaticamente a visibilidade real do container via `IntersectionObserver` para pausar renders de canvas quando o gráfico sai da viewport.

## 2. Passo a Passo Cirúrgico
1. **Controle de Limite de Charts Simultâneos (`MAX_CONCURRENT_CHARTS = 6`)**:
   - Em [`TradingFeedManager.ts`](file:///d:/brokerproject/apps/web/src/feed/TradingFeedManager.ts), adicionar registro de instâncias de gráficos ativos (`registerChartInstance(chartId)` / `unregisterChartInstance(chartId)` / `getActiveChartCount()` / `MAX_CONCURRENT_CHARTS = 6`), emitindo aviso e impedindo sobrecarga acima do teto.
   - Integrar em [`IsolatedChartHost.tsx`](file:///d:/brokerproject/apps/web/src/chart/IsolatedChartHost.tsx) com cleanup garantido no `unmount`.
2. **`IntersectionObserver` Automático em `PriceChart.tsx`**:
   - Observar `chartContainerRef.current` com `IntersectionObserver` (quando disponível no ambiente browser) para atualizar `isViewportVisibleRef.current`.
   - Combinar `isVisible && isViewportVisibleRef.current`: quando o gráfico está fora da viewport, o loop de `requestAnimationFrame` guarda apenas o último candle pendente em `pendingCandleRef.current` sem forçar repaint de GPU; assim que volta para a viewport, aplica imediatamente o candle mais recente no `rAF` e desconecta o `IntersectionObserver` no unmount.

## 3. Testes Obrigatórios (Estresse, Caos e Segurança)
- Montar 6 gráficos simultâneos → permitido; tentar registrar o 7º gráfico → bloqueado/sinalizado pelo guard `MAX_CONCURRENT_CHARTS = 6`; desmontar 1 gráfico → libera vaga imediatamente (zero leak).
- Simular saída e retorno de viewport no `IntersectionObserver` → renders pausados enquanto oculto e atualizados instantaneamente ao retornar, com `observer.disconnect()` no unmount.
