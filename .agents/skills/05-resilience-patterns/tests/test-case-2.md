# Test case 2 — Revisão do consumer de settlement

- **Skill:** `05-resilience-patterns`
- **Tipo:** modo revisão + fronteira com `02-financial-invariants`
- **Agente que envia:** `qa-resilience-agent`

## Entrada (prompt)

```text
Alguns contratos ficam EXPIRING para sempre depois de deploy. Revisar o consumer do settlement.
```

## Contexto fornecido — `services/settlement-worker/consumer.ts`

```ts
const res = await redis.xreadgroup('GROUP', 'settlement-workers', 'worker', 'BLOCK', 0, 'STREAMS', 'contracts:expiring', '>')
for (const [id, fields] of res[0][1]) {
  await redis.xack('contracts:expiring', 'settlement-workers', id)
  try {
    await settle(fields.contract_id)
  } catch (e) {
    console.error(e)
  }
}
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "consumer", "settlement", reentrega) | Obrigatório |
| 2 | R-06 FAIL — `XACK` antes de `settle()` (linha 3): falha ou deploy perdem a mensagem | Obrigatório |
| 3 | R-06 FAIL — nome de consumidor fixo `'worker'` em todas as réplicas (linha 1) | Obrigatório |
| 4 | R-06 FAIL — sem loop de `XAUTOCLAIM` | Obrigatório |
| 5 | R-03 FAIL — `BLOCK 0` (linha 1) impede shutdown gracioso e health check | Obrigatório |
| 6 | R-05 FAIL — erro engolido (linha 7), sem DLQ | Obrigatório |
| 7 | R-02 FAIL — sem classificação de erro nem backoff | Obrigatório |
| 8 | Liga a causa raiz ao sintoma "EXPIRING para sempre" | Obrigatório |
| 9 | Encaminha idempotência do `settle()` para `02-financial-invariants` sem reavaliá-la | Obrigatório |
| 10 | `VEREDITO: REPROVADO` | Obrigatório |
