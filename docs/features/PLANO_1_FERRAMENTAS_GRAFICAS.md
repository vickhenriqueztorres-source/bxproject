# PLANO 1 — Ferramentas Gráficas e Indicadores Técnicos
## Detalhamento Completo, Subetapas e Bateria de Testes

---

## 1. Definição Arquitetural e Seleção de Tecnologias

### 1.1. Comparativo Técnico de Viabilidade
| Critério | TradingView Free Widget | TradingView Charting Library (Empresarial) | Lightweight Charts + Camada Overlay (Escolhido) |
| :--- | :--- | :--- | :--- |
| **Suporte a Ticks OTC em Tempo Real** | ❌ Impossível (somente feeds da TV) | ✅ Possível via UDF | ✅ Perfeito via WebSocket local |
| **Custo / Burocracia** | Gratuito | ❌ Contrato pago + NDA + GitHub privado | ✅ Gratuito e 100% Open-Source |
| **Desempenho e FPS** | 30-45 FPS em iframe pesado | 60 FPS | ✅ 60 FPS constante via Canvas 2D/WebGL |
| **Controle de UI / Dark Theme** | Limitado | Alto | ✅ Controle absoluto de CSS e SVG |
| **Decisão** | Inviável para OTC sintético | Inviável burocraticamente | **ESCOLHIDO (Mais Fácil e Preciso)** |

### 1.2. Plano Geral vs. Plano Secundário
- **Plano Geral (Principal)**:
  - Utilizar a infraestrutura do `lightweight-charts` já em execução.
  - Desenvolver componente `ChartDrawingToolbar.tsx` acoplado à esquerda do gráfico (idêntico à imagem de referência).
  - Desenvolver componente `ChartDrawingOverlay.tsx` (camada SVG interativa mapeada no canvas do Lightweight Charts através de coordenadas matemáticas de preço/tempo).
  - Implementar 5 ferramentas de desenho:
    1. **Linha**: Segmento entre dois cliques.
    2. **Linha de Tendência**: Segmento com projeção infinita/angular.
    3. **Linha Horizontal**: Nível de preço com snap automático e etiqueta na escala.
    4. **Linha Vertical**: Nível temporal com snap na vela.
    5. **Retração de Fibonacci**: Grade de suporte/resistência (0.0%, 23.6%, 38.2%, 50.0%, 61.8%, 100.0%).
  - Menu de Indicadores Técnicos integrado: SMA, EMA, Bandas de Bollinger e RSI adicionados diretamente como séries matemáticas ao gráfico.
- **Plano Secundário (Fallback)**:
  - Caso haja incompatibilidade geométrica de zoom com o SVG, utilizar overlay em Canvas 2D dedicado com redraw disparado pelo evento `subscribeVisibleTimeRangeChange` do Lightweight Charts.

---

## 2. Divisão em Subetapas Detalhadas

### Subetapa 1.1: Barra Lateral de Ferramentas Gráficas
- **Objetivo**: Inserir barra lateral esquerda estilizada com ícones de:
  - Tipo de Gráfico (Velas/Linhas);
  - Período de Vela (5s, 15s, 30s, 1m, 5m);
  - Indicadores Técnicos `((•))`;
  - Ferramentas Gráficas `✏️` (com popup expansível idêntico à imagem de referência);
  - Limpar Desenhos `🗑️`.
- **Arquivos**: `apps/web/src/chart/ChartToolbar.tsx`, `apps/web/src/chart/PriceChart.tsx`.

### Subetapa 1.2: Camada de Desenho Interativa (Linhas e Níveis)
- **Objetivo**: Captura de eventos de mouse (`onMouseDown`, `onMouseMove`, `onMouseUp`) sobre o gráfico.
- **Mapeamento de Coordenadas**:
  - `coordinateToPrice(y)` e `priceToCoordinate(price)`;
  - `coordinateToTime(x)` e `timeToCoordinate(time)`.
- **Persistência**: Salvamento em `localStorage` por símbolo (`broker_drawings_${symbol}`).
- **Ferramentas Ativas**: Linha livre, Linha de tendência, Linha horizontal e Linha vertical.

### Subetapa 1.3: Retração de Fibonacci e Personalização de Estilo
- **Objetivo**: Ferramenta de Fibonacci que calcula os 6 níveis áureos entre topo e fundo selecionados pelo usuário, com cores distintas e linhas tracejadas. Seletor de cor da linha (Amarelo, Azul, Vermelho, Verde) e espessura (1px, 2px).
- **Ações**: Botão de exclusão individual da linha ao clicar sobre ela e botão de limpar todas as ferramentas.

### Subetapa 1.4: Indicadores Técnicos Nativos (SMA, EMA, Bollinger, RSI)
- **Objetivo**: Adicionar séries matemáticas calculadas sob demanda a partir das velas carregadas.
  - SMA 9 e SMA 21 (Linhas amarela e azul);
  - EMA 14 (Linha ciano);
  - Bandas de Bollinger 20 (Superior, Média e Inferior);
  - RSI 14 em painel inferior com linhas horizontais nos níveis 30 e 70.

---

## 3. Matriz de Testes Exaustivos

### 3.1. Testes de Estresse
- Renderizar 50 linhas simultâneas no gráfico enquanto ticks chegam a cada 100ms.
- Medição de FPS via `requestAnimationFrame`: a taxa não pode cair abaixo de 55 FPS.
- Teste de zoom e arrasto contínuo da escala de tempo com 30 desenhos ativos.

### 3.2. Testes de Caos
- Redimensionamento violento da janela (de 1920x1080 para 800x600 e vice-versa). As linhas devem se reajustar exatamente aos mesmos níveis de preço e tempo.
- Troca imediata de ativo (`SYNTH_VOL_50` -> `CRYPTO_BTC_SYNTH`). As linhas do ativo anterior devem ser ocultadas e as do ativo selecionado restauradas.

### 3.3. Testes de Segurança
- Validação de schema no `localStorage`: tentar injetar JSON corrompido ou strings arbitrárias. O sistema deve descartar e inicializar com array vazio sem disparar `Uncaught TypeError`.

### 3.4. Critérios de Aceite para Fechamento do Gate 1
- [ ] Barra lateral esquerda idêntica à imagem fornecida pelo usuário.
- [ ] Desenho fluido de Linha Horizontal, Vertical, Tendência e Fibonacci.
- [ ] Snap nos preços e persistência após recarregar a página (`F5`).
- [ ] Ativação/Desativação de pelo menos 2 indicadores técnicos (SMA e Bollinger).
- [ ] Zero erros no console do navegador.
