# SUBETAPA 4: MOTOR GRÁFICO, OVERLAYS EM TEMPO REAL E DESENHO DENTRO DO GRÁFICO DA API

> **Orquestrador:** `tech-lead-orchestrator`  
> **Agentes Envolvidos:** `chart-trading-engineer`, `iq-fidelity-reviewer`, `qa-resilience-agent`, `surgical-frontend-agent`  
> **Skills Aplicadas:** `11-chart-trading-tools`, `03-synthetic-market-engine`, `06-testing-quality`, `14-teste-de-sobreposicao`

---

## 1. Objetivo Visual e de Engenharia Gráfica
Atender ao pedido central do usuário: **"desenhar dentro do gráfico da API do trading, sem quebrar o que já existe e funciona"** e transformar a estética rústica em um gráfico ultra-profissional idêntico à **Imagem 1**:

1. **Renderização de Velas da API no Lightweight Charts:**
   - Paleta oficial: Velas de alta verde `#22C47A` e velas de baixa vermelho `#F2545B`.
   - Fundo Noche `#0D0F14` com linhas de grade suaves `rgba(244, 245, 247, 0.03)` e marca d'água sutil.
2. **Traders Mood Bar em Diamantes (Sentimento):**
   - Substituição da barra contínua por **coluna vertical de diamantes/losangos** no lado esquerdo do gráfico.
   - Topo: `SUBE 52%` com pilha de diamantes verdes.
   - Base: `BAJA 48%` com pilha de diamantes vermelhos.
3. **Linhas de Tempo Real & Sincronia de Trade:**
   - **Linha de Preço Atual:** Linha horizontal pontilhada verde que acompanha o tick em tempo real com etiqueta verde em seta/pill no eixo Y com o preço exato (ex: `89.587`).
   - **Linha de Fim de Compra (Trava 30s):** Linha vertical pontilhada branca com contador `HORA DE COMPRA 00:08` e ícone circular de cronômetro no eixo temporal.
   - **Linha de Expiração (Trava 00s):** Linha vertical contínua vermelha `#F2545B` com ícone circular de bandeira quadriculada no eixo temporal.
4. **Sub-controles Flutuantes do Gráfico (Topo e Base Esquerda):**
   - No topo esquerdo do gráfico: Seletor do ativo com bandeira `NZD/JPY Turbo ▾`, ícone de informação `(i)`, sino de alertas `🔔` e estrela de favoritos `★`.
   - Na base esquerda: Botão de tipo de gráfico (velas/área), botão de ferramentas de desenho (lápis) e botão de tela cheia.
5. **Ferramentas de Desenho Vetorial Dentro do Gráfico da API:**
   - Ferramentas disponíveis: Linha de Tendência, Linha Horizontal de Suporte/Resistência, Linha Vertical e Retração de Fibonacci (6 níveis áureos: 0%, 23.6%, 38.2%, 50%, 61.8%, 100%).
   - Mapeamento bidirecional de coordenadas `(price, time, logical) ↔ (pixelX, pixelY)` permitindo desenhar além da vela atual (Right Offset).
   - Hitbox generosa de **24px** para facilitar o clique e manipulação de linhas pelo trader sob pressão.
   - Persistência segura em `localStorage` com chave isolada por símbolo (`broker_drawings_${symbol}`).
   - Taxa de quadros garantida a **60 FPS** com coalescência via `RafChartUpdater`.

---

## 2. Escopo Cirúrgico da Subetapa

### 2.1 Lista Fechada de Arquivos Impactados
- `apps/web/src/chart/PriceChart.tsx` (Configuração estética completa do gráfico e integração dos overlays).
- `apps/web/src/chart/TradersMoodBar.tsx` (Implementação visual dos diamantes empilhados).
- `apps/web/src/chart/TimeLinesOverlay.tsx` (Linha pontilhada de compra com cronômetro e linha vermelha com bandeira).
- `apps/web/src/chart/ChartDrawingOverlay.tsx` (Camada SVG transparente com captura de eventos do mouse e projeção matemática das linhas).
- `apps/web/src/chart/ChartDrawingToolbar.tsx` (Menu flutuante discreto com opções de desenho).
- `apps/web/src/trade/chart-drawing-tools.unit.test.ts` (Bateria de testes matemáticos e de desenho).

### 2.2 O que Muda
- A representação gráfica agora espelha exatamente a Imagem 1.
- Inclusão dos diamantes no Traders Mood Bar.
- O desenho vetorial funciona diretamente sincronizado com a escala de preços e tempos do Lightweight Charts.

### 2.3 O que NÃO Muda
- A ingestão de ticks e candles continua obedecendo aos mesmos dados oficiais da API.
- Os indicadores técnicos (SMA, EMA, Bollinger, RSI) preservam suas fórmulas matemáticas rígidas e causais.

---

## 3. Matriz de Testes Rigorosos

### 3.1 Testes Unitários e Geométricos
- Validação do cálculo de Fibonacci nos 6 níveis áureos ($P_{k} = P_{1} + k \times \Delta P$) com tolerância $< 0.0001$.
- Teste de interceptação da hitbox de 24px: cliques a 12px da linha selecionam a reta; cliques a 13px são ignorados.
- Teste de resample de velas: conversão determinística de velas de 1m a partir dos ticks.

### 3.2 Testes de Estresse
- Renderização de 50 linhas de desenho simultâneas no gráfico mantendo tempo de frame sob 16.6ms (60 FPS constante).
- Injeção de 100 eventos de arraste (`mousemove`) no mesmo microsegundo comprovando exatamente 1 chamada ao `requestAnimationFrame`.

### 3.3 Testes de Caos
- Corrupção deliberada do `localStorage` com JSON malformado (`{broken: "json"`) demonstrando recuperação graciosa para lista vazia sem quebrar o componente.
- Mudança brusca de símbolo (`NZDJPY` -> `EURUSD` -> `BTCUSD`) garantindo isolamento total dos desenhos de cada ativo.

### 3.4 Testes de Segurança
- Validação de que coordenadas extremas (preço negativo, timestamp no passado infinito) não causam loop infinito ou estouro de pilha.

### 3.5 Testes de Regressão
- A funcionalidade de zoom e arrasto (pan) do Lightweight Charts continua suave e sem travar os desenhos vetoriais na posição antiga.

---

## 4. Critérios de Aceite (Gate de Saída)
1. Gráfico idêntico à Imagem 1 com velas nítidas, linha de preço em verde neon com badge flutuante `89.587`.
2. Traders Mood Bar em diamantes verdes e vermelhos funcional.
3. Linhas verticais de compra e expiração visíveis com seus respectivos ícones.
4. Desenho de retas e Fibonacci funcional e persistente.
5. `chart-drawing-tools.unit.test.ts` 100% verde.
