# Subetapa 1 — Serviço de Sentimento no Backend (`sentiment-service.mjs`)

**Projeto**: Binmax (`brokerproject`)  
**Branch**: `fix/traders-mood`  
**Agentes**: `backend-implementation-agent` + `qa-resilience-agent` + `security-reviewer`  
**Skills**: `01-project-context`, `04-security-iam`, `05-resilience-patterns`, `06-testing-quality`, `08-database-foundation`  
**Arquivos Criados**:
- `scripts/sentiment/sentiment-service.mjs`
- `scripts/sentiment/sentiment-service.unit.test.mjs`

**Commit**: `feat(sentiment): add isolated market sentiment service and unit tests`

---

## 1. Especificação Técnica

### 1.1 Funções Puras Exportadas (para testes determinísticos)

1. **`computeRaw(up, down, k = 10)`**:
   - Fórmula: $\text{raw} = \frac{\text{up} + k}{\text{up} + \text{down} + 2k} \times 100$
   - Sanitiza entradas não-finitas ou negativas para `0`.
   - Casos canônicos:
     - `computeRaw(0, 0, 10)` → `50`
     - `computeRaw(3, 1, 10)` → `54.1666...` ($\approx 54 \pm 0.5$)
     - `computeRaw(300, 100, 10)` → `73.8095...` ($\approx 74 \pm 0.5$)

2. **`nextEma(prev, raw, dtSec = 5, halfLifeSec = 30)`**:
   - Fórmula:
     - Se `prev === null || prev === undefined || !Number.isFinite(prev)`, retorna `raw`.
     - $\alpha = 1 - \exp(-\text{dtSec} / \text{halfLifeSec})$ (conforme especificação: $\alpha = 1 - \exp(-5/30)$).
     - Retorna $\text{prev} + \alpha \cdot (\text{raw} - \text{prev})$.

3. **`aggregateRows(rows, resolveSymbol = (s) => s, k = 10)`**:
   - Recebe linhas da consulta SQL `{ symbol, user_id, has_up, has_down }`.
   - Canonicaliza `symbol` via `resolveSymbol(row.symbol)`.
   - Consolida por `(canonicalSymbol, user_id)` para que um mesmo usuário com contratos em `SYNTH_VOL_50` e `VOL_50` conte apenas **1 vez** no ativo canônico `VOL_50` (unindo `has_up = a || b` e `has_down = a || b`).
   - Por ativo canônico:
     - `up = Σ (has_up && has_down ? 0.5 : has_up ? 1 : 0)`
     - `down = Σ (has_up && has_down ? 0.5 : has_down ? 1 : 0)`
     - `sample_size` = número de `user_id` distintos no ativo canônico
     - `raw = computeRaw(up, down, k)`
     - `low_sample = sample_size < 5`
     - `bulls_pct = low_sample ? 50 : Math.round(raw)`
   - Retorna `Map<string, { symbol, up, down, sample_size, raw, bulls_pct, low_sample }>`.

### 1.2 Serviço com Estado em Memória

4. **`startSentimentService({ pgPool, resolveSymbol, enabled, intervalMs = 5000, knownSymbols = [] })`**:
   - Se `enabled === false` ou `process.env.SENTIMENT_ENABLED === 'false'`:
     - Marca serviço como desabilitado (`isEnabled = false`).
     - Não inicia timer nem consulta o banco.
     - `getSentiment()` retorna `null`.
   - Caso habilitado:
     - Mantém snapshot em memória (`Map<symbol, Snapshot>`) e estado EMA (`Map<symbol, number>`).
     - Consulta SQL a cada 5s (`setInterval(..., intervalMs).unref()`):
       ```sql
       SELECT symbol, user_id,
              BOOL_OR(direction = 'UP')   AS has_up,
              BOOL_OR(direction = 'DOWN') AS has_down
       FROM contracts
       WHERE status = 'OPEN' AND expires_at > now()
       GROUP BY symbol, user_id
       ```
     - **Proteção contra sobreposição (`inFlight`)**: se a consulta anterior ainda estiver em andamento, pula o ciclo atual imediatamente.
     - **Convergência para ativos sem contratos abertos**: todo símbolo já conhecido em `emaBySymbol` ou `knownSymbols` que não apareceu na consulta recebe `up = 0, down = 0, sample_size = 0, raw = 50`, fazendo sua EMA convergir para `50` e marcando `bulls_pct = 50, low_sample = true, sample_size = 0`.
     - **Privacidade (`sample_size < 5`)**: quando `low_sample === true`, o snapshot público armazena `bulls_pct: 50`, `low_sample: true`, `sample_size: 0` (nunca expõe contagem exata menor que 5).
     - **Resiliência a falhas**: se `pgPool.query` rejeitar ou lançar erro, mantém o último snapshot intocado, registra `console.error` com throttle de no máximo 1x a cada 60.000 ms (`1 min`), e **nunca** propaga exceção para fora do intervalo.

5. **`getSentiment(symbol)`**:
   - Se serviço desabilitado → retorna `null`.
   - Resolve o símbolo canônico via `resolveSymbol`.
   - Lê exclusivamente do snapshot em memória (zero I/O de banco).
   - Se o ativo ainda não teve contratos, devolve snapshot neutro `{ symbol: canonical, bulls_pct: 50, sample_size: 0, low_sample: true, ts }`.

---

## 2. Passo a Passo de Implementação

### Passo 1: Criar `scripts/sentiment/sentiment-service.mjs`
Implementar todas as funções puras e o gerenciador de ciclo de 5s com injeção opcional de relógio (`nowFn`) para testes determinísticos de throttle e EMA.

### Passo 2: Criar `scripts/sentiment/sentiment-service.unit.test.mjs`
Implementar suíte abrangendo:
1. **Testes Unitários Matemáticos**:
   - `computeRaw`: `0/0 → 50`, `3/1 → 54 (±0.5)`, `300/100 → 74 (±0.5)`.
   - `aggregateRows`: 1 usuário com 10 contratos UP conta 1; usuário com UP e DOWN conta `0.5 / 0.5`; símbolo legado (`SYNTH_VOL_50`) é canonicalizado para `VOL_50` e deduplicado por usuário; `sample_size < 5` → `bulls_pct: 50, low_sample: true`.
   - `nextEma`: converge monotonamente para `raw`; meia-vida de ~30s verificada matematicamente.
2. **Testes de Caos e Resiliência**:
   - Falha na consulta (`pgPool.query` lança `Connection terminated unexpectedly`): mantém o snapshot anterior intacto e não lança exceção.
   - Throttle de log de erro: 10 falhas seguidas dentro de 60s geram apenas 1 log; após +60s, loga novamente.
   - Proteção anti-sobreposição (`inFlight`): se uma query demorar mais que 1 ciclo, chamadas concorrentes de `pollOnce()` não disparam segunda query simultânea no banco.
   - Ativo cujos contratos expiraram converge a EMA em direção a 50 e volta para `low_sample: true`.
3. **Testes de Segurança e Privacidade**:
   - `sample_size` entre 1 e 4 nunca é exposto no retorno de `getSentiment` (retorna sempre `sample_size: 0, bulls_pct: 50, low_sample: true`).
   - `enabled: false` (ou `SENTIMENT_ENABLED=false`) retorna `null` em `getSentiment` e faz `0` queries ao banco.
4. **Teste de Estresse**:
   - `aggregateRows` processando 10.000 linhas distribuídas em 36 ativos executa em `< 50ms`.

### Passo 3: Executar e Validar 100%
```bash
npx vitest run scripts/sentiment/sentiment-service.unit.test.mjs
```

### Passo 4: Commit Atômico
```bash
git add scripts/sentiment/sentiment-service.mjs scripts/sentiment/sentiment-service.unit.test.mjs
git commit -m "feat(sentiment): add isolated market sentiment service and unit tests"
```
