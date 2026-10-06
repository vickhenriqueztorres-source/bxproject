# Exemplo 1 — T13 feed WebSocket + gráfico com reconexão e catch-up

## 1. Handoff recebido

```yaml
task_id: T13
agent: frontend-realtime-agent
objective: Gráfico de velas de 1 minuto do SYNTH_VOL_50 com histórico e atualização ao vivo, sem buraco após reconexão.
context:
  - ORCHESTRATOR.md §9.6
  - skills/03-synthetic-market-engine/references/api-guide.md (mensagens do feed, GET /candles)
skills: [01-project-context, 03-synthetic-market-engine, 04-security-iam]
acceptance_criteria:
  - Gráfico abre com a última hora de candles.
  - Cada tick atualiza a vela atual sem recriar a série.
  - Queda do WebSocket reconecta com backoff e continua do lastSequence, sem tick duplicado ou faltando.
  - Token nunca aparece na URL do WebSocket.
budget: { max_steps: 30, max_tokens: 150000, timeout: 20m }
```

## 2. Validação e classificação

```text
Handoff válido: T13 pertence ao agente; 4 critérios testáveis; budget definido.
01-project-context → DENTRO DO ESCOPO (D-03 Lightweight Charts, D-04 Pub/Sub visual).
API necessária existe: WS /streams/ticks/:symbol e GET /candles. Nenhum pedido ao backend.
```

## 3. Plano

| Arquivo | Conteúdo |
|---------|----------|
| `apps/web/src/feed/backoff.ts` | Backoff exponencial com jitter e teto |
| `apps/web/src/feed/use-tick-feed.ts` | Auth na 1ª mensagem, subscribe, gap, ping/pong, resync, stale |
| `apps/web/src/chart/candle-adapter.ts` | String decimal → `Number` só para o gráfico |
| `apps/web/src/chart/price-chart.tsx` | `setData` inicial + `update` por tick |
| `apps/web/src/feed/use-tick-feed.unit.test.ts` | Gap, duplicado, reconexão, resync |

## 4. Código

### `feed/backoff.ts`

```ts
const BASE_MS = 500
const CAP_MS = 30_000

// Jitter não é controle de segurança; Math.random é permitido só aqui (ver references/api-guide.md).
export function nextDelay(attempt: number): number {
  const ceiling = Math.min(CAP_MS, BASE_MS * 2 ** attempt)
  return Math.floor(Math.random() * ceiling)
}
```

### `feed/use-tick-feed.ts`

```ts
import { useEffect, useRef, useState } from 'react'
import { getAccessToken } from '@/auth/use-access-token'
import { nextDelay } from './backoff'

export type Tick = { symbol: string; sequence: number; ts: string; price: string }
export type Candle = { bucketStart: string; open: string; high: string; low: string; close: string; volume: number }
type FeedState = 'connecting' | 'live' | 'stale' | 'blocked'

type Handlers = {
  onTick: (tick: Tick) => void
  onCandle: (candle: Candle) => void
  onResync: () => void
}

const STALE_AFTER_MS = 5_000
const TERMINAL_ERRORS = new Set(['SYMBOL_LIMIT', 'CONNECTION_LIMIT'])

export function useTickFeed(symbol: string, handlers: Handlers): FeedState {
  const [state, setState] = useState<FeedState>('connecting')
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    let socket: WebSocket | null = null
    let attempt = 0
    let lastSequence: number | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let staleTimer: ReturnType<typeof setTimeout> | undefined
    let closedByUs = false

    const markAlive = () => {
      setState('live')
      clearTimeout(staleTimer)
      staleTimer = setTimeout(() => setState('stale'), STALE_AFTER_MS)
    }

    const subscribe = () =>
      socket?.send(JSON.stringify(
        lastSequence === null ? { type: 'subscribe', symbol } : { type: 'subscribe', symbol, lastSequence },
      ))

    const connect = async () => {
      setState('connecting')
      const token = await getAccessToken()
      socket = new WebSocket(`${import.meta.env.VITE_WS_URL}/streams/ticks/${symbol}`)   // sem token na URL

      socket.onopen = () => {
        socket?.send(JSON.stringify({ type: 'auth', token }))
        subscribe()
      }

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data as string)
        switch (message.type) {
          case 'snapshot':
            lastSequence = message.sequence
            attempt = 0
            markAlive()
            break
          case 'tick':
            if (lastSequence !== null && message.sequence <= lastSequence) return     // duplicado
            if (lastSequence !== null && message.sequence !== lastSequence + 1) {     // gap
              subscribe()
              return
            }
            lastSequence = message.sequence
            markAlive()
            handlersRef.current.onTick(message)
            break
          case 'candle':
            handlersRef.current.onCandle(message)
            break
          case 'ping':
            socket?.send(JSON.stringify({ type: 'pong' }))
            break
          case 'resync_required':
            lastSequence = null
            handlersRef.current.onResync()
            subscribe()
            break
          case 'error':
            if (TERMINAL_ERRORS.has(message.code)) {
              closedByUs = true
              setState('blocked')
              socket?.close(1000)
            }
            break
        }
      }

      socket.onclose = () => {
        clearTimeout(staleTimer)
        if (closedByUs) return
        setState('connecting')
        reconnectTimer = setTimeout(connect, nextDelay(attempt++))
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible' && socket?.readyState === WebSocket.OPEN) subscribe()
    }

    connect()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      closedByUs = true
      clearTimeout(reconnectTimer)
      clearTimeout(staleTimer)
      document.removeEventListener('visibilitychange', onVisible)
      socket?.close(1000)
    }
  }, [symbol])

  return state
}
```

### `chart/candle-adapter.ts`

```ts
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts'
import type { Candle, Tick } from '@/feed/use-tick-feed'

const toSeconds = (iso: string) => Math.floor(Date.parse(iso) / 1000) as UTCTimestamp
const bucketOf = (iso: string) => (Math.floor(Date.parse(iso) / 60_000) * 60) as UTCTimestamp

// Único ponto em que preço vira number: só para desenhar.
export function fromApiCandle(candle: Candle): CandlestickData<UTCTimestamp> {
  return {
    time: toSeconds(candle.bucketStart),
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  }
}

export function mergeTick(
  current: CandlestickData<UTCTimestamp> | null,
  tick: Tick,
): CandlestickData<UTCTimestamp> {
  const time = bucketOf(tick.ts)
  const price = Number(tick.price)
  if (!current || current.time !== time) return { time, open: price, high: price, low: price, close: price }
  return { ...current, high: Math.max(current.high, price), low: Math.min(current.low, price), close: price }
}
```

### `chart/price-chart.tsx`

```tsx
import { useEffect, useRef } from 'react'
import { CandlestickSeries, createChart, type ISeriesApi } from 'lightweight-charts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/http'
import { useTickFeed, type Candle } from '@/feed/use-tick-feed'
import { fromApiCandle, mergeTick } from './candle-adapter'

export function PriceChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const liveRef = useRef<ReturnType<typeof mergeTick> | null>(null)
  const queryClient = useQueryClient()

  const { data: candles } = useQuery({
    queryKey: ['candles', symbol, '1m'],
    queryFn: () => {
      const to = new Date()
      const from = new Date(to.getTime() - 60 * 60_000)
      return api<Candle[]>(`/candles?symbol=${symbol}&interval=1m&from=${from.toISOString()}&to=${to.toISOString()}`)
    },
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, { autoSize: true })
    seriesRef.current = chart.addSeries(CandlestickSeries)
    return () => chart.remove()
  }, [])

  useEffect(() => {
    if (!candles || !seriesRef.current) return
    const data = candles.map(fromApiCandle)
    seriesRef.current.setData(data)                                   // só na carga inicial / resync
    liveRef.current = data.at(-1) ?? null
  }, [candles])

  const state = useTickFeed(symbol, {
    onTick: (tick) => {
      liveRef.current = mergeTick(liveRef.current, tick)
      seriesRef.current?.update(liveRef.current)                       // F-13
    },
    onCandle: (candle) => {
      const official = fromApiCandle(candle)
      seriesRef.current?.update(official)                              // F-08: oficial substitui a visual
      if (liveRef.current?.time === official.time) liveRef.current = official
    },
    onResync: () => queryClient.invalidateQueries({ queryKey: ['candles', symbol, '1m'] }),
  })

  return (
    <section aria-label={`Gráfico de ${symbol}`} className="flex flex-col gap-2">
      <p role="status" className="text-sm text-muted-foreground">
        {state === 'live' && 'Ao vivo'}
        {state === 'connecting' && 'Conectando…'}
        {state === 'stale' && 'Cotação parada há mais de 5 segundos'}
        {state === 'blocked' && 'Limite de conexões atingido. Feche outras abas.'}
      </p>
      <div ref={containerRef} className="h-96 w-full" />
    </section>
  )
}
```

## 5. Testes unitários

```ts
// use-tick-feed.unit.test.ts (com mock-socket)
it('descarta tick duplicado', ...)                       // seq 10, 10 → onTick 1 vez
it('detecta gap e reenvia subscribe com lastSequence', ...) // seq 10, 12 → send({ subscribe, lastSequence: 10 })
it('reconecta com lastSequence após queda', ...)          // close → novo socket → subscribe com 10
it('não coloca token na URL', ...)                        // expect(url).not.toMatch(/token/)
it('envia auth como primeira mensagem', ...)              // sent[0].type === 'auth'
it('resync_required limpa lastSequence e invalida candles', ...)
it('para de reconectar após SYMBOL_LIMIT', ...)
```

## 6. Saída

```yaml
task_id: T13
agent: frontend-realtime-agent
status: DONE
summary: >
  Gráfico 1m do SYNTH_VOL_50 com histórico de /candles e vela ao vivo por update(). Feed com auth na
  primeira mensagem, catch-up por lastSequence, detecção de gap, backoff com jitter, ping/pong,
  resync e estado stale após 5 s. Vela oficial substitui a visual. Pendente fora dos critérios:
  reautenticação do socket na renovação do token (hoje reconecta).
artifacts:
  - apps/web/src/feed/backoff.ts
  - apps/web/src/feed/use-tick-feed.ts
  - apps/web/src/chart/candle-adapter.ts
  - apps/web/src/chart/price-chart.tsx
  - apps/web/src/feed/use-tick-feed.unit.test.ts
evidence:
  - pnpm --filter web test use-tick-feed.unit → 7 passed
  - bash agents/frontend-realtime-agent/scripts/health-check.sh → 0 FAIL
  - bash skills/04-security-iam/scripts/health-check.sh apps/web → 0 FAIL
acceptance_criteria_met:
  - { criterion: "Abre com a última hora", met: true, evidence: "query ['candles', symbol, '1m'] + setData" }
  - { criterion: "Tick atualiza sem recriar série", met: true, evidence: "series.update em onTick" }
  - { criterion: "Reconexão sem duplicado ou buraco", met: true, evidence: "testes de gap, duplicado e reconexão" }
  - { criterion: "Token fora da URL", met: true, evidence: "teste de URL + health-check F-05" }
confidence_score: 0.9
decisions_cited: [D-03, D-04, M-02, M-05, M-06, S-02, F-05, F-06, F-07, F-08, F-11, F-13]
pending:
  - Comportamento do gateway na renovação do token <não definido no contexto>
```
