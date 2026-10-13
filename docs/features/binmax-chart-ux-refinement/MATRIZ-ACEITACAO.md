# MATRIZ DE ACEITAÇÃO: REFINAMENTO DE UX/UI DO GRÁFICO

**Feature:** `BMR-CHART-UX-REFINEMENT-2026-10-09`

| ID | Item da Demanda | Implementação Técnica | Evidência de Teste | Status |
|---|---|---|---|:---:|
| **UX-01** | Remover a borda verde ao redor do gráfico | Remoção de `#00e676` no `MultiChartGrid.tsx` sob modo Binmax/1x1 (`border: none`) | `subetapa-ux-01-border-and-logo.unit.test.tsx` (4/4) | **APROVADO** |
| **UX-02** | Ocultar logo da TradingView | Supressão de `#tv-attr-logo`, `.tv-attr-logo` e links de atribuição via CSS e DOM ativo em `IsolatedChartHost.tsx` | `subetapa-ux-01-border-and-logo.unit.test.tsx` (4/4) | **APROVADO** |
| **UX-03** | Palavra "Promociones" sem sair das bordas | Padding `6px 2px`, tipografia `9.5px`, `maxWidth: '68px'` e proteção contra overflow no `SidebarDock.tsx` | `subetapa-ux-02-sidebar-promociones.unit.test.tsx` (3/3) | **APROVADO** |
| **UX-04** | Temperatura dos traders (Mood Bar) profissional | Cápsula contínua elegante bicolor verde `#22C47A` / vermelho `#F2545B` com badges em `Geist Mono` | `subetapa-ux-03-mood-bar.unit.test.tsx` (5/5) | **APROVADO** |
| **UX-05** | Ferramentas de velas e indicadores profissionais | Dock minimalista glassmorphism, SVGs de candlesticks, ondas e caneta geométrica, popovers em espanhol | `subetapa-ux-04-drawing-toolbar.unit.test.tsx` (5/5) | **APROVADO** |
| **UX-06** | Hora de compra, expiração e flags de ordens sofisticadas | Redução de halos neon, tags translúcidas escuras com contorno fino e pinos SVG no rodapé em `TimeLinesOverlay.tsx` e `OrderFlagsOverlay.tsx` | `subetapa-ux-05-timelines-flags.unit.test.tsx` (5/5) | **APROVADO** |
| **UX-07** | Certificação Integrada e Regressão Zero | **507/507 testes aprovados no Vitest** (99 suítes 100% verdes), 0 erros no TypeScript | Suíte Completa Vitest & `tsc --noEmit` | **APROVADO** |
