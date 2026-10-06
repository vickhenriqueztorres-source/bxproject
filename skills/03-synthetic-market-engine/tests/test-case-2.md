# Test case 2 — Revisão do Candle Worker com agregação em memória

- **Skill:** `03-synthetic-market-engine`
- **Tipo:** modo revisão + fronteira com `05-resilience-patterns`
- **Agente que envia:** `qa-resilience-agent`

## Entrada (prompt)

```text
O gráfico de 1 minuto às vezes mostra volume 120 e o close errado. Revisar o candle worker.
```

## Contexto fornecido — `services/candle-worker/worker.ts`

```ts
const candles = new Map<number, Candle>()
redis.subscribe('ticks:SYNTH_1:live', (raw) => {
  const tick = JSON.parse(raw)
  const bucket = Math.floor(new Date(tick.ts).getTime() / 60000) * 60000
  const c = candles.get(bucket) ?? { open: tick.price, high: tick.price, low: tick.price, close: tick.price, volume: 0 }
  c.high = Math.max(c.high, tick.price)
  c.low = Math.min(c.low, tick.price)
  c.close = tick.price
  c.volume += 1
  candles.set(bucket, c)
  db.query('INSERT INTO candles VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO UPDATE SET open=$3, high=$4, low=$5, close=$6, volume=$7',
    ['SYNTH_1', bucket, c.open, c.high, c.low, c.close, c.volume])
})
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "candle", "volume", "close") | Obrigatório |
| 2 | M-05 FAIL — candle derivado de estado em memória, não de `ticks` persistidos | Obrigatório |
| 3 | Explica o volume 120: reentrega/duplicação + `volume += 1` não idempotente | Obrigatório |
| 4 | Explica o close errado: `close` = última mensagem recebida, não maior `sequence` | Obrigatório |
| 5 | Aponta consumo via Pub/Sub como fonte de trabalho (viola `D-04`) | Obrigatório |
| 6 | Aponta `db.query` sem `await` e sem tratamento de erro | Obrigatório |
| 7 | Encaminha detalhes de consumer group/XACK para `05-resilience-patterns` sem detalhá-los | Obrigatório |
| 8 | M-01 a M-04 e M-06 marcados `N/A` | Obrigatório |
| 9 | `VEREDITO: REPROVADO` | Obrigatório |
