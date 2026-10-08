---
name: 11-chart-trading-tools
description: >
  Trigger: "gráfico", "ferramenta gráfica", "desenho no gráfico", "Fibonacci", "indicador técnico", "SMA", "EMA", "Bollinger", "RSI", "Lightweight Charts", "overlay", "hitbox", "PriceChart", "ChartDrawingOverlay", "ChartDrawingToolbar", "TimeLinesOverlay", "OrderFlagsOverlay". Ativar antes de planejar, implementar, depurar ou testar ferramentas visuais, camadas interativas ou indicadores matemáticos nos gráficos da plataforma.
version: 1.0.0
---

# 11-chart-trading-tools

Engenharia de Ferramentas Gráficas de Trading, Indicadores Técnicos e Camadas Interativas de Alta Performance na **Plataforma de Índices Sintéticos**.

Esta skill governa a precisão matemática, estabilidade de FPS (60 quadros/s), conversão bidirecional de coordenadas, persistência de desenhos vetoriais e integridade dos indicadores técnicos construídos sobre o **TradingView Lightweight Charts (v4.2.1)** e overlays SVG/Canvas.

---

## 1. Mentalidade e Princípios de Engenharia Gráfica

| Princípio | Pergunta Mental | Regra Prática |
| :--- | :--- | :--- |
| **Precisão Geométrica Absoluta** | A linha desenhada no gráfico de 1080p permanece no mesmo centavo de dólar em 720p ou após zoom de 500%? | Coordenadas são salvas como `(price, time, logical)`, NUNCA como pixels fixos `(x, y)`. |
| **Taxa de Quadros Sagrada (60 FPS)** | Se chegarem 100 ticks por segundo, o navegador vai travar ou atrasar o render? | Aplique coalescência via `RafChartUpdater`. No máximo 1 render por quadro de 16,6ms. |
| **Hitbox Generosa (24px)** | Um trader sob pressão consegue clicar na linha de suporte com facilidade? | Camada invisível de `strokeWidth={24}` transparente envolvendo o traço visível de 1px/2px. |
| **Isolamento e Sanitização de Estado** | O que acontece se o usuário trocar de ativo ou o `localStorage` contiver lixo? | Chaves isoladas por símbolo (`broker_drawings_${symbol}`) e try/catch com fallback defensivo para `[]`. |
| **Temporalidade Estrita** | O cálculo do indicador técnico ou do resample de velas viola a causalidade temporal? | Timestamps estritamente crescentes sem repetição (`t_n > t_{n-1}`). Suavização causal (ex: Wilder no RSI). |

---

## 2. Regras de Ativação

**Ativar obrigatoriamente quando o pedido contiver:**
- "ferramentas de desenho", "barra de ferramentas do gráfico", "ChartDrawingToolbar", "ChartDrawingOverlay"
- "linha de suporte", "linha de resistência", "linha de tendência", "linha horizontal", "linha vertical", "retração de Fibonacci"
- "indicadores técnicos", "SMA", "EMA", "Bandas de Bollinger", "RSI", "MACD", "Estocástico"
- "Lightweight Charts", "PriceChart", "OrderFlagsOverlay", "TimeLinesOverlay", "TradersMoodBar", "MultiChartGrid"
- "conversão de coordenadas", `coordinateToPrice`, `priceToCoordinate`, `coordinateToLogical`, `logicalToCoordinate`
- "throttle de render", `requestAnimationFrame`, "queda de FPS", "otimização do gráfico"
- "resample de velas", "timeframe 5s/15s/30s/1m/5m", `candle-adapter`

**Não ativar quando:**
- Geração estocástica de ticks no backend — usar `03-synthetic-market-engine`
- Settlement financeiro, regras de ledger e saldo Blnk — usar `02-financial-invariants`
- Autenticação JWT e RBAC de rotas da API — usar `04-security-iam`

---

## 3. As 10 Garantias Gráficas Invioláveis (G-01 a G-10)

| ID | Garantia | Definição Técnica | Forma de Prova |
| :--- | :--- | :--- | :--- |
| **G-01** | **60 FPS Constante** | Coalescência de rajadas de ticks e eventos de mouse via `RafChartUpdater`. Nenhuma renderização redundante dentro do mesmo ciclo de 16.6ms. | Benchmark rAF / Teste de Throttle |
| **G-02** | **Mapeamento Bidirecional** | Mapeamento exato `(price, time, logical) ↔ (pixelX, pixelY)` com suporte a barras passadas, presentes e margem futura à direita (Right Offset). | Teste unitário de projeção |
| **G-03** | **Retração Áurea de Fibonacci** | Grade com os 6 níveis áureos exatos: `0.0%`, `23.6%`, `38.2%`, `50.0%`, `61.8%`, `100.0%`. Cálculo: $P_{nivel} = P_{fundo} + (P_{topo} - P_{fundo}) \times N$. | Teste unitário matemático |
| **G-04** | **Hitbox de Interação 24px** | Tolerância de seleção e exclusão de linhas com raio de 12px ao redor do traço visível (`stroke="transparent" strokeWidth={24}`). | Teste geométrico de interceptação |
| **G-05** | **Redraw Reativo no Zoom/Pan** | Redraw síncrono do overlay SVG escutando `timeScale.subscribeVisibleTimeRangeChange`, mantendo as linhas cravadas nos preços durante arrasto. | Event Listener verificado |
| **G-06** | **Imunidade no LocalStorage** | Schema validation defensivo para `broker_drawings_${symbol}`. Descarte silencioso de strings arbitrárias ou JSON malformado sem gerar exceções. | Teste de caos com JSON corrompido |
| **G-07** | **Monotonicidade do Resample** | Agregação determinística de velas nos timeframes `5s`, `15s`, `30s`, `1m` e `5m`. Timestamps estritamente crescentes sem duplicatas. | Teste de agregação OHLCV |
| **G-08** | **Causalidade dos Indicadores** | SMA, EMA, Bollinger Bands e RSI calculados exclusivamente a partir de preços passados e presentes, sem olhar para o futuro (*lookahead bias*). | Teste unitário de indicadores |
| **G-09** | **Sincronismo de Overlays de Trade** | Linhas de strike (`OrderFlagsOverlay`) e linhas verticais de trava (:30s) e expiração (:00s) (`TimeLinesOverlay`) sincronizadas ao relógio oficial do tick. | Intervalo de atualização ≤ 250ms |
| **G-10** | **Ciclo de Vida Multi-Gráfico** | Gráficos fora do viewport têm seu ciclo de renderização pausado automaticamente via `useVisibilityPause` e IntersectionObserver. | Auditoria de lifecycle React |

---

## 4. Fórmulas Matemáticas e Regras de Implementação

### 4.1. Mapeamento de Coordenadas do Canvas/SVG
O Lightweight Charts separa a escala de tempo da série de preços:
1. **Eixo Y (Preço)**:
   - Pixel Y = `activeSeries.priceToCoordinate(price)`
   - Preço = `activeSeries.coordinateToPrice(pixelY)`
2. **Eixo X (Tempo e Lógica)**:
   - Se dentro das velas existentes: `timeScale.timeToCoordinate(time)`
   - Se na margem futura à direita (Right Offset): utilizar `timeScale.coordinateToLogical(pixelX)` e `timeScale.logicalToCoordinate(logical)`. O índice lógico permite projetar linhas de tendência e Fibonacci além da vela atual.

### 4.2. Retração de Fibonacci
Dados o ponto inicial $P_1(t_1, y_1)$ e o ponto final $P_2(t_2, y_2)$:
- $\Delta P = P_2.price - P_1.price$
- Para cada nível $k \in \{0.0, 0.236, 0.382, 0.500, 0.618, 1.000\}$:
  $$P(k) = P_1.price + k \times \Delta P$$
- Coordenada em pixels na tela:
  $$Y(k) = activeSeries.priceToCoordinate(P(k))$$

### 4.3. Indicadores Técnicos
- **SMA (Simple Moving Average)**:
  $$SMA_t(n) = \frac{1}{n} \sum_{i=0}^{n-1} Close_{t-i}$$
- **EMA (Exponential Moving Average)**:
  $$k = \frac{2}{n + 1}, \quad EMA_t = (Close_t - EMA_{t-1}) \times k + EMA_{t-1}$$
  *Inicialização: $EMA_n = SMA_n$ dos primeiros $n$ períodos.*
- **Bandas de Bollinger**:
  $$\mu_t = SMA_t(n), \quad \sigma_t = \sqrt{\frac{1}{n} \sum_{i=0}^{n-1} (Close_{t-i} - \mu_t)^2}$$
  $$Upper_t = \mu_t + k \cdot \sigma_t, \quad Lower_t = \mu_t - k \cdot \sigma_t \quad (k=2, n=20)$$
- **RSI (Relative Strength Index com Suavização de Wilder)**:
  $$RS_t = \frac{AvgGain_t}{AvgLoss_t}, \quad RSI_t = 100 - \frac{100}{1 + RS_t}$$
  $$AvgGain_t = \frac{AvgGain_{t-1} \times (n-1) + Gain_t}{n}, \quad AvgLoss_t = \frac{AvgLoss_{t-1} \times (n-1) + Loss_t}{n}$$

---

## 5. Bateria de Testes Exaustivos

Ao desenvolver, alterar ou validar ferramentas gráficas, execute a seguinte matriz:

### 5.1. Testes de Unidade Numérica e Geométrica
1. **Níveis de Fibonacci**: Validação exata dos 6 níveis com tolerância $< 0.0001$.
2. **Hitbox de Interação**: Prova de captura para distâncias $\le 12\text{px}$ e rejeição para $> 12\text{px}$.
3. **Indicadores Técnicos**: Verificação de SMA, EMA, Bandas de Bollinger e RSI contra dados sintéticos conhecidos.
4. **Resample OHLCV**: Garantia de que a vela de 1 minuto resume precisamente 12 velas de 5 segundos ($High = \max(H_i)$, $Low = \min(L_i)$, $Open = O_1$, $Close = C_{12}$).

### 5.2. Testes de Estresse e Desempenho
1. **Carga de Desenhos**: Persistir e renderizar 50 desenhos simultâneos sem congelamento.
2. **Coalescência rAF**: Rajada de 100 movimentos de mouse ou 100 ticks no mesmo microsegundo deve resultar em exatamente 1 agendamento rAF.

### 5.3. Testes de Caos e Resiliência
1. **LocalStorage Corrompido**: Injeção de valores inválidos (`{bad_json`, `null`, `12345`, `undefined`) deve retornar array vazio sem gerar `TypeError`.
2. **Troca Rápida de Símbolo**: Mudar entre múltiplos símbolos (`SYNTH_VOL_50` → `CRYPTO_BTC_SYNTH` → `FOREX_EURUSD`) garante isolamento absoluto dos desenhos de cada ativo.

---

## 6. Formato de Relatório de Homologação Gráfica

```text
SKILL: 11-chart-trading-tools
COMPONENTE: <PriceChart | ChartDrawingOverlay | ChartDrawingToolbar | IndicatorEngine>
DATA: <AAAA-MM-DD>

G-01 60 FPS Throttle        : PASS | FAIL — <tempo médio de quadro / rAF coalesced>
G-02 Mapeamento Coordenadas : PASS | FAIL — <erro delta px preço e tempo>
G-03 Retração de Fibonacci  : PASS | FAIL — <precisão dos 6 níveis áureos>
G-04 Hitbox 24px            : PASS | FAIL — <captura a 12px e rejeição a 13px>
G-05 Redraw no Zoom/Pan     : PASS | FAIL — <inscrição em subscribeVisibleTimeRangeChange>
G-06 Sanitização Storage    : PASS | FAIL — <recuperação graciosa em JSON corrompido>
G-07 Resample Monotônico    : PASS | FAIL — <monotonicidade estrita dos timeframes>
G-08 Causalidade Indicadores: PASS | FAIL — <validação matemática sem lookahead bias>
G-09 Overlays de Trade      : PASS | FAIL — <sincronia de strike e contagem regressiva>
G-10 Multi-Gráfico Lifecycle: PASS | FAIL — <pausa quando fora do viewport>
RESULTADO GERAL             : APROVADO | REPROVADO
```
