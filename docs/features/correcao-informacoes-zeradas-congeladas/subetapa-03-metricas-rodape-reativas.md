# Subetapa 03: Métricas Dinâmicas e Reativas de Rodapé (`Portafolio Total` e `Ganancia de Hoy`)

> **Agente**: `surgical-frontend-agent`  
> **Revisor**: `financial-correctness-reviewer`  
> **QA**: `qa-resilience-agent`  
> **Skills**: `01-project-context`, `02-financial-invariants`, `12-tokens-binmax`, `17-mudanca-cirurgica`

---

## 1. Objetivo Técnico
Erradicar as métricas estáticas e hardcoded do rodapé do terminal:
1. Em `apps/web/src/App.tsx`:
   - Calcular reativamente o **`portfolioTotalFormatted`**:
     - Soma de todas as stakes (`stake_minor`) de contratos com `status === 'OPEN'`:
       `const openPortfolioMinor = openContracts.reduce((acc, c) => acc + (typeof c.stake_minor === 'string' ? parseInt(c.stake_minor, 10) : c.stake_minor), 0);`
     - Formatação oficial: `formatCurrencyBinmax(openPortfolioMinor)` (ex: `$400.00` para 4 ordens de $100).
   - Calcular reativamente o **`todayProfitFormatted`**:
     - Filtrar os contratos encerrados (`status === 'SETTLED'`) que foram fechados no dia de hoje (a partir das 00:00:00 da hora local / servidor):
       - Se `result === 'WIN'`: lucro líquido = `(payout_minor - stake_minor)`
       - Se `result === 'LOSS'`: prejuízo líquido = `-stake_minor`
       - Se `result === 'DRAW'`: `0`
     - Somar para obter `todayProfitMinor`.
     - Formatação com sinal explícito:
       - Se positivo: `+${formatCurrencyBinmax(todayProfitMinor)}`
       - Se negativo: `-${formatCurrencyBinmax(Math.abs(todayProfitMinor))}`
       - Se zero: `$0.00`
2. Em `apps/web/src/components/footer/TerminalFooter.tsx`:
   - Permitir estilização cromática dinâmica para `Ganancia de hoy`:
     - Positivo (> 0): cor verde ganho `#22C55E`
     - Negativo (< 0): cor vermelha perda `#E5484D`
     - Zero (== 0): cor neutra `#DCE1EA` ou `#8A92A1`
   - Preservar integridade dos testes e compatibilidade com o layout existente.

---

## 2. Arquivos Modificados
- `apps/web/src/App.tsx`
- `apps/web/src/components/footer/TerminalFooter.tsx`
- Novo teste de unidade: `apps/web/src/trade/footer-reactive-metrics.unit.test.tsx`

---

## 3. Especificação dos Testes da Subetapa 03
1. **Teste de Portfólio Ativo Dinâmico**:
   - 4 ordens abertas de $100 -> Rodapé deve exibir exatamente `Portafolio total $400.00`.
   - 0 ordens abertas -> Rodapé deve exibir `Portafolio total $0.00`.
2. **Teste de Ganho de Hoje (P&L Líquido)**:
   - 1 WIN de $100 com payout de $185 (+$85) e 1 LOSS de $100 (-$100) -> Net = -$15 -> Exibe `-$15.00` com cor `#E5484D`.
   - 2 WINs de $100 com payout $185 (+$170) -> Net = +$170 -> Exibe `+$170.00` com cor `#22C55E`.
   - Zero operações hoje -> Exibe `$0.00`.
3. **Teste de Ignorar Operações de Ontem**:
   - Operações liquidadas ontem não devem entrar no cálculo de `Ganancia de hoy`.
4. **Teste de Estresse de 200 Contratos no Histórico**:
   - Calcular as métricas instantaneamente sem re-renders desnecessários.

---

## 4. Critério de Aceite (Gate de Avanço)
- [ ] Testes em `footer-reactive-metrics.unit.test.tsx` 100% aprovados.
- [ ] Rodapé do terminal reflete com precisão os valores reais do portfólio.
