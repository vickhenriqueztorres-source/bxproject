# Plano Mestre de Correção Definitiva: Multi-Gráficos e Escala Vertical

**Orquestrador:** `tech-lead-orchestrator`  
**Data:** 09/10/2026  
**Status:** Em Execução Subetapa por Subetapa  
**Diretriz Inviolável:** NENHUM código será implementado sem testes robustos prévios (TDD estrito). Cada subetapa deve ser validada e aprovada a 100% antes do avanço.

---

## 1. Diagnóstico Forense Definitivo das Causas Raiz (Smoking Guns)

### 🔴 Problema 1: "SELECIONO AUDUSD E NÃO VAI PRA ESSE GRÁFICO / GRÁFICOS SEPARADOS FALTANDO"
* **Evidência no Código (`MultiChartGrid.tsx` L251-285, L488):**
  - No layout `1x1` (modo tela cheia padrão), `visibleCellsCount = 1`.
  - A grade renderiza apenas `cells.slice(0, 1)`.
  - O array `cells` era sincronizado colocando `openTabs[0]` na célula 0, `openTabs[1]` na célula 1, etc.
  - Quando o usuário clicava em qualquer outra aba (`AUDUSD_OTC`, `USDCAD_OTC`), o `App.tsx` atualizava `activeSymbol`, mas a célula 0 permanecia amarrada a `openTabs[0]` (`SYNTH_VOL_50`)!
  - Como `cells.slice(0, 1)` só renderiza a célula 0, a viewport **NUNCA** trocava de ativo. O gráfico ficava eternamente travado no primeiro ativo da lista.
  - Nos layouts multi-gráfico (`2x1`, `2x2`, `3x2`), as células não permitiam que abas além do número de células fossem ativadas na célula focada.

### 🔴 Problema 2: "VELA ENORME, GAP GIGANTE, GRÁFICO PEQUENO DEMAIS (VELAS EM 1.253 E TICK EM 499)"
* **Evidência no Print e Código (`client.ts` L40-52, L267-275):**
  - No modo Guest/Dev, `client.ts` lia do `sessionStorage.getItem('synth_mock_store')`.
  - Nas sessões anteriores, o `sessionStorage` gravou histórico de velas para `SYNTH_VOL_50` cotadas a **~1.253,87** (quando o preço base estava descalibrado).
  - Quando o usuário recarrega a página, `getCandles('SYNTH_VOL_50')` encontrava essas velas antigas no cache do navegador e as retornava diretamente.
  - Paralelamente, o feed WebSocket conectava à VPS recebendo ticks cotados ao preço real de **499,84**.
  - O motor gráfico (`Lightweight Charts`) era forçado a esticar a escala vertical de **400 até 1.360** para abarcar tanto as velas velhas (1.253) quanto o tick atual (499).
  - Resultado: As velas ficavam espremidas numa linha de poucos pixels no topo da tela com um abismo de 754 pontos de distância do tick atual.
  - Além disso, faltava um mecanismo automático de purga de cache com validação de divergência de preço (> 15%) em relação a `getAssetBasePrice(symbol)`.

---

## 2. Divisão em Subetapas

```
[Subetapa 01] Mapeamento Dinâmico de Células no MultiChartGrid (1x1 e Grades Multi-Gráficos)
      │
      ▼ (Validado a 100% com Testes Unitários, Estresse e Caos)
[Subetapa 02] Purga de Cache Zumbi no sessionStorage, Sanitização de Preço Base e Reset de Escala
      │
      ▼ (Validado a 100% com Testes Unitários, Estresse e Caos)
[Subetapa 03] Testes de Integração End-to-End, Build, Deploy na VPS e Validação ao Vivo
```

---

## 3. Detalhamento das Subetapas

### Subetapa 01: Sincronização Dinâmica de Células no `MultiChartGrid`
* **Objetivo:** Garantir que:
  1. No layout `1x1`, a célula exibida seja rigorosamente `activeSymbol`. Ao clicar em qualquer aba (`AUDUSD_OTC`, `USDCAD_OTC`, etc.), o gráfico atualiza instantaneamente.
  2. Nos layouts de múltiplos gráficos (`2x1`, `2x2`, `3x2`), a célula em foco exiba `activeSymbol`, e as demais células exibam as outras abas de `openTabs` sem duplicidade.
  3. Clicar em uma célula da grade mude o `activeSymbol` do App para o ativo daquela célula.
* **Testes Robustos Prévios:**
  - `apps/web/src/chart/multichart-selection.unit.test.tsx`:
    - **Teste 1 (Layout 1x1):** Alternância entre 4 abas diferentes (`SYNTH_VOL_50` -> `AUDUSD_OTC` -> `USDCAD_OTC` -> `EURUSD_OTC`) atualiza `cells[0].symbol` e renderiza a `GridCell` com o ativo correto.
    - **Teste 2 (Layout Multi-Gráfico 2x1 e 2x2):** Renderização correta de viewports distintos com sincronização bidirecional de foco e abas.
    - **Teste de Estresse (Troca Rápida de Abas):** 100 trocas sucessivas de abas em alta frequência sem vazamento de memória ou descompasso de símbolo.
    - **Teste de Caos (Abas Vazias / Nulas / Duplicadas):** Resiliência contra arrays com símbolos inválidos ou duplicados com fallback imediato para ativos padrão.
* **Critério de Aceite da Subetapa 01:** Todos os testes verdes; nenhuma regressão na suíte Vitest.

---

### Subetapa 02: Purga de Cache Zumbi, Sanitização de Preço e Reset de Escala
* **Objetivo:** Garantir que:
  1. Qualquer cache persistido no `sessionStorage` com preços divergentes (> 20%) do preço base oficial (`getAssetBasePrice`) seja imediatamente expurgado e substituído por velas alinhadas.
  2. A chave do store seja migrada para `synth_mock_store_v3`, limpando chaves obsoletas legadas.
  3. No `IsolatedChartHost.tsx`, a troca de símbolo force limpeza atômica de resíduos de preço e acione `applyOptions({ autoScale: true })` e `scrollToRealTime()`.
* **Testes Robustos Prévios:**
  - `apps/web/src/api/client-cache-invalidation.unit.test.ts`:
    - **Teste 1 (Purga Automática de Cache Zumbi):** Simular `sessionStorage` contendo velas de `SYNTH_VOL_50` cotadas a 1.253. Invocar `getCandles('SYNTH_VOL_50')` e verificar que o cache antigo foi descartado e as novas velas estão centradas em ~500.1250.
    - **Teste 2 (Tolerância de Preço Base):** Velas dentro da faixa de flutuação normal são mantidas; velas com salto anormal são purgadas.
    - **Teste de Caos (JSON Corrompido no sessionStorage):** Resiliência contra strings inválidas ou tipos truncados no `sessionStorage`.
* **Critério de Aceite da Subetapa 02:** Todos os testes verdes; purga de cache comprovada por asserções estritas.

---

### Subetapa 03: Testes de Integração, Build, Deploy na VPS e Verificação ao Vivo
* **Objetivo:**
  1. Executar suíte completa de testes no Vitest (`npx vitest run apps/web`).
  2. Executar build de produção (`pnpm --filter @broker/web build`).
  3. Realizar deploy seguro para a VPS (`node scripts/deploy-to-vps.mjs`) com recarga do Nginx e PM2.
  4. Reiniciar o servidor de preview local e comprovar o alinhamento visual de escala e a seleção imediata de ativos.
* **Critério de Aceite da Subetapa 03:** Deploy na VPS bem-sucedido, preview funcional, gráficos sincronizados e escala perfeitamente ajustada.
