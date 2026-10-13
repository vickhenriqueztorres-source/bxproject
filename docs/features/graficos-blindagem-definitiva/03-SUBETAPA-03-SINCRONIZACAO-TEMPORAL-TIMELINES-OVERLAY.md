# Subetapa 03: Sincronização Geométrica das Linhas de Tempo (TimeLinesOverlay)

## 1. Problema Identificado
No componente `TimeLinesOverlay.tsx`:
1. As linhas verticais de "Hora de Compra" (branca pontilhada) e "Tempo de Expiração" (vermelha sólida) eram calculadas através de uma aproximação visual arbitrária:
   `forwardSpace = Math.min(220, Math.max(70, (effectiveWidth - xCandle) * 0.85))`
2. Isso jogava as linhas até 220 pixels à frente do candle mais recente, o que em timeframes rápidos (5s, 15s) ou com zoom equivale a 20 a 40 velas no futuro (3 a 5 minutos à frente no vazio).
3. O trader visualizava uma linha de expiração a quilômetros de distância da vela atual, gerando desorientação e sensação de erro grave no gráfico.

## 2. Solução Arquitetural
1. **Passagem do Timeframe Ativo**:
   - `PriceChart.tsx` repassa a prop `timeframe` (ex: `'5s'`, `'15s'`, `'30s'`, `'1m'`, `'5m'`) para o `TimeLinesOverlay`.
2. **Cálculo da Largura de Barra (`barSpacing`) em Tempo Real**:
   - Utilizando a API do `chartInstance.timeScale()`:
     - Dado `xCandle` da vela atual, obtemos seu índice lógico: `logical = timeScale.coordinateToLogical(xCandle)`.
     - Obtemos a coordenada da barra seguinte: `nextX = timeScale.logicalToCoordinate(logical + 1)`.
     - `barSpacing = Math.max(4, nextX - xCandle)`.
3. **Projeção Causal Proporcional ao Tempo Restante**:
   - `tfSec = timeframeSeconds(timeframe)`.
   - `barsAheadExp = Math.max(0.2, secondsRemaining / tfSec)`.
   - `xExpiration = Math.min(maxExpirationX, xCandle + barsAheadExp * barSpacing)`.
   - Para compra:
     - Se locked (`isPurchaseLocked` ou `purchaseSecondsRemaining <= 0`): `xPurchase = xCandle`.
     - Caso contrário:
       - `barsAheadPurchase = Math.max(0.1, purchaseSecondsRemaining / tfSec)`.
       - `xPurchase = Math.min(xExpiration - 15, xCandle + barsAheadPurchase * barSpacing)`.
4. **Fallback Seguro**:
   - Se `chartInstance` ainda não renderizou ou coordenadas lógicas forem indefinidas, recorrer a uma distância proporcional segura e discreta (ex: 2 a 4 barras de largura), nunca esticando até a borda da tela.

## 3. Testes Automatizados da Subetapa
- **Teste de Projeção em Timeframe de 1m**:
  - Com 60s restantes no timeframe de 1m, prova que a linha de expiração está exatamente a ~1 barra de distância da vela atual.
  - Com 30s restantes, prova que está a ~0.5 barras de distância.
- **Teste de Projeção em Timeframe de 5s**:
  - Com 30s restantes no timeframe de 5s, prova que a linha de expiração está a 6 barras de distância da vela atual.
- **Teste de Trava de Compra (`isPurchaseLocked`)**:
  - Quando os 30s iniciais terminam, a linha de compra cola na vela atual indicando encerramento de novas entradas.
