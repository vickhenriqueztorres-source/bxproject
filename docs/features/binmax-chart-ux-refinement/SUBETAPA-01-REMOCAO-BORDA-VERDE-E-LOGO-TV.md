# SUBETAPA 01: REMOÇÃO DA BORDA VERDE DO GRÁFICO E OCULTAÇÃO DA LOGO TRADINGVIEW

**Feature ID:** `BMR-CHART-UX-REFINEMENT-2026-10-09`  
**Subetapa:** 01 de 06  
**Responsável:** `chart-trading-engineer` / `surgical-frontend-agent`  
**Revisores:** `qa-resilience-agent`, `compliance-risk-reviewer`

---

## 1. Problemas Identificados e Escopo

1. **Borda Verde ao Redor do Gráfico**:
   - Em `apps/web/src/chart/MultiChartGrid.tsx` linha 109, a célula do gráfico ativa renderiza:
     `border: isActive ? '1px solid #00e676' : '1px solid #1a253a'`.
   - Essa borda verde neon contorna todo o quadro do gráfico de forma invasiva e anti-profissional.
   - **Solução**: No modo Binmax (`isBinmax`) ou em layout 1x1, aplicar `border: 'none'` (ou contorno sutil neutro em layouts com múltiplos gráficos como 2x2).
2. **Logo do TradingView no Canto Inferior Esquerdo**:
   - O Lightweight Charts injeta automaticamente um elemento com id `#tv-attr-logo` e links `a[href*="tradingview.com"]` no canto inferior esquerdo do canvas.
   - **Solução**:
     - No arquivo `apps/web/src/styles.css`, aplicar regras de alta especificidade com `!important` para sumir com `#tv-attr-logo`, `.tv-attr-logo` e quaisquer links de atribuição (`display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;`).
     - No componente `apps/web/src/chart/IsolatedChartHost.tsx`, adicionar varredura segura após a montagem do gráfico para ocultar o nó DOM caso o navegador o gere tardiamente.

---

## 2. Passo a Passo de Execução

1. **Editar `MultiChartGrid.tsx`**:
   - Ajustar o estilo de borda do `GridCell`: quando `isBinmax` estiver ativo, a borda ativa deve ser `border: isBinmax ? (layout === '1x1' ? 'none' : (isActive ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid rgba(244, 245, 247, 0.08)')) : ...`.
2. **Editar `styles.css`**:
   - Adicionar regras globais sob `.theme-binmax` e `.terminal-center`:
     ```css
     .theme-binmax #tv-attr-logo,
     .theme-binmax .tv-attr-logo,
     .theme-binmax a[href*="tradingview.com"],
     .terminal-center #tv-attr-logo,
     .terminal-center .tv-attr-logo,
     .terminal-center a[href*="tradingview.com"] {
       display: none !important;
       opacity: 0 !important;
       visibility: hidden !important;
       pointer-events: none !important;
       width: 0 !important;
       height: 0 !important;
     }
     ```
3. **Editar `IsolatedChartHost.tsx`**:
   - Adicionar MutationObserver ou fallback de limpeza que garanta que nenhum elemento de logo persista no DOM do container do gráfico.
4. **Criar Bateria de Testes Automatizados**:
   - Criar `apps/web/src/chart/subetapa-ux-01-border-and-logo.unit.test.tsx`.
   - Teste 1: Validação de ausência da borda `#00e676` no modo Binmax.
   - Teste 2: Validação das regras CSS de supressão da logo do TradingView.
   - Teste 3: Teste de montagem no DOM comprovando ocultação de `#tv-attr-logo`.
   - Teste 4: Padrão Duas Portas (modo legado intacto).
   - Teste 5: Estresse de 100 montagens rápidas sem erro.
5. **Execução e Emissão do Relatório de Gate**:
   - Rodar Vitest e emitir `docs/features/binmax-chart-ux-refinement/relatorios/RELATORIO-SUBETAPA-01.md`.
