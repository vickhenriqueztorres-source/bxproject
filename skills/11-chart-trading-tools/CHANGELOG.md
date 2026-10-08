# Changelog — 11-chart-trading-tools

Todas as alterações notáveis na skill `11-chart-trading-tools` serão documentadas neste arquivo.

## [1.1.0] — 2026-10-07

### Adicionado
- Expansão institucional para 10 indicadores técnicos nativos: WMA (20), MACD (12, 26, 9), Stochastic (%K 14, %D 3), ATR (14), VWAP e CCI (20).
- Suporte a séries compostas (MACD Line + Signal Line, Stochastic %K + %D, Bollinger Superior + Inferior).
- Otimização do menu de indicadores em `ChartDrawingToolbar.tsx` com contador de ativos em badge neon e scroll adaptativo.
- Suíte de testes de estresse (1.000 barras em < 100ms) e resiliência a caos em `indicator-stress.unit.test.ts`.

## [1.0.0] — 2026-10-07

### Adicionado
- Criação inicial da skill governando ferramentas de trading gráficas, indicadores técnicos e overlays de alta precisão.
- 10 Garantias Gráficas Invioláveis (G-01 a G-10).
- Definição formal das ferramentas de desenho: Linha, Tendência, Linha Horizontal com snap, Linha Vertical, Retração de Fibonacci nos 6 níveis áureos.
- Especificação formal dos indicadores matemáticos: SMA, EMA, Bandas de Bollinger e RSI com Wilder Smoothing.
- Mapeamento bidirecional de coordenadas de tela (Price <-> Y, Time/Logical <-> X) com suporte a margem futura (Right Offset).
- Especificação de hitbox transparente de 24px (raio 12px) para máxima facilidade de seleção.
- Bateria de testes automatizados com Vitest cobrindo estresse, caos e precisão matemática.
