# Subetapa 01 — Integração Cirúrgica de `Torneos` e `Arena` no Menu Lateral (`SidebarDock` + `ArenaPage`)

> **Agentes Alocados**: `surgical-frontend-agent`, `frontend-realtime-agent`, `chief-visual-director`, `qa-resilience-agent`, `regression-guardian-agent`
> **Skills**: `01-project-context`, `12-tokens-binmax`, `17-mudanca-cirurgica`, `18-zonas-sensiveis`, `21-designer-senior-binmax`
> **Status**: CONCLUÍDA E VALIDADA (100% — `sidebar-arena-integration.unit.test.tsx`: 6/6 passed)

---

## 1. Objetivo da Subetapa
1. Garantir que o item **`Arena`** (`data-testid="sidebar-item-arena"`, ícone de diamante) esteja integrado no menu lateral esquerdo ([`SidebarDock.tsx`](../../../apps/web/src/components/sidebar/SidebarDock.tsx)) logo abaixo de **`Torneos`** (`data-testid="sidebar-item-tournaments"`), com indicador visual de aba ativa quando a rota atual for `/arena` ou quando a Arena estiver aberta.
2. Eliminar a colisão visual em [`SidebarDock.tsx:234-237`](../../../apps/web/src/components/sidebar/SidebarDock.tsx#L234-L237) onde clicar em `Torneos` abria simultaneamente a gaveta lateral (`TournamentsDrawer`) **e** o modal central (`TournamentModal`) com backdrop borrado por cima da gaveta.
   - **Comportamento cirúrgico corrigido**:
     - Na Sala de Trading (`/`), clicar em `Torneos` abre limpa e diretamente o Hub Modal de Torneios (`TournamentModal`) sem abrir a gaveta lateral borrada por trás (ou permite alternar entre a gaveta rápida e o Hub completo sem sobreposição de `z-index`).
     - A `TournamentsDrawer` permanece acessível quando invocada especificamente ou sincronizada, sem colisão de backdrop.
3. Integrar o shell da [`ArenaPage.tsx`](../../../apps/web/src/pages/ArenaPage.tsx) com a barra lateral esquerda ([`SidebarDock.tsx`](../../../apps/web/src/components/sidebar/SidebarDock.tsx)) e rodapé ([`TerminalFooter.tsx`](../../../apps/web/src/components/footer/TerminalFooter.tsx)), fiel à referência visual (`media_1791990970774_497c2832.png`), de modo que:
   - Na rota `/arena`, o menu lateral esquerdo permaneça visível com o item **`Arena`** destacado como ativo (`activeItem === 'arena'`).
   - Clicar em `Operar` no menu lateral a partir de `/arena` retorne imediatamente para a Sala de Trading (`/`).
   - Clicar em `Torneos` no menu lateral a partir de `/arena` abra a `TournamentModal` (ou navegue para Torneios).
   - Clicar em `Análisis`, `Tutoriales` ou `Promociones` navegue para a respectiva rota.

---

## 2. Passo a Passo de Implementação Cirúrgica

### Passo 1.1 — Suporte a `activeNavOverride` e Navegação Cross-Route no `SidebarDock.tsx`
- Adicionar prop opcional `activeRoute?: 'trade' | 'arena' | 'tournaments'` em [`SidebarDock.tsx`](../../../apps/web/src/components/sidebar/SidebarDock.tsx).
- Quando `activeRoute === 'arena'`, destacar o botão `sidebar-item-arena` com a barra indicadora lateral (`#00E676` / `#CBD5E1`) e `aria-current="page"`.
- Quando o usuário estiver em `/arena` (`activeRoute === 'arena'`) e clicar em `Operar` (`sidebar-item-trade`), navegar de volta para `/` (via callback `onBackToTrade` ou `window.history.pushState` + `PopStateEvent`).
- Ao clicar em `Torneos` (`sidebar-item-tournaments`), abrir `TournamentModal` (`setIsTournamentsModalOpen(true)`) e garantir que a gaveta lateral `TournamentsDrawer` não fique aberta simultaneamente por baixo do backdrop borrado (`if (activeTab === 'tournaments') setActiveTab(null)` ao abrir a modal, ou botão dedicado dentro da drawer para expandir o modal).

### Passo 1.2 — Integração do Layout `SidebarDock` + `TerminalFooter` na `ArenaPage.tsx`
- Em [`ArenaPage.tsx`](../../../apps/web/src/pages/ArenaPage.tsx), envolver o conteúdo da `ArenaRoom` com o shell lateral `SidebarDock` (`activeRoute="arena"`) à esquerda e `TerminalFooter` na base, exatamente como na imagem de referência `media_1791990970774_497c2832.png`.
- Manter a topbar da Arena Blitz (`← Torneos | BINMAX OPTION | ARENA BLITZ · 15 MIN | Sala de Trading →`) funcionando perfeitamente tanto por clique no topo quanto pelo menu lateral esquerdo.

---

## 3. Especificação de Testes Obrigatórios da Subetapa 01
Arquivo de teste: `apps/web/src/components/sidebar/sidebar-arena-integration.unit.test.tsx`

1. **Testes Unitários e Funcionais**:
   - Renderização do botão `sidebar-item-arena` e `sidebar-item-tournaments` no `SidebarDock`.
   - Clicar em `sidebar-item-tournaments` abre `TournamentModal` (`tournaments-modal-backdrop`) sem deixar `TournamentsDrawer` colidindo por trás.
   - Clicar em `sidebar-item-arena` navega para `/arena` e destaca `Arena` como item ativo no menu lateral.
   - Renderização de `ArenaPage` inclui `SidebarDock` com `sidebar-item-arena` ativo e permite voltar para `Operar` (`/`).
2. **Teste de Estresse (Stress Test)**:
   - 200 cliques rápidos alternados entre `Operar`, `Torneos`, `Arena`, `Portafolio` e `Historial` sem vazamento de estado, sem sobreposição de modais/drawers e sem exceções.
3. **Teste de Segurança (Security Test)**:
   - Sanitização da query string `?room=` ao abrir a Arena via menu/modal (valores maliciosos como `?room=<script>alert(1)</script>` ou `?room=__proto__` caem em fallback seguro `null` sem injeção no DOM ou prototype pollution).
4. **Teste de Caos e Resiliência (Chaos Test)**:
   - Falha simulada em `window.localStorage` (`QuotaExceededError` / `SecurityError`) durante a navegação entre `SidebarDock`, `TournamentModal` e `ArenaPage` — a interface não quebra e mantém a navegação funcional.
5. **Verificação de Regressão e Zonas Sensíveis**:
   - `git diff` zero em arquivos vermelhos (`docs/zonas-sensiveis.txt`).
   - 100% dos testes unitários existentes passando.
