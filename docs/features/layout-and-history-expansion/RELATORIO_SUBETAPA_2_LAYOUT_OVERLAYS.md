# Relatório de Conclusão — Subetapa 2: Refinamento de Design, Espaçamento, Bordas e Descolisão de Overlays

> **Status do Gate**: **APROVADO (100% GREEN)**  
> **Responsáveis**: `surgical-frontend-agent`, `iq-fidelity-reviewer`, `binmax-brand-agent`, `qa-resilience-agent`  
> **Data**: 2026-10-08  
> **Suíte de Testes**: `apps/web/src/trade/layout-spacing-overlays.unit.test.tsx` (5 testes, 0 falhas)

---

## 1. Problema Resolvido
- **Diagnóstico**:
  1. A tag flutuante `.price-tag-pulse` ficava pairando sobre a régua de preços e os rótulos de contagem regressiva, causando sobreposições indevidas.
  2. O Lightweight Charts mantinha ativos `lastValueVisible` e `priceLineVisible` por padrão, gerando duas etiquetas sobrepostas de cotação na régua de preços à direita.
  3. No `TimeLinesOverlay.tsx`, as etiquetas `time-tag-purchase` e `time-tag-expiration` compartilhavam `top: 40px`, colidindo no mesmo trilho horizontal e transbordando para dentro da escala de preços.
- **Correções Implementadas**:
  1. **Supressão do `.price-tag-pulse` no tema Binmax**: No modo Turbo Prata (`NEW_TRADEROOM = true`), a cotação é exibida exclusivamente no cabeçalho do ativo e na régua de preços oficial, sem poluição de tags flutuantes na área do gráfico.
  2. **Desativação de Linhas e Badges Nativos Duplicados**: Definido `lastValueVisible: false` e `priceLineVisible: false` em `addCandlestickSeries` e `addAreaSeries`. Apenas a linha e badge customizados (`currentPriceLine`) aparecem na régua de preços.
  3. **Escalonamento em Trilhos Verticais Distintos**:
     - `time-tag-purchase`: `top: 24px`
     - `time-tag-expiration`: `top: 56px`
     - Distância vertical comprovada: $\Delta Y \ge 8px$. É fisicamente impossível haver sobreposição entre os balões.
  4. **Margem de Segurança Contra a Régua de Preços**: A coordenada `xExpiration` é travada com `maxExpirationX = Math.max(80, effectiveWidth - 65)`, garantindo que o balão de 110px centralizado nunca invada a escala de preços.
  5. **Preservação do Padrão Duas Portas**: Com `NEW_TRADEROOM = false`, o comportamento clássico permanece 100% preservado.

---

## 2. Evidência dos Testes Automatizados
- **LSO-01**: Etiquetas de compra e expiração escalonadas verticalmente em 24px e 56px.
- **LSO-02**: Clamp horizontal impede invasão da régua de preços (`left <= containerWidth - 65`).
- **LSO-03**: Nenhuma tag duplicada, microcopy em espanhol neutro oficial.
- **LSO-04**: Prova matemática de não-intersecção com gap vertical mínimo de 8px.
- **LSO-05**: Padrão Duas Portas validado (modo clássico intacto).
