# Example 2 — Implementar rotas de contrato e de reversão sem BOLA nem mass assignment

- **Modo:** implementação
- **Agente:** `backend-implementation-agent`
- **Controles:** S-03, S-04, S-05

## Entrada

```text
Reescrever GET /contracts/:id, POST /contracts e POST /admin/reversals seguindo a skill de segurança.
```

## Saída

```text
SKILL: 04-security-iam
MODO: IMPLEMENTAÇÃO
ESCOPO ANALISADO: services/api/routes/{contracts,admin-reversals}.ts, services/api/dto/*.ts
```

### `services/api/dto/contracts.ts` — S-05

```ts
import { z } from 'zod'

export const OpenContractBody = z.object({
  direction: z.enum(['UP', 'DOWN']),
  stake: z.string().regex(/^\d+(\.\d{1,2})?$/),
  symbol: z.string().regex(/^[A-Z0-9_]{1,20}$/),
}).strict()

export const ContractIdParams = z.object({ id: z.string().uuid() }).strict()

export const IdempotencyKeyHeader = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/)
```

`.strict()` rejeita qualquer campo extra (`user_id`, `status`, `entry_price`, `payout`...). Limites de `stake`: `<não definido no contexto>`.

### `services/api/routes/contracts.ts` — S-04, S-05

```ts
import { Router } from 'express'
import { OpenContractBody, ContractIdParams, IdempotencyKeyHeader } from '../dto/contracts'

export const contractsRouter = Router()

contractsRouter.get('/:id', async (req, res) => {
  const params = ContractIdParams.safeParse(req.params)
  if (!params.success) return res.status(404).json({ error: 'not_found' })

  const contract = await db.oneOrNone(
    `SELECT id, symbol, direction, stake, entry_price, expires_at, status, result, payout
       FROM contracts
      WHERE id = $1 AND user_id = $2`,
    [params.data.id, req.principal.sub])

  if (!contract) {
    metrics.idorAttempts.inc()
    return res.status(404).json({ error: 'not_found' })
  }
  res.json(contract)
})

contractsRouter.post('/', async (req, res) => {
  const body = OpenContractBody.safeParse(req.body)
  const key = IdempotencyKeyHeader.safeParse(req.header('Idempotency-Key'))
  if (!body.success) return res.status(422).json({ error: 'invalid_body', issues: body.error.issues })
  if (!key.success) return res.status(400).json({ error: 'idempotency_key_required' })

  const contract = await contractService.open({
    userId: req.principal.sub,
    idempotencyKey: key.data,
    direction: body.data.direction,
    stake: body.data.stake,
    symbol: body.data.symbol,
  })
  res.status(201).json(contract)
})
```

`contractService.open` define no servidor `entry_price` (último tick oficial), `expires_at` (+60 s, `D-10`), `payout_rate` (0,85) e `status` — ver `02-financial-invariants` e `03-synthetic-market-engine`.

### `services/api/routes/admin-reversals.ts` — S-03, S-05

```ts
import { Router } from 'express'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'

const ReversalBody = z.object({
  transactionReference: z.string().min(1).max(200),
  reason: z.string().min(10).max(500),
}).strict()

export const adminReversalsRouter = Router()

adminReversalsRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const body = ReversalBody.safeParse(req.body)
  if (!body.success) return res.status(422).json({ error: 'invalid_body', issues: body.error.issues })

  const reversal = await reversalService.request({
    transactionReference: body.data.transactionReference,
    reason: body.data.reason,
    requestedBy: req.principal.sub,
  })

  await audit.log({
    actorSub: req.principal.sub,
    actorRoles: req.principal.roles,
    action: 'reversal.requested',
    resource: 'transaction',
    resourceId: body.data.transactionReference,
    result: 'allowed',
    reason: body.data.reason,
    traceId: req.traceId,
  })

  res.status(202).json({ id: reversal.id, status: reversal.status })
})
```

O router `/admin` já exige `AUDITOR` ou `ADMIN` + MFA (example-1); esta rota restringe a `ADMIN`. O valor revertido e a `reference` (`reversal:{transaction_reference}`) são calculados no servidor a partir da transação original — o cliente nunca informa valor.

### Testes de segurança obrigatórios

| Caso | Esperado |
|------|----------|
| `GET /contracts/{id-de-outro-usuário}` | `404`, corpo igual ao de id inexistente |
| `GET /contracts/nao-e-uuid` | `404` |
| `POST /contracts` com `"user_id"` no body | `422` |
| `POST /contracts` com `"status": "SETTLED"` | `422` |
| `POST /contracts` sem `Idempotency-Key` | `400` |
| `POST /admin/reversals` com token `USER` | `403` |
| `POST /admin/reversals` com token `AUDITOR` | `403` |
| `POST /admin/reversals` com `ADMIN` sem MFA | `403 mfa_required` |
| `POST /admin/reversals` com `"amount"` no body | `422` |

### Checklist da implementação

```text
S-01 Keycloak/OIDC     : N/A
S-02 JWT validation    : N/A — coberto pelo middleware do example-1
S-03 RBAC              : PASS — reversão restrita a ADMIN + MFA; auditoria registrada
S-04 BOLA/IDOR         : PASS — WHERE id = $1 AND user_id = $2; 404 para inexistente e alheio
S-05 Mass assignment   : PASS — DTOs .strict(); campos de servidor nunca lidos do body
S-06 Secrets           : N/A

PENDÊNCIAS: limites de stake; aprovação dupla de reversões — <não definido no contexto>
VEREDITO: APROVADO
```
