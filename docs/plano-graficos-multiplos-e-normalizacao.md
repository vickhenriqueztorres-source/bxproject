# Plano Diretor: Multi-Gráficos Separados e Normalização de Escala Gráfica

**Status:** APROVADO PELO ORQUESTRADOR  
**Papel Operacional:** `tech-lead-orchestrator`  
**Agentes Mobilizados:** `broker-architect-agent`, `chart-trading-engineer`, `surgical-frontend-agent`, `qa-resilience-agent`, `regression-guardian-agent`  
**Skills Ativas:** `01-project-context`, `03-synthetic-market-engine`, `06-testing-quality`, `11-chart-trading-tools`, `12-tokens-binmax`, `17-mudanca-cirurgica`, `18-zonas-sensiveis`, `19-testes-de-regressao-visual`

---

## 1. Diagnóstico Forense dos Problemas

### 1.1 Problema 1: Gráficos Separados Faltando (Multi-Gráficos)
- **Causa Raiz A:** Em `apps/web/src/chart/MultiChartGrid.tsx`, a barra seletora de layout está oculta sob a flag Binmax (`{(!isBinmax || layout !== '1x1') && ...}`).
- **Causa Raiz B:** Em `apps/web/src/components/header/TerminalHeader.tsx`, o botão `data-testid="header-grid-layout-btn"` existe visualmente, porém não possui evento `onClick`, nem menu/popover para escolha de layout (1x1, 2x1 vertical/horizontal, 2x2 grade, 3x2 institucional).
- **Causa Raiz C:** Em `apps/web/src/App.tsx`, o estado `layout` não é compartilhado entre o Header e o `MultiChartGrid`, impedindo que o operador ative telas separadas simultâneas.

### 1.2 Problema 2: Abertura com Vela Enorme, Gap Gigante ou Pequeno Demais
- **Causa Raiz A (Vela Gigante e Gap)**: Dessincronização entre `generateSeedCandles(symbol, ...)` e o primeiro `Tick` em tempo real:
  - Enquanto a query `/api/candles` carrega, o gráfico usa velas semente cujo preço final difere do preço real do tick WebSocket.
  - Ao chegar o tick em `candleFromTick`, a biblioteca estica a vela atual unindo o preço da semente ao tick real, criando uma vela com amplitude de dezenas/centenas de pontos.
- **Causa Raiz B (Gráfico Pequeno Demais / Escala Comprimida)**:
  - O `IsolatedChartHost` reutiliza a instância do gráfico sem redefinir a escala (`rightPriceScale().applyOptions({ autoScale: true })` e `timeScale().fitContent() / scrollToRealTime()`).
  - Ao alternar entre ativos de diferentes grandezas (ex: BTCUSD a $64.000 vs EURUSD a 1.0850), o range anterior prende a escala, comprimindo as novas velas em uma linha invisível.
- **Causa Raiz C (Condição de Corrida WebSocket vs REST Candles)**:
  - Ticks chegam antes da resolução do snapshot histórico REST. Se uma vela incompleta é inserida antes do lote canônico, ocorre distorção de timestamp e buracos temporais.

---

## 2. Divisão em Subetapas Rígidas (Test-Driven Development)

### SUBETAPA 01: Normalização de Escala, Alinhamento de Semente e Prevenção de Velas Gigantes
**Objetivo:** Garantir que NENHUM gráfico abra com velas desproporcionais, gaps de semente ou escala travada.
- **Ações:**
  1. Criação do módulo `apps/web/src/chart/chart-scale-normalizer.ts`:
     - Alinhamento de preço de semente com o tick de mercado mais recente disponível.
     - Clamp e filtro anti-spike para primeiro tick pós-montagem.
     - Reset forçado de autoscale e reposicionamento de viewport (`autoScale: true`, `fitContent()`) ao trocar de símbolo ou montar gráfico.
  2. Ajuste em `candleFromTick` / `PriceChart.tsx`:
     - Se a diferença percentual entre a vela semente e o primeiro tick ultrapassar o limiar de volatilidade normal (>3%), a vela semente é renormalizada para ancorar no preço do tick sem criar pavio deformado.
  3. Atualização no `IsolatedChartHost.tsx` e `PriceChart.tsx`.
- **Testes Obrigatórios:**
  - `apps/web/src/chart/chart-scale-normalizer.unit.test.ts` (testes de estresse, saltos de ordens de magnitude BTC vs EURUSD, ticks com latência e spikes).

---

### SUBETAPA 02: Dropdown / Popover de Layout de Multi-Gráficos no Header
**Objetivo:** Permitir ao operador selecionar e alternar grades de gráficos separados (1 tela cheia, 2 lado a lado, 4 grade 2x2, 6 institucional).
- **Ações:**
  1. Criação do componente `apps/web/src/chart/GridLayoutPopover.tsx` com design Turbo Prata da Binmax.
  2. Conexão do botão `header-grid-layout-btn` no `TerminalHeader.tsx` para abrir o popover e disparar `onLayoutChange`.
  3. Conexão do estado `layout` no `App.tsx` repassando para `TerminalHeader` e `MultiChartGrid`.
  4. Suporte a sincronização e foco do ativo ativo entre as janelas da grade.
- **Testes Obrigatórios:**
  - `apps/web/src/chart/grid-layout-popover.unit.test.tsx` (abertura, seleção de layout, fechamento ao clicar fora ou ESC, disparo de eventos).

---

### SUBETAPA 03: Estresse, Caos, Isolamento Cross-Asset e Validação Completa
**Objetivo:** Provar a estabilidade de múltiplos gráficos rodando simultaneamente sem memory leak, sem vazamento de ticks e com 100% dos testes passando.
- **Ações:**
  1. Testes de estresse com 6 gráficos simultâneos processando 500 ticks/s.
  2. Testes de caos com perda e recuperação de foco, troca rápida de ativos e reconexão de WebSocket.
  3. Execução da suíte completa de testes (`npx vitest run apps/web`).
- **Critério de Aceite:** 100% dos testes verdes, zero erros de linter, sem travamento de UI.
