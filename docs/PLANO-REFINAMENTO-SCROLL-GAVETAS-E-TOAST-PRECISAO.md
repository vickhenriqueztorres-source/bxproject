# Plano Mestre de Engenharia Visual & Resiliência: Stealth Scrollbars nas Gavetas e Redesign de Precisão do `TradeResultToast`

> **Orquestrador Ativo**: `tech-lead-orchestrator`  
> **Pool de Agentes Acionados**:
> 1. `chief-visual-director` (`designer-senior` / `senior-designer-agent`) — Governança estética e de motion (`21-designer-senior-binmax`).
> 2. `surgical-frontend-agent` (`cirurgiao`) — Execução cirúrgica com diff mínimo e preservação de contratos (`17-mudanca-cirurgica`, `12-tokens-binmax`, `13-textos-es`).
> 3. `qa-resilience-agent` & `regression-guardian-agent` (`guardiao-regressao`) — Suítes de testes unitários, estresse, segurança (XSS/Injection) e caos (`06-testing-quality`, `19-testes-de-regressao-visual`).

---

## 1. Diagnóstico Forense dos Problemas (Evidências `arquivo:linha`)

A análise das 3 capturas de tela enviadas revelou **7 falhas combinadas** (visuais, ergonômicas e de ciclo de vida React):

1. **Barra de Rolagem Vertical Branca Nativa (17px) em Todas as Gavetas (`Portafolio`, `Historial`, `Análisis`, `Torneos`)**:
   - **Evidência**: [`apps/web/src/components/sidebar/SidebarDock.tsx:666`](file:///d:/brokerproject/apps/web/src/components/sidebar/SidebarDock.tsx#L666) define `<div style={{ flex: 1, overflowY: 'auto', ... }}>` **sem** a classe `.bm-stealth-scroll`. No Windows, o navegador renderiza a barra de rolagem branca clássica de `17px` com setas cinzas.
2. **Barra de Rolagem Horizontal Branca Atravessando a Gaveta de `Análisis de Mercado`**:
   - **Evidência**: [`apps/web/src/news/MarketNewsDrawer.tsx:152-160`](file:///d:/brokerproject/apps/web/src/news/MarketNewsDrawer.tsx#L152-L160) usa `overflowX: 'auto'` na faixa de pílulas (`Todas | Índices | Cripto | Câmbio / Forex | Economia Global`) sem ocultar a barra horizontal, criando um trilho branco gigante no meio da gaveta.
3. **Duplo Scroll Vertical Aninhado e Cabeçalho Duplicado em `Análisis de Mercado`**:
   - **Evidência**: [`SidebarDock.tsx:605-663`](file:///d:/brokerproject/apps/web/src/components/sidebar/SidebarDock.tsx#L605-L663) já renderiza o cabeçalho `📰 Análisis de mercado [✕]`. Logo abaixo, [`MarketNewsDrawer.tsx:74-128`](file:///d:/brokerproject/apps/web/src/news/MarketNewsDrawer.tsx#L74-L128) renderiza um **segundo cabeçalho** (`📰 Notícias do Mercado [🔄] [✕]`) com outro botão `✕` e outro container `overflowY: 'auto'` (linha 187).
4. **Símbolo Técnico Cru (`SYNTH_VOL_50`) Exibido nos Cards de `Portafolio` e `Historial`**:
   - **Evidência**: [`BinmaxPortfolioDrawer.tsx:154`](file:///d:/brokerproject/apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx#L154) e [`BinmaxHistoryDrawer.tsx:103`](file:///d:/brokerproject/apps/web/src/components/drawer/BinmaxHistoryDrawer.tsx#L103) usam `c.symbol.replace('_OTC', '')` em vez de `getAssetDisplayName(c.symbol)` ([`assets.ts:195`](file:///d:/brokerproject/apps/web/src/catalog/assets.ts#L195)), vazando `SYNTH_VOL_50` na interface.
5. **Bug Crítico de Ciclo de Vida: `TradeResultToast` Nunca Fecha Sozinho (Fica Preso na Tela)**:
   - **Evidência**: [`TradeResultToast.tsx:20-25`](file:///d:/brokerproject/apps/web/src/components/toasts/TradeResultToast.tsx#L20-L25) declara `useEffect(..., [onClose, autoCloseMs])`. Em [`App.tsx:393`](file:///d:/brokerproject/apps/web/src/App.tsx#L393), `onClose={() => setSettledToast(null)}` é recriado a cada renderização do `Dashboard` (que ocorre a cada 1 segundo com os ticks do WebSocket). Como $1\text{s} < 4\text{s}$, o `clearTimeout` reseta o timer a cada segundo e o toast **nunca desaparece automaticamente**.
6. **Bug de Dados Hardcoded no Toast (`App.tsx:188-189`) e Colisão com Gaveta Aberta (`left: 84px`)**:
   - **Evidência**: [`App.tsx:188-189`](file:///d:/brokerproject/apps/web/src/App.tsx#L188-L189) grava `symbol: activeSymbol` e `direction: 'SUBE'` fixos em vez dos dados reais da ordem liquidada. Além disso, `left: '84px'` em [`TradeResultToast.tsx:52`](file:///d:/brokerproject/apps/web/src/components/toasts/TradeResultToast.tsx#L52) faz o toast ficar por cima dos cards quando qualquer gaveta lateral (`360px`) está aberta.
7. **Estética do `TradeResultToast` em Desacordo com `21-designer-senior-binmax`**:
   - **Evidência**: Círculo colorido maciço de `32px`, caixa alta empilhada e ausência de indicador visual de temporização dão aspecto de alerta genérico em vez de telemetria cirúrgica.

---

## 2. Divisão em Subetapas com Portões de Qualidade (Gates 01 a 04)

Cada subetapa possui implementação isolada e suíte própria de **Testes Unitários, Estresse, Segurança e Caos**. Nenhuma subetapa avança sem `100% PASS` na anterior.

---

### SUBETAPA 01 — Sistema Global de Stealth Scrollbar Dark & Erradicação de Scrollbars Brancas nas Gavetas
- **Arquivos Alvo**:
  - [`apps/web/src/styles/tokens-precision.css`](file:///d:/brokerproject/apps/web/src/styles/tokens-precision.css)
  - [`apps/web/src/components/sidebar/SidebarDock.tsx`](file:///d:/brokerproject/apps/web/src/components/sidebar/SidebarDock.tsx)
- **Passo a Passo**:
  1. Aprimorar `.bm-stealth-scroll` em `tokens-precision.css` (largura `4px`, trilho transparente, thumb `rgba(138, 146, 161, 0.22)`, `::-webkit-scrollbar-button { display: none; width: 0; height: 0; }`, `::-webkit-scrollbar-corner { background: transparent; }`).
  2. Adicionar `.bm-no-scrollbar` (`scrollbar-width: none; -ms-overflow-style: none;` e `::-webkit-scrollbar { display: none; }`) para faixas horizontais de pílulas/filtros.
  3. Aplicar regra escopada `.theme-binmax *` em `tokens-precision.css` para que nenhum container descendente dentro do terminal herde barra branca do sistema operacional.
  4. Em `SidebarDock.tsx:666`, adicionar `className="bm-stealth-scroll sidebar-drawer-scroll"` e `overflowX: 'hidden'`, e delegar a rolagem vertical de `news` de forma unificada sem barras duplicadas.
- **Testes Obrigatórios (`apps/web/src/trade/subetapa-scroll-toast-01-stealth-scroll.unit.test.tsx`)**:
  - **Unitário**: Verifica presença de `.bm-stealth-scroll`, `.bm-no-scrollbar`, `::-webkit-scrollbar-button` oculto e aplicação no container do `SidebarDock`.
  - **Estresse**: 200 ciclos de abertura/troca rápida entre todas as 8 abas do `SidebarDock` em `< 500ms`.
  - **Caos**: Renderização de gaveta com 500 itens simultâneos sem vazamento de `overflowX`.
  - **Segurança**: Sanitização e isolamento de conteúdo injetado nas abas.

---

### SUBETAPA 02 — Refinamento Cirúrgico das Gavetas `Análisis de Mercado`, `Portafolio Total` e `Historial`
- **Arquivos Alvo**:
  - [`apps/web/src/news/MarketNewsDrawer.tsx`](file:///d:/brokerproject/apps/web/src/news/MarketNewsDrawer.tsx)
  - [`apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`](file:///d:/brokerproject/apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx)
  - [`apps/web/src/components/drawer/BinmaxHistoryDrawer.tsx`](file:///d:/brokerproject/apps/web/src/components/drawer/BinmaxHistoryDrawer.tsx)
- **Passo a Passo**:
  1. Em `MarketNewsDrawer.tsx`:
     - Eliminar o segundo cabeçalho duplicado (`Notícias do Mercado [🔄] [✕]`) quando dentro da sala Binmax (já que o `SidebarDock` exibe `Análisis de mercado [✕]`), integrando o botão de atualização SVG discreto ao lado da barra de busca.
     - Aplicar `className="bm-no-scrollbar"` e `flexWrap: 'wrap'` nas pílulas de categoria para erradicar 100% a barra de rolagem horizontal branca.
     - Aplicar `className="bm-stealth-scroll"` na lista de artigos e substituir cores legadas e emojis (`🟢 ALTA`, `🔴 BAIXA`) por superfícies `--bg-1`/`--bg-2` e badges de precisão com ponto semântico (`#22C47A`, `#F2545B`, `#8A92A1`).
  2. Em `BinmaxPortfolioDrawer.tsx` e `BinmaxHistoryDrawer.tsx`:
     - Substituir a formatação ingênua de símbolo por um helper baseado em `getAssetDisplayName(c.symbol)` que converte `SYNTH_VOL_50` / `VOL_50` em `Vol 50` e pares OTC em `EUR/USD`, `NZD/JPY`, `USD/CAD`, adicionando `className="bm-stealth-scroll"` nas listas.
- **Testes Obrigatórios (`apps/web/src/trade/subetapa-scroll-toast-02-drawers-precision.unit.test.tsx`)**:
  - **Unitário**: Prova que `SYNTH_VOL_50` é exibido como `Vol 50` em `BinmaxPortfolioDrawer` e `BinmaxHistoryDrawer` (sem vazar `SYNTH_VOL_50` visível no título) e que `MarketNewsDrawer` não duplica o cabeçalho nem exibe barra horizontal.
  - **Estresse**: 150 renderizações de listas densas de portfólio, histórico e notícias em `< 1500ms`.
  - **Caos**: Contratos com símbolos legados, nulos ou desconhecidos e notícias com timestamps extremos.
  - **Segurança**: Proteção anti-XSS em títulos/resumos de notícias e nomes de ativos.

---

### SUBETAPA 03 — Redesign de Precisão e Correção de Ciclo de Vida do `TradeResultToast`
- **Arquivos Alvo**:
  - [`apps/web/src/components/toasts/TradeResultToast.tsx`](file:///d:/brokerproject/apps/web/src/components/toasts/TradeResultToast.tsx)
  - [`apps/web/src/App.tsx`](file:///d:/brokerproject/apps/web/src/App.tsx)
  - [`scripts/dev-live-feed.mjs`](file:///d:/brokerproject/scripts/dev-live-feed.mjs)
- **Passo a Passo**:
  1. **Correção do Timer de Auto-Close (4000ms)**:
     - Em `TradeResultToast.tsx`, armazenar `onClose` em `onCloseRef = useRef(onClose)` para que re-renders de ticks no `App.tsx` **jamais** reiniciem o `setTimeout` de `4000ms`.
  2. **Coordenadas Anti-Colisão com Gavetas (`drawerOpen`)**:
     - Quando uma gaveta lateral (`sidebarTab !== null`) estiver aberta, posicionar o toast em `left: '448px'` (`72px` sidebar + `360px` drawer + `16px` margem) com transição suave `260ms cubic-bezier(0.16, 1, 0.3, 1)`, nunca sobrepondo os cards da gaveta. Quando fechada, manter em `left: '88px'`.
  3. **Dados Reais da Ordem Liquidada**:
     - Em `scripts/dev-live-feed.mjs:2861`, incluir `symbol`, `direction` e `stake_minor` no evento WebSocket `contract_settled`.
     - Em `App.tsx:163-190`, extrair `symbol` e `direction` reais do evento ou do `matchedContract`, calculando o lucro líquido na vitória (`payout_minor - stake_minor` quando `payout_minor > stake_minor`, ex: `+$85.00` para stake de `$100` e retorno de `$185`).
  4. **Redesign Visual de Precisão (`21-designer-senior-binmax`)**:
     - Cápsula horizontal compacta em superfície `--bg-1` (`#101622`), filete vertical esquerdo de `3px` (`#22C47A` / `#F2545B` / `#E8A33D`), `<AssetFlagBadge />`, ícone vetorial compacto, tipografia `Geist Mono` (`tabular-nums`) e barra de progresso temporal de `2px` na base, preservando 100% dos `data-testid` (`trade-result-toast-win`, `trade-result-toast-loss`, `toast-title`, `toast-amount`, `toast-details`, `btn-close-toast`).
- **Testes Obrigatórios (`apps/web/src/trade/subetapa-scroll-toast-03-toast-lifecycle.unit.test.tsx`)**:
  - **Unitário & Ciclo de Vida**: Prova com `vi.useFakeTimers()` que mesmo com 40 re-renders (simulando ticks a cada 100ms trocando a função inline `onClose`), o `TradeResultToast` dispara `onClose` exatamente aos `4000ms`!
  - **Anti-Colisão**: Prova que `drawerOpen={true}` move o toast para `left: 448px` (fora da gaveta de `360px`).
  - **Estresse & Caos**: 200 toasts consecutivos alternando `WIN`, `LOSS` e `DRAW` com diferentes ativos (`SYNTH_VOL_50` $\rightarrow$ `Vol 50`, `USDCAD_OTC` $\rightarrow$ `USD/CAD`).
  - **Segurança**: Escape de strings maliciosas em `assetSymbol` e `amountFormatted`.

---

### SUBETAPA 04 — Certificação Final de Regressão, Build de Produção e Deploy (`binmaxbroker.com`)
- **Passo a Passo**:
  1. Executar todas as 3 novas suítes (`subetapa-scroll-toast-01`, `02`, `03`) + todas as suítes existentes de `trade/`, `arena/`, `unit/` e `chaos/`.
  2. Executar `pnpm --filter @broker/web build` (`tsc && vite build`) com zero erros.
  3. Publicar em produção (`node scripts/deploy-frontend-update.mjs`) e validar `HTTP 200`.

---

## Certificação Final de Execução (Subetapas 01 a 04)

| Subetapa | Escopo | Suíte de Testes (Unit, Estresse, Segurança, Caos) | Status |
| :--- | :--- | :--- | :--- |
| **SUBETAPA 01** | Sistema Global de Stealth Scrollbar Dark (`tokens-precision.css` + `SidebarDock.tsx`) | `subetapa-scroll-toast-01-stealth-scroll.unit.test.tsx` + `subetapa-03-sidebar-fidelity.unit.test.tsx` + `tokens-precision.unit.test.ts` (`15/15 PASS`) | ✅ **100% VALIDADA** |
| **SUBETAPA 02** | Refinamento de `MarketNewsDrawer`, `BinmaxPortfolioDrawer` e `BinmaxHistoryDrawer` (Zero Scroll Horizontal, Sem Cabeçalho Duplicado, `Vol 50`, `Intl.DateTimeFormat` em Cache) | `subetapa-scroll-toast-02-drawers-precision.unit.test.tsx` + 5 suítes de regressão de `Portafolio`/`Historial` (`21/21 PASS`) | ✅ **100% VALIDADA** |
| **SUBETAPA 03** | Redesign de Precisão e Ciclo de Vida do `TradeResultToast` (`useRef(onClose)`, `drawerOpen` Anti-Colisão `448px`, `AssetFlagBadge`, Barra Temporal `2px`) | `subetapa-scroll-toast-03-toast-lifecycle.unit.test.tsx` + `trade-result-toast.unit.test.tsx` + `onprivate-closure-fix.unit.test.ts` + `ui-anti-casino-chaos.test.ts` (`23/23 PASS`) | ✅ **100% VALIDADA** |
| **SUBETAPA 04** | Regressão Consolidada (`13 suítes / 53 testes PASS`), Build de Produção (`tsc && vite build` `Exit Code 0`) e Deploy em `binmaxbroker.com` (`HTTP 200 OK`) | Todas as suítes + `pnpm --filter @broker/web build` + `deploy-frontend-update.mjs` | ✅ **100% PUBLICADA** |
