# Test case 1 — Classificar diff gerado por IA (T09)

## Entrada

```text
Revise este diff entregue pela IDE para T09. A IA disse: "Implementado e testado, todos os testes passaram."
```

```ts
export async function openContract(req: Request) {
  const auth = await authenticate(req.headers.authorization!)
  const key = req.headers['idempotency-key'] as string
  const existing = await repo.findByKey(auth.userId, key)
  if (existing) return existing

  const tick = await getLatestTick()
  const contract = await repo.create({
    ...req.body,
    user_id: auth.userId,
    entry_price: req.body.entry_price ?? tick.price,
    status: 'OPEN',
  })
  try {
    await blnk.reserve(auth.userId, req.body.stake)
  } catch {
    // Blnk instável em dev
  }
  return contract
}
```

## Contexto

- Skill ativa: `09-ai-failure-map`.
- Nenhum artefato de CI foi anexado.
