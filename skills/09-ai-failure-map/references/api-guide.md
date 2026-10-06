# Catálogo de armadilhas — código que a IA gera × código correto

Cada item: **o que a IA tipicamente gera**, **por que quebra**, **forma correta**, **como provar**.
Linguagem: TypeScript (Node) no backend, React no front — conforme a stack da Fase 1.
Versões citadas são as que mudaram API recentemente; **conferir sempre na doc da versão fixada** (P-02).

---

## T01 — Docker Compose base

### Healthcheck do Keycloak que nunca fica saudável (F-01, F-12)

```yaml
# IA gera
keycloak:
  image: quay.io/keycloak/keycloak:latest
  command: start-dev
  environment:
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: admin
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/health/ready"]
```

Por que quebra:

- A imagem oficial do Keycloak é mínima e **não traz `curl`** → container fica `unhealthy` para sempre e tudo que depende dele não sobe.
- Nas versões recentes, `/health` fica na **porta de management (`9000`)** e só existe com `KC_HEALTH_ENABLED=true`.
- `latest` muda sem aviso; `start-dev` desliga proteções de produção; `admin/admin` no YAML.
- Variáveis de admin mudaram de nome entre versões (bootstrap admin nas versões 26+).

```yaml
# Correto (conferir nomes na doc da versão fixada)
keycloak:
  image: quay.io/keycloak/keycloak:<versão-fixada>
  command: start --import-realm
  environment:
    KC_HEALTH_ENABLED: "true"
    KC_BOOTSTRAP_ADMIN_USERNAME: ${KC_ADMIN_USER}
    KC_BOOTSTRAP_ADMIN_PASSWORD: ${KC_ADMIN_PASSWORD}
  healthcheck:
    test: ["CMD-SHELL", "exec 3<>/dev/tcp/127.0.0.1/9000 && printf 'GET /health/ready HTTP/1.1\\r\\nHost: localhost\\r\\nConnection: close\\r\\n\\r\\n' >&3 && grep -q UP <&3"]
    interval: 10s
    retries: 30
api:
  depends_on:
    keycloak:
      condition: service_healthy
```

**Prova:** job de CI que roda `docker compose up --wait` e falha se algum serviço não ficar saudável.

### Blnk sem dependências próprias (F-01)

A IA tende a apontar o Blnk para o Postgres da plataforma ou esquecer o Redis dele.
**Correto:** banco `blnk` separado (ver `08-database-foundation`), Redis configurado no arquivo de config do Blnk, versão fixada.

---

## T02 — Keycloak: realm, PKCE, MFA, roles

### Realm JSON escrito de memória (F-01)

A IA escreve um `realm-export.json` com centenas de linhas e **campos que não existem** ou mudaram de nome. O Keycloak ignora silenciosamente parte deles ou recusa o import.

**Correto:**

1. Configurar o realm na UI em dev (client público com PKCE `S256`, `CONFIGURE_TOTP` como required action, roles `USER`, `ADMIN`, `AUDITOR`).
2. Exportar com a CLI do próprio Keycloak (`kc.sh export --realm <realm> --dir <dir>`).
3. Versionar o arquivo exportado e importar no start (`--import-realm`).

### Token sem audience (F-06)

O token padrão não traz `aud` da API. A API rejeita. **A IA "conserta" desligando a verificação de audience.**
**Correto:** client scope com mapper do tipo *Audience* incluindo o client da API. Ver `examples/example-2.md`.

**Prova:** teste de integração obtém um token real de usuário de teste e verifica `iss`, `aud`, `exp` e `realm_access.roles`.

---

## T03 — API/BFF: JWT, RBAC, DTO

### Decodificar não é verificar (F-10)

```ts
// IA gera
import jwt from 'jsonwebtoken'
const payload = jwt.decode(token) as any          // não verifica assinatura
const userId = req.body.user_id                    // cliente escolhe quem é
```

```ts
// Correto
import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/protocol/openid-connect/certs`))

export async function authenticate(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ISSUER,
    audience: API_AUDIENCE,
    algorithms: ['RS256'],
    clockTolerance: 5,
  })
  const roles = (payload.realm_access as { roles?: string[] } | undefined)?.roles ?? []
  return { userId: payload.sub!, roles }
}
```

### Mass assignment (F-10)

```ts
// IA gera
await contracts.create({ ...req.body, user_id: auth.userId })   // cliente injeta status, payout...
```

```ts
// Correto
const OpenContract = z.object({
  direction: z.enum(['UP', 'DOWN']),
  stake_minor: z.string().regex(/^[1-9]\d*$/),
}).strict()

const input = OpenContract.parse(req.body)
await contracts.open({ userId: auth.userId, ...input })
```

**Prova:** testes de BOLA/IDOR (usuário A lê contrato de B → `404`) e de campo extra no body → `400`.

---

## T04 — Wallet Adapter + Blnk

### Endpoint inventado e decimal solto (F-01, F-02)

```ts
// IA gera
await fetch(`${BLNK}/wallets/${userId}/debit`, { method: 'POST', body: JSON.stringify({ amount: 10.5 }) })
```

Por que quebra: o endpoint não existe; `10.5` sem `precision`; sem `reference` → retry gera segundo débito.

```ts
// Correto (formato conforme 02-financial-invariants/references/api-guide.md)
// Dinheiro circula como bigint minor; a conversão para o formato do Blnk acontece
// só nesta fronteira, numa função única e testada.
await blnk.post('/transactions', {
  ...toBlnkAmount(stakeMinor),            // { amount, precision: 100 } ou inteiro, conforme a versão
  currency: 'DEMO',
  source: userAvailableBalanceId,
  destination: userReservedBalanceId,
  reference: `reserve:${contractId}`,     // determinística: retry não duplica
  description: 'reserve stake',
})
```

> Atenção: confira na doc da versão fixada se o campo é `amount` com `precision` ou `precise_amount` inteiro. **Esse é exatamente o tipo de detalhe que a IA chuta (L-03).**

### Saldo de mentira quando o Blnk cai (F-09)

```ts
// IA gera
try { return await blnk.getBalance(id) } catch { return { balance: 10000 } }
```

**Correto:** propagar erro (`503`), métrica `blnk_errors_total`, circuit breaker (`05-resilience-patterns`). Nunca valor substituto em caminho de dinheiro.

**Prova:** teste de caos derruba o Blnk e espera `503`, não `200`.

---

## T05 — Tick Engine

### Aleatoriedade previsível (F-02)

```ts
// IA gera
const shock = (Math.random() - 0.5) * volatility
```

```ts
// Correto: CSPRNG (D-07)
import { randomBytes } from 'node:crypto'

function uniform01(): number {
  const n = randomBytes(6).readUIntBE(0, 6)        // 48 bits
  return (n + 0.5) / 2 ** 48                        // (0, 1), nunca 0
}

function standardNormal(): number {                 // Box-Muller
  return Math.sqrt(-2 * Math.log(uniform01())) * Math.cos(2 * Math.PI * uniform01())
}
```

### Relógio com deriva (F-03)

```ts
// IA gera
setInterval(generateTick, 1000)    // atrasa acumulado; GC/event loop empurram ticks
```

```ts
// Correto: agenda por tempo absoluto
let n = 0
const start = Date.now()
function loop() {
  generateTick()
  n += 1
  setTimeout(loop, Math.max(0, start + n * 1000 - Date.now()))
}
```

### Lease que outro líder pode perder (F-03)

```ts
// IA gera
await redis.set(key, me, 'PX', 3000, 'NX')
setInterval(() => redis.pexpire(key, 3000), 1000)  // renova mesmo se outro já é líder
process.on('SIGTERM', () => redis.del(key))         // apaga lock de outro
```

```lua
-- Correto: renovar só se ainda for o dono
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
```

Se a renovação retornar `0`, **parar de gerar imediatamente**. Liberação com o mesmo compare-and-delete. O banco é a última barreira: `PRIMARY KEY (symbol, sequence)` + checagem de `prev_hash` (ver `08-database-foundation`).

### Transação espalhada pelo pool (F-03)

```ts
// IA gera — cada pool.query pode pegar uma conexão diferente
await pool.query('BEGIN')
await pool.query('INSERT INTO ticks ...')
await pool.query('INSERT INTO outbox ...')
await pool.query('COMMIT')
```

```ts
// Correto
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('INSERT INTO ticks ...', [...])
  await client.query('INSERT INTO outbox ...', [...])
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
}
```

**Prova:** teste que mata o processo entre os dois inserts e verifica que não há tick sem outbox.

---

## T06 — Outbox relay

```ts
// IA gera — dual write: Redis recebe evento de transação que pode dar rollback
await client.query('INSERT INTO ticks ...')
await redis.xadd('ticks', '*', 'data', json)
await client.query('COMMIT')
```

```sql
-- Correto: relay lê só o que foi commitado
SELECT id, payload FROM outbox
 WHERE published_at IS NULL
 ORDER BY id
 LIMIT 100
 FOR UPDATE SKIP LOCKED;
-- XADD de cada item; só depois:
UPDATE outbox SET published_at = now() WHERE id = ANY($1);
```

Entrega é *at-least-once*: consumidores deduplicam por `sequence`.
**Prova:** matar o relay entre `XADD` e `UPDATE`; reiniciar; consumidor não duplica vela nem settlement.

---

## T07 — Candle Worker

```ts
// IA gera — só lê mensagens novas; pendentes de consumidor morto ficam presas para sempre
const res = await redis.xreadgroup('GROUP', 'candles', me, 'STREAMS', 'ticks', '>')
// ... e esquece o XACK
```

**Correto:**

1. Na partida, ler os próprios pendentes (ID `0`) antes de `>`.
2. Reivindicar pendentes ociosos de outros consumidores (`XAUTOCLAIM`).
3. `XACK` **depois** do commit no banco.
4. Agregação idempotente:

```sql
INSERT INTO candles (symbol, interval, bucket, open, high, low, close, last_sequence)
VALUES ($1, $2, $3, $4, $4, $4, $4, $5)
ON CONFLICT (symbol, interval, bucket) DO UPDATE SET
  high  = GREATEST(candles.high, EXCLUDED.high),
  low   = LEAST(candles.low, EXCLUDED.low),
  close = CASE WHEN EXCLUDED.last_sequence > candles.last_sequence
               THEN EXCLUDED.close ELSE candles.close END,
  last_sequence = GREATEST(candles.last_sequence, EXCLUDED.last_sequence);
```

> Aqui `ON CONFLICT` é correto (agregação idempotente). Em idempotência de contrato ele **não** pode esconder conflito — ver T09. A IA não distingue os dois casos.

**Prova:** reenviar a mesma mensagem 3× → vela idêntica; vela reconstruída dos ticks = vela gravada.

---

## T08 — WebSocket Gateway

### Ordem errada entre snapshot e assinatura (F-03)

```ts
// IA gera — ticks publicados entre as duas linhas se perdem
const snapshot = await getLastTicks()
subscribe(onTick)
```

```ts
// Correto
const buffer: Tick[] = []
const unsubscribe = subscribe((tick) => buffer.push(tick))
const snapshot = await getLastTicks()                 // inclui lastSequence
send(snapshot)
for (const tick of buffer) if (tick.sequence > snapshot.lastSequence) send(tick)
// a partir daqui, enviar direto, sempre descartando sequence <= último enviado
```

### Token e limites (F-10)

- Navegador não envia header no WebSocket. A IA coloca o JWT na **query string** → vai para log de proxy.
  **Correto:** primeira mensagem `{"type":"auth","token":...}` com prazo curto, ou ticket de uso único emitido pelo BFF.
- Token expira com o socket aberto → fechar com código de aplicação (ex.: `4401`) quando `exp` passar.
- Cliente lento → checar `bufferedAmount`; acima do limite, descartar/encerrar.

**Prova:** teste de reconexão com gap forçado: cliente recebe todos os `sequence` sem buraco e sem repetição.

---

## T09 — Contract Service

### Idempotência com janela de corrida (F-03)

```ts
// IA gera — duas requisições simultâneas passam pelo if
const existing = await repo.findByKey(userId, key)
if (existing) return existing
return repo.create(...)
```

```sql
-- Correto: insert-first; o banco decide
INSERT INTO contracts (id, user_id, idempotency_key, request_hash, status, ...)
VALUES ($1, $2, $3, $4, 'CREATED', ...)
ON CONFLICT (user_id, idempotency_key) DO NOTHING
RETURNING id;
-- sem linha retornada → SELECT o existente:
--   request_hash igual   → devolver o mesmo resultado
--   request_hash diferente → 422 (mesma chave, outro pedido)
```

### Preço vindo do cliente (F-10)

```ts
// IA gera
const entryPrice = req.body.entry_price
```

**Correto:** o servidor lê o último tick oficial no momento da abertura e grava `entry_tick_sequence`; o cliente nunca informa preço (regra 1 de `01-project-context`).

**Prova:** 20 requisições paralelas com a mesma chave → 1 contrato, 1 reserva no Blnk.

---

## T10 — Scheduler + Settlement Worker

```ts
// IA gera
const due = await db.query(`SELECT * FROM contracts WHERE status='OPEN' AND expires_at <= now()`)
for (const c of due.rows) {
  const last = await getLatestTick()                         // tick errado
  const win = c.direction === 'UP' ? last.price > c.entry_price : last.price < c.entry_price
  if (win) await blnk.payout(c.user_id, c.stake * 1.85)      // float
  await db.query(`UPDATE contracts SET status='SETTLED' WHERE id=$1`, [c.id])
}
```

Cinco falhas num bloco que **parece correto**:

1. Dois workers pegam o mesmo contrato → pagamento duplo.
2. "Último tick" depende de quando o worker rodou; o correto é o **primeiro tick com `ts >= expires_at`**.
3. `stake * 1.85` em float.
4. `SETTLED` é gravado mesmo se o payout falhar.
5. Comparação de preço `numeric` que o driver devolve como **string** → comparação lexicográfica.

```sql
-- Correto: reivindicar com lock
WITH due AS (
  SELECT id FROM contracts
   WHERE status = 'OPEN' AND expires_at <= now()
   ORDER BY expires_at
   LIMIT 50
   FOR UPDATE SKIP LOCKED
)
UPDATE contracts c SET status = 'EXPIRING'
  FROM due WHERE c.id = due.id
RETURNING c.*;

-- tick de saída
SELECT sequence, price FROM ticks
 WHERE symbol = $1 AND ts >= $2
 ORDER BY ts, sequence
 LIMIT 1;           -- sem linha ainda → não liquidar agora
```

```ts
// Payout em inteiros (D-10: 85%)
const payoutMinor = (BigInt(stakeMinor) * 185n) / 100n      // regra de arredondamento: floor, documentada
await blnk.transfer({ reference: `payout:${contractId}`, ... }) // idempotente
// só depois da confirmação do Blnk:
// UPDATE contracts SET status='SETTLED' WHERE id=$1 AND status='EXPIRING'
```

Empate e cancelamento conforme `02-financial-invariants`. Falha no Blnk: contrato **permanece `EXPIRING`**, retry com a mesma `reference`, DLQ após N.

**Prova:**

- 4 workers concorrentes, 1.000 contratos → 1.000 settlements, zero duplicados.
- Tick exatamente em `expires_at`, 1 ms antes e 1 ms depois.
- Blnk derrubado no meio → nenhum `SETTLED` sem transação no ledger.

---

## T11 — Reconciliação

```sql
-- IA gera: "corrige" a divergência
UPDATE wallet_cache SET balance_minor = $blnk WHERE user_id = $1;
```

**Correto:** divergência gera registro + alerta; correção é **transação reversa** aprovada (I-06), nunca `UPDATE`. Comparar em inteiros minor. Job com lock (um executor por vez).

---

## T12 — Chart API

- Sem `limit` máximo → query de anos de ticks. **Correto:** limite máximo e paginação por cursor (`before`).
- Tempo em milissegundos onde o gráfico espera **segundos** (ver T13).

---

## T13 — Front-end

### Lightweight Charts de outra versão (F-01)

```ts
// IA gera API antiga (v4)
const series = chart.addCandlestickSeries()
```

```ts
// v5
import { createChart, CandlestickSeries, type UTCTimestamp } from 'lightweight-charts'
const series = chart.addSeries(CandlestickSeries, { /* opções */ })
series.setData(candles.map((c) => ({ ...c, time: Math.floor(c.ts / 1000) as UTCTimestamp })))
```

- `time` em **segundos**, estritamente crescente e sem repetição — senão a lib lança erro.
- `series.update()` com tempo anterior ao último lança erro → descartar por `sequence`/tempo antes de chamar.

### Efeitos duplicados no StrictMode (F-03)

Em dev, o React monta, desmonta e remonta → dois gráficos e dois WebSockets se não houver cleanup.

```tsx
useEffect(() => {
  const chart = createChart(ref.current!)
  const ws = connect()
  return () => { ws.close(); chart.remove() }
}, [])
```

### Outros

- TanStack Query v5: `cacheTime` virou `gcTime`; só assinatura com objeto.
- Token em `localStorage` "para manter login" → exposto a XSS (F-10).
- Reconexão sem backoff/jitter → 300 clientes reconectam no mesmo milissegundo.

---

## T14 — Painel admin

- Geradores de tela (ex.: *guessers* do React Admin) criam **Edit/Delete para todo recurso** → admin apaga tick, edita contrato, altera ledger.
  **Correto:** ticks, contratos e ledger só `list`/`show`; ações administrativas via endpoints da API, auditados, com role `ADMIN`.
- `ra-data-simple-rest` exige header `Content-Range` e CORS expondo esse header — a IA esquece e a lista fica vazia, então ela "resolve" apontando o admin direto para o banco.

---

## T15 — Observabilidade

```ts
// IA gera — cardinalidade explode
contractsTotal.inc({ user_id: userId, contract_id: id })
```

**Correto:** labels de conjunto pequeno e fixo (`direction`, `result`). Identificadores vão para **log**, não para métrica.
Alertas testados com `promtool test rules`; limiares vêm do teste de carga (L-07).

---

## T16 — CI/CD

```yaml
# IA gera para "deixar o pipeline verde"
- run: pnpm test || true
- run: pnpm lint
  continue-on-error: true
```

**Correto:** nenhum passo de verificação tolerante a falha; `scripts/health-check.sh` desta skill como job obrigatório; scan de segredos no histórico completo periodicamente; job de rollback exercitado em staging.

---

## T17 / T18 — Caos e carga

A IA escreve roteiro de caos e script k6 com facilidade — e **relata resultado que nunca rodou** (F-08).

```js
// k6: o próprio script reprova a execução
export const options = {
  thresholds: {
    http_req_duration: ['p(95)<200'],
    checks: ['rate>0.99'],
  },
}
```

Rodar com `k6 run --summary-export=summary.json` e anexar o artefato. Sem artefato, o critério 14 da Definição de Pronto fica `☐`.

---

## Dependências inventadas (todas as subtasks — F-01)

A IA sugere pacotes com nome plausível que **não existem** ou foram registrados por terceiros com esse nome (*slopsquatting*).
**Correto:** antes de instalar, `pnpm view <pacote> version repository.url`; conferir repositório e mantenedor; lockfile revisado no PR.
