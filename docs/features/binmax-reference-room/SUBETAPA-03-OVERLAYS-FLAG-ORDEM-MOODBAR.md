# SUBETAPA 03: OVERLAYS GRÁFICOS, FLAG DE ORDEM & MOOD BAR (SESSÃO 3 & SESSÃO 1)

**Objetivo:** Implementar os elementos gráficos operacionais em tempo real: a Flag de Ordem Aberta ancorada na linha de Strike (Sessão 3), a Mood Bar vertical de sentimento do mercado (Sessão 1), as linhas verticais de Compra e Expiração com badges circulares, e a barra de ferramentas inferior esquerda.

---

## 1. Escopo e Fronteiras

- **Arquivos Abrangidos:**
  * `apps/web/src/chart/PriceChart.tsx`
  * `apps/web/src/chart/OrderFlagsOverlay.tsx` (ou componente equivalente de bandeira de ordem)
  * `apps/web/src/chart/TimeLinesOverlay.tsx`
  * `apps/web/src/chart/SentimentMoodBar.tsx`
  * `apps/web/src/trade/subetapa-04-chart-overlays.unit.test.tsx`
- **Fronteira Proibida:** Não alterar a geração estocástica de preços do motor CSPRNG nem interpolar candles inexistentes.

---

## 2. Detalhamento dos Overlays (Sessão 1 & Sessão 3)

### 2.1 Flag de Ordem Aberta (Sessão 3):
- Ao registrar uma ordem (`OPEN`):
  * **Linha de Strike:** Linha horizontal projetada no preço de entrada da ordem.
  * **Badge/Flag de Operação:** Pílula ancorada à direita da linha de strike exibindo:
    - Seta direcional: `▲` (Verde para SUBE) ou `▼` (Vermelho para BAJA).
    - Montante apostado: `$100`.
    - Cronômetro regressivo em tempo real: `00:14` (calculado a partir da expiração da ordem).

### 2.2 Linhas de Tempo (Sessão 1 & 3):
- **Hora de Compra:** Linha vertical branca tracejada com cabeçalho de contagem regressiva `HORA DE COMPRA 00:08` e badge circular com ícone de cronômetro na base.
- **Linha de Expiração:** Linha vertical vermelha contínua com badge circular de bandeira de chegada na base.

### 2.3 Mood Bar (Barra de Humor / Sentimento):
- Posicionada verticalmente na margem esquerda da área útil do gráfico.
- Topo: `SUBE 52%` em Verde Ganancia.
- Coluna de pílulas/losangos: blocos superiores verdes e blocos inferiores vermelhos refletindo a proporção de ordens.
- Base: `BAJA 48%` em Vermelho Risco.

### 2.4 Ferramentas de Desenho e Visualização (Inferior Esquerda):
- Ícone de tipo de gráfico (Candles).
- Ícone de ferramentas de desenho (Lápis).
- Ícone de alternância de tela cheia (Fullscreen).

---

## 3. Passo a Passo de Execução

1. **Desenvolvimento / Ajuste do Componente `OrderFlagsOverlay.tsx`:**
   Renderizar as tags operacionais no Canvas/SVG sobre o gráfico, mapeando preço para coordenadas Y com alta precisão e sem travamento de FPS (60 FPS garantidos).
2. **Integração das Linhas de Compra e Expiração:**
   Assegurar ancoragem no tempo lógico do gráfico e renderização dos badges circulares no rodapé do chart.
3. **Refinamento da `SentimentMoodBar`:**
   Garantir proporção visual exata da Prancha 1 com blocos arredondados e cálculo dinâmico baseado nos contratos ativos.
4. **Execução de Testes de Posicionamento e Performance:**
   Testar cálculo de coordenadas sob zoom e pan do gráfico.

---

## 4. Testes Rigorosos e Critérios de Aceite

### 4.1 Testes Unitários:
- Validação da projeção de Y para a linha de strike baseada no preço da ordem.
- Teste da contagem regressiva da flag até zero.

### 4.2 Teste de Estresse (Render a 60 FPS):
- Injetar 100 ticks por segundo enquanto 10 ordens estão abertas simultaneamente: verificar taxa de quadros e ausência de vazamento de memória em Canvas/DOM.

### 4.3 Teste de Caos:
- Forçar redimensionamento brusco da viewport ou perda transitória de contexto WebGL: os overlays devem se reancorar sem lançar exceções não tratadas.

### 4.4 Teste de Integridade Financeira:
- O valor da flag de ordem deve refletir estritamente o valor do contrato (`stake_minor / 100`) sem discrepâncias de arredondamento.

---

## 5. Critério de Gate
- **Status:** [ ] PENDENTE
- Flag de ordem visível e animada com countdown.
- Mood Bar e linhas de compra/expiração perfeitamente integradas.
