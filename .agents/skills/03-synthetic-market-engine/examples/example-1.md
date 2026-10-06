# Example 1 — Implementar a geração e persistência de um tick

- **Modo:** implementação
- **Agente:** `backend-implementation-agent`
- **Etapas:** geração, persistência

## Entrada

```text
Implementar a função que produz um tick do SYNTH_1 a cada segundo.
```

## Saída

```text
SKILL: 03-synthetic-market-engine
MODO: IMPLEMENTAÇÃO
ETAPAS: GERAÇÃO | PERSISTÊNCIA
ESCOPO ANALISADO: services/tick-engine/{random,lease,produce-tick}.ts
```

### `services/tick-engine/random.ts` — M-01

```ts
import { randomBytes } from 'node:crypto'

function uniformOpenInterval(): number {
  const bits = randomBytes(8).readBigUInt64BE() >> 11n
  return (Number(bits) + 1) / 2 ** 53
}

export function standardNormal(): number {
  const u1 = uniformOpenInterval()
  const u2 = uniformOpenInterval()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

export function nextPrice(lastPrice: string, sigma: number, decimals: number): string {
  const next = Number(lastPrice) * Math.exp(sigma * standardNormal())
  return next.toFixed(decimals)
}
```

O cálculo intermediário usa `double`; o valor oficial é a string arredondada para `decimals`, gravada como `numeric`.

### `services/tick-engine/lease.ts` — M-02

```ts
const RENEW_OR_ACQUIRE = `
  local holder = redis.call('GET', KEYS[1])
  if holder == ARGV[1] then
    redis.call('PEXPIRE', KEYS[1], ARGV[2])
    return redis.call('GET', KEYS[2])
  end
  if holder == false then
    redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
    return redis.call('INCR', KEYS[2])
  end
  return false
`

export async function holdLease(redis: Redis, symbol: string, instanceId: string) {
  const epoch = await redis.eval(
    RENEW_OR_ACQUIRE, 2,
    `lease:tick-engine:${symbol}`, `lease:epoch:${symbol}`,
    instanceId, 3000,
  )
  return epoch === null ? null : BigInt(epoch as string | number)
}
```

### `services/tick-engine/produce-tick.ts` — M-02, M-03, M-04

```ts
import { createHash } from 'node:crypto'
import { nextPrice } from './random'
import { holdLease } from './lease'

export function chainHash(prev: string, symbol: string, seq: bigint, tsIso: string, price: string) {
  return createHash('sha256').update(`${prev}|${symbol}|${seq}|${tsIso}|${price}`).digest('hex')
}

export async function produceTick(db: Db, redis: Redis, cfg: EngineConfig) {
  const epoch = await holdLease(redis, cfg.symbol, cfg.instanceId)
  if (epoch === null) return { status: 'NOT_LEADER' as const }

  return db.tx(async (tx) => {
    await tx.none(`SET LOCAL statement_timeout = '500ms'`)
    const state = await tx.one(
      'SELECT * FROM index_state WHERE symbol = $1 FOR UPDATE', [cfg.symbol])

    if (epoch < BigInt(state.lease_epoch)) throw new StaleLeaderError(cfg.symbol, epoch)

    const sequence = BigInt(state.last_sequence) + 1n
    const ts = new Date(Math.max(Date.now(), state.last_ts.getTime() + 1))
    const tsIso = ts.toISOString()
    const price = nextPrice(state.last_price, cfg.sigma, cfg.priceDecimals)
    const hash = chainHash(state.last_hash, cfg.symbol, sequence, tsIso, price)

    await tx.none(
      `INSERT INTO ticks (symbol, sequence, ts, price, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [cfg.symbol, sequence, ts, price, state.last_hash, hash])

    await tx.none(
      `UPDATE index_state
          SET last_sequence = $2, last_price = $3, last_hash = $4, last_ts = $5, lease_epoch = $6
        WHERE symbol = $1`,
      [cfg.symbol, sequence, price, hash, ts, epoch])

    await tx.none(
      `INSERT INTO outbox (topic, aggregate_id, sequence, payload)
       VALUES ('tick', $1, $2, $3)`,
      [cfg.symbol, sequence, { symbol: cfg.symbol, sequence: String(sequence), ts: tsIso, price, hash }])

    return { status: 'OK' as const, sequence }
  })
}
```

### Agendamento sem deriva

```ts
export function runEngine(db: Db, redis: Redis, cfg: EngineConfig) {
  const tickOnce = async () => {
    const started = performance.now()
    try {
      const result = await produceTick(db, redis, cfg)
      if (result.status === 'OK') metrics.ticksGenerated.inc({ symbol: cfg.symbol })
    } catch (error) {
      logger.error({ err: error, symbol: cfg.symbol }, 'tick_failed')
    }
    const delay = 1000 - ((Date.now()) % 1000)
    metrics.tickDuration.observe(performance.now() - started)
    setTimeout(tickOnce, delay)
  }
  setTimeout(tickOnce, 1000 - (Date.now() % 1000))
}
```

### Checklist da implementação

```text
M-01 CSPRNG              : PASS — random.ts usa crypto.randomBytes; sem seed
M-02 Tick sequence       : PASS — last_sequence + 1 com FOR UPDATE; PK (symbol, sequence); fencing por lease_epoch
M-03 Persistir→publicar  : PASS — tick + index_state + outbox na mesma transação; nenhum publish no engine
M-04 Hash encadeado      : PASS — SHA-256 sobre serialização canônica com price em string
M-05 Candle OHLCV        : N/A
M-06 WebSocket feed      : N/A

PENDÊNCIAS: cfg.sigma, cfg.priceDecimals e p_0 (seed de index_state) — <não definido no contexto>
VEREDITO: APROVADO
```
