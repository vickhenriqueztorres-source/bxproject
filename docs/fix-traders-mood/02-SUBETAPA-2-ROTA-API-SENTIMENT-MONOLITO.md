# Subetapa 2 — Rota REST `GET /api/sentiment` no Monólito (`dev-live-feed.mjs`)

**Projeto**: Binmax (`brokerproject`)  
**Branch**: `fix/traders-mood`  
**Agentes**: `backend-implementation-agent` + `security-reviewer` + `regression-guardian-agent`  
**Skills**: `01-project-context`, `04-security-iam`, `05-resilience-patterns`, `08-database-foundation`, `17-mudanca-cirurgica`  
**Arquivos Editados/Criados**:
- `scripts/dev-live-feed.mjs` (estritamente 3 pontos: import, `startSentimentService`, e rota `GET /api/sentiment`)
- `scripts/sentiment/sentiment-service.unit.test.mjs` (adição dos testes de contrato HTTP da rota, segurança, caos e verificação do índice `idx_contracts_settlement`)

**Commit**: `feat(api): expose GET /api/sentiment endpoint in dev-live-feed`

---

## 1. Regras Estritas de Isolamento no Monólito

No arquivo `scripts/dev-live-feed.mjs`, entram **NO MÁXIMO**:
1. **1 import** no topo:
   ```js
   import { startSentimentService, getSentiment } from './sentiment/sentiment-service.mjs';
   ```
2. **1 chamada de start** logo após `resolveSymbol` e `ASSETS_CONFIG` estarem definidos (com `pgPool` já pronto):
   ```js
   startSentimentService({ pgPool, resolveSymbol, enabled: process.env.SENTIMENT_ENABLED === 'true', knownSymbols: ASSETS_CONFIG.map((a) => a.symbol) });
   ```
   *(Nota: Como a especificação determina "4. Fica desligada por flag, nos dois lados", por padrão sem variável ou com `SENTIMENT_ENABLED=false` fica desligada; se `SENTIMENT_ENABLED=true`, liga. Também aceita `SENTIMENT_ENABLED !== 'false'` quando configurado explicitamente — vamos suportar a regra exata do prompt: `Se enabled === false (env SENTIMENT_ENABLED=false): não faz nada; getSentiment devolve null`, com default desligado no monólito via `process.env.SENTIMENT_ENABLED === 'true'`, ou verificaremos ambos os modos em teste!)*
   - **Atenção ao detalhe do prompt**:
     - Seção 2 item 4: *"Fica desligada por flag, nos dois lados."*
     - Seção 4 item 1: *"Se enabled === false (env SENTIMENT_ENABLED=false): não faz nada; getSentiment devolve null."*
     - Seção 4 Manual: *"Desligar a flag no servidor e no front → barra neutra, sem erro no console."*
     - Para atender simultaneamente a ambos os enunciados sem ambiguidade:
       - Em `startSentimentService({ pgPool, resolveSymbol, enabled })`: se `enabled === undefined`, avalia `process.env.SENTIMENT_ENABLED !== 'false' && process.env.SENTIMENT_ENABLED !== '0'`.
       - Em `dev-live-feed.mjs`: passa `enabled: process.env.SENTIMENT_ENABLED !== 'false' && process.env.SENTIMENT_ENABLED !== '0'` (ou `Boolean(...)`), garantindo que `SENTIMENT_ENABLED=false` desliga imediatamente (retornando `404`) e permitindo os testes manuais de múltiplos navegadores e de desligamento da flag.
3. **1 bloco de rota `GET /api/sentiment`** junto das outras rotas GET (logo acima da linha 646 `/candles`):
   - `symbol` obrigatório (`?symbol=X`), resolvido com `resolveSymbol(rawSymbol)`; se ausente ou não existir em `assetState` → `400 Bad Request`.
   - Se o serviço estiver desligado (`getSentiment(symbol) === null`) → `404 Not Found`.
   - Caso contrário → `200 OK` com `{ symbol, bulls_pct, sample_size, low_sample, ts }` e header `Cache-Control: no-store`.
   - Sem autenticação (dado puramente agregado, sem `user_id` nem valores financeiros).
   - Com `low_sample: true`, garante `sample_size: 0` (nunca expõe contagem exata `< 5`).

---

## 2. Verificação de Banco de Dados (`idx_contracts_settlement`)

A consulta executada pelo serviço a cada 5s é:
```sql
SELECT symbol, user_id,
       BOOL_OR(direction = 'UP')   AS has_up,
       BOOL_OR(direction = 'DOWN') AS has_down
FROM contracts
WHERE status = 'OPEN' AND expires_at > now()
GROUP BY symbol, user_id
```
O schema inicial (`db/migrations/0001_initial_schema.sql:82`) já define o índice parcial:
```sql
CREATE INDEX IF NOT EXISTS idx_contracts_settlement ON contracts(status, expires_at) WHERE status = 'OPEN';
```
- Como o predicado da consulta contém `WHERE status = 'OPEN' AND expires_at > now()`, o planejador do PostgreSQL utiliza o índice parcial `idx_contracts_settlement` para varrer exclusivamente contratos abertos não expirados (`Index Scan using idx_contracts_settlement on contracts`), evitando Seq Scan sobre o histórico de contratos `SETTLED`.

---

## 3. Testes Obrigatórios da Subetapa 2

1. **Testes Unitários / Contrato HTTP**:
   - `GET /api/sentiment?symbol=VOL_50` → `200 OK`, `Cache-Control: no-store`, JSON `{ symbol: 'VOL_50', bulls_pct, sample_size, low_sample, ts }`.
   - `GET /api/sentiment?symbol=SYNTH_VOL_50` (alias legado) → `200 OK` com `symbol: 'VOL_50'`.
   - `GET /api/sentiment` (sem `symbol`) → `400 Bad Request`.
   - `GET /api/sentiment?symbol=UNKNOWN_ASSET` → `400 Bad Request`.
   - `GET /api/sentiment?symbol=VOL_50` com `SENTIMENT_ENABLED=false` → `404 Not Found`.
2. **Testes de Segurança**:
   - Injeção de payloads maliciosos em `symbol` (`' OR 1=1--`, `<script>`, strings gigantes) → `400 Bad Request` imediato via validação contra `assetState`.
   - Verificação de que nenhum campo `user_id`, `stake_minor` ou contagem `1..4` jamais aparece no payload HTTP.
3. **Auditoria de Diff do Monólito**:
   - `git diff main... -- scripts/dev-live-feed.mjs` contém exclusivamente o import, o start e o bloco da rota `GET /api/sentiment`.

---

## 4. Passo a Passo de Execução

1. Editar `scripts/dev-live-feed.mjs` cirurgicamente nos 3 pontos autorizados.
2. Adicionar os testes de contrato HTTP, segurança e estresse da rota em `scripts/sentiment/sentiment-service.unit.test.mjs`.
3. Rodar `npx vitest run scripts/sentiment/sentiment-service.unit.test.mjs`.
4. Auditar `git diff main... -- scripts/dev-live-feed.mjs`.
5. Fazer commit atômico: `feat(api): expose GET /api/sentiment endpoint in dev-live-feed`.
