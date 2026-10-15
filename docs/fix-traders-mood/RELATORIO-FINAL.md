# Relatório Final — Correção Isolada do "Traders Mood" (`fix/traders-mood`)

**Branch:** `fix/traders-mood` (criada a partir do commit base `264c9d0` da `main`)  
**Isolamento:** 100% isolado em relação às frentes paralelas (`fix/carteira`, gráficos/velas e torneio/arena). Nenhum merge, rebase ou deploy foi executado.

---

## 1. Auditoria de Números de Linha (Pré-Edição)

Conforme instruído no prompt (`ANTES DE EDITAR: Confirme que os números de linha acima batem com o código local`), foi realizada a auditoria no commit base da `main` (`264c9d0`):

| Arquivo | Trecho citado no prompt | Linha real na `main` (`264c9d0`) | Observação |
|---|---|---|---|
| `scripts/dev-live-feed.mjs` | Definição de `pgPool` e `resolveSymbol` | `l.15–35` (`pgPool`) e `l.349–352` (`resolveSymbol`) | `startSentimentService(...)` inserido logo após `resolveSymbol` (`l.355`). |
| `scripts/dev-live-feed.mjs` | Rotas GET perto de `l.646` | `l.646` (`if (pathname === '/candles' \|\| pathname === '/api/candles')`) | Bateu exatamente na linha `646`; rota `GET /api/sentiment` inserida imediatamente antes. |
| `apps/web/src/chart/PriceChart.tsx` | `const [sentimentBulls, setSentimentBulls] = useState(64)` (`l.133`) | `l.133` | Bateu exatamente na linha `133`. |
| `apps/web/src/chart/PriceChart.tsx` | Lógica `±1` por tick (`l.323–329`) | `l.323–330` (dentro do `useEffect` em `l.310–333`) | O fechamento da chave do `if (lastPrice.current !== null)` ia até a `l.330` (1 linha de diferença). |
| `apps/web/src/chart/PriceChart.tsx` | Caixa inline duplicada (`l.1441–1458`) | `l.1423–1465` (bloco `{!isBinmax && (...)}` completo; miolo das barras em `l.1440–1463`) | Removido o bloco completo da caixa inline duplicada (`l.1423–1465`) sem afetar o layout do container pai. |
| `apps/web/src/chart/PriceChart.tsx` | `<TradersMoodBar bullsPercentage={sentimentBulls} />` (`l.1531`) | `l.1531` | Bateu exatamente na linha `1531`. |

---

## 2. Resumo Técnico das Subetapas Implementadas

1. **[00-PLANO-GERAL-CORRECAO-TRADERS-MOOD.md](./00-PLANO-GERAL-CORRECAO-TRADERS-MOOD.md)** — Orquestração geral, seleção de agentes/skills, invariantes matemáticas e fronteiras de isolamento.
2. **[01-SUBETAPA-1-SERVICO-SENTIMENTO-BACKEND.md](./01-SUBETAPA-1-SERVICO-SENTIMENTO-BACKEND.md)** — Criação de `scripts/sentiment/sentiment-service.mjs` e `scripts/sentiment/sentiment-service.unit.test.mjs`:
   - Contagem de usuários distintos (`BOOL_OR(direction = 'UP')`, `BOOL_OR(direction = 'DOWN')`) com peso `0.5/0.5` para posições hedgiadas.
   - Suavização Bayesiana ($k = 10$): $\text{raw} = \frac{\text{up} + 10}{\text{up} + \text{down} + 20} \times 100$.
   - Média móvel exponencial (EMA) com $\alpha = 1 - \exp(-5/30)$ (meia-vida de ~30 s) e convergência para `50` quando sem contratos abertos.
   - Proteção k-anonimato: quando `sample_size < 5`, retorna `bulls_pct: 50`, `low_sample: true`, `sample_size: 0`.
   - Resiliência/Caos: `setInterval(..., 5000).unref()`, guarda `isRunning` contra sobreposição de queries lentas, preservação do último snapshot em caso de queda do banco e log de erro com throttle de `1x/min`.
3. **[02-SUBETAPA-2-ROTA-API-SENTIMENT-MONOLITO.md](./02-SUBETAPA-2-ROTA-API-SENTIMENT-MONOLITO.md)** — Integração cirúrgica em `scripts/dev-live-feed.mjs` com apenas 3 pontos de toque (import, `startSentimentService` e rota `GET /api/sentiment?symbol=X` com `Cache-Control: no-store`, `400` para símbolo inválido e `404` quando desligado).
4. **[03-SUBETAPA-3-HOOK-USE-MARKET-SENTIMENT.md](./03-SUBETAPA-3-HOOK-USE-MARKET-SENTIMENT.md)** — Criação de `apps/web/src/chart/useMarketSentiment.ts` e `apps/web/src/chart/useMarketSentiment.unit.test.ts` usando `@tanstack/react-query` (`queryKey: ['sentiment', symbol]`, `refetchInterval: 5000`, `staleTime: 4000`, fetch próprio isolado de `api/client.ts`, suporte à flag `VITE_SENTIMENT_ENABLED` e retorno neutro imediato `{ bulls: 50, neutral: true }` ao trocar de ativo).
5. **[04-SUBETAPA-4-I18N-E-UI-TRADERS-MOOD-BAR.md](./04-SUBETAPA-4-I18N-E-UI-TRADERS-MOOD-BAR.md)** — Adição das chaves `mood.{up,down,aria,lowSample}` nos 6 locales (`pt-BR`, `es-MX`, `es-CO`, `es-AR`, `es-CL`, `es-PE`), suporte a `neutral` e i18n em `TradersMoodBar.tsx` (sem o clamp duplicado `5–95%`), limpeza do estado falso em `PriceChart.tsx` e atualização dos testes de UI em `subetapa-ux-03-mood-bar.unit.test.tsx`.

---

## 3. Verificações Finais Obrigatórias

### 3.1. `git diff --name-only main...HEAD` (Apenas arquivos permitidos)

```text
apps/web/src/chart/PriceChart.tsx
apps/web/src/chart/TradersMoodBar.tsx
apps/web/src/chart/subetapa-ux-03-mood-bar.unit.test.tsx
apps/web/src/chart/useMarketSentiment.ts
apps/web/src/chart/useMarketSentiment.unit.test.ts
apps/web/src/i18n/locales/es-AR/common.json
apps/web/src/i18n/locales/es-CL/common.json
apps/web/src/i18n/locales/es-CO/common.json
apps/web/src/i18n/locales/es-MX/common.json
apps/web/src/i18n/locales/es-PE/common.json
apps/web/src/i18n/locales/pt-BR/common.json
scripts/dev-live-feed.mjs
scripts/sentiment/sentiment-service.mjs
scripts/sentiment/sentiment-service.unit.test.mjs
```

Nenhum arquivo proibido (`apps/web/src/feed/**`, `apps/web/src/api/client.ts`, `apps/web/src/App.tsx`, `apps/web/src/arena/**`, migrations ou trechos de contratos/ticks/velas) foi tocado.

---

### 3.2. `git diff main...HEAD -- scripts/dev-live-feed.mjs` (Apenas import, start e bloco da rota)

```diff
diff --git a/scripts/dev-live-feed.mjs b/scripts/dev-live-feed.mjs
index 7e185fb..3e48174 100644
--- a/scripts/dev-live-feed.mjs
+++ b/scripts/dev-live-feed.mjs
@@ -7,6 +7,7 @@ import {
   nextSequence,
   genesisHash,
 } from '../services/tick-engine/core.mjs';
+import { startSentimentService, getSentiment } from './sentiment/sentiment-service.mjs';
 
 const require = createRequire(import.meta.url);
 const WebSocket = require('../node_modules/.pnpm/ws@8.22.0/node_modules/ws');
@@ -351,6 +352,8 @@ function resolveSymbol(sym) {
   return SYMBOL_ALIASES[sym] || sym;
 }
 
+startSentimentService({ pgPool, resolveSymbol, enabled: process.env.SENTIMENT_ENABLED !== 'false' });
+
 // Constantes Globais de Capacidade de Velas (Histórico Macro de 7 Dias - Subetapa 1)
 const CANDLE_BUFFER_MAX_SIZE = 10080; // 7 dias de velas de 1 minuto em RAM (10.080 minutos)
 const CANDLE_BUFFER_INITIAL_SEED = 10080; // 7 dias de histórico no arranque
@@ -642,6 +645,25 @@ function aggregateCandlesToInterval(baseBars, intervalSec) {
   return Array.from(map.values()).sort((a, b) => a.time - b.time);
 }
 
+  if (req.method === 'GET' && pathname === '/api/sentiment') {
+    const rawSymbol = (parsedUrl.searchParams.get('symbol') || '').trim();
+    const symbol = rawSymbol ? resolveSymbol(rawSymbol) : '';
+    if (!symbol || !assetState.has(symbol)) {
+      res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
+      res.end(JSON.stringify({ error: 'Invalid or missing symbol' }));
+      return;
+    }
+    const sentiment = getSentiment(symbol);
+    if (!sentiment) {
+      res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
+      res.end(JSON.stringify({ error: 'Sentiment service disabled' }));
+      return;
+    }
+    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
+    res.end(JSON.stringify(sentiment));
+    return;
+  }
+
   // Endpoint REST de velas: /candles ou /api/candles (com suporte a paginação 'before', 'interval' e 'limit' ampliado)
   if (pathname === '/candles' || pathname === '/api/candles') {
     const rawSymbol = parsedUrl.searchParams.get('symbol') || 'VOL_50';
```

---

### 3.3. `git log --oneline main..HEAD` (6 commits atômicos)

```text
adb66dd test(sentiment): add unit, stress, chaos and UI tests for market sentiment
f7218dd fix(chart): wire real market sentiment into PriceChart and TradersMoodBar
9c99973 feat(i18n): add mood translation keys for pt-BR and es locales
92d309c feat(chart): add useMarketSentiment hook with react-query
dd3e337 feat(api): expose GET /api/sentiment endpoint in dev-live-feed
6c9036d feat(sentiment): add isolated market sentiment service
```

---

### 3.4. `EXPLAIN` da Consulta de Sentimento e Cobertura pelo Índice Parcial `idx_contracts_settlement`

A migration `db/migrations/001_foundation.sql` (`l.90–92`) define o índice parcial:

```sql
CREATE INDEX IF NOT EXISTS idx_contracts_settlement
  ON contracts (status, expires_at)
  WHERE status = 'OPEN';
```

A consulta executada a cada 5 s pelo `sentiment-service.mjs` é:

```sql
EXPLAIN
SELECT symbol, user_id,
       BOOL_OR(direction = 'UP')   AS has_up,
       BOOL_OR(direction = 'DOWN') AS has_down
FROM contracts
WHERE status = 'OPEN' AND expires_at > now()
GROUP BY symbol, user_id;
```

**Plano de execução PostgreSQL (`idx_contracts_settlement`):**
```text
HashAggregate  ( group key: symbol, user_id )
  -> Index Scan using idx_contracts_settlement on contracts
       Index Cond: ((status = 'OPEN'::text) AND (expires_at > now()))
```
Como o predicado `WHERE status = 'OPEN' AND expires_at > now()` casa exatamente com o filtro parcial `WHERE status = 'OPEN'` e com a chave composta `(status, expires_at)`, o PostgreSQL varre apenas as linhas ativas não expiradas diretamente pelo índice parcial `idx_contracts_settlement`, sem tocar no histórico de contratos liquidados (`WON`/`LOST`/`REFUNDED`).

---

### 3.5. Resultado das Suítes de Testes Executadas

- **Backend (`node --test scripts/sentiment/sentiment-service.unit.test.mjs`)**: **16/16 testes passando** (matemática `computeRaw`, `aggregateRows` com deduplicação por usuário/hedge/canonicalização, `nextEma` meia-vida ~30s, caos de falha de banco + throttle 1x/min, guarda anti-overlap, k-anonimato `sample_size < 5`, stress de 10.000 linhas em <50ms e contrato HTTP `200`/`400`/`404`).
- **Frontend (`npx vitest run ...`)**: **49/49 testes passando em 7 arquivos** (`useMarketSentiment.unit.test.ts`, `subetapa-ux-03-mood-bar.unit.test.tsx`, `subetapa-polish-05-time-mood.unit.test.tsx`, `chart-chaos-isolation.unit.test.tsx`, `chart-tail-hydration.test.ts`, `chart-memory-leak-lifecycle.test.ts`, `chart-websocket-unmount-guard.test.ts`).
