# Subetapa 1 — Expansão do Histórico de Velas para 48h (2.880 Velas) e Lazy Loading Retroativo

> **Governança**: `tech-lead-orchestrator`  
> **Workers Especializados**: `broker-architect-agent`, `chart-trading-engineer`, `surgical-frontend-agent`, `qa-resilience-agent`  
> **Skills Ativas**: `11-chart-trading-tools`, `03-synthetic-market-engine`, `06-testing-quality`, `17-mudanca-cirurgica`  
> **Data**: 2026-10-08  
> **Objetivo**: Resolver o Problema 2 (Apenas últimas 5 horas aparecendo no gráfico).

---

## 1. Motivação e Causa Raiz
No código anterior de `apps/web/src/api/client.ts`:
- O gerador de fallback em `getCandles` limitava as velas a `Math.min(safeLimit, 180)`.
- 180 velas de 1m representam exatamente 3 horas de mercado.
- Ao rolar para o passado, a busca por velas com `beforeTimestamp` recebia um array vazio porque a semente inicial continha apenas 180 velas e nenhuma vela mais antiga era sintetizada.
- `PriceChart.tsx` interpretava o retorno vazio como fim do histórico (`hasMoreHistoryRef.current = false`), travando o gráfico.

---

## 2. Solução Técnica Arquitetada

1. **Aumento do Seed Padrão para 2.880 Velas**:
   - `safeLimit` no cliente passa a aceitar até 2.880 velas (48 horas contínuas de dados a 1m) em carregamento inicial.
   - 2.880 velas cobrem 2 dias completos ininterruptos na inicialização.

2. **Geração Dinâmica Retroativa Ancorada em `beforeTimestamp`**:
   - Atualização de `generateSeedCandles(symbol, count, endTimestamp)` para aceitar opcionalmente o `endTimestamp`.
   - Se `endTimestamp` for fornecido (passado pelo lazy load com `before`), as velas são geradas terminando exatamente no minuto anterior a `endTimestamp`.
   - A semente do gerador determinístico utiliza `hashSymbol(symbol) ^ (beforeMinute & 0xffffff00)`, garantindo coerência matemática e continuidade de preços sem saltos abruptos.

3. **Mesclagem Inteligente no Armazenamento Local**:
   - Novos blocos históricos carregados são desduplicados e mesclados em ordem cronológica estritamente crescente.

---

## 3. Matriz de Testes Requerida
- `apps/web/src/trade/history-expansion.unit.test.ts`:
  - **HE-01**: Validação de 2.880 velas no carregamento padrão (48h contínuas).
  - **HE-02**: Geração retroativa determinística ancorada em `beforeTimestamp`.
  - **HE-03**: Ausência de duplicatas de timestamp na mesclagem de blocos contíguos.
  - **HE-04**: Teste de estresse: rolagem consecutiva de 5 blocos (5.000 velas) em menos de 100ms.
  - **HE-05**: Teste de integridade de preços (High >= Low, High >= Max(Open, Close), Low <= Min(Open, Close)).
