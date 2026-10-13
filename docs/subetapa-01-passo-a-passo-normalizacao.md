# Subetapa 01: Paridade de Preços Base, Desacoplamento de Ticks e Estabilização de Escala

**Responsável:** `broker-architect-agent` & `chart-trading-engineer`  
**Revisor:** `financial-correctness-reviewer` & `qa-resilience-agent`  
**Executor Cirúrgico:** `surgical-frontend-agent`  
**Garantia:** "NUNCA IMPLEMENTAR NADA SEM TESTES ROBUSTOS"

---

## 1. Escopo Técnico da Subetapa 01

1. **Paridade Rigorosa de Preços Base**:
   - `SYNTH_VOL_50` é alterado de `1250.0` para `500.1250` em `apps/web/src/catalog/assets.ts`, alinhando perfeitamente com `scripts/dev-live-feed.mjs`.
   - Todos os 36 ativos auditados contra o backend para garantir delta zero na montagem da semente.

2. **Desacoplamento de Ticks e Fim do Ciclo de Re-render `setData`**:
   - `effectiveCandles` no `PriceChart.tsx` é calculado estritamente sobre `[internalCandles, symbol]`. O parâmetro `tick` é removido das dependências para evitar reinicialização contínua de velas.
   - Os novos ticks utilizam estritamente `series.update()` via `rafUpdater`.

3. **Reset de Escala e Limpeza de PriceLines na Troca de Símbolo**:
   - Antes de carregar as novas velas, todas as linhas de preço (`currentPriceLine`, `strikeLines`) são purgadas.
   - Forçar `chart.priceScale('right').applyOptions({ autoScale: true })` e `timeScale().fitContent()`.

---

## 2. Passo a Passo de Execução

### Passo 1: Criação dos Testes de Paridade e Estabilização de Escala
- **Arquivo**: `apps/web/src/chart/subetapa-01-parity-and-scale-hardening.unit.test.ts`
- **Casos de Teste**:
  - `SCALE-01`: Paridade exata entre catálogo de ativos do frontend e backend (`SYNTH_VOL_50 = 500.1250`).
  - `SCALE-02`: Ausência de vela gigante na inicialização de qualquer um dos 36 ativos (amplitude da 1ª vela < 1%).
  - `SCALE-03`: Reset de escala entre ativos de ordens de magnitude discrepantes (BTC 64.000 -> EURUSD 1.0854).
  - `SCALE-04`: Teste de estresse com 10.000 ticks contínuos sem colapso de escala.

### Passo 2: Implementação das Correções
- Atualizar `apps/web/src/catalog/assets.ts`.
- Ajustar `apps/web/src/chart/PriceChart.tsx`.
- Ajustar `apps/web/src/chart/IsolatedChartHost.tsx`.

### Passo 3: Execução e Validação
- Rodar vitest e certificar aprovação de 100% dos testes.
