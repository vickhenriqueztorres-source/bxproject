# Arquitetura de Componentes Gráficos e Pipeline de Renderização

Este documento detalha o pipeline de renderização, a integração do Lightweight Charts e a arquitetura das camadas de desenho e overlays da plataforma.

---

## 1. Visão Geral da Pilha Visual

A interface gráfica do gráfico é composta por camadas sobrepostas ordenadas pelo `z-index`:

```text
+-----------------------------------------------------------+
| Z: 25  ChartDrawingToolbar (Barra Lateral Esquerda)       |
+-----------------------------------------------------------+
| Z: 20  ChartDrawingOverlay (SVG interativo quando ativo)  |
+-----------------------------------------------------------+
| Z: 12  ChartDrawingOverlay (SVG passivo: linhas prontas)  |
+-----------------------------------------------------------+
| Z: 10  TradersMoodBar (Sentimento do Mercado)            |
+-----------------------------------------------------------+
| Z: 8   OrderFlagsOverlay (Flags flutuantes de Strike)     |
+-----------------------------------------------------------+
| Z: 6   TimeLinesOverlay (Linhas de Compra e Expiração)    |
+-----------------------------------------------------------+
| Z: 1   Lightweight Charts Canvas (Velas + Indicadores)    |
+-----------------------------------------------------------+
```

---

## 2. Componentes e Responsabilidades

### 2.1. `PriceChart.tsx`
- **Função**: Contêiner mestre do gráfico.
- **Gerenciamento**:
  - Instanciação e resize do `IChartApi` do Lightweight Charts.
  - Alternância entre série de Velas (`CandlestickSeries`) e Área (`AreaSeries`).
  - Atualização do último tick com linha de preço (`currentPriceLine`) colorida dinamicamente.
  - Séries adicionais para Indicadores Técnicos (SMA, EMA, Bollinger Bands, RSI).
  - Linhas de strike horizontais (`strikeLinesMap`) para cada contrato em aberto.
  - Batching via `RafChartUpdater` para garantir 60 FPS estáveis mesmo sob rajadas de ticks de OTC.

### 2.2. `ChartDrawingToolbar.tsx`
- **Função**: Barra lateral esquerda flutuante de ferramentas e menus retráteis.
- **Menus**:
  1. **Tipo de Gráfico**: Alterna entre Candlestick (Velas japonesas) e Linha contínua.
  2. **Timeframe**: `5s`, `15s`, `30s`, `1m`, `5m`.
  3. **Indicadores Técnicos**: Toggles com badges para SMA 9, SMA 21, EMA 14, Bollinger Bands 20, RSI 14.
  4. **Ferramentas de Desenho**: Linha, Linha de Tendência, Nível Horizontal, Nível Vertical, Retração de Fibonacci.
  5. **Paleta de Cores**: 6 cores selecionáveis (#00e676, #ffeb3b, #00b0ff, #ff3d71, #e040fb, #ffffff).
  6. **Gerenciador de Desenhos**: Lista de desenhos ativos com botão de exclusão individual (`×`) e botão de limpar todos (`🗑️`).

### 2.3. `ChartDrawingOverlay.tsx`
- **Função**: Camada SVG que renderiza os desenhos matemáticos por cima do canvas.
- **Eventos de Mouse**:
  - `onClick` / `onMouseDown`: Captura ponto 1 e ponto 2.
  - `onMouseMove`: Preview contínuo do traçado antes de fixar o segundo ponto, throttled por `requestAnimationFrame`.
- **Hitbox de Interação**:
  - Cada elemento desenhado possui uma camada invisível com `stroke="transparent" strokeWidth={24}` que intercepta cliques a até 12px de distância.
  - Exibe botão flutuante de exclusão (`×`) em vermelho neon quando o usuário passa o mouse ou clica sobre o elemento.
- **Sincronização com o Gráfico**:
  - Escuta `timeScale.subscribeVisibleTimeRangeChange` para forçar re-render SVG instantâneo durante zoom ou pan da escala de tempo.

### 2.4. `OrderFlagsOverlay.tsx`
- **Função**: Renderiza flags visuais flutuantes ancoradas no strike price dos contratos abertos.
- **Dados exibidos**:
  - Direção da operação (Ícone verde CALL para UP, ícone vermelho PUT para DOWN).
  - Valor investido formatado na moeda (`$stake_minor / 100`).
  - Timer regressivo em tempo real (`mm:ss`) até a liquidação oficial.
  - Coordenada Y calculada dinamicamente via `activeSeries.priceToCoordinate(strikePrice)`.

### 2.5. `TimeLinesOverlay.tsx`
- **Função**: Linhas temporais verticais que guiam o trader quanto à janela de compra e fechamento.
- **Linha Amarela (Trava de Compra)**:
  - Marca a virada dos 30 segundos da vela em curso.
  - Após os 30s, exibe aviso visual "Compra travada para esta vela".
- **Linha Vermelha Tracejada (Expiração)**:
  - Marca a virada dos 00 segundos do próximo minuto, onde a vela fecha e o contrato expira.

### 2.6. `MultiChartGrid.tsx`
- **Função**: Suporte a layouts de múltiplos gráficos simultâneos (1x1, 2x1, 2x2, 3x2).
- **Recursos**:
  - Foco de seleção de ativo ativo por clique no card.
  - Troca individual de ativo por célula da grade.
  - Otimização via `useVisibilityPause`: apenas células visíveis processam atualizações pesadas de ticks.
