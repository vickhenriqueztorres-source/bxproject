# Test case 1 — Revisão do Tick Engine com violações

- **Skill:** `03-synthetic-market-engine`
- **Tipo:** modo revisão
- **Agente que envia:** `qa-resilience-agent`

## Entrada (prompt)

```text
Revisar o tick engine do PR #34 antes do merge.
```

## Contexto fornecido — `services/tick-engine/engine.ts`

```ts
let price = 1000
setInterval(async () => {
  price = price * (1 + (Math.random() - 0.5) * 0.002)
  const tick = { symbol: 'SYNTH_1', ts: Date.now(), price }
  await redis.publish('ticks:SYNTH_1:live', JSON.stringify(tick))
  await db.query('INSERT INTO ticks (symbol, ts, price) VALUES ($1, $2, $3)',
    [tick.symbol, tick.ts, tick.price])
}, 1000)
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "tick engine") | Obrigatório |
| 2 | M-01 FAIL — `Math.random()` na linha 3 | Obrigatório |
| 3 | M-02 FAIL — sem `sequence`, sem leader lease (duas instâncias geram dois preços) | Obrigatório |
| 4 | M-03 FAIL — `publish` antes do `INSERT`, sem transação, sem outbox, sem Stream | Obrigatório |
| 5 | M-04 FAIL — sem `prev_hash`/`hash` | Obrigatório |
| 6 | Aponta preço em ponto flutuante e estado em memória (reinício volta para 1000) | Obrigatório |
| 7 | M-05 e M-06 marcados `N/A` | Obrigatório |
| 8 | Severidade `CRÍTICO` em M-01, M-02 e M-03 | Obrigatório |
| 9 | Não escreve código corrigido (revisor é somente leitura) | Obrigatório |
| 10 | `VEREDITO: REPROVADO` | Obrigatório |
