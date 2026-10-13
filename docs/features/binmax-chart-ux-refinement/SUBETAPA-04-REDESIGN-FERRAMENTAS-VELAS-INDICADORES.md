# SUBETAPA 04: REDESIGN PROFISSIONAL DA BARRA FLUTUANTE DE VELAS, TIMEFRAME E INDICADORES

**Feature ID:** `BMR-CHART-UX-REFINEMENT-2026-10-09`  
**Subetapa:** 04 de 06  
**Responsável:** `chart-trading-engineer` / `surgical-frontend-agent`  
**Revisores:** `qa-resilience-agent`, `compliance-risk-reviewer`

---

## 1. Problema Identificado e Escopo

> *"4 - Ajustar essa parte das velas dos indicadores esta com um designer horrivel"*

- Em `apps/web/src/chart/ChartDrawingToolbar.tsx`, a barra flutuante de ferramentas de análise técnica na lateral esquerda do gráfico apresentava elementos simplistas e visual rústico:
  - Emoji de vela `🕯️` e linha `📈`.
  - Indicadores técnicos representados por texto de parênteses com ponto `((•))`.
  - Ferramenta de desenho com emoji de lápis e badge amarelo "NEW" rústico.
  - Painéis popover escuros sem blur ou tokens institucionais Turbo Prata.
- **Redesign Institucional estilo IQ Option**:
  1. **Cápsula Flutuante Minimalista**:
     - Estilo *Glassmorphism*: `background: rgba(18, 24, 38, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(244, 245, 247, 0.1); border-radius: 8px;`.
     - 4 botões verticais ergonômicos de 34px x 34px:
       1. **Tipo de Gráfico**: Ícone vetorial SVG nítido de par de candlesticks com preenchimento verde/vermelho translúcido.
       2. **Timeframe**: Rótulo limpo em tipografia `Geist Mono` (`1m`, `5s`, `15s`, `5m`).
       3. **Indicadores Técnicos**: Ícone vetorial SVG de oscilador / onda analítica (bússola / onda senoidal), eliminando `((•))`.
       4. **Ferramentas Gráficas**: Ícone vetorial SVG de caneta geométrica / régua de análise.
  2. **Menus Popover Elegantes**:
     - Fundo `#151922` com bordas sutis e tipografia Archivo em espanhol neutro.
     - Indicador de estado ativo com borda ciano vívida `#00e5ff` ou verde `#22C47A`.

---

## 2. Passo a Passo de Execução

1. **Editar `ChartDrawingToolbar.tsx`**:
   - Criar e importar ícones vetoriais SVG de alta resolução para: `IconCandlestickPair`, `IconWaveIndicators`, `IconToolPencil`.
   - Substituir o render dos botões principais para usar os novos SVGs.
   - Refinar os popovers de seleção de tipo de gráfico, timeframe, indicadores (SMA, EMA, Bollinger, RSI, MACD, etc.) e ferramentas de desenho (Linha de Tendência, Suporte/Resistência, Fibonacci).
2. **Desenvolver Bateria de Testes Automatizados**:
   - Criar `apps/web/src/chart/subetapa-ux-04-drawing-toolbar.unit.test.tsx`.
   - Teste 1: Renderização dos 4 botões com SVGs dedicados (sem emojis 🕯️ ou texto ((•))).
   - Teste 2: Abertura e fechamento de cada popover ao clicar.
   - Teste 3: Seleção de timeframe e chamada correta de `onSelectTimeframe`.
   - Teste 4: Alternância de indicadores e ferramentas com destaque visual ativo.
   - Teste 5: Teste de estresse com 100 cliques rápidos de abertura de menus sem vazamento.
3. **Execução e Emissão do Relatório de Gate**:
   - Rodar Vitest e emitir `docs/features/binmax-chart-ux-refinement/relatorios/RELATORIO-SUBETAPA-04.md`.
