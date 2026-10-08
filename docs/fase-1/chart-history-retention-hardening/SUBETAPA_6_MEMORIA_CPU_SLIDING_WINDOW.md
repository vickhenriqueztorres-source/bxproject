# Subetapa 6: Janela Deslizante de Memória e Blindagem de Heap no Frontend (Sliding Window)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `chart-trading-engineer`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `11-chart-trading-tools`  
**Invariantes:** V-11 (Resiliência de Interface & Limites de Memória) | Perigo 6 (Frontend CPU & Memory Hardening)

---

## 1. Escopo e Objetivos da Subetapa

Prevenir que o mecanismo de rolagem infinita histórica (Infinite Scroll) cause vazamento de memória ou sobrecarga de GPU na thread do navegador:
- Se um usuário arrastar o gráfico repetidamente para o passado, a série visual poderia acumular dezenas de milhares de barras em memória.
- No TradingView Lightweight Charts, manter mais de 3.000 a 5.000 barras ativas em uma única série de canvas aumenta desnecessariamente o footprint de heap e reduz a taxa de quadros (FPS).
- **A Solução:** Implementar uma **Janela Deslizante (*Sliding Window*) com teto institucional `MAX_LOADED_BARS = 3000`**. Se o trader navegar profundamente para o passado e novos ticks continuarem chegando, o sistema limita a coleção aos 3.000 pontos mais relevantes em torno da visão do usuário, garantindo consumo de memória estritamente constante e previsível ($< 35\text{MB}$).

---

## 2. Passos de Execução Obrigatórios

### Passo 6.1: Definição da Constante de Teto de Barras
- **Ação:** Em `apps/web/src/chart/PriceChart.tsx`, estabelecer o teto canônico:
  ```typescript
  const MAX_LOADED_BARS = 3000; // Suficiente para 50 horas em 1m ou 250 horas em 5m
  ```
- **Critério de Aceite:** Constante adotada por todas as rotinas de agregação e mesclagem de séries no frontend.

### Passo 6.2: Algoritmo de Poda da Janela Deslizante (*Sliding Window Pruning*)
- **Ação:** Após mesclar novas barras históricas ou receber ticks ao vivo:
  ```typescript
  if (mergedList.length > MAX_LOADED_BARS) {
    // Se o usuário está olhando o passado distante, podar a frente mais recente
    // Se o usuário está no tempo real, podar o passado mais distante
    const logicalRange = chart.timeScale().getVisibleLogicalRange();
    const isLookingAtPast = logicalRange && logicalRange.to < mergedList.length * 0.7;

    if (isLookingAtPast) {
      // Preserva o passado e poda o excesso da ponta recente
      mergedList = mergedList.slice(0, MAX_LOADED_BARS);
    } else {
      // Preserva o presente e poda o passado mais distante
      const excess = mergedList.length - MAX_LOADED_BARS;
      mergedList = mergedList.slice(excess);
    }
  }
  ```
- **Critério de Aceite:** O array de velas nunca excede 3.000 elementos sob nenhuma circunstância.

### Passo 6.3: Preservação dos Indicadores Técnicos
- **Ação:** Garantir que o cálculo dos 10 indicadores técnicos (SMA, EMA, RSI, Bollinger, etc.) em `indicator-calculator.ts` execute sobre a janela podada sem produzir valores `NaN` ou descontinuidades visuais.
- **Critério de Aceite:** Indicadores recalculados em $< 2\text{ms}$ a 60 FPS.

### Passo 6.4: Gestão de Memória no Desmonte de Séries
- **Ação:** Ao alternar de ativo, invocar explicitamente `loadedCandlesRef.current = []` e solicitar ao Garbage Collector a liberação do buffer anterior antes de alocar a nova série.
- **Critério de Aceite:** Zero retenção de objetos desnecessários em snapshots de heap do Chrome DevTools.

### Passo 6.5: Monitoramento de Alocação de Memória (*Memory Leak Watchdog*)
- **Ação:** Adicionar medição em modo de desenvolvimento (`process.env.NODE_ENV !== 'production'`) logando aviso caso o tamanho do buffer de velas ultrapasse 3.000 barras.
- **Critério de Aceite:** Telemetria interna transparente sem sobrecarga em produção.

### Passo 6.6: Teste de Carga Contínua de Memória
- **Ação:** Executar teste simulando 10.000 novos ticks ao vivo e 20 rolagens retroativas para verificar se o consumo de memória permanece estável.
- **Critério de Aceite:** Variação de heap delta $\le 1.5\text{MB}$ após estabilização.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Scroll Extremo de 10.000 Minutos):**
  - Simular script de automação requisitando 20 fatias retroativas consecutivas. O tamanho do array deve estagnar em exatamente 3.000 barras, sem vazamento progressivo de memória.
- **Segurança (Resiliência do Navegador contra Freezes):**
  - Monitorar o event loop do browser durante as podas de array. Tempo de execução do bloco síncrono deve ser $< 4\text{ms}$, garantindo zero *frame drops* perceptíveis na tela.
- **Caos (Alternância Frenética entre Passado e Presente):**
  - Usuário clica no botão "Ir para Tempo Real" (`scrollToRealTime`) após navegar 2 dias no passado. O gráfico deve re-ancorar suavemente no último tick e sincronizar o buffer sem sobressaltos visuais.

---

## 4. Critérios de Aceite da Subetapa 6
- [ ] O tamanho do buffer visual de velas é rigorosamente limitado a 3.000 barras.
- [ ] Zero vazamento de memória (*heap exhaustion*) mesmo após horas de uso e dezenas de scrolls.
- [ ] A taxa de renderização da tela permanece fixa a 60 FPS.
- [ ] Compatibilidade total com as diretrizes de `frontend-memory-cpu-hardening`.
