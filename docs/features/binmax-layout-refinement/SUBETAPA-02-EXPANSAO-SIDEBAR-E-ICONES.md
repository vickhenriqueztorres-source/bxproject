# SUBETAPA 02: EXPANSÃO DO SIDEBAR VERTICAL E ÍCONES (IMAGEM 1)

**Feature:** `BMR-LAYOUT-REFINEMENT-2026-10-09`  
**Subetapa:** 02 de 04  
**Agente Responsável:** `broker-architect-agent` / `surgical-frontend-agent`  
**Revisores:** `qa-resilience-agent`, `compliance-risk-reviewer`, `financial-correctness-reviewer`

---

## 1. Análise Forense da Imagem 1 (`media_1791574672877_032f756a.png`)

A captura da lateral esquerda do terminal IQ/Binmax demonstra a composição exata:
1. **Topo com Duplo Chevron (`▲▲` / `icon-collapse`)**:
   - Um botão de cabeçalho sutil com duplo chevron apontando para cima ou recolher/expandir no topo da barra.
2. **Largura e Ergonomia**:
   - Largura real de 72px, eliminando o aperto visual dos botões.
   - Espaçamento vertical equilibrado (gap de 6px a 8px entre botões).
3. **Ícones Ampliados (24px)**:
   - Os ícones aumentam de 18px para 24px (`IconOperar`, `IconPortafolio`, `IconHistorial`, `IconTorneos`, `IconAnalisis`, `IconTutoriales`, `IconPromociones`, `IconAjustes`).
   - Traços nítidos (`strokeWidth="1.75"` a `"2.0"`).
4. **Tipografia e Rótulos (10.5px a 11px)**:
   - Os rótulos inferiores de cada ícone sobem de 8.5px para 10.5px / 11px, com peso 700 e `letter-spacing: 0.01em`.
   - Textos exatos em Espanhol Neutro: `Operar`, `Portafolio`, `Historial`, `Torneos`, `Análisis`, `Tutoriales`, `Promociones`, `Ajustes`.
5. **Estado Ativo**:
   - Borda esquerda com destaque de 3px em Ciano Turbo `#00e5ff`.
   - Fundo translúcido `rgba(0, 229, 255, 0.08)`.
   - Ícone e texto em ciano vívido `#00e5ff`.

---

## 2. Passo a Passo de Execução

1. **Atualizar `SidebarIcons.tsx`**:
   - Garantir suporte a `size={24}` padrão ou dimensionamento flexível.
   - Adicionar o ícone de topo `IconChevronDouble` (duplo chevron `▲▲`).
2. **Atualizar `SidebarDock.tsx`**:
   - Renderizar o botão de topo com duplo chevron `▲▲` no modo Binmax.
   - Atualizar todos os 8 botões para usar ícones com `size={24}`.
   - Atualizar a tipografia dos rótulos para `fontSize: '10.5px'` / `'11px'` com `fontWeight: 700`.
   - Atualizar padding dos botões para `padding: '8px 0'`.
   - Alinhar fly-out lateral para acompanhar a nova largura de 72px (`left: '72px'`).
3. **Desenvolver Bateria de Testes Automatizados**:
   - Criar `apps/web/src/trade/subetapa-refine-02-sidebar-expansion.unit.test.tsx`.
   - Teste 1: Presença do topo duplo chevron `▲▲`.
   - Teste 2: Renderização dos 8 itens com ícones de 24px e textos de 10.5px/11px.
   - Teste 3: Estado ativo de `Operar` com ciano `#00e5ff` e borda esquerda de 3px.
   - Teste 4: Interação de clique e alternância de abas de drawer (`Portafolio`, `Historial`, `Torneos`, etc.).
   - Teste 5: Teste de estresse com 100 cliques rápidos alternando abas (ausência de travamento ou memory leak).
   - Teste 6: Teste de acessibilidade (ARIA labels e foco por teclado ESC).
4. **Execução e Validação**:
   - Executar vitest e registrar relatório em `docs/features/binmax-layout-refinement/relatorios/RELATORIO-SUBETAPA-02.md`.

---

## 3. Critérios de Aceite e Gate

- [ ] Topo com duplo chevron `▲▲` presente e acessível.
- [ ] Todos os 8 ícones renderizados com 24px de dimensão.
- [ ] Rótulos legíveis com fonte de 10.5px a 11px em negrito.
- [ ] Destaque ciano `#00e5ff` para o item selecionado.
- [ ] 100% dos testes da subetapa verdes.
