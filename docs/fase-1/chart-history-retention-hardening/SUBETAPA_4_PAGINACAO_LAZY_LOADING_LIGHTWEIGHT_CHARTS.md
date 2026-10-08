# Subetapa 4: Lazy Loading Retroativo no Lightweight Charts (Infinite Scroll Gapless)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `chart-trading-engineer`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `06-testing-quality`, `11-chart-trading-tools`  
**Invariantes:** V-04 (OHLCV Idempotente) | V-11 (Interface Fluida a 60 FPS)

---

## 1. Escopo e Objetivos da Subetapa

Implementar o mecanismo institucional de **Infinite Scroll Retroativo** no componente `PriceChart.tsx` utilizando a API nativa do TradingView Lightweight Charts:
1. **Detecção de Proximidade da Borda Esquerda:** Escutar `chart.timeScale().subscribeVisibleLogicalRangeChange()`. Quando o índice lógico visível à esquerda se aproximar da borda (`range.from < 15`), disparar busca do lote anterior.
2. **Mesclagem Monotônica e Deduplicada (*Gapless Merge*):** Unir as novas barras históricas ao array existente, eliminando duplicatas e preservando ordenação estrita.
3. **Compensação de Posição Visual (*Zero Jump / Zero Flicker*):** Ao injetar $K$ novas barras no início da série, compensar imediatamente a posição lógica da escala de tempo em $+K$, mantendo o gráfico estritamente imóvel perante os olhos do trader.

---

## 2. Passos de Execução Obrigatórios

### Passo 4.1: Estado e Refs de Controle de Paginação no `PriceChart.tsx`
- **Ação:** Adicionar referências para evitar requisições concorrentes e loops de busca:
  ```typescript
  const isLoadingHistoryRef = useRef(false);
  const hasMoreHistoryRef = useRef(true);
  const loadedCandlesRef = useRef<CandlestickData<UTCTimestamp>[]>([]);
  ```
- **Critério de Aceite:** Refs inicializados e limpos adequadamente na troca de ativo ou desmontagem do componente.

### Passo 4.2: Inscrição no `subscribeVisibleLogicalRangeChange`
- **Ação:** Configurar listener no `timeScale` do gráfico com debounce de 250ms:
  ```typescript
  chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
    if (!logicalRange || isLoadingHistoryRef.current || !hasMoreHistoryRef.current) return;
    
    // Se o usuário rolou até perto do início das barras carregadas
    if (logicalRange.from < 15) {
      void loadOlderCandles();
    }
  });
  ```
- **Critério de Aceite:** Listener dispara apenas quando o usuário realmente se aproxima da extremidade esquerda do histórico.

### Passo 4.3: Implementação da Função `loadOlderCandles`
- **Ação:** Buscar o lote anterior usando o timestamp da primeira barra atualmente carregada:
  ```typescript
  const loadOlderCandles = async () => {
    const oldestBar = loadedCandlesRef.current[0];
    if (!oldestBar) return;

    isLoadingHistoryRef.current = true;
    try {
      const older = await fetchHistoricalCandlesChunk(activeSymbol, oldestBar.time, 300);
      if (!older || older.length === 0) {
        hasMoreHistoryRef.current = false;
        return;
      }

      // Reamostrar novas velas para o timeframe atual
      const resampledOlder = resampleCandles(older, timeframe);
      if (resampledOlder.length === 0) {
        hasMoreHistoryRef.current = false;
        return;
      }

      // Mesclagem deduplicada
      const existing = loadedCandlesRef.current;
      const mergedMap = new Map<number, CandlestickData<UTCTimestamp>>();
      for (const bar of resampledOlder) mergedMap.set(bar.time, bar);
      for (const bar of existing) mergedMap.set(bar.time, bar);

      const mergedList = Array.from(mergedMap.values()).sort((a, b) => a.time - b.time);
      const addedCount = mergedList.length - existing.length;

      if (addedCount > 0) {
        // Atualizar série visual
        const activeSeries = candleSeries.current ?? areaSeries.current;
        if (activeSeries) {
          activeSeries.setData(mergedList);
        }
        loadedCandlesRef.current = mergedList;

        // Compensar o deslocamento para não saltar a tela
        const currentRange = chart.timeScale().getVisibleLogicalRange();
        if (currentRange) {
          chart.timeScale().setVisibleLogicalRange({
            from: currentRange.from + addedCount,
            to: currentRange.to + addedCount,
          });
        }
      }
    } finally {
      isLoadingHistoryRef.current = false;
    }
  };
  ```
- **Critério de Aceite:** As barras históricas são inseridas de forma contínua sem saltos visuais na tela.

### Passo 4.4: Reset Limpo na Troca de Símbolo ou Timeframe
- **Ação:** Ao alternar o ativo ativo ou o timeframe:
  * `hasMoreHistoryRef.current = true`
  * `isLoadingHistoryRef.current = false`
  * Carregar o lote inicial padrão e rolar para o tempo real (`chart.timeScale().scrollToRealTime()`).
- **Critério de Aceite:** O novo ativo não herda histórico nem posição de scroll do ativo anterior.

### Passo 4.5: Indicador Discreto de Carregamento (*Micro Spinner*)
- **Ação:** Exibir um indicador sutil no canto superior esquerdo do gráfico ("Carregando histórico...") durante o fetch retroativo.
- **Critério de Aceite:** Feedback visual elegante sem obstruir o painel de ordens ou as velas.

### Passo 4.6: Teste de Interação de Scroll
- **Ação:** Criar teste de estresse visual e lógico simulando 5 rolagens consecutivas para o passado.
- **Critério de Aceite:** O array de barras expande de 500 para 2.000 barras sem falhas de ordenação temporal.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Arrasto Contínuo e Violento com o Mouse):**
  - O usuário segura o gráfico e arrasta rapidamente para a direita por 30 segundos consecutivos. O debounce e o lock booleano devem garantir que apenas 1 requisição ocorra por vez, sem enfileirar centenas de fetches pendentes.
- **Segurança (Isolamento de Séries):**
  - Garantir que nenhum dado de outro símbolo seja misturado no mapa de barras durante o merge retroativo.
- **Caos (Erro de Rede no Meio do Scroll):**
  - Simular queda de rede durante o 3º lote. O gráfico deve manter intactas as barras já carregadas e permitir nova tentativa de scroll assim que a conexão restabelecer.

---

## 4. Critérios de Aceite da Subetapa 4
- [ ] O gráfico detecta a aproximação da borda esquerda e busca mais velas automaticamente.
- [ ] Zero flicker / zero jump na tela durante a injeção do lote anterior.
- [ ] Invariantes de OHLC e ordenação estritamente monotônica preservadas em todas as barras mescladas.
- [ ] Performance estável a 60 FPS sem congelamento da UI.
