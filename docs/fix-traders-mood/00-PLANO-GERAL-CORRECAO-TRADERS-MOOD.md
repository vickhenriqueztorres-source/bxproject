# Plano Geral — #13 Correção Isolada do "Traders Mood" (Sentimento de Mercado)

**Projeto**: Binmax (`brokerproject`)  
**Branch**: `fix/traders-mood` (criada a partir da `main`, 100% isolada)  
**Severidade**: 🟡 **MÉDIO**  
**Data**: 2026-10-15  
**Orquestrador**: `tech-lead-orchestrator`  

---

## 0. Seleção do Orquestrador, Agentes e Skills

### 0.1 Papel do Orquestrador (`tech-lead-orchestrator`)
Coordena a decomposição da issue `#13 — "Traders mood" (sentimento)`, impõe as fronteiras estritas de isolamento em relação às branches paralelas (`fix/carteira`, torneio/arena e gráficos), exige validação 100% (unitária, estresse, caos e segurança) antes de avançar entre subetapas e consolida as evidências finais.

### 0.2 Pool de Agentes Selecionados

| Etapa / Escopo | Agente Principal | Agentes Revisores / Guardiões | Permissão |
|---|---|---|---|
| **Subetapa 1** — Serviço Backend (`sentiment-service.mjs`) | `backend-implementation-agent` | `qa-resilience-agent`, `security-reviewer` | `write-code` (isolado em `scripts/sentiment/**`) |
| **Subetapa 2** — Rota REST (`GET /api/sentiment` no monólito) | `backend-implementation-agent` | `security-reviewer`, `regression-guardian-agent` | `write-code` (máx. 3 pontos em `scripts/dev-live-feed.mjs`) |
| **Subetapa 3** — Hook Frontend (`useMarketSentiment.ts`) | `chart-trading-engineer` | `qa-resilience-agent`, `regression-guardian-agent` | `write-code` (`apps/web/src/chart/useMarketSentiment*`) |
| **Subetapa 4** — i18n + UI (`TradersMoodBar.tsx` + `PriceChart.tsx`) | `surgical-frontend-agent` + `chart-trading-engineer` | `binmax-brand-agent`, `compliance-risk-reviewer`, `regression-guardian-agent` | `write-code` (apenas linhas de sentimento e chaves `mood.*`) |
| **Verificação Final** — Gate e Auditoria de Diff/SQL | `post-implementation-verifier` | `tech-lead-orchestrator` | `read-only` estrito |

### 0.3 Skills Ativadas

1. **`01-project-context`**: Arquitetura da plataforma, separação de responsabilidades e decisões tomadas.
2. **`04-security-iam`**: Privacidade de posições (contagem por usuário distinto, nunca volume financeiro; anonimização de amostra pequena `sample_size < 5 → sample_size: 0`; validação estrita de `symbol`).
3. **`05-resilience-patterns`**: Proteção contra sobreposição de ciclo (`inFlight`), preservação do último snapshot válido em falha do PostgreSQL, log de erro com throttle de 1x/min, zero exceções não tratadas no `setInterval(..., 5000).unref()`.
4. **`06-testing-quality`**: Bateria completa de testes unitários, estresse, caos e segurança em cada subetapa.
5. **`08-database-foundation`**: Leitura agregada eficiente a cada 5s apoiada no índice parcial existente `idx_contracts_settlement (status, expires_at) WHERE status = 'OPEN'`, sem migrations ou locks.
6. **`09-ai-failure-map`**: Prevenção de escopo inflado (F-11), proteção de testes-oráculo (P-03) e isolamento de fronteiras (F-04).
7. **`11-chart-trading-tools`**: Desacoplamento de re-render por tick em `PriceChart.tsx` (G-01 60 FPS) e integridade visual de `TradersMoodBar.tsx`.
8. **`13-textos-es`**, **`15-chave-sala-nova`** e **`17-mudanca-cirurgica`**: Chaves `mood.up`, `mood.down`, `mood.aria`, `mood.lowSample` em `pt-BR` e `es-*`, controle por feature flags (`SENTIMENT_ENABLED` e `VITE_SENTIMENT_ENABLED`) e orçamento mínimo de diff.

---

## 1. Diagnóstico e Mapeamento de Código Real (`main` @ `264c9d0`)

Antes de qualquer edição, todos os números de linha do relatório foram conferidos contra a `main`:

| Arquivo | Linha no Relatório | Linha Real na `main` | Código Encontrado |
|---|---|---|---|
| `apps/web/src/chart/PriceChart.tsx` | `l.133` | **`l.133`** (exato) | `const [sentimentBulls, setSentimentBulls] = useState(64);` |
| `apps/web/src/chart/PriceChart.tsx` | `l.323–329` | **`l.323–330`** (`useEffect` em `l.310–333`) | `setSentimentBulls((prev) => Math.min(88, Math.max(45, prev + 1)))` e `Math.max(25, Math.min(65, prev - 1))` junto de `setPriceDirection` |
| `apps/web/src/chart/PriceChart.tsx` | `l.1441–1458` | **`l.1423–1465`** (miolo em `l.1440–1463`) | Bloco `{/* Trader Sentiment Bar (Sentimento da Comunidade Legado) */}` com `▲ {sentimentBulls}% COMPRA` / `▼ {100 - sentimentBulls}% VENDA` |
| `apps/web/src/chart/PriceChart.tsx` | `l.1531` | **`l.1531`** (exato) | `<TradersMoodBar bullsPercentage={sentimentBulls} />` |
| `apps/web/src/chart/TradersMoodBar.tsx` | `l.1–279` | **`l.1–279`** (exato) | Clamp `Math.min(95, Math.max(5, Math.round(bullsPercentage)))` na `l.72` e rótulos fixos `SUBE`/`BAJA` e `aria-label` hardcoded nas `l.36, 54, 62, 83, 120, 234, 263–272` |
| `scripts/dev-live-feed.mjs` | `pgPool` + `resolveSymbol` | **`l.15–35`** (`pgPool`) e **`l.349–352`** (`resolveSymbol`) | Inicialização do pool PostgreSQL e função `resolveSymbol(sym)` |
| `scripts/dev-live-feed.mjs` | `l.646` | **`l.646`** (exato) | `if (pathname === '/candles' \|\| pathname === '/api/candles')` |

### 1.1 Defeitos Raiz Identificados
1. **Sentimento falso movido por tick**: Calculado no cliente apenas pela direção do último tick (`±1`), sem relação com posições abertas.
2. **Assimetria e saltos artificiais**: Inicia em `64%` fixo; limites `[45, 88]` na subida e `[25, 65]` na queda causam saltos abruptos de 15–20 pontos na reversão.
3. **Divergência entre clientes**: Cada navegador exibe um percentual diferente para o mesmo ativo.
4. **Vazamento de estado entre ativos**: Trocar de símbolo mantém o estado `sentimentBulls` do ativo anterior.
5. **Duplicação de UI e regras**: Caixa inline legada (`PriceChart.tsx:1423–1465`) sem o clamp da `TradersMoodBar` (`l.1531`).
6. **Hardcode de idioma**: `TradersMoodBar.tsx` fixa `"SUBE"`, `"BAJA"` e `aria-label` sem passar pelo i18n (`pt-BR` vs `es-*`).

---

## 2. Arquitetura da Solução Isolada

### 2.1 Fronteiras de Isolamento (Zero Conflito com Agentes Paralelos)
- ❌ **PROIBIDO tocar em**:
  - Abertura (`~l.2600–2720`) e liquidação (`~l.2780–2800`) de contratos em `scripts/dev-live-feed.mjs`.
  - Loop de ticks e fan-out WebSocket (`~l.3150–3320`) e gerador de preço em `scripts/dev-live-feed.mjs`.
  - Trechos de torneio/arena (`apps/web/src/arena/**`, rotas de arena).
  - `apps/web/src/feed/**`, `apps/web/src/api/client.ts`, `apps/web/src/App.tsx`.
  - Em `PriceChart.tsx`: `observed.current`, `mergeObservedCandles`, séries/velas, escala.
  - `db/migrations/**` (nenhuma migration ou mudança de schema).

- ✅ **ARQUIVOS PERMITIDOS**:
  - **Criar**:
    - `scripts/sentiment/sentiment-service.mjs`
    - `scripts/sentiment/sentiment-service.unit.test.mjs`
    - `apps/web/src/chart/useMarketSentiment.ts`
    - `apps/web/src/chart/useMarketSentiment.unit.test.ts`
  - **Editar**:
    - `scripts/dev-live-feed.mjs` (1 import, 1 chamada `startSentimentService`, 1 bloco de rota `GET /api/sentiment`)
    - `apps/web/src/chart/PriceChart.tsx` (apenas as linhas do sentimento: `l.133`, `l.323–330`, `l.1423–1465`, `l.1531` + import do hook)
    - `apps/web/src/chart/TradersMoodBar.tsx` (rótulos e `aria-label` via i18n, prop `neutral`, remoção do clamp 5–95% mantendo arredondamento)
    - `apps/web/src/i18n/locales/**` (apenas chaves novas `mood.up`, `mood.down`, `mood.aria`, `mood.lowSample`)
    - Testes de UI existentes que fixavam `64%`, clamp `5–95%` ou comportamento por tick.

### 2.2 Modelo Matemático e Privacidade
1. **Contagem por usuário distinto (anti-manipulação e privacidade)**:
   - Consulta SQL a cada 5s:
     ```sql
     SELECT symbol, user_id,
            BOOL_OR(direction = 'UP')   AS has_up,
            BOOL_OR(direction = 'DOWN') AS has_down
     FROM contracts
     WHERE status = 'OPEN' AND expires_at > now()
     GROUP BY symbol, user_id
     ```
   - Símbolos são canonicalizados via `resolveSymbol(symbol)` ANTES de consolidar o voto por usuário em cada ativo canônico (garantindo que se o mesmo `user_id` tiver contrato em `SYNTH_VOL_50` e `VOL_50`, ainda conta como 1 único usuário no ativo canônico `VOL_50`).
   - Pesos por usuário distinto no ativo:
     - `has_up && has_down` → `up += 0.5`, `down += 0.5`
     - `has_up && !has_down` → `up += 1`
     - `!has_up && has_down` → `down += 1`
     - `sample_size` = número de usuários distintos com posição aberta no ativo canônico.
2. **Suavização Bayesiana com $k = 10$**:
   $$\text{raw} = \frac{\text{up} + 10}{\text{up} + \text{down} + 20} \times 100$$
   - `0 / 0` → `50.0%`
   - `3 / 1` → `54.166...%` ($\approx 54\%$)
   - `300 / 100` → `73.809...%` ($\approx 74\%$)
3. **Média Móvel Exponencial (EMA) com meia-vida de ~30s**:
   - $\alpha = 1 - \exp(-\Delta t / \tau) = 1 - \exp(-5 / 30) \approx 0.1535$
   - $\text{ema}_t = \text{ema}_{t-1} + \alpha \cdot (\text{raw}_t - \text{ema}_{t-1})$ (primeiro ciclo: $\text{ema}_0 = \text{raw}_0$).
   - Ativos sem contratos abertos recebem `up = 0, down = 0` ($\text{raw} = 50$), fazendo a EMA convergir suavemente para `50`.
4. **Proteção de Amostra Pequena ($k$-anonimato, `sample_size < 5`)**:
   - Se `sample_size < 5`: `bulls_pct = 50`, `low_sample = true`, e na resposta HTTP `sample_size: 0` (nunca expõe contagem exata menor que 5).
   - Se `sample_size >= 5`: `bulls_pct = Math.round(ema)`, `low_sample = false`, `sample_size` real.

---

## 3. Divisão em Subetapas (Execução Sequencial Estrita)

Cada subetapa possui seu documento `.md` detalhado em `docs/fix-traders-mood/` e só avança para a próxima após validação 100%:

| # | Documento | Escopo | Commit Atômico |
|---|---|---|---|
| **Subetapa 1** | [`01-SUBETAPA-1-SERVICO-SENTIMENTO-BACKEND.md`](./01-SUBETAPA-1-SERVICO-SENTIMENTO-BACKEND.md) | Criar `scripts/sentiment/sentiment-service.mjs` + `scripts/sentiment/sentiment-service.unit.test.mjs` com `computeRaw`, `nextEma`, `aggregateRows`, `startSentimentService`, `getSentiment` e testes unitários/stress/caos/segurança. | `feat(sentiment): add isolated market sentiment service and unit tests` |
| **Subetapa 2** | [`02-SUBETAPA-2-ROTA-API-SENTIMENT-MONOLITO.md`](./02-SUBETAPA-2-ROTA-API-SENTIMENT-MONOLITO.md) | Integrar `startSentimentService` e rota `GET /api/sentiment` em `scripts/dev-live-feed.mjs` (máximo 3 pontos de toque) + testes de contrato HTTP, caos, segurança e verificação `EXPLAIN` do índice `idx_contracts_settlement`. | `feat(api): expose GET /api/sentiment endpoint in dev-live-feed` |
| **Subetapa 3** | [`03-SUBETAPA-3-HOOK-USE-MARKET-SENTIMENT.md`](./03-SUBETAPA-3-HOOK-USE-MARKET-SENTIMENT.md) | Criar `apps/web/src/chart/useMarketSentiment.ts` + `apps/web/src/chart/useMarketSentiment.unit.test.ts` com TanStack Query, flag `VITE_SENTIMENT_ENABLED`, reset neutro por ativo e testes de troca rápida, erro 404/rede e flag. | `feat(chart): add useMarketSentiment hook with react-query and feature flag` |
| **Subetapa 4** | [`04-SUBETAPA-4-I18N-E-UI-TRADERS-MOOD-BAR.md`](./04-SUBETAPA-4-I18N-E-UI-TRADERS-MOOD-BAR.md) | Adicionar chaves `mood.*` em `apps/web/src/i18n/locales/**`, atualizar `TradersMoodBar.tsx` (i18n + estado `neutral` + remoção de clamp duplicado) e `PriceChart.tsx` (remover `useState(64)`, `±1`/tick e caixa inline duplicada; conectar `useMarketSentiment`), atualizar testes de UI. | `feat(i18n): add mood translation keys for pt-BR and es locales` + `fix(chart): wire real market sentiment into PriceChart and TradersMoodBar` |

---

## 4. Matriz de Testes Obrigatórios por Subetapa

| Categoria | O que é provado | Critério de Sucesso |
|---|---|---|
| **Unitários** | `computeRaw` (0/0→50, 3/1→54, 300/100→74), `aggregateRows` (dedupe por usuário, hedge 0.5/0.5, alias canônico, `sample_size < 5`), `nextEma` (convergência 30s), hook e UI i18n (`pt-BR` / `es-MX`). | 100% PASS |
| **Estresse** | Agregação de 10.000 contratos em `< 50ms`; 100 trocas rápidas de símbolo no hook sem vazamento; 500 ciclos de renderização da `TradersMoodBar` em `< 500ms`. | 100% PASS |
| **Caos** | Falha na query PostgreSQL mantém snapshot anterior sem exceção; query lenta (>5s) aciona guarda anti-sobreposição (`inFlight`); throttle de log de erro (máx. 1x/min); API 404/500/offline mantém barra neutra. | 100% PASS |
| **Segurança & Privacidade** | `sample_size < 5` nunca vaza contagem exata (`sample_size: 0`); baleia com 500 contratos conta como `1` usuário; símbolos inválidos/SQLi/XSS em `?symbol=` retornam `400`; `Cache-Control: no-store`. | 100% PASS |
| **Regressão & Isolamento** | `git diff --name-only main...fix/traders-mood` contém exclusivamente arquivos permitidos; suíte existente continua 100% verde. | 100% PASS |

---

## 5. Plano de Rollback e Feature Flags

### 5.1 Desativação Imediata por Feature Flag (Zero Deploy / Zero Revert)
- **Servidor**: `SENTIMENT_ENABLED=false` → não inicia o polling no PostgreSQL; `getSentiment()` retorna `null`; `GET /api/sentiment` responde `404`.
- **Frontend**: `VITE_SENTIMENT_ENABLED=false` → `useMarketSentiment` não faz requisições HTTP e retorna `{ bulls: 50, neutral: true }`; `TradersMoodBar` exibe estado neutro `50% / 50%`.

### 5.2 Reversão Git
```bash
# Reverter toda a branch ou commits individuais:
git revert <commit-sha>
```
