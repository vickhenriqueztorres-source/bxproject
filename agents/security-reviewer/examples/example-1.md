# Example 1 — T09 rotas de contrato reprovadas

Revisão das rotas de contrato. A validação de JWT está correta, o que torna tentador aprovar;
os problemas estão na autorização por objeto, no DTO e numa rota admin protegida só pelo front.

## Handoff recebido

```yaml
task_id: T09
agent: security-reviewer
objective: Revisar segurança das rotas de contrato e da rota admin de listagem.
context:
  - diff: services/api/src/contracts/routes.ts
  - diff: services/api/src/admin/routes.ts
  - diff: apps/admin/src/menu.tsx
  - evidência do QA: "contracts.int.test.ts → [S-02] alg none → 401; [S-02] aud errado → 401"
skills: [01-project-context, 04-security-iam]
acceptance_criteria:
  - Usuário só acessa os próprios contratos.
  - Body de POST /contracts rejeita campos de servidor.
  - Rotas /admin/* exigem ADMIN ou AUDITOR com MFA.
budget: { max_steps: 20, max_tokens: 80000, timeout: 10m }
```

## Código revisado

```ts
// services/api/src/contracts/routes.ts
 8  app.post('/contracts', authenticate, requireRole('USER'), async (req, res) => {
 9    const dto = OpenContract.parse(req.body)                       // z.object({...}) sem .strict()
10    const c = await openContract({ ...req.body, ...dto, user_id: req.auth.sub }, req.header('Idempotency-Key'))
11    res.status(201).json(c)
12  })
...
30  app.get('/contracts/:id', authenticate, requireRole('USER'), async (req, res) => {
31    const c = await db.oneOrNone('SELECT * FROM contracts WHERE id = $1', [req.params.id])
32    if (!c) return res.status(404).end()
33    if (c.user_id !== req.auth.sub) return res.status(403).end()
34    res.json(c)
35  })
```

```ts
// services/api/src/admin/routes.ts
 5  app.get('/admin/users', authenticate, async (_req, res) => res.json(await listUsers()))
```

```tsx
// apps/admin/src/menu.tsx
12  {roles.includes('ADMIN') && <MenuItem to="/users">Usuários</MenuItem>}
```

## Raciocínio como atacante

| Ataque | Leitura do código | Resultado |
|--------|-------------------|-----------|
| `alg: none`, `aud` errado | `authenticate` com `jwtVerify` + JWKS (evidência do QA confere) | Bloqueado — S-02 PASS |
| Body com `entry_price: 1` e `status: "SETTLED"` | Linha 10 espalha `req.body` **antes** do DTO; schema sem `.strict()` | Campos chegam ao `openContract` — S-05 FAIL |
| Body com `user_id` de outro usuário | Linha 10 sobrescreve com `req.auth.sub` por último | Bloqueado nesse campo, mas por sorte da ordem |
| Trocar `:id` | Linha 31 carrega por id; linha 33 responde 403 | Existência revelada; dono checado depois — S-04 FAIL |
| `USER` chama `GET /admin/users` direto | Linha 5 sem `requireRole`; menu escondido é só UX | Lista de usuários exposta — S-03 FAIL |

## Saída

```yaml
task_id: T09
agent: security-reviewer
status: DONE
summary: >
  Revisão de contracts/routes.ts, admin/routes.ts e menu.tsx. REPROVADO. JWT validado
  corretamente. Porém POST /contracts espalha req.body sem DTO estrito (entry_price e status
  chegam ao serviço), GET /contracts/:id carrega por id e responde 403 para dono diferente, e
  GET /admin/users não declara role — o front esconder o menu não é controle.
artifacts: []
evidence:
  - services/api/src/contracts/routes.ts:8-35 lido
  - services/api/src/admin/routes.ts:5 lido
  - apps/admin/src/menu.tsx:12 lido
  - bash agents/security-reviewer/scripts/health-check.sh → FAIL "...req.body"; FAIL "query por id sem user_id"; WARN "/admin sem requireRole"
acceptance_criteria_met:
  - { criterion: "Usuário só acessa os próprios contratos", met: false, evidence: "S-04 routes.ts:31,33" }
  - { criterion: "Body rejeita campos de servidor", met: false, evidence: "S-05 routes.ts:9-10" }
  - { criterion: "/admin/* exige ADMIN ou AUDITOR com MFA", met: false, evidence: "S-03 admin/routes.ts:5" }
confidence_score: 0.93
review:
  surface: [POST /contracts, GET /contracts/:id, GET /admin/users, menu do painel admin]
  controls:
    S-01: { result: N/A, evidence: "T09 não altera client nem flow do Keycloak" }
    S-02: { result: PASS, evidence: "authenticate em todas as rotas; testes [S-02] do QA conferidos" }
    S-03: { result: FAIL, evidence: "admin/routes.ts:5 sem requireRole nem checagem de acr" }
    S-04: { result: FAIL, evidence: "contracts/routes.ts:31 WHERE id = $1 sem user_id" }
    S-05: { result: FAIL, evidence: "contracts/routes.ts:9 schema sem .strict(); :10 espalha req.body" }
    S-06: { result: PASS, evidence: "nenhum segredo no diff" }
  findings:
    - severity: CRÍTICO
      location: services/api/src/contracts/routes.ts:10
      problem: req.body espalhado no objeto enviado ao serviço, antes do DTO validado
      vector: usuário envia {"direction":"UP","stake_minor":100,"symbol":"SYNTH_VOL_50","entry_price":1,"status":"SETTLED"}; campos de servidor chegam ao openContract
      violates: [S-05]
    - severity: CRÍTICO
      location: services/api/src/admin/routes.ts:5
      problem: rota admin só autenticada, sem role nem MFA
      vector: qualquer USER com token válido chama GET /admin/users direto e recebe a lista de usuários
      violates: [S-03, SR-07, SR-11]
    - severity: MÉDIO
      location: services/api/src/contracts/routes.ts:31-33
      problem: contrato carregado só por id; dono checado depois com 403
      vector: atacante enumera ids; 403 confirma que o contrato existe e pertence a outro usuário
      violates: [S-04, SR-09]
  rotations_required: []
  verdict: REPROVADO
decisions_cited: [D-01, S-02, S-03, S-04, S-05, SR-07, SR-09, SR-11]
pending:
  - QA: teste de integração [S-05] body com entry_price/status → 400 (matriz)
  - QA: teste de integração [S-03] USER em /admin/users → 403
handoff_notes:
  - "financial-correctness-reviewer: routes.ts:10 — se status/entry_price forem gravados, há impacto em I-04; não avaliado aqui"
```

O `S-04` ficou `MÉDIO` e não `CRÍTICO` porque o dono é checado antes de devolver o corpo: não há
leitura de dado alheio, só revelação de existência. Se a linha 33 não existisse, seria `CRÍTICO`.

## O que o revisor não fez

- Não escreveu o DTO com `.strict()` nem a query com `AND user_id = $2`.
- Não chamou a rota admin em staging para "confirmar".
- Não julgou se o contrato com `status: SETTLED` quebra o ledger — nota para o revisor financeiro.
