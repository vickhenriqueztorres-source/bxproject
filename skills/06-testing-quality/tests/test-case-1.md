# Test case 1 — Revisão dos testes do Contract Service

- **Skill:** `06-testing-quality`
- **Tipo:** modo revisão
- **Agente que envia:** `qa-resilience-agent`

## Entrada (prompt)

```text
O PR do Contract Service diz "testes de idempotência e settlement incluídos". Revisar os testes.
```

## Contexto fornecido — `services/contract-service/test/contracts.test.ts`

```ts
import { vi, describe, it, expect } from 'vitest'
import { openContract, settleContract } from '../src/contracts'

vi.mock('../src/db', () => ({ db: { query: vi.fn().mockResolvedValue({ rows: [] }) } }))

describe('contracts', () => {
  it('abre contrato', async () => {
    const res = await openContract({ userId: 'u1', direction: 'UP', stake: 100 }, 'key-1')
    expect(res).toBeTruthy()
  })

  it('idempotência', async () => {
    const a = await openContract({ userId: 'u1', direction: 'UP', stake: 100 }, 'key-1')
    const b = await openContract({ userId: 'u1', direction: 'UP', stake: 100 }, 'key-1')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
  })

  it('liquida após expirar', async () => {
    const c = await openContract({ userId: 'u1', direction: 'UP', stake: 100 }, 'key-2')
    await new Promise((r) => setTimeout(r, 61_000))
    const price = 1000 + Math.random() * 10
    const s = await settleContract(c.id, price)
    expect(s.result).toBe('WIN')
  }, 70_000)
})
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "testes", "idempotência", revisão de arquivo de teste) | Obrigatório |
| 2 | Q-02 FAIL — banco mockado (linha 4); idempotência nunca toca a constraint nem o ledger | Obrigatório |
| 3 | Q-02 FAIL — linhas 15-16 não comparam `a.id` com `b.id` nem contam reservas; sem teste concorrente | Obrigatório |
| 4 | Q-01 FAIL — espera real de 61 s (linha 21) em vez de relógio injetado | Obrigatório |
| 5 | Q-01 FAIL — `Math.random` (linha 22) torna o resultado não determinístico; `WIN` depende do acaso | Obrigatório |
| 6 | Q-01 FAIL — asserções fracas `toBeTruthy`/`toBeDefined` (linhas 9, 15, 16) | Obrigatório |
| 7 | Q-05 FAIL — sem rastreabilidade de regra; faltam LOSS, DRAW, DOWN, duplicata no settlement, falha do Blnk | Obrigatório |
| 8 | Descreve o "bug que passaria" em cada achado | Obrigatório |
| 9 | Q-03 e Q-04 marcados `N/A` | Obrigatório |
| 10 | Não escreve o teste corrigido | Obrigatório |
| 11 | `VEREDITO: REPROVADO` | Obrigatório |
