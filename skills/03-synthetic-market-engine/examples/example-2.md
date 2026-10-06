# Example 2 — Implementar assinatura com catch-up no WebSocket Gateway e candle idempotente

- **Modo:** implementação
- **Agentes:** `frontend-realtime-agent` (protocolo) + `backend-implementation-agent` (gateway e worker)
- **Etapas:** agregação, feed

## Entrada

```text
Quando o usuário perde a conexão por alguns segundos, o gráfico fica com buraco.
Implementar o catch-up no gateway e garantir que o candle de 1m não duplica.
```

## Saída

```text
SKILL: 03-synthetic-market-engine
MODO: IMPLEMENTAÇÃO
ETAPAS: AGREGAÇÃO | FEED
ESCOPO ANALISADO: services/ws-gateway/subscribe.ts, services/candle-worker/upsert-candle.ts
```

### `services/ws-gateway/subscribe.ts` — M-06

A autenticação do handshake é feita antes deste handler (`04-security-iam`).

```ts
import { z } from 'zod'

const SubscribeMessage = z.object({
  type: z.literal('subscribe'),
  symbol: z.string().regex(/^[A-Z0-9_]{1,20}$/),
  lastSequence: z.coerce.bigint().nonnegative().optional(),
}).strict()

const MAX_SYMBOLS = 10
const PAGE = 500

export async function onSubscribe(conn: Connection, raw: unknown) {
  const parsed = SubscribeMessage.safeParse(raw)
  if (!parsed.success) return conn.send({ type: 'error', code: 'INVALID_MESSAGE' })

  const { symbol, lastSequence } = parsed.data
  if (!conn.symbols.has(symbol) && conn.symbols.size >= MAX_SYMBOLS) {
    return conn.send({ type: 'error', code: 'SYMBOL_LIMIT' })
  }

  conn.beginCatchUp(symbol)

  if (lastSequence === undefined) {
    const last = await redis.get(`tick:last:${symbol}`)
    if (last) conn.deliver(symbol, { type: 'snapshot', ...JSON.parse(last) })
    return conn.endCatchUp(symbol)
  }

  const oldest = await redis.xrange(`ticks:${symbol}`, '-', '+', 'COUNT', 1)
  const oldestSequence = oldest.length ? BigInt(oldest[0][0].split('-')[0]) : null

  if (oldestSequence === null || lastSequence + 1n < oldestSequence) {
    conn.send({ type: 'resync_required', symbol, reason: 'lastSequence_out_of_retention' })
    return conn.endCatchUp(symbol)
  }

  let cursor = `${lastSequence + 1n}-0`
  for (;;) {
    const entries = await redis.xrange(`ticks:${symbol}`, cursor, '+', 'COUNT', PAGE)
    for (const [, fields] of entries) conn.deliver(symbol, { type: 'tick', ...toTick(fields) })
    if (entries.length < PAGE) break
    const lastId = BigInt(entries[entries.length - 1][0].split('-')[0])
    cursor = `${lastId + 1n}-0`
  }

  conn.endCatchUp(symbol)
}
```

### `Connection.deliver` — dedupe e buffer durante o catch-up

```ts
class Connection {
  private lastSent = new Map<string, bigint>()
  private buffering = new Map<string, TickMessage[]>()
  readonly symbols = new Set<string>()

  beginCatchUp(symbol: string) {
    this.symbols.add(symbol)
    this.buffering.set(symbol, [])
  }

  endCatchUp(symbol: string) {
    const buffered = this.buffering.get(symbol) ?? []
    this.buffering.delete(symbol)
    for (const message of buffered) this.deliver(symbol, message)
  }

  onLive(symbol: string, message: TickMessage) {
    const buffer = this.buffering.get(symbol)
    if (buffer) buffer.push(message)
    else this.deliver(symbol, message)
  }

  deliver(symbol: string, message: TickMessage) {
    const sequence = BigInt(message.sequence)
    if (sequence <= (this.lastSent.get(symbol) ?? -1n)) return
    this.lastSent.set(symbol, sequence)
    this.send(message)
  }
}
```

### `services/candle-worker/upsert-candle.ts` — M-05

O worker consome `ticks:{symbol}` via consumer group (`05-resilience-patterns`) e, para cada tick, recalcula o bucket a partir da tabela `ticks`. Reprocessar o mesmo tick produz o mesmo candle.

```ts
export async function upsertCandle(tx: Tx, symbol: string, ts: Date) {
  await tx.none(
    `INSERT INTO candles (symbol, interval, bucket_start, open, high, low, close, volume, first_seq, last_seq)
     SELECT $1, '1m', date_trunc('minute', $2::timestamptz),
            (array_agg(price ORDER BY sequence ASC))[1],
            max(price), min(price),
            (array_agg(price ORDER BY sequence DESC))[1],
            count(*), min(sequence), max(sequence)
       FROM ticks
      WHERE symbol = $1
        AND ts >= date_trunc('minute', $2::timestamptz)
        AND ts <  date_trunc('minute', $2::timestamptz) + interval '1 minute'
     ON CONFLICT (symbol, interval, bucket_start) DO UPDATE SET
       open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
       close = EXCLUDED.close, volume = EXCLUDED.volume,
       first_seq = EXCLUDED.first_seq, last_seq = EXCLUDED.last_seq`,
    [symbol, ts])
}
```

Com TimescaleDB, a mesma regra pode ser uma continuous aggregate usando `first(price, sequence)` e `last(price, sequence)`.

### Lado do cliente (`frontend-realtime-agent`)

```text
1. Guardar lastSequence por símbolo após cada mensagem tick/snapshot.
2. Se sequence recebida != lastSequence + 1 → reenviar subscribe com lastSequence.
3. Ao reconectar → subscribe com lastSequence.
4. resync_required → GET /candles, limpar a série no Lightweight Charts, subscribe sem lastSequence.
5. Preço chega como string; converter apenas para exibir.
```

### Checklist da implementação

```text
M-01 CSPRNG              : N/A
M-02 Tick sequence       : N/A
M-03 Persistir→publicar  : N/A
M-04 Hash encadeado      : N/A
M-05 Candle OHLCV        : PASS — candle recalculado a partir de ticks; open/close por sequence; idempotente
M-06 WebSocket feed      : PASS — catch-up por XRANGE, buffer + dedupe por sequence, resync fora da retenção

PENDÊNCIAS: retenção (MAXLEN) do Stream ticks:{symbol} — <não definido no contexto>
VEREDITO: APROVADO
```
