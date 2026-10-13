# Subetapa 2 — Refinamento de Design, Espaçamento, Bordas e Descolisão de Overlays

> **Governança**: `tech-lead-orchestrator`  
> **Workers Especializados**: `surgical-frontend-agent`, `iq-fidelity-reviewer`, `binmax-brand-agent`, `qa-resilience-agent`  
> **Skills Ativas**: `11-chart-trading-tools`, `12-tokens-binmax`, `17-mudanca-cirurgica`, `19-testes-de-regressao-visual`  
> **Data**: 2026-10-08  
> **Objetivo**: Resolver o Problema 1 (Erros de design, colisões visuais, bordas e tags sobrepostas).

---

## 1. Motivação e Causa Raiz
1. `.price-tag-pulse` flutuava sobre o gráfico em `top: 12px, right: 16px`, colidindo com a régua de preços à direita e com as tags de tempo.
2. Lightweight Charts mantinha `lastValueVisible: true` e `priceLineVisible: true` nativamente na série de velas, desenhando um badge cinza na régua ao lado do badge colorido da linha de cotação atual.
3. Em `TimeLinesOverlay.tsx`, tanto `time-tag-purchase` quanto `time-tag-expiration` utilizavam `top: 40px`, colidindo horizontalmente no mesmo trilho quando a linha de compra estava a menos de 80px da linha de expiração.
4. A tag de expiração não respeitava margem de segurança contra a escala de preços à direita, invadindo os números do eixo Y.

---

## 2. Solução Cirúrgica Proposta

1. **Ocultar `.price-tag-pulse` no Tema Binmax**:
   - Condicionar a renderização no JSX de `PriceChart.tsx`: `{!isBinmax && (<div className="price-tag-pulse".../>)}`.
   - No tema Turbo Prata (Binmax), a cotação é exibida exclusivamente no cabeçalho do ativo e na régua de preços oficial.

2. **Eliminar Duplicação no Eixo Y de Preço**:
   - Nas chamadas `chart.addCandlestickSeries` e `chart.addAreaSeries`, definir:
     ```ts
     lastValueVisible: false,
     priceLineVisible: false,
     ```
   - Apenas `currentPriceLine.current` desenha o traço e badge oficial de cotação na régua de preços.

3. **Escalonamento Vertical em Dois Trilhos em `TimeLinesOverlay.tsx`**:
   - `time-tag-purchase` posicionada em `top: 24px`.
   - `time-tag-expiration` posicionada em `top: 56px`.
   - Ao estarem em alturas distintas (24px vs 56px), a sobreposição física é matematicamente impossível, mesmo que as linhas fiquem a 1 pixel uma da outra.
   - Limitação de clamp horizontal: `xExpiration = Math.min(effectiveWidth - 65, ...)`, garantindo que o balão de 110px centralizado (`translateX(-50%)`) nunca invada a escala de preços.

4. **Polimento de Bordas e Margens do Order Dock**:
   - Verificação e ajuste de bordas sutis com `var(--bm-linha)` para separação perfeita entre o gráfico e o painel de ordens.

---

## 3. Matriz de Testes Requerida
- `apps/web/src/trade/layout-spacing-overlays.unit.test.tsx`:
  - **LSO-01**: Descolisão de tags de tempo: `purchase` e `expiration` devem ter valores de `top` estritamente diferentes.
  - **LSO-02**: Não invasão da escala de preços: borda direita da tag de expiração nunca ultrapassa o limite do canvas do gráfico.
  - **LSO-03**: Badge único no eixo Y: série de velas configurada com `lastValueVisible: false` e `priceLineVisible: false`.
  - **LSO-04**: Ocultação de tag de pulso flutuante quando `NEW_TRADEROOM = true`.
