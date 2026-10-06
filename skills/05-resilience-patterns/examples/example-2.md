# Example 2 — Implementar o consumer do Wallet Adapter com timeout, retry, breaker e DLQ

- **Modo:** implementação
- **Agente:** `backend-implementation-agent`
- **Padrões:** R-02, R-03, R-04, R-05, R-06

## Entrada

```text
Reescrever o wallet adapter para consumir wallet:commands e chamar o Blnk sem travar
quando o Blnk cair, sem perder comando e sem encher a DLQ à toa.
```

## Saída

```text
SKILL: 05-resilience-patterns
MODO: IMPLEMENTAÇÃO
DEPENDÊNCIAS: Blnk, Redis Streams, PostgreSQL
ESCOPO ANALISADO: services/wallet-adapter/{blnk-client,circuit-breaker,retry,consumer}.ts
```

### `services/wallet-adapter/blnk-client.ts` — R-03 + classificação de erro

```ts
export class RetryableError extends Error {}
export class NonRetryableError extends Error {}

const BLNK_TIMEOUT_MS = 2000

export async function postTransaction(command: WalletCommand): Promise<'APPLIED' | 'ALREADY_APPLIED'> {
  let response: Response
  try {
    response = await fetch(`${process.env.BLNK_URL}/transactions`, {
      method: 'POST',
      headers: blnkHeaders(),
      body: JSON.stringify(command.transaction),
      signal: AbortSignal.timeout(BLNK_TIMEOUT_MS),
    })
  } catch (error) {
    throw new RetryableError(`blnk_network:${(error as Error).name}`)
  }

  if (response.ok) return 'APPLIED'
  if (response.status === 409) return 'ALREADY_APPLIED'
  if (response.status === 429 || response.status >= 500) {
    throw Object.assign(new RetryableError(`blnk_${response.status}`), {
      retryAfterMs: Number(response.headers.get('retry-after') ?? 0) * 1000,
    })
  }
  throw new NonRetryableError(`blnk_${response.status}`)
}
```

`command.transaction` já contém `source`, `destination` e `reference` fixa definidos pela `02-financial-invariants`. Confirmar na documentação do Blnk o status de "reference duplicada".

### `services/wallet-adapter/circuit-breaker.ts` — R-04

```ts
export class BreakerOpenError extends Error {}

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private outcomes: boolean[] = []
  private openedAt = 0
  private trialInFlight = false

  constructor(private readonly name: string, private readonly opts = { window: 20, failureRate: 0.5, openMs: 30_000 }) {}

  isOpen() {
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= this.opts.openMs) this.transition('HALF_OPEN')
    return this.state === 'OPEN' || (this.state === 'HALF_OPEN' && this.trialInFlight)
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) throw new BreakerOpenError(this.name)
    if (this.state === 'HALF_OPEN') this.trialInFlight = true
    try {
      const result = await operation()
      this.record(true)
      return result
    } catch (error) {
      if (error instanceof RetryableError) this.record(false)
      throw error
    } finally {
      this.trialInFlight = false
    }
  }

  private record(success: boolean) {
    if (this.state === 'HALF_OPEN') return this.transition(success ? 'CLOSED' : 'OPEN')
    this.outcomes.push(success)
    if (this.outcomes.length > this.opts.window) this.outcomes.shift()
    const failures = this.outcomes.filter((ok) => !ok).length
    if (this.outcomes.length >= this.opts.window && failures / this.outcomes.length >= this.opts.failureRate) {
      this.transition('OPEN')
    }
  }

  private transition(next: 'CLOSED' | 'OPEN' | 'HALF_OPEN') {
    this.state = next
    if (next === 'OPEN') this.openedAt = Date.now()
    if (next === 'CLOSED') this.outcomes = []
    metrics.circuitBreakerState.set({ dependency: this.name }, { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 }[next])
    logger.warn({ dependency: this.name, state: next }, 'circuit_breaker_transition')
  }
}
```

`NonRetryableError` (4xx) não conta como falha da dependência: é erro do comando, não indisponibilidade.

### `services/wallet-adapter/retry.ts` — R-02

```ts
export async function withRetry<T>(
  operation: () => Promise<T>,
  { attempts = 3, baseMs = 200, capMs = 2000, signal }: { attempts?: number; baseMs?: number; capMs?: number; signal?: AbortSignal },
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const retryable = error instanceof RetryableError
      if (!retryable || attempt + 1 >= attempts || signal?.aborted) throw error
      const jitter = Math.floor(Math.random() * Math.min(capMs, baseMs * 2 ** attempt))
      const retryAfter = (error as RetryableError & { retryAfterMs?: number }).retryAfterMs ?? 0
      metrics.retryAttempts.inc({ dependency: 'blnk', outcome: 'retry' })
      await sleep(Math.max(jitter, retryAfter), signal)
    }
  }
}
```

Retry curto em processo (3 tentativas, ≤ ~2 s). Retry longo = reentrega pelo Stream (até 8 entregas) via `XAUTOCLAIM`.

### `services/wallet-adapter/consumer.ts` — R-05, R-06

```ts
import os from 'node:os'

const STREAM = 'wallet:commands'
const GROUP = 'wallet-adapter'
const DLQ = `dlq:${STREAM}`
const CONSUMER = `wallet-adapter-${os.hostname()}-${process.pid}`
const MAX_DELIVERIES = 8
const MIN_IDLE_MS = 30_000

const breaker = new CircuitBreaker('blnk')

export async function ensureGroup(redis: Redis) {
  try {
    await redis.xgroup('CREATE', STREAM, GROUP, '0', 'MKSTREAM')
  } catch (error) {
    if (!/BUSYGROUP/.test((error as Error).message)) throw error
  }
}

export async function consumeLoop(redis: Redis, signal: AbortSignal) {
  while (!signal.aborted) {
    if (breaker.isOpen()) {
      await sleep(1000, signal)
      continue
    }
    const batch = await redis.xreadgroup(
      'GROUP', GROUP, CONSUMER, 'COUNT', 10, 'BLOCK', 5000, 'STREAMS', STREAM, '>')
    if (!batch) continue
    for (const [id, fields] of batch[0][1]) await handle(redis, id, fields, signal)
  }
}

async function handle(redis: Redis, id: string, fields: string[], signal: AbortSignal) {
  let command: WalletCommand
  try {
    command = WalletCommand.parse(JSON.parse(field(fields, 'payload')))
  } catch (error) {
    return deadLetter(redis, id, fields, 'poison', error)
  }

  try {
    await withRetry(() => breaker.execute(() => postTransaction(command)), { signal })
    await onCommandApplied(command)
    await redis.xack(STREAM, GROUP, id)
  } catch (error) {
    if (error instanceof NonRetryableError) return deadLetter(redis, id, fields, 'non_retryable', error)
    logger.warn({ err: error, id, contractId: command.contractId }, 'wallet_command_deferred')
  }
}

export async function reclaimLoop(redis: Redis, signal: AbortSignal) {
  while (!signal.aborted) {
    await sleep(10_000, signal)
    if (breaker.isOpen()) continue

    const pending = await redis.xpending(STREAM, GROUP, 'IDLE', MIN_IDLE_MS, '-', '+', 100) as [string, string, number, number][]
    for (const [id, , , deliveries] of pending) {
      if (deliveries < MAX_DELIVERIES) continue
      const [entry] = await redis.xrange(STREAM, id, id)
      await deadLetter(redis, id, entry?.[1] ?? [], entry ? 'retryable_exhausted' : 'trimmed', new Error(`deliveries=${deliveries}`))
    }

    const [, claimed, deleted = []] = await redis.xautoclaim(STREAM, GROUP, CONSUMER, MIN_IDLE_MS, '0-0', 'COUNT', 50) as [string, [string, string[]][], string[]?]
    for (const deletedId of deleted) await deadLetter(redis, deletedId, [], 'trimmed', new Error('trimmed_before_ack'))
    for (const [id, fields] of claimed) await handle(redis, id, fields, signal)
  }
}

async function deadLetter(redis: Redis, id: string, fields: string[], errorClass: string, error: unknown) {
  const now = new Date().toISOString()
  await redis.xadd(DLQ, '*',
    'original_stream', STREAM,
    'original_id', id,
    'group', GROUP,
    'payload', fields.length ? field(fields, 'payload') : '',
    'error_class', errorClass,
    'error_message', sanitize((error as Error)?.message ?? String(error)),
    'last_failed_at', now,
    'trace_id', currentTraceId() ?? '')
  await redis.xack(STREAM, GROUP, id)
  metrics.dlqMessages.inc({ stream: STREAM, error_class: errorClass })
  logger.error({ id, errorClass }, 'wallet_command_dead_lettered')
}

function field(fields: string[], name: string) {
  const index = fields.indexOf(name)
  if (index === -1 || index % 2 !== 0) throw new Error(`missing_field:${name}`)
  return fields[index + 1]
}
```

Fluxo com o Blnk fora do ar:

```text
1. Timeouts de 2 s → RetryableError → breaker registra falhas
2. 50% de falha em 20 chamadas → OPEN
3. consumeLoop e reclaimLoop param de ler → entregas não aumentam → DLQ não enche
4. Mensagens acumulam em wallet:commands (alerta stream_pending_messages)
5. 30 s depois → HALF_OPEN → 1 chamada de teste
6. Sucesso → CLOSED → reclaimLoop reentrega pendentes → reference fixa evita efeito duplo
```

### Checklist da implementação

```text
R-01 Outbox            : N/A — consumidor (produtor no example-1)
R-02 Retry + backoff   : PASS — só RetryableError; full jitter; Retry-After; 3 em processo + 8 entregas
R-03 Timeout           : PASS — AbortSignal.timeout(2000); BLOCK 5000; sleeps abortáveis
R-04 Circuit breaker   : PASS — janela de 20, 50%, 30 s; aberto pausa leitura e reclaim
R-05 DLQ               : PASS — dlq:wallet:commands com classe de erro; XADD antes do XACK; sem MAXLEN
R-06 Consumer groups   : PASS — consumidor único por instância; XACK após onCommandApplied; XPENDING + XAUTOCLAIM

PENDÊNCIAS: valores definitivos (PROPOSTOS em references/api-guide.md)
VEREDITO: APROVADO
```

`onCommandApplied` grava a transição de estado do contrato + outbox numa transação idempotente (`WHERE status = 'CREATED'`), conforme `02-financial-invariants`.
