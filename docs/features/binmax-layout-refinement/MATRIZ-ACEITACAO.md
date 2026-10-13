# MATRIZ DE ACEITAÇÃO: REFINAMENTO DE LAYOUT BINMAX

**Feature:** `BMR-LAYOUT-REFINEMENT-2026-10-09`

| ID | Requisito do Usuário | Implementação Técnica | Evidência de Teste | Status |
|---|---|---|---|---|
| **R-01** | Diminuir tamanho do card geral do gráfico sem mexer na lógica atual | Padding de moldura `padding: 6px 8px`, cantos arredondados de `8px` e borda sutil no `.terminal-center`. Ajuste de 72px na sidebar e 56px no header. Lightweight Charts redimensiona passivamente via `ResizeObserver`. | `subetapa-refine-01-shell-card.unit.test.tsx` (5/5) | **APROVADO** |
| **R-02** | Aumentar elementos da barra lateral (Imagem 1) | Sidebar expandido para 72px, 8 ícones ampliados para 24px, rótulos ampliados para 11px em negrito 700, topo com duplo chevron `▲▲`, indicador ativo ciano `#00e5ff`. | `subetapa-refine-02-sidebar-expansion.unit.test.tsx` (5/5) | **APROVADO** |
| **R-03** | Aumentar elementos do topo direito (Imagem 2) | Avatar expandido para 32px, rótulo de conta ampliado para 11px, saldo verde monospaçado de 16px (`Geist Mono`), botão `💳 Depositar` amplo de 38px de altura com alto contraste e tipografia 13.5px negrito 800. | `subetapa-refine-03-header-deposit.unit.test.tsx` (6/6) | **APROVADO** |
| **R-04** | Regressão zero e estabilidade integral | 485 testes automatizados aprovados no Vitest em 94 arquivos. TypeScript limpo com 0 erros. Padrão Duas Portas intacto. | Suíte Completa Vitest & `tsc --noEmit` | **APROVADO** |
