# Subetapa 6 — Memoização Rígida de Props, Callbacks & Refs Estáveis

> **Documento:** `docs/fase-1/frontend-memory-cpu-hardening/SUBETAPA_6_MEMOIZACAO_REFS_ESTAVEIS.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** React Performance, Zero Parasitic Re-renders

---

## 1. Objetivo Técnico

Em aplicações React com múltiplos fluxos em tempo real, um dos erros mais comuns de degradação é a propagação de re-renders desnecessários na árvore de componentes.

### Fontes de Re-render Parasitas Identificadas:
1. **Recriação de Arrays Inline:** `candlesQuery.data ?? []` ou `contracts.filter(...)` sendo avaliados no corpo do render e passados como props para `PriceChart`, gerando uma nova referência de memória (`[] !== []`) a cada render de qualquer pai.
2. **Estados React Atualizados a Cada Tick:** Em `PriceChart.tsx`, estados como `sentimentBulls` e `priceDirection` disparavam `setState` a cada tick recebido, forçando o React a reconciliar toda a árvore de DOM virtual e reexecutar hooks a cada segundo.
3. **Funções Inline em Handlers:** Handlers de redimensionamento e foco sendo recriados a cada ciclo em vez de estabilizados com `useCallback`.

### Solução Institucional:
1. **Memoização de Coleções com `useMemo`:**
   ```typescript
   const relevantContracts = useMemo(
     () => contracts.filter((c) => c.status === 'OPEN' && c.symbol === symbol),
     [contracts, symbol]
   );
   ```
2. **Refs Estáveis para Dados Gráficos:**
   - Instância de gráfico (`chartInstance`), séries (`candleSeries`, `areaSeries`), linhas de strike e última vela mantidas estritamente em `useRef`.
   - Atualizações gráficas são imperativas (via API C++ do Lightweight Charts) e não passam pelo pipeline de reconciliação de JSX do React.
3. **Isolamento de Componentes de Sentimento / Pulso:**
   - O indicador de sentimento da comunidade e a direção de preço passam a ser componentes isolados (`React.memo`) ou atualizados sem causar re-render do container do gráfico.

---

## 2. Passos de Execução

1. **Passo 6.1:** Refatorar `GridCell` em `MultiChartGrid.tsx` para memorizar arrays de contratos e fallbacks de velas com `useMemo`.
2. **Passo 6.2:** Desacoplar os cálculos de direção de preço e sentimento no `PriceChart.tsx`, utilizando referências estáveis para impedir re-renders do componente pai.
3. **Passo 6.3:** Envolver os componentes secundários com `React.memo` para garantir que apenas o componente afetado sofra reconciliação.
4. **Passo 6.4:** Criar teste automatizado `tests/test-subetapa-6-fe-memo-refs-stability.mjs` monitorando a contagem de renderizações sob chegada contínua de ticks e provando que o container do gráfico não re-executa a função de render.
5. **Passo 6.5:** Homologar o Quality Gate da Subetapa 6.

---

## 3. Critérios de Aceite

- [x] Nenhuma prop é recriada desnecessariamente em tempo de render.
- [x] O container do `PriceChart` não sofre reconciliação desnecessária quando novos ticks chegam.
- [x] O número de re-renders de componentes React permanece em $O(1)$ por alteração de configuração.
- [x] A taxa de quadros (FPS) da interface mantém-se estável em 60fps constantes.
