# SUBETAPA 02: OVERLAYS, INDICADORES E PREVENÇÃO DE DISTORÇÃO DA ESCALA VERTICAL

> **Responsáveis:** `chart-trading-engineer`, `surgical-frontend-agent`, `qa-resilience-agent`  
> **Arquivos-alvo:**  
> - `apps/web/src/chart/PriceChart.tsx`  
> - `apps/web/src/chart/IsolatedChartHost.tsx`  
> - `apps/web/src/chart/pricechart-scale-overlays.unit.test.tsx`

---

## 1. Problema e Causa Raiz

1. **Distorção de Escala Vertical:**
   Ao trocar de ativo (por exemplo, de BTC a US$ 60.000 para EURUSD a 1.08500), a linha de preço `currentPriceLine` criada na série mantinha a cotação antiga de 60.000 até um novo tick de EURUSD chegar. O Lightweight Charts reescalonava o eixo Y para abranger tanto 60.000 quanto 1.08, resultando em um gráfico de EURUSD achatado a zero pixel de altura (parecendo que o gráfico sumiu).
2. **Strikes Órfãos:**
   Linhas de strike do ativo anterior permaneciam no `strikeLinesMap` e poluíam o novo gráfico se não fossem removidas explicitamente na troca de `symbol`.
3. **Indicadores e Lazy-Loading Não Carregados:**
   O `useEffect` de indicadores e o listener `subscribeVisibleLogicalRangeChange` executavam antes de `chartInstance.current` estar pronto (`null` no primeiro render). Como `isChartReady` não estava nas dependências, eles nunca eram inicializados.
4. **Listeners Duplicados de WebGL:**
   `webglcontextlost` e `webglcontextrestored` eram registrados em duas partes do código, gerando eventos duplicados.

---

## 2. Solução Técnica Arquitetural

1. **Limpeza Cirúrgica de Linhas de Preço na Mudança de Ativo:**
   No `PriceChart.tsx`, ao alterar `symbol`:
   - Remover `currentPriceLine.current` da série ativa e resetá-lo para `null`.
   - Limpar todos os price lines de `strikeLinesMap.current` da série ativa e chamar `.clear()`.
   - Resetar `lastPrice.current = null`.
   - Resetar `shouldScrollToRealTimeRef.current = true`.
2. **Inclusão de `isChartReady` nas Dependências Reativas:**
   - O efeito dos 10 indicadores técnicos agora depende de `[isChartReady, indicators, resampledCandles]`.
   - O efeito de lazy-loading de velas agora depende de `[isChartReady, symbol, internalCandles]`.
3. **Chamada de `scrollToRealTime()` no `IsolatedChartHost` ao Mudar Símbolo ou Timeframe:**
   - Sempre que novas velas forem carregadas após troca de par, posicionar o viewport na extremidade direita em tempo real.
4. **Unificação dos Listeners de WebGL no Mount:**
   - Consolidar os listeners de `webglcontextlost` e `webglcontextrestored` em um único bloco de ciclo de vida seguro.

---

## 3. Plano de Testes de Estresse e Regressão (Subetapa 02)

- **Teste 2.1 (Anti-Esmagamento de Escala):** Simular ativo a 60.000 com price line ativo, trocar para ativo com cotação 1.08, e verificar que o price line de 60.000 foi removido imediatamente e o novo ativo inicia sem linha defasada.
- **Teste 2.2 (Inicialização de Indicadores):** Montar o gráfico e comprovar que assim que `isChartReady` se torna `true`, as séries de indicadores ativados são criadas e recebem dados sem necessidade de clique manual.
- **Teste 2.3 (Limpeza de Strikes Órfãos):** Adicionar contratos em aberto para ativo A, trocar para ativo B, e comprovar que nenhuma linha de strike de A permanece na tela.
