# Test case 1 — Revisão das rotas de contrato com BOLA e mass assignment

- **Skill:** `04-security-iam`
- **Tipo:** modo revisão
- **Agente que envia:** `security-reviewer`

## Entrada (prompt)

```text
Revisar a segurança das rotas de contrato e da rota de reversão do PR #40.
```

## Contexto fornecido — `services/api/routes/contracts.ts`

```ts
router.get('/contracts/:id', async (req, res) => {
  const claims = jwt.decode(req.headers.authorization!.split(' ')[1]) as JwtPayload
  const contract = await db.oneOrNone('SELECT * FROM contracts WHERE id = $1', [req.params.id])
  if (!contract) return res.status(403).json({ error: 'forbidden' })
  res.json(contract)
})

router.post('/contracts', async (req, res) => {
  const claims = jwt.decode(req.headers.authorization!.split(' ')[1]) as JwtPayload
  const contract = await contracts.create({ user_id: claims.sub, ...req.body })
  res.status(201).json(contract)
})

router.post('/admin/reversals', async (req, res) => {
  if (!req.body.isAdmin) return res.status(403).end()
  await reversals.create(req.body)
  res.status(201).end()
})
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "segurança", "rotas", "admin") | Obrigatório |
| 2 | S-02 FAIL — `jwt.decode` sem verificar assinatura (linhas 2 e 9) | Obrigatório |
| 3 | S-04 FAIL — query sem `user_id` (linha 3); 403 revela existência (linha 4) | Obrigatório |
| 4 | S-05 FAIL — `...req.body` depois de `user_id` permite sobrescrever `user_id`, `status`, `entry_price` (linha 10) | Obrigatório |
| 5 | S-03 FAIL — role lida do body (linha 15); sem MFA na rota admin | Obrigatório |
| 6 | Cita o vetor de ataque em cada achado | Obrigatório |
| 7 | S-01 e S-06 marcados `N/A` | Obrigatório |
| 8 | Severidade `CRÍTICO` em S-02, S-03, S-04 e S-05 | Obrigatório |
| 9 | Não escreve código corrigido | Obrigatório |
| 10 | `VEREDITO: REPROVADO` | Obrigatório |
