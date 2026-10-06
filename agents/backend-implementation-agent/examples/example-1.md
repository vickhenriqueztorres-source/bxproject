# Exemplo 1 — T09 `POST /contracts` do handoff ao YAML de saída

## 1. Handoff recebido

```yaml
task_id: T09
agent: backend-implementation-agent
objective: Implementar POST /contracts com Idempotency-Key, reserva de stake via outbox e estados da seção 9.2.
context:
  - ORCHESTRATOR.md §9.2, §9.3
  - agents/backend-implementation-agent/references/api-guide.md (DTO, schema, erros)
skills: [01-project-context, 02-financial-invariants, 04-security-iam, 05-resilience-patterns]
acceptance_criteria:
  - Mesma Idempotency-Key + mesmo corpo devolve o mesmo contrato e não reserva duas vezes.
  - Preço de entrada vem do último tick persistido, nunca do cliente.
  - Stake fora de 100..10000 ou acima do saldo é rejeitado.
  - Reserva no Blnk usa a chave reserve:{contract_id}.
budget: { max_steps: 40, max_tokens: 200000, timeout: 30m }
```

## 2. Validação e classificação

```text
Handoff válido: task_id T09 pertence ao agente; 4 critérios testáveis; budget definido.
01-project-context → DENTRO DO ESCOPO (Contract Service; D-06, D-10, D-12).
Divergências aplicadas: estados vigentes (PENDING_RESERVE); UNIQUE (user_id, idempotency_key).
```

## 3. Plano

| Arquivo | Conteúdo |
|---------|----------|
| `db/migrations/0004_contracts.up.sql` / `.down.sql` | Tabela `contracts` da referência |
| `services/api/src/contracts/open-contract.ts` | Rota, DTO estrito, idempotência, transação + outbox |
| `services/api/src/outbox/reserve-stake.ts` | Handler do relay que chama o Blnk |
| `services/api/src/contracts/open-contract.unit.test.ts` | Replay e corpo divergente |

## 4. Código

```ts
// services/api/src/contracts/open-contract.ts
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { RequestContext, HttpResult } from '../http/types'
import { error, ok } from '../http/respond'

const OpenContractDto = z
  .object({
    symbol: z.literal('SYNTH_VOL_50'),
    direction: z.enum(['UP', 'DOWN']),
    stake_minor: z.number().int().min(100).max(10_000),
  })
  .strict() // S-05: qualquer campo extra (price, user_id, payout…) é rejeitado

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CONTRACT_DURATION_MS = 60_000
const FEED_STALE_MS = 5_000

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const canonical = (dto: z.infer<typeof OpenContractDto>) =>
  JSON.stringify([dto.symbol, dto.direction, dto.stake_minor])

export async function openContract(ctx: RequestContext): Promise<HttpResult> {
  const userId = ctx.auth.sub // B-01: identidade vem do JWT validado pelo middleware
  const idempotencyKey = ctx.headers['idempotency-key']
  if (typeof idempotencyKey !== 'string' || !UUID_PATTERN.test(idempotencyKey)) {
    return error(400, 'IDEMPOTENCY_KEY_REQUIRED')
  }

  const parsed = OpenContractDto.safeParse(ctx.body)
  if (!parsed.success) {
    const unknown = parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')
    return error(400, unknown ? 'UNKNOWN_FIELD' : 'INVALID_STAKE')
  }
  const dto = parsed.data
  const requestHash = sha256(canonical(dto))

  const replay = await findByKey(ctx.db, userId, idempotencyKey)
  if (replay) {
    return replay.request_hash === requestHash
      ? ok(201, toView(replay))
      : error(422, 'IDEMPOTENCY_KEY_REUSED')
  }

  // Pré-checagem de UX. A checagem autoritativa é a reserva no Blnk (allow_overdraft: false).
  const availableMinor = await ctx.wallet.getAvailableMinor(userId) // timeout + breaker no adapter
  if (dto.stake_minor > availableMinor) return error(422, 'INSUFFICIENT_FUNDS')

  return ctx.db.transaction(async (tx) => {
    const index = await tx.one('SELECT status FROM indices WHERE symbol = $1', [dto.symbol])
    if (index.status !== 'ACTIVE') return error(409, 'INDEX_PAUSED')

    const lastTick = await tx.one(
      'SELECT sequence, price, ts FROM ticks WHERE symbol = $1 ORDER BY sequence DESC LIMIT 1',
      [dto.symbol],
    )
    if (Date.now() - lastTick.ts.getTime() > FEED_STALE_MS) return error(503, 'FEED_STALE')

    const contractId = randomUUID()
    const expiresAt = new Date(lastTick.ts.getTime() + CONTRACT_DURATION_MS)

    // CREATED é transitório dentro desta transação; o primeiro estado visível é PENDING_RESERVE.
    const inserted = await tx.maybeOne(
      `INSERT INTO contracts (id, user_id, symbol, direction, stake_minor, entry_price,
         entry_sequence, expires_at, status, idempotency_key, request_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_RESERVE', $9, $10)
       ON CONFLICT (user_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [contractId, userId, dto.symbol, dto.direction, dto.stake_minor, lastTick.price,
       lastTick.sequence, expiresAt, idempotencyKey, requestHash],
    )

    if (!inserted) {
      // Corrida: outra requisição com a mesma chave commitou primeiro.
      const winner = await findByKey(tx, userId, idempotencyKey)
      return winner && winner.request_hash === requestHash
        ? ok(201, toView(winner))
        : error(422, 'IDEMPOTENCY_KEY_REUSED')
    }

    await tx.query(
      `INSERT INTO outbox (topic, aggregate_id, sequence, payload)
       VALUES ('RESERVE_STAKE', $1, 0, $2)`,
      [contractId, JSON.stringify({
        contractId,
        userId,
        amountMinor: dto.stake_minor,
        reference: `reserve:${contractId}`, // B-04
      })],
    )

    ctx.metrics.contractCreatedTotal.inc()
    return ok(201, toView(inserted))
  })
}

async function findByKey(db: RequestContext['db'], userId: string, key: string) {
  return db.maybeOne(
    'SELECT * FROM contracts WHERE user_id = $1 AND idempotency_key = $2',
    [userId, key],
  )
}

function toView(row: ContractRow) {
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    stake_minor: Number(row.stake_minor),
    entry_price: row.entry_price,
    entry_sequence: Number(row.entry_sequence),
    expires_at: row.expires_at.toISOString(),
    status: row.status,
  }
}
```

```ts
// services/api/src/outbox/reserve-stake.ts
import type { OutboxHandler } from './types'

export const handleReserveStake: OutboxHandler<'RESERVE_STAKE'> = async (event, deps) => {
  await deps.wallet.transfer(
    {
      reference: event.reference, // reserve:{contract_id} — Blnk deduplica por reference
      from: { userId: event.userId, balance: 'available' },
      to: { userId: event.userId, balance: 'reserved' },
      amountMinor: event.amountMinor,
      allowOverdraft: false,
      metaData: { type: 'CONTRACT_OPEN', contract_id: event.contractId },
    },
    { timeoutMs: 2_000 }, // R-03; retry + backoff + breaker ficam no relay (R-02, R-04)
  )

  await deps.db.query(
    "UPDATE contracts SET status = 'OPEN' WHERE id = $1 AND status = 'PENDING_RESERVE'",
    [event.contractId],
  )
}
```

```ts
// services/api/src/contracts/open-contract.unit.test.ts
it('replay com a mesma chave devolve o mesmo contrato e grava um único outbox', async () => {
  const ctx = fakeContext({ sub: 'u1', key: KEY, body: { symbol: 'SYNTH_VOL_50', direction: 'UP', stake_minor: 500 } })
  const first = await openContract(ctx)
  const second = await openContract(ctx)
  expect(second.body).toEqual(first.body)
  expect(ctx.db.outboxRows('RESERVE_STAKE')).toHaveLength(1)
})

it('mesma chave com corpo diferente devolve 422', async () => {
  const ctx = fakeContext({ sub: 'u1', key: KEY, body: { symbol: 'SYNTH_VOL_50', direction: 'UP', stake_minor: 500 } })
  await openContract(ctx)
  const res = await openContract({ ...ctx, body: { ...ctx.body, stake_minor: 900 } })
  expect(res.status).toBe(422)
})
```

## 5. Evidências coletadas

```text
pnpm vitest run services/api/src/contracts      → 6 passed
bash agents/backend-implementation-agent/scripts/health-check.sh services db  → APROVADO
bash skills/02-financial-invariants/scripts/health-check.sh services          → APROVADO
bash skills/04-security-iam/scripts/health-check.sh services                  → APROVADO
```

## 6. Saída

```yaml
task_id: T09
agent: backend-implementation-agent
status: DONE
summary: >
  POST /contracts implementado com DTO estrito, Idempotency-Key obrigatória (UNIQUE por usuário
  + hash do corpo), preço de entrada do último tick persistido e outbox RESERVE_STAKE na mesma
  transação. Reserva no Blnk com reference reserve:{id} e allow_overdraft=false; contrato passa
  a OPEN após confirmação. Rota de cancelamento não implementada (regra pendente).
artifacts:
  - db/migrations/0004_contracts.up.sql
  - db/migrations/0004_contracts.down.sql
  - services/api/src/contracts/open-contract.ts
  - services/api/src/outbox/reserve-stake.ts
  - services/api/src/contracts/open-contract.unit.test.ts
evidence:
  - pnpm vitest run services/api/src/contracts → 6 passed
  - agent health-check → APROVADO; skills 02 e 04 health-check → APROVADO
acceptance_criteria_met:
  - criterion: Mesma Idempotency-Key + mesmo corpo devolve o mesmo contrato
    met: true
    evidence: teste "replay com a mesma chave…"
  - criterion: Preço de entrada vem do último tick persistido
    met: true
    evidence: open-contract.ts lê ticks ORDER BY sequence DESC; DTO .strict()
  - criterion: Stake fora de 100..10000 ou acima do saldo é rejeitado
    met: true
    evidence: DTO + CHECK no banco + allow_overdraft=false no Blnk
  - criterion: Reserva usa reserve:{contract_id}
    met: true
    evidence: reserve-stake.ts
confidence_score: 0.9
decisions_cited: [D-06, D-10, D-12, I-03, I-04, R-01, R-03, S-04, S-05, B-01, B-04, B-05]
pending:
  - Regra de cancelamento (POST /contracts/:id/cancel) <não definido no contexto>
```

O item pendente não pertence aos critérios desta subtask, por isso o status é `DONE` e o
`confidence_score` fica em `0.9`. Se pertencesse, o status seria `BLOCKED`.
