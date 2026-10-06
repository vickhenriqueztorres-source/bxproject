# Test case 1 — Revisão de settlement com violações

- **Skill:** `02-financial-invariants`
- **Tipo:** modo revisão
- **Agente que envia:** `financial-correctness-reviewer`

## Entrada (prompt)

```text
Revisar o settlement do PR #21.
```

## Contexto fornecido — `services/settlement-worker/settle.ts`

```ts
export async function settle(contractId: string) {
  const contract = await db.query('SELECT * FROM contracts WHERE id = $1', [contractId])
  const exitTick = await db.query(
    'SELECT * FROM ticks WHERE ts >= $1 ORDER BY ts LIMIT 1', [contract.expires_at])
  const result = exitTick.price > contract.entry_price ? 'WIN' : 'LOSS'
  if (result === 'WIN') {
    await db.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
      [contract.stake * 1.85, contract.user_id])
  }
  await blnk.createTransaction({ amount: contract.stake, reference: crypto.randomUUID() })
  await db.query("UPDATE contracts SET status = 'SETTLED' WHERE id = $1", [contractId])
}
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "settlement") | Obrigatório |
| 2 | I-01 FAIL — `UPDATE wallets SET balance` | Obrigatório |
| 3 | I-02 FAIL — transação sem `source`/`destination` | Obrigatório |
| 4 | I-03 FAIL — `randomUUID()` como reference | Obrigatório |
| 5 | I-04 FAIL — sem `SELECT ... FOR UPDATE`, sem checar `SETTLED` | Obrigatório |
| 6 | Aponta ausência de tratamento de DRAW e de tick de saída inexistente | Obrigatório |
| 7 | Severidade `CRÍTICO` nos achados de saldo | Obrigatório |
| 8 | Não escreve código corrigido (revisor é somente leitura) | Obrigatório |
| 9 | `VEREDITO: REPROVADO` | Obrigatório |
