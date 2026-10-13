# SUBETAPA 01: DIMENSÕES DO SHELL E MOLDURA INSTITUCIONAL DO CARD DO GRÁFICO

**Feature:** `BMR-LAYOUT-REFINEMENT-2026-10-09`  
**Subetapa:** 01 de 04  
**Agente Responsável:** `broker-architect-agent` / `surgical-frontend-agent`  
**Revisores:** `qa-resilience-agent`, `financial-correctness-reviewer`, `compliance-risk-reviewer`

---

## 1. Objetivo e Escopo

Atender a diretriz primordial:
> *"Alteracao- Diminuir tamanho do card geral do grafico.. sem mexer absolutamente nada na logica atual e aumentar o tamanho desses elementos.. porque estao muito pequenos"*

O gráfico de trading em `.theme-binmax .terminal-center` atualmente ocupa a viewport de ponta a ponta sem respiro. Nesta subetapa:
1. **Redução e Enquadramento do Card do Gráfico**: Configurar espaçamento (`padding: 6px 8px`), bordas arredondadas institucionais (`border-radius: 8px`), e moldura com sombra sutil (`border: 1px solid rgba(244, 245, 247, 0.06)`, `box-shadow: 0 4px 24px rgba(0,0,0,0.4)`).
2. **Ajuste de Dimensões Base do Shell no CSS**:
   - `.theme-binmax .terminal-header`: `height: 56px !important;` (anterior: 46px), fornecendo o espaço vertical ideal para o avatar de 32px e o botão de depósito destacado.
   - `.theme-binmax .terminal-sidebar`: `width: 72px !important;` (anterior: 50px), fornecendo largura confortável para ícones de 24px e tipografia legível de 11px.
3. **Invariante Absoluto**: Zero alteração em brokers, feeds de cotação, cálculos de velas, WebSockets ou execução de ordens. O motor Lightweight Charts adapta-se passivamente através do seu `ResizeObserver` nativo.

---

## 2. Passo a Passo de Execução

1. **Editar `apps/web/src/styles.css`**:
   - Ajustar `.theme-binmax .terminal-header` de `46px` para `56px`.
   - Ajustar `.theme-binmax .terminal-sidebar` de `50px` para `72px`.
   - Adicionar moldura em `.theme-binmax .terminal-center` com `padding: 6px 8px` e estilo de card (`border-radius: 8px`, `border: 1px solid rgba(244, 245, 247, 0.06)`).
   - Ajustar drawer lateral para acompanhar o novo offset do sidebar (`left: 72px`, `top: 56px`, `maxWidth: calc(100vw - 72px)`).
2. **Desenvolver Bateria de Testes Automatizados**:
   - Criar `apps/web/src/trade/subetapa-refine-01-shell-card.unit.test.tsx`.
   - Teste 1: Renderização do shell sob `.theme-binmax` com dimensões corretas.
   - Teste 2: Isolamento da feature flag `NEW_TRADEROOM` (modo legado permanece com dimensões originais intactas).
   - Teste 3: Verificação de que o container do gráfico possui o enquadramento de card sem quebrar nós filhos.
   - Teste 4: Teste de estresse de redimensionamento de janela (emulação de resize sem exceptions).
   - Teste 5: Teste de segurança de escopo CSS (não vazar classes globais).
3. **Execução e Validação**:
   - Executar vitest no arquivo da subetapa.
   - Gerar relatório formal de fechamento em `docs/features/binmax-layout-refinement/relatorios/RELATORIO-SUBETAPA-01.md`.

---

## 3. Critérios de Aceite e Gate

- [ ] Shell `.theme-binmax .terminal-header` possui altura de 56px.
- [ ] Shell `.theme-binmax .terminal-sidebar` possui largura de 72px.
- [ ] Shell `.theme-binmax .terminal-center` possui enquadramento de card com padding e cantos arredondados.
- [ ] Modo legado permanece inalterado.
- [ ] 100% dos testes da subetapa verdes.
