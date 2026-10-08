# PLANO DE EXPANSÃO — Indicadores Técnicos Institucionais
## Detalhamento Completo, Subetapas Ordenadas e Matriz de Testes

---

## 1. Visão Geral e Arquitetura

O objetivo é expandir o motor gráfico da plataforma (`apps/web/src/chart`) com 6 novos indicadores técnicos institucionais de alta precisão, elevando o total de 4 para **10 indicadores nativos**:

| Indicador | Categoria | Parâmetros Padrão | Séries Gráficas |
| :--- | :--- | :--- | :--- |
| **SMA** (Existente) | Média Móvel | 9 e 21 períodos | Linha Simples |
| **EMA** (Existente) | Média Móvel | 14 períodos | Linha Simples |
| **BOLLINGER** (Existente) | Volatilidade | 20 períodos, 2 stdDev | Linha Superior e Inferior pontilhadas |
| **RSI** (Existente) | Oscilador | 14 períodos (Wilder) | Linha de Força Relativa |
| **WMA** (Novo) | Média Móvel | 20 períodos | Linha Ponderada (baixo lag) |
| **MACD** (Novo) | Tendência/Momento | 12 (fast), 26 (slow), 9 (signal) | Linha MACD + Linha de Sinal |
| **STOCHASTIC** (Novo) | Oscilador | 14 (%K), 3 (%D) | Linha %K + Linha %D |
| **ATR** (Novo) | Volatilidade | 14 períodos (Wilder) | Linha de Volatilidade Absoluta |
| **VWAP** (Novo) | Volume/Preço | Sessão acumulada | Linha de Preço Ponderado por Volume |
| **CCI** (Novo) | Oscilador Cíclico | 20 períodos | Linha de Desvio Médio |

---

## 2. Divisão em Subetapas Ordenadas

### Subetapa 1: Modelagem de Tipos e Definições de Indicadores
- **Objetivo**: Expandir `IndicatorType`, `IndicatorConfig` e `DEFAULT_INDICATORS` em `drawing-types.ts` para suportar parâmetros secundários (`fastPeriod`, `slowPeriod`, `signalPeriod`, `kPeriod`, `dPeriod`).
- **Arquivos**: `apps/web/src/chart/drawing-types.ts`.
- **Validação**: Verificação estática de tipos e integridade do catálogo padrão.

### Subetapa 2: Motor Matemático e Algoritmos dos Novos Indicadores
- **Objetivo**: Implementar em `indicator-calculator.ts` as fórmulas matemáticas causais de:
  1. `calculateWMA(candles, period)`
  2. `calculateMACD(candles, fastPeriod, slowPeriod, signalPeriod)`
  3. `calculateStochastic(candles, kPeriod, dPeriod)`
  4. `calculateATR(candles, period)`
  5. `calculateVWAP(candles)`
  6. `calculateCCI(candles, period)`
- **Arquivos**: `apps/web/src/chart/indicator-calculator.ts`.
- **Validação**: Testes unitários com casos padrão, edge cases (divisão por zero, velas insuficientes, candles com amplitude zero) via `indicator-calculator.unit.test.ts`.

### Subetapa 3: Integração no Ciclo de Vida do Lightweight Charts
- **Objetivo**: Atualizar `PriceChart.tsx` para criar, alimentar e remover de forma limpa as séries múltiplas (MACD e Stochastic) e séries simples (WMA, ATR, VWAP, CCI).
- **Arquivos**: `apps/web/src/chart/PriceChart.tsx`.
- **Validação**: Validação de montagem e desmontagem sem memory leaks ou séries órfãs no canvas.

### Subetapa 4: Interface e Menu do Toolbar
- **Objetivo**: Exibir os 10 indicadores no popup expansível de `ChartDrawingToolbar.tsx` com categorização clara, indicador visual de cor e alternância instantânea.
- **Arquivos**: `apps/web/src/chart/ChartDrawingToolbar.tsx`.
- **Validação**: Renderização fluida e contagem de indicadores ativos no badge.

### Subetapa 5: Bateria Completa de Testes de Estresse, Caos e Segurança
- **Objetivo**: Validar a estabilidade sob carga extrema:
  - Estresse: Ativação simultânea dos 10 indicadores com rajadas de ticks a 100ms.
  - Caos: Candles com volume zero, preços idênticos (variação zero), dados corrompidos.
  - Segurança: Tratamento defensivo contra NaN e infinitos.
- **Arquivos**: `apps/web/src/chart/*.unit.test.ts`, `skills/11-chart-trading-tools/tests/chart-tools.test.ts`.
- **Validação**: 100% dos testes Vitest verdes + `npm run build` com código de saída 0.

---

## 3. Matriz de Testes Exaustivos

### 3.1. Testes de Precisão Matemática
- **MACD**: Conferir que em tendência de alta linear, MACD Line permanece positiva e Signal Line converge suavemente.
- **Estocástico**: Conferir que %K e %D se mantêm estritamente entre 0 e 100 mesmo sob movimentos violentos.
- **ATR**: Conferir que dias sem oscilação geram True Range igual ao gap entre fechamentos.
- **VWAP**: Conferir que em caso de volume unitário em todas as velas, o VWAP coincide com a média cumulativa do preço típico.
- **CCI**: Conferir que para preços constantes, o Mean Deviation é 0 e o resultado é protegido contra divisão por zero.

### 3.2. Testes de Caos
- Injetar velas com `high < low` ou `volume = 0` ou strings decimais. Os algoritmos devem sanitizar sem travar o loop de renderização.

### 3.3. Critérios de Aceite
- [ ] 10 tipos de indicadores nativos disponíveis e selecionáveis.
- [ ] Séries calculadas em O(N) com zero alocação desnecessária de memória.
- [ ] Remoção limpa das séries sem resíduos visuais ou exceções no console.
- [ ] 100% de testes unitários passando.
- [ ] Build do Vite/TypeScript compilando com 0 erros.
