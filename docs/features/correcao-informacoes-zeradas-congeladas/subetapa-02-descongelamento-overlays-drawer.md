# Subetapa 02: Descongelamento do Terminal, Transição "Liquidando..." e Limpeza de Flags no Gráfico

> **Agente**: `surgical-frontend-agent`  
> **Revisores**: `chart-trading-engineer`, `financial-correctness-reviewer`  
> **QA**: `qa-resilience-agent`  
> **Skills**: `01-project-context`, `03-synthetic-market-engine`, `11-chart-trading-tools`, `17-mudanca-cirurgica`

---

## 1. Objetivo Técnico
Garantir que tanto no gráfico quanto nos painéis de portfólio (`PortfolioDrawer.tsx`, `BinmaxPortfolioDrawer.tsx` e `OrderFlagsOverlay.tsx`):
1. **Transição Precisa de Expiração**:
   - Quando `secondsLeft <= 0` e o contrato ainda estiver formalmente com `status === 'OPEN'` (aguardando o tick ou o ciclo de liquidação):
     - No `PortfolioDrawer`: o status deve exibir `"Liquidando..."` (ou `"Expirando..."`), com indicador visual de transição em vez de permanecer como `"En curso"` com bolinha verde ativa.
     - A barra de progresso não deve desbordar além de 100%.
     - Um callback / trigger de expiração dispara a invalidação imediata da query `contracts` para não ficar esperando 3 segundos à toa.
2. **Descongelamento e Limpeza no Gráfico (`OrderFlagsOverlay.tsx`)**:
   - A flag flutuante de strike (`▲ $100 | 00:00`) NÃO deve ficar permanentemente congelada no gráfico se o contrato expirou.
   - Assim que o contrato for liquidado (`status === 'SETTLED'`), a flag de strike é imediatamente removida e substituída pelo `ExpirationResultPin` oficial com a animação de entrada da Binmax.
   - Se por qualquer motivo de atraso de rede um contrato estiver com `secondsLeft <= 0` mas status `OPEN`, a flag deve indicar visualmente `"Liquidando"` ou `"00:00 ⏳"`.
3. **Contagem e Lucro Potencial Coerentes**:
   - No `PortfolioDrawer`, o cálculo de `potentialPnlMinor` e a contagem de `activas` só devem somar contratos genuinamente em andamento (`expires_at > now`). Contratos cujo tempo já esgotou não devem inflar a estimativa de ganho futuro.

---

## 2. Arquivos Modificados
- `apps/web/src/components/drawer/PortfolioDrawer.tsx`
- `apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`
- `apps/web/src/chart/OrderFlagsOverlay.tsx`
- Novo teste de unidade & caos: `apps/web/src/trade/portfolio-unfreeze-and-overlays.unit.test.tsx`

---

## 3. Especificação dos Testes da Subetapa 02
1. **Teste de Transição "Liquidando..."**:
   - Contrato com `expires_at` igual a `Date.now() - 500ms` e status `OPEN` deve exibir status `"Liquidando..."` no `PortfolioDrawer`.
2. **Teste de Remoção de Flag de Strike no Gráfico**:
   - Quando contrato transiciona de `OPEN` para `SETTLED`, provar que a flag `order-strike-flag` não é mais renderizada, e o `expiration-result-pin` correspondente passa a ser renderizado.
3. **Teste de Não-Inflação de Ganho Potencial**:
   - 2 contratos ativos e 2 contratos com tempo esgotado (`0s`): o cálculo de ganho potencial deve somar apenas os 2 contratos ativos.
4. **Teste de Estresse de 50 Flags**:
   - 50 contratos expirando simultaneamente não devem travar a thread de animação nem causar erros de renderização no canvas.

---

## 4. Critério de Aceite (Gate de Avanço)
- [ ] Testes em `portfolio-unfreeze-and-overlays.unit.test.tsx` 100% aprovados.
- [ ] Sem quebras em testes visuais ou gráficos existentes.
