# SUBETAPA 02: AJUSTE TIPOGRÁFICO E LARGURA DA SIDEBAR PARA ENQUADRAMENTO DE "PROMOCIONES"

**Feature ID:** `BMR-CHART-UX-REFINEMENT-2026-10-09`  
**Subetapa:** 02 de 06  
**Responsável:** `surgical-frontend-agent`  
**Revisores:** `compliance-risk-reviewer`, `qa-resilience-agent`

---

## 1. Problema Identificado e Escopo

> *"5 - no menu central ajustar o tamanho porque a palavra promociones da saindo das bordas"*

- A palavra "Promociones" possui 11 caracteres. Na barra lateral (sidebar dock de navegação), sob certos zooms ou telas com escala de DPI elevada, a palavra encostava ou vazava das bordas do botão.
- **Solução Integrada**:
  1. Aumentar a largura da sidebar em `.theme-binmax .terminal-sidebar` de `72px` para `76px !important;` (fornecendo 4px extras de respiro sem comprometer o gráfico).
  2. Ajustar o tamanho da fonte dos rótulos para `fontSize: '10.5px'` ou `10px` quando a palavra for longa, com `padding: '6px 2px'`, `maxWidth: '100%'`, `overflow: 'hidden'`, `textOverflow: 'ellipsis'`.
  3. Atualizar o offset do drawer lateral para `left: 76px` e `maxWidth: calc(100vw - 76px)`.

---

## 2. Passo a Passo de Execução

1. **Editar `styles.css`**:
   - Ajustar `.theme-binmax .terminal-sidebar` para `width: 76px !important; min-width: 76px !important; max-width: 76px !important;`.
2. **Editar `SidebarDock.tsx`**:
   - Ajustar estilos do botão de Promociones (e demais botões) para usar `fontSize: '10.5px'`, `padding: '6px 2px'`, com respiro lateral garantido.
   - Ajustar offsets do fly-out lateral para `left: '76px'`.
3. **Desenvolver Bateria de Testes Automatizados**:
   - Criar `apps/web/src/trade/subetapa-ux-02-sidebar-promociones.unit.test.tsx`.
   - Teste 1: Regras CSS em styles.css confirmam largura de 76px.
   - Teste 2: Renderização de `Promociones` sem overflow de texto.
   - Teste 3: Alinhamento de todos os 8 botões e offsets do drawer em 76px.
   - Teste 4: Teste de estresse com 100 alternâncias sem perda de alinhamento.
4. **Execução e Emissão do Relatório de Gate**:
   - Rodar Vitest e emitir `docs/features/binmax-chart-ux-refinement/relatorios/RELATORIO-SUBETAPA-02.md`.
