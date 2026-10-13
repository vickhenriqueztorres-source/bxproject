# Subetapa 05 — Bateria de Testes de Estresse, Caos e Segurança

## 1. Objetivo Técnico
Submeter o novo componente `BinmaxPortfolioDrawer` a um processo rigoroso de validação executiva conduzido pelo `qa-resilience-agent` e revisado pelo `financial-correctness-reviewer` e `security-reviewer`:
- **Teste de Estresse (High Load)**:
  - Simulação de renderização com 100 contratos abertos simultâneos.
  - Verificação de ausência de gargalos no ciclo de renderização React (< 15ms para 100 itens).
  - Estabilidade de consumo de memória durante updates frequentes de preço.
- **Teste de Caos (Resiliência Operacional)**:
  - Simulação de relógio do cliente adiantado em +5 minutos (drift temporal) e atrasado em -5 minutos.
  - Simulação de tick de preço nulo (`currentPrice = null`), indefinido ou `NaN`.
  - Simulação de símbolos atípicos, criptomoedas e commodities sem quebra de layout.
  - Contratos com `expires_at < created_at` (dados corrompidos) tratados com elegância via fallback seguro.
- **Teste de Segurança & Integridade Financeira**:
  - Garantia de que nenhum cálculo do drawer tenta alterar o saldo da carteira ou forjar payouts no backend.
  - Dados estritamente read-only (`Contract` imutável).
  - Sanitização de símbolos e valores numéricos contra injeção ou formatações inconsistentes.

---

## 2. Arquivos Impactados
- `apps/web/src/trade/portfolio-refinement-stress-chaos.unit.test.tsx` (novo arquivo de teste dedicado).

---

## 3. Critérios de Aceite
- 100% de sucesso nos cenários de estresse e casos de borda.
- Zero vazamentos de memória ou timers zumbis (`setInterval` devidamente limpos no unmount).
