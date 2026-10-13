# Subetapa 01: Eliminação Total do Vazamento de Linhas de Preço (Price Lines)

## 1. Problema Identificado
No `PriceChart.tsx`, o efeito de sincronização da linha de preço atual possuía um bug crítico na remoção de linhas antigas:
1. Ao tentar remover a linha anterior, tentava remover de `areaSeries` quando estava no modo `candles`, e vice-versa.
2. A linha nunca era removida da série real, tornando-se órfã no canvas.
3. Além disso, `priceDirection` disparava o efeito a cada tick, gerando centenas de linhas horizontais empilhadas.
4. Na troca de símbolo (`symbol`), as linhas órfãs já gravadas no canvas permaneciam na série.

## 2. Solução Arquitetural
1. **Rastreamento Estrito do Proprietário da Linha**:
   - Manter um ref `currentPriceLineSeries` que aponta exatamente para a série (`candleSeries.current` ou `areaSeries.current`) onde `currentPriceLine.current` foi criada.
   - Criar uma função auxiliar idempotente `safeRemoveCurrentPriceLine()` que remove a linha da série proprietária correta e anula os refs.
2. **Eliminar `priceDirection` do `useEffect` de Criação**:
   - A criação/recriação de linhas de preço deve ocorrer estritamente na comutação de `chartType` (`candles` <-> `area`) ou quando a série é inicializada.
   - Atualizações de valor, cor e direção (`isUp`, `color`, `title`) devem ser feitas exclusivamente via `currentPriceLine.current.applyOptions({ price, color, title })` dentro do loop coalescido de animação (`RafChartUpdater`), SEM criar novas linhas.
3. **Limpeza Exaustiva na Troca de Símbolo (`symbol`)**:
   - Garantir que `safeRemoveCurrentPriceLine()` seja chamado no início da troca de símbolo.
   - Na reinicialização dos dados (`series.setData`), todas as linhas e dados antigos da série são higienizados.

## 3. Testes Automatizados da Subetapa
- **Teste de Estresse de 1.000 Ticks com Oscilação de Direção**:
  - Simula 1.000 atualizações rápidas de tick alternando entre `UP` e `DOWN`.
  - Prova que o número de `createPriceLine` chamados é exatamente 1 (ou zero novas criações adicionais), enquanto `applyOptions` é chamado para cada tick.
- **Teste de Troca de Ativo (Multi-Symbol)**:
  - Alterna entre `SYNTH_VOL_50` (~100.00) e `USDJPY_OTC` (~151.20).
  - Prova que `removePriceLine` é chamado na série proprietária correta e nenhuma linha órfã com preço 100.00 contamina o gráfico de 151.20.
