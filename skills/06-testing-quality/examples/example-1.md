# Exemplo 1 — Unit + integração do fluxo de contrato

- **Modo:** implementação
- **Agente:** `qa-resilience-agent`
- **Pedido:** "Escrever os testes do resultado do contrato, do candle e da idempotência do `POST /contracts`."
- **Regras cobertas:** `I-02`, `I-03`, `I-04`, `M-05`, `S-04`, `S-05`, `D-10`, `D-12`

Ferramentas PROPOSTAS (`references/api-guide.md`): Vitest, fast-check, Testcontainers. Valores monetários com `decimal.js` (nunca `float`).

## Unit — resultado e payout (Q-01)

```ts
// services/settlement-worker/test/unit/result.test.ts
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import Decimal from 'decimal.js'
import { decideResult, profitFor, settlementLegs } from '../../src/result'

describe('[I-02][D-10] resultado e payout', () => {
  it.each([
    ['UP', '1000.25', '1000.90', 'WIN'],
    ['UP', '1000.25', '1000.10', 'LOSS'],
    ['DOWN', '1000.25', '999.80', 'WIN'],
    ['DOWN', '1000.25', '1000.30', 'LOSS'],
    ['UP', '1000.25', '1000.25', 'DRAW'],
    ['DOWN', '1000.25', '1000.25', 'DRAW'],
  ] as const)('[AC-42-1..4] %s entrada %s saída %s → %s', (direction, entry, exit, expected) => {
    expect(decideResult(direction, new Decimal(entry), new Decimal(exit))).toBe(expected)
  })

  it('[D-10] lucro do WIN é 85% do stake', () => {
    expect(profitFor(new Decimal('50.00')).toFixed(2)).toBe('42.50')
  })

  it.todo('[D-10] arredondamento do payout — <não definido no contexto>')

  it('[I-02] soma das variações dos balances é zero para qualquer stake e resultado', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.constantFrom('WIN', 'LOSS', 'DRAW'),
        (cents, result) => {
          const legs = settlementLegs(new Decimal(cents).div(100), result)
          const total = legs.reduce((sum, leg) => sum.plus(leg.delta), new Decimal(0))
          expect(total.isZero()).toBe(true)
        },
      ),
    )
  })
})
```

## Unit — expiração com relógio injetado (Q-01)

```ts
// services/contract-service/test/unit/expiry.test.ts
import { describe, it, expect } from 'vitest'
import { FakeClock } from '../../../../tests/support/fake-clock'
import { draftContract, isExpired } from '../../src/contract'

describe('[I-04][D-10] expiração de 60 s', () => {
  it('[D-10] contrato vence exatamente 60 s após a abertura', () => {
    const clock = new FakeClock('2026-03-10T12:00:00.000Z')
    const contract = draftContract({ clock, direction: 'UP', stake: '50.00' })

    clock.advance(59_999)
    expect(isExpired(contract, clock)).toBe(false)

    clock.advance(1)
    expect(isExpired(contract, clock)).toBe(true)
  })
})
```

## Unit — candle OHLCV (Q-01, property-based)

```ts
// services/candle-worker/test/unit/aggregate.test.ts
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import Decimal from 'decimal.js'
import { aggregate } from '../../src/aggregate'

const ticks = fc
  .uniqueArray(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 60 })
  .chain((sequences) =>
    fc.tuple(...sequences.sort((a, b) => a - b).map((sequence) =>
      fc.integer({ min: 90_000, max: 110_000 }).map((cents) => ({ sequence, price: new Decimal(cents).div(100) })),
    )),
  )

describe('[M-05] agregação OHLCV', () => {
  it('[M-05] low ≤ open, close ≤ high', () => {
    fc.assert(fc.property(ticks, (input) => {
      const c = aggregate(input)
      expect(c.low.lte(c.open) && c.low.lte(c.close)).toBe(true)
      expect(c.high.gte(c.open) && c.high.gte(c.close)).toBe(true)
    }))
  })

  it('[M-05] reprocessar os mesmos ticks não muda o candle', () => {
    fc.assert(fc.property(ticks, (input) => {
      expect(aggregate([...input, ...input])).toEqual(aggregate(input))
    }))
  })
})
```

## Integração — idempotência, BOLA e mass assignment (Q-02)

```ts
// services/api/test/integration/contracts.int.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startStack, type Stack } from '../../../../tests/support/stack'

let stack: Stack
beforeAll(async () => { stack = await startStack() }, 180_000)
afterAll(async () => { await stack.stop() })

const body = (symbol: string) => ({ symbol, direction: 'UP', stake: '50.00' })

describe('[I-03][D-12] POST /contracts', () => {
  it('[I-03] mesma Idempotency-Key 20× em paralelo → 1 contrato e 1 reserva', async () => {
    const user = await stack.createUser()
    const key = crypto.randomUUID()

    const responses = await Promise.all(
      Array.from({ length: 20 }, () => stack.api(user).post('/contracts', body(stack.symbol), { 'Idempotency-Key': key })),
    )

    const ok = responses.filter((r) => r.status === 200 || r.status === 201)
    const ids = new Set(ok.map((r) => r.body.id))
    expect(ok.length).toBeGreaterThan(0)
    expect(ids.size).toBe(1)
    expect(await stack.db.count('contracts', { user_id: user.sub })).toBe(1)
    expect(await stack.blnk.countTransactions({ reference: `reserve:${[...ids][0]}` })).toBe(1)
    expect(await stack.ledgerSum()).toBe('0')
  })

  it('[S-04] usuário B recebe 404 no contrato de A', async () => {
    const [a, b] = [await stack.createUser(), await stack.createUser()]
    const created = await stack.api(a).post('/contracts', body(stack.symbol), { 'Idempotency-Key': crypto.randomUUID() })

    const res = await stack.api(b).get(`/contracts/${created.body.id}`)

    expect(res.status).toBe(404)
  })

  it('[S-05] body com user_id e entry_price → 400 e nada gravado', async () => {
    const [attacker, victim] = [await stack.createUser(), await stack.createUser()]

    const res = await stack.api(attacker).post(
      '/contracts',
      { ...body(stack.symbol), user_id: victim.sub, entry_price: '1' },
      { 'Idempotency-Key': crypto.randomUUID() },
    )

    expect(res.status).toBe(400)
    expect(await stack.db.count('contracts', { user_id: victim.sub })).toBe(0)
  })
})
```

## Notas

- `startStack` sobe PostgreSQL, Redis, Keycloak e Blnk com as **mesmas tags de imagem** do `docker-compose.yml`; cada teste cria usuário e símbolo próprios.
- O teste paralelo não fixa o status das respostas duplicadas em voo (`<não definido no contexto>`); ele prova o **efeito**: 1 contrato, 1 reserva, ledger fechado.
- Remover a `UNIQUE (user_id, idempotency_key)` ou o lock deixa `[I-03]` vermelho — é isso que prova que o teste testa.
