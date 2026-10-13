# Plano Diretor Revisado e Definitivo: Multi-Gráficos e Normalização Gráfica

**Status:** APROVADO PELO ORQUESTRADOR E PELO POOL DE AGENTES ESPECIALIZADOS  
**Papel Operacional:** `tech-lead-orchestrator`  
**Consenso Técnico dos Agentes:**
- `broker-architect-agent`: Paridade estrita de preços base entre frontend e backend (500.1250 para SYNTH_VOL_50).
- `chart-trading-engineer`: Eliminação do `setData` a cada tick em `PriceChart` e isolamento estrito de `series.update()`. Reset forçado de autoscale e timeScale na troca de ativo.
- `iq-fidelity-reviewer`: Sincronização bidirecional entre as abas abertas (`openTabs`) e as janelas da grade (`MultiChartGrid`).
- `qa-resilience-agent`: Testes prévios de estresse, caos e regressão para cada subetapa.
- `surgical-frontend-agent`: Execução com menor diff possível e garantia de 100% de testes verdes.

---

## 1. Diagnóstico Forense das Falhas Reais

### Problema 1: Gráficos Separados Faltando
1. **Desconexão entre Abas (`openTabs`) e a Grade (`MultiChartGrid`)**:
   - `MultiChartGrid` possuía uma lista estática de símbolos hardcoded (`['cell-0', 'cell-1', ...]`), ignorando completamente as abas que o operador abriu.
   - Ao ativar o modo dividido (2x1, 2x2), o usuário via ativos arbitrários em vez das abas abertas.
2. **Falta de Sincronização Bidirecional**:
   - Clicar numa aba não dava foco à célula correspondente no grid, e mudar de ativo na célula não atualizava as abas.
   - Se o usuário abrisse novas abas com layout dividido, novos viewports não eram criados dinamicamente.
3. **Visibilidade e Posicionamento do Seletor de Grade**:
   - O popover anterior podia vazar ou não responder adequadamente fora do container pai.

### Problema 2: Abertura com Vela Enorme, Gap Gigante ou Pequeno Demais
1. **Divergência Crítica de Preço Base (750 Pontos!)**:
   - No frontend: `SYNTH_VOL_50` estava configurado em **1250.0** em `apps/web/src/catalog/assets.ts`.
   - No backend: `SYNTH_VOL_50` é gerado e transmitido em **500.1250** em `scripts/dev-live-feed.mjs`.
   - Na abertura do traderoom, o gráfico montava com semente em 1250 e, ao receber o primeiro tick em 500, criava uma vela gigante de amplitude monstruosa (queda de 750 pontos) que quebrava a escala vertical.
2. **Re-render Descontrolado com `setData` a Cada Tick**:
   - `effectiveCandles` possuía dependência `[internalCandles, symbol, tick]`. A cada tick recebido (a cada 200ms), a semente inteira de 2.880 velas era recalculada e repassada via `candleSeries.setData()`, quebrando a animação nativa do TradingView, redefinindo o viewport e forçando deformações.
3. **Resíduos de `PriceLine` Congelando Escala Vertical**:
   - Linhas horizontais de preço da cotação anterior permaneciam registradas na escala de preço anterior, fazendo com que ativos novos fossem forçados a renderizar na escala antiga, esmagando as velas em uma linha de 1 pixel ("pequeno demais").
4. **Alinhamento do Bucket Temporal**:
   - Ticks atualizavam timestamps em segundos arbitrários em vez de respeitar o bucket de minuto (`Math.floor(ts / 60) * 60`), causando gaps entre a semente e os ticks reais.

---

## 2. Divisão em Subetapas Rígidas e Sequenciais

### SUBETAPA 01: Paridade de Preços Base, Desacoplamento de Ticks e Estabilização de Escala
**Objetivo:** Resolver definitivamente o Problema 2 (Zero velas gigantes, zero gaps, zero gráficos microscópicos).
- **Ações:**
  1. Corrigir preço base de `SYNTH_VOL_50` para `500.1250` em `apps/web/src/catalog/assets.ts` e alinhar todos os 36 ativos com o backend.
  2. Remover `tick` da dependência de `effectiveCandles` no `PriceChart.tsx`.
  3. Velas históricas usam `setData` UMA ÚNICA VEZ por ativo. Ticks usam EXCLUSIVAMENTE `candleSeries.update()`.
  4. Na troca de ativo: limpeza total de priceLines e execução de `chart.priceScale('right').applyOptions({ autoScale: true })` e `timeScale().fitContent()`.
- **Testes Obrigatórios:**
  - `subetapa-01-parity-and-scale-hardening.unit.test.ts`:
    - Validação de paridade exata de preços base dos 36 ativos entre frontend e backend.
    - Teste de troca abrupta BTCUSD ($64.000) -> EURUSD ($1.0854) sem resíduo de escala.
    - Teste de 10.000 ticks contínuos sem chamada a `setData`.

---

### SUBETAPA 02: Sincronização Dinâmica de Abas (`openTabs`) com a Grade de Múltiplos Gráficos
**Objetivo:** Resolver definitivamente o Problema 1 (Gráficos separados conectados com as abas do operador).
- **Ações:**
  1. Refatorar `MultiChartGrid.tsx` para que as células da grade reflitam exatamente as abas abertas (`openTabs`):
     - Se `layout === '2x1'` e houver 2 abas abertas, cada tela exibe uma aba.
     - Se houver novas abas abertas pelo operador, a grade as preenche ordenadamente.
  2. Sincronização de foco: clicar em uma janela da grade ativa a aba no topo, e clicar na aba no topo foca a janela correspondente.
  3. Botão de grade no header acessível e integrado.
- **Testes Obrigatórios:**
  - `subetapa-02-tabs-grid-sync.unit.test.tsx`:
    - Mapeamento automático de `openTabs` para os viewports da grade.
    - Foco bidirecional entre abas e células da grade.
    - Adição e fechamento de abas refletindo instantaneamente nos viewports.

---

### SUBETAPA 03: Testes Integrados de Caos, Estresse, Build e Deploy na VPS
**Objetivo:** Prova irrefutável de homologação e deploy em produção.
- **Ações:**
  1. Suíte de caos com rajadas concorrentes em 6 gráficos simultâneos.
  2. Compilação TypeScript e Vite (`pnpm --filter @broker/web build`).
  3. Deploy na VPS (`169.58.159.77`) e teste de validação ao vivo.
- **Critério de Aceite:** 100% dos testes verdes, 0 erros no console do navegador, multi-gráficos operando fluidos e escalas perfeitas.
