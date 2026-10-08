# Fórmulas Matemáticas e Algoritmos Geométricos do Gráfico

Este documento consolida as formulações matemáticas exatas implementadas para as ferramentas de desenho e indicadores técnicos da plataforma.

---

## 1. Geometria de Coordenadas e Projeções

### 1.1. Projeção de Linha de Tendência Angular
Dado $P_1(t_1, y_1)$ e $P_2(t_2, y_2)$ em coordenadas de tela $(x_1, y_1)$ e $(x_2, y_2)$:
- **Vetor Diretor**:
  $$\vec{v} = (x_2 - x_1, y_2 - y_1)$$
- **Comprimento**:
  $$L = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$
- **Projeção com Extensão (Raio Infinito)**:
  Para estender a linha de tendência até a borda direita da tela ($x_{final} = W_{container}$):
  $$t = \frac{W_{container} - x_1}{x_2 - x_1}$$
  $$y_{final} = y_1 + t \cdot (y_2 - y_1)$$

### 1.2. Interceptação de Hitbox (Distância Ponto-Reta)
Para determinar se o clique do mouse no ponto $C(x_0, y_0)$ intercepta a linha entre $A(x_1, y_1)$ e $B(x_2, y_2)$:
- **Distância Perpendicular**:
  $$d = \frac{|(y_2 - y_1)x_0 - (x_2 - x_1)y_0 + x_2 y_1 - y_2 x_1|}{\sqrt{(y_2 - y_1)^2 + (x_2 - x_1)^2}}$$
- **Critério de Interceptação da Hitbox de 24px**:
  $$\text{Intercepta} \iff d \le 12\text{px} \quad \text{e} \quad \min(x_1, x_2) - 12 \le x_0 \le \max(x_1, x_2) + 12$$

---

## 2. Retração de Fibonacci

A grade áurea clássica de Fibonacci decompõe o impulso de preço entre a mínima $P_{min}$ e a máxima $P_{max}$:

$$\Delta P = P_{max} - P_{min}$$

| Nível ($k$) | Multiplicador | Preço no Nível | Significado Técnico |
| :--- | :--- | :--- | :--- |
| **0.0%** | $0.000$ | $P_{min}$ | Fundo / Origem do movimento |
| **23.6%** | $0.236$ | $P_{min} + 0.236 \times \Delta P$ | Retração rasa |
| **38.2%** | $0.382$ | $P_{min} + 0.382 \times \Delta P$ | Primeiro suporte de ouro |
| **50.0%** | $0.500$ | $P_{min} + 0.500 \times \Delta P$ | Ponto médio (Dow Theory) |
| **61.8%** | $0.618$ | $P_{min} + 0.618 \times \Delta P$ | Proporção Áurea ($\phi - 1$) |
| **100.0%** | $1.000$ | $P_{max}$ | Topo / Fim do impulso |

---

## 3. Indicadores Técnicos Nativos

### 3.1. SMA (Simple Moving Average)
Para uma série temporal de preços de fechamento $C_0, C_1, \dots, C_{m-1}$ e período $N$:
$$SMA_i = \frac{1}{N} \sum_{j=0}^{N-1} C_{i-j}, \quad \text{para } i \ge N - 1$$

### 3.2. EMA (Exponential Moving Average)
Aplica peso exponencialmente decrescente aos preços anteriores:
- **Fator de Suavização**:
  $$k = \frac{2}{N + 1}$$
- **Recursão**:
  $$EMA_N = \frac{1}{N} \sum_{j=0}^{N-1} C_j \quad (\text{seed via SMA inicial})$$
  $$EMA_i = C_i \times k + EMA_{i-1} \times (1 - k), \quad \text{para } i \ge N$$

### 3.3. Bandas de Bollinger
Mede a dispersão estatística ao redor de uma média móvel simples:
- **Média Central**: $Middle_i = SMA_i(20)$
- **Variância Populacional**:
  $$\sigma_i^2 = \frac{1}{20} \sum_{j=0}^{19} (C_{i-j} - Middle_i)^2$$
- **Desvio Padrão**: $\sigma_i = \sqrt{\sigma_i^2}$
- **Banda Superior**: $Upper_i = Middle_i + (2 \times \sigma_i)$
- **Banda Inferior**: $Lower_i = Middle_i - (2 \times \sigma_i)$

### 3.4. RSI (Relative Strength Index de J. Welles Wilder)
Quantifica a velocidade e mudança dos movimentos de preço:
1. Variação diária: $\Delta C_i = C_i - C_{i-1}$
2. Ganhos e Perdas:
   $$Gain_i = \max(0, \Delta C_i), \quad Loss_i = \max(0, -\Delta C_i)$$
3. Médias Iniciais para os primeiros 14 períodos:
   $$AvgGain_{14} = \frac{1}{14} \sum_{j=1}^{14} Gain_j, \quad AvgLoss_{14} = \frac{1}{14} \sum_{j=1}^{14} Loss_j$$
4. Suavização de Wilder para $i > 14$:
   $$AvgGain_i = \frac{AvgGain_{i-1} \times 13 + Gain_i}{14}$$
   $$AvgLoss_i = \frac{AvgLoss_{i-1} \times 13 + Loss_i}{14}$$
5. Força Relativa (RS):
   $$RS_i = \begin{cases} \infty, & \text{se } AvgLoss_i = 0 \\ \frac{AvgGain_i}{AvgLoss_i}, & \text{caso contrário} \end{cases}$$
6. Índice Final:
   $$RSI_i = \begin{cases} 100, & \text{se } AvgLoss_i = 0 \\ 100 - \frac{100}{1 + RS_i}, & \text{caso contrário} \end{cases}$$

### 3.5. WMA (Weighted Moving Average)
Atribui peso proporcionalmente maior às velas recentes:
$$WMA_i(N) = \frac{\sum_{j=0}^{N-1} (N - j) \cdot C_{i-j}}{\frac{N(N+1)}{2}}$$

### 3.6. MACD (Moving Average Convergence Divergence)
Mede o momento e a convergência/divergência entre duas médias exponenciais:
- **Linha MACD**: $MACD_t = EMA_t(12) - EMA_t(26)$
- **Linha de Sinal**: $Signal_t = EMA_t(9, MACD)$
- **Histograma**: $Hist_t = MACD_t - Signal_t$

### 3.7. Oscilador Estocástico (%K e %D)
Compara o preço de fechamento atual com a amplitude (High-Low) de uma janela de $k$ períodos:
$$\%K_t = \frac{Close_t - \min_{j=0}^{k-1}(Low_{t-j})}{\max_{j=0}^{k-1}(High_{t-j}) - \min_{j=0}^{k-1}(Low_{t-j})} \times 100$$
$$\%D_t = SMA_t(d, \%K) \quad (k=14, d=3)$$

### 3.8. ATR (Average True Range de Welles Wilder)
Quantifica a volatilidade absoluta incorporando potenciais gaps de abertura:
- **True Range**:
  $$TR_t = \max(High_t - Low_t, |High_t - Close_{t-1}|, |Low_t - Close_{t-1}|)$$
- **Suavização de Wilder (14 períodos)**:
  $$ATR_t = \frac{ATR_{t-1} \times 13 + TR_t}{14}$$

### 3.9. VWAP (Volume Weighted Average Price)
Média ponderada pelo volume negociado na sessão:
$$TP_t = \frac{High_t + Low_t + Close_t}{3}$$
$$VWAP_t = \frac{\sum_{j=0}^t (TP_j \times Volume_j)}{\sum_{j=0}^t Volume_j}$$

### 3.10. CCI (Commodity Channel Index de Donald Lambert)
Oscilador estatístico que quantifica variações em relação à média estatística:
$$TP_t = \frac{High_t + Low_t + Close_t}{3}$$
$$MeanDev_t = \frac{1}{N} \sum_{j=0}^{N-1} |TP_{t-j} - SMA_t(N, TP)|$$
$$CCI_t = \frac{TP_t - SMA_t(N, TP)}{0.015 \times MeanDev_t} \quad (N=20)$$
