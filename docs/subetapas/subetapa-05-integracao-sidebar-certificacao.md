# Subetapa 05: Integração no Traderoom (SidebarDock, App Router & Certificação Final)

## 1. Contexto e Especificação
- **Objetivo**: Conectar o novo `TournamentModal` no fluxo operacional principal da BINMAX:
  1. Ao clicar no item "Torneios" no dock lateral (`SidebarDock`), o modal popup é aberto diretamente, cumprindo com precisão a exigência: *"ao clicar em torneios deve abrir o poupup com esse designer igual a imagem"*.
  2. Preservar suporte para a rota `/torneos` e rotas móveis.
  3. Garantir compatibilidade retroativa total com `TournamentsDrawer` para que nenhum teste de regressão seja quebrado.
  4. Executar certificação final integrada de estresse, segurança e ausência de regressões.

## 2. Arquivos Envolvidos
- `apps/web/src/components/sidebar/SidebarDock.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/components/tournaments/tournament-integration.unit.test.tsx` (Novo teste integrado)

## 3. Plano de Testes da Subetapa
- **Testes de Integração**:
  - Clique em `data-testid="sidebar-item-tournaments"` abre o modal popup com `data-testid="tournament-modal"`.
  - Fechamento do modal restaura o estado do sidebar.
  - Compatibilidade com o renderizador de drawer original quando invocado diretamente.
- **Testes de Estresse & Desempenho**:
  - Teste de abertura e fechamento repetido (50 ciclos rápidos) sem engasgos ou retenção de DOM.
- **Bateria Global de Regressão**:
  - Execução dos testes da suíte web no Vitest para assegurar que nada foi quebrado.

## 4. Critério de Aceite (Gate de Avanço)
- [ ] Todos os testes da Subetapa 5 executados e 100% aprovados.
- [ ] Zero quebras em testes de produção existentes.
