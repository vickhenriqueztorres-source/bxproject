# Subetapa 3 — Hook `useMarketSentiment.ts` no Frontend

**Projeto**: Binmax (`brokerproject`)  
**Branch**: `fix/traders-mood`  
**Agentes**: `chart-trading-engineer` + `qa-resilience-agent` + `regression-guardian-agent`  
**Skills**: `01-project-context`, `05-resilience-patterns`, `06-testing-quality`, `11-chart-trading-tools`, `15-chave-sala-nova`, `17-mudanca-cirurgica`  
**Arquivos Criados**:
- `apps/web/src/chart/useMarketSentiment.ts`
- `apps/web/src/chart/useMarketSentiment.unit.test.ts`

**Commit**: `feat(chart): add useMarketSentiment hook with react-query and feature flag`

---

## 1. Especificação Técnica

### 1.1 Assinatura e Comportamento do Hook
Arquivo: `apps/web/src/chart/useMarketSentiment.ts`

```ts
export interface MarketSentimentResult {
  bulls: number;
  neutral: boolean;
}

export function useMarketSentiment(symbol: string): MarketSentimentResult
```

### 1.2 Regras de Implementação
1. **TanStack Query (`@tanstack/react-query`)**:
   - `queryKey: ['sentiment', symbol]`
   - `refetchInterval: 5000`
   - `staleTime: 4000`
   - `retry: false` (falhas retornam estado neutro sem tempestade de retries, aguardando o próximo ciclo de 5s)
   - **Fetch próprio no hook**: **PROIBIDO** adicionar função em `apps/web/src/api/client.ts`.
   - Propaga o `signal` do React Query (`fetch(url, { signal, cache: 'no-store' })`) para cancelar automaticamente requisições em voo ao trocar de ativo.
   - Possui um `fallbackQueryClient` interno para que testes existentes que renderizam `<PriceChart />` via `renderToString` sem `<QueryClientProvider>` funcionem sem lançar exceção.
2. **Feature Flag `VITE_SENTIMENT_ENABLED`**:
   - Suporta `import.meta.env?.VITE_SENTIMENT_ENABLED` e helper de teste `setSentimentEnabledForTesting(boolean | null)`.
   - Se a flag estiver desligada (`false` / `'false'` / `'0'`), `enabled: false` no `useQuery` (zero chamadas de rede) e o hook retorna imediatamente `{ bulls: 50, neutral: true }`.
3. **Troca de Símbolo (Zero Herança do Ativo Anterior)**:
   - Como a chave é `['sentiment', symbol]` e não usamos `keepPreviousData`/`placeholderData`, ao trocar de `symbol` o estado fica `isLoading/isPending` (`neutral: true, bulls: 50`) até chegar a primeira resposta válida do novo ativo.
4. **Regra de Retorno `{ bulls, neutral }`**:
   - `neutral = !isEnabled || isLoading || isError || !data || Boolean(data.low_sample)`
   - `bulls = neutral ? 50 : Math.min(100, Math.max(0, Math.round(data.bulls_pct)))`

---

## 2. Testes Obrigatórios (`useMarketSentiment.unit.test.ts`)

1. **Testes Unitários**:
   - Resposta normal (`bulls_pct: 68, low_sample: false`) → retorna `{ bulls: 68, neutral: false }`.
   - Resposta com `low_sample: true` → retorna `{ bulls: 50, neutral: true }`.
   - Troca de símbolo (`VOL_50` → `EURUSD_OTC`) → retorna `{ bulls: 50, neutral: true }` imediatamente até a resposta do novo símbolo resolver (nunca herda `68%` do ativo anterior).
   - Flag `VITE_SENTIMENT_ENABLED = false` → retorna `{ bulls: 50, neutral: true }` e não executa `fetch`.
2. **Testes de Caos**:
   - API retorna `404` (serviço desligado no servidor) → retorna `{ bulls: 50, neutral: true }`.
   - API retorna `500` ou erro de rede (`TypeError: Failed to fetch`) → retorna `{ bulls: 50, neutral: true }` sem lançar erro para a árvore React.
   - API retorna JSON malformado ou `bulls_pct: NaN` → fallback seguro `{ bulls: 50, neutral: true }`.
3. **Teste de Estresse**:
   - 50 trocas rápidas de símbolo consecutivas não vazam estado do símbolo anterior e resolvem apenas o último símbolo ativo.
4. **Teste de Segurança**:
   - Símbolo com caracteres especiais é codificado com `encodeURIComponent(symbol)` na query string `?symbol=...`.

---

## 3. Passo a Passo de Execução

1. Criar `apps/web/src/chart/useMarketSentiment.ts`.
2. Criar `apps/web/src/chart/useMarketSentiment.unit.test.ts`.
3. Executar `npx vitest run apps/web/src/chart/useMarketSentiment.unit.test.ts`.
4. Fazer commit atômico: `feat(chart): add useMarketSentiment hook with react-query and feature flag`.
