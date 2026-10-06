# Example 1 — Implementar o Outbox Relay

- **Modo:** implementação
- **Agente:** `backend-implementation-agent`
- **Padrões:** R-01, R-03

## Entrada

```text
Implementar o relay que publica os eventos do outbox no Redis Stream.
Os ticks precisam chegar em ordem; os comandos de carteira não podem se perder.
```

## Saída

```text
SKILL: 05-resilience-patterns
MODO: IMPLEMENTAÇÃO
DEPENDÊNCIAS: PostgreSQL, Redis
ESCOPO ANALISADO: services/outbox-relay/{relay,run}.ts
```

### `services/outbox-relay/relay.ts` — R-01

```ts
type OutboxRow = {
  id: string
  topic: 'tick' | 'wallet.command' | 'contract.expiring'
  aggregate_id: string
  sequence: string | null
  payload: Record<string, unknown>
}

const BATCH = 100

function destination(row: OutboxRow) {
  switch (row.topic) {
    case 'tick':
      return { stream: `ticks:${row.aggregate_id}`, id: `${row.sequence}-0` }
    case 'wallet.command':
      return { stream: 'wallet:commands', id: '*' }
    case 'contract.expiring':
      return { stream: 'contracts:expiring', id: '*' }
  }
}

function isAlreadyPublished(error: unknown) {
  return error instanceof Error && /equal or smaller than the target stream top item/i.test(error.message)
}

export async function relayBatch(db: Db, redis: Redis, topic: OutboxRow['topic'], aggregateId?: string) {
  return db.tx(async (tx) => {
    await tx.none(`SET LOCAL statement_timeout = '5s'`)
    await tx.none(`SET LOCAL lock_timeout = '2s'`)

    const rows: OutboxRow[] = await tx.any(
      `SELECT id, topic, aggregate_id, sequence, payload
         FROM outbox
        WHERE published_at IS NULL
          AND topic = $1
          AND ($2::text IS NULL OR aggregate_id = $2)
        ORDER BY id
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED`,
      [topic, aggregateId ?? null])

    const published: string[] = []
    for (const row of rows) {
      const { stream, id } = destination(row)
      try {
        await redis.xadd(stream, id, 'payload', JSON.stringify(row.payload), 'outbox_id', row.id)
      } catch (error) {
        if (!isAlreadyPublished(error)) {
          logger.warn({ err: error, outboxId: row.id, stream }, 'outbox_publish_failed')
          break
        }
      }
      published.push(row.id)

      if (row.topic === 'tick') {
        await redis.set(`tick:last:${row.aggregate_id}`, JSON.stringify(row.payload))
        await redis.publish(`ticks:${row.aggregate_id}:live`, JSON.stringify({ type: 'tick', ...row.payload }))
      }
    }

    if (published.length > 0) {
      await tx.none('UPDATE outbox SET published_at = now() WHERE id = ANY($1)', [published])
    }
    return { fetched: rows.length, published: published.length }
  })
}
```

Decisões:

- Para no primeiro erro (`break`) e confirma o que já saiu: preserva a ordem e evita republicar o lote todo.
- Rollback depois de um `XADD` bem-sucedido é seguro: ticks são deduplicados pelo ID `{sequence}-0`; demais streams são at-least-once e os consumidores são idempotentes.
- `SET` do último tick e `PUBLISH` são best effort (fan-out visual, `D-04`); o gateway descarta `sequence` repetida.

### `services/outbox-relay/run.ts` — R-01 (ordem por símbolo), R-03

```ts
const POLL_MS = 100
const LEASE_MS = 3000

export async function runTickRelay(db: Db, redis: Redis, symbol: string, instanceId: string, signal: AbortSignal) {
  const leaseKey = `lease:relay:${symbol}`
  while (!signal.aborted) {
    const leader = await holdSimpleLease(redis, leaseKey, instanceId, LEASE_MS)
    if (!leader) {
      await sleep(LEASE_MS / 3, signal)
      continue
    }
    const result = await safeRelay(() => relayBatch(db, redis, 'tick', symbol))
    if (result.fetched < 100) await sleep(POLL_MS, signal)
  }
  await redis.eval(RELEASE_IF_OWNER, 1, leaseKey, instanceId)
}

export async function runCommandRelay(db: Db, redis: Redis, topic: 'wallet.command' | 'contract.expiring', signal: AbortSignal) {
  while (!signal.aborted) {
    const result = await safeRelay(() => relayBatch(db, redis, topic))
    if (result.fetched < 100) await sleep(POLL_MS, signal)
  }
}

async function safeRelay(run: () => Promise<{ fetched: number; published: number }>) {
  const started = performance.now()
  try {
    const result = await run()
    metrics.outboxPublished.inc(result.published)
    return result
  } catch (error) {
    logger.error({ err: error }, 'outbox_relay_batch_failed')
    metrics.outboxRelayErrors.inc()
    return { fetched: 0, published: 0 }
  } finally {
    metrics.outboxBatchDuration.observe((performance.now() - started) / 1000)
  }
}

const RELEASE_IF_OWNER = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
  return 0
`
```

Graceful shutdown: `SIGTERM` aborta o `signal`; o lote em voo termina (limitado por `statement_timeout`) e o lease é liberado para outra instância assumir sem esperar o TTL.

### Métrica de lag (job a cada 5 s)

```sql
SELECT topic,
       count(*)                                   AS unpublished,
       extract(epoch FROM now() - min(created_at)) AS lag_seconds
  FROM outbox
 WHERE published_at IS NULL
 GROUP BY topic;
```

### Checklist da implementação

```text
R-01 Outbox            : PASS — FOR UPDATE SKIP LOCKED; published_at na mesma transação; um relay por símbolo para ticks
R-02 Retry + backoff   : N/A — relay repete pelo próprio loop; eventos não publicados continuam no outbox
R-03 Timeout           : PASS — statement_timeout e lock_timeout por lote; sleep abortável; lease com TTL
R-04 Circuit breaker   : N/A — sem dependência externa além de Redis/Postgres
R-05 DLQ               : N/A — falha de publicação não descarta evento (permanece no outbox)
R-06 Consumer groups   : N/A — produtor

PENDÊNCIAS: retenção de linhas publicadas no outbox — <não definido no contexto>
VEREDITO: APROVADO
```
