# Subetapa 01: Remoção do Cabeçalho Repetido nas Células da Grade de Gráficos

> **Objetivo**: Eliminar o cabeçalho azul repetido (`<select> ATIVO ⚡ 0ms`) dentro das células da grade multichart quando a experiência BINMAX estiver ativa, preservando o seletor in-chart moderno e a moldura sutil de foco da célula ativa.

---

## 1. Escopo de Alteração
- **Arquivo**: `apps/web/src/chart/MultiChartGrid.tsx`
- **Linhas Alvo**:
  - `GridCell`: Ajustar a estilização de borda para que as células em grade mantenham a moldura refinada (`rgba(244, 245, 247, 0.08)` e foco ativo `rgba(0, 229, 255, 0.4)` ou `#22C55E`) mesmo com `showHeader=false`.
  - Mapeamento das células: passar `showHeader={!isBinmax}` tanto no layout `1x1` quanto nos layouts em grade (`cells.slice(0, visibleCellsCount).map(...)`).

## 2. Testes de Validação (TDD)
- Arquivo de Teste: `apps/web/src/chart/subetapa-01-remove-gridcell-header.unit.test.tsx`
- **Critérios de Aceite**:
  1. Em modo Binmax com layout `2x1` ou `2x2`, nenhuma célula renderiza `<select>` nativo ou texto `ATIVO ⚡`.
  2. As células mantêm o atributo de identificação e foco ao serem clicadas.
  3. No modo legado (`isBinmax = false`), o cabeçalho original é preservado para compatibilidade retroativa.
  4. Teste de estresse: renderização de grade `3x2` (6 células) sem vazamento de cabeçalho redundante.

## 3. Critérios de Segurança e Não-Regressão
- A alternância de ativos através da pílula in-chart continua funcionando 100%.
- A boleta individual de cada célula continua intacta.
- Todos os testes de `MultiChartGrid` continuam verdes.
