# Example 1 — Implementar validação de JWT na API e no WebSocket Gateway

- **Modo:** implementação
- **Agente:** `backend-implementation-agent`
- **Controles:** S-02, S-03

## Entrada

```text
Criar o middleware de autenticação da API e a autenticação do WebSocket com o Keycloak.
```

## Saída

```text
SKILL: 04-security-iam
MODO: IMPLEMENTAÇÃO
ESCOPO ANALISADO: services/api/auth/{verify-token,middleware}.ts, services/ws-gateway/auth.ts
```

### `services/api/auth/verify-token.ts` — S-02

```ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

const issuer = `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`
const audience = process.env.API_AUDIENCE!

const jwks = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`), {
  cacheMaxAge: 10 * 60 * 1000,
  cooldownDuration: 30 * 1000,
  timeoutDuration: 2000,
})

export type Role = 'USER' | 'AUDITOR' | 'ADMIN'

export interface Principal {
  sub: string
  roles: Role[]
  acr?: string
  exp: number
}

const KNOWN_ROLES = new Set<Role>(['USER', 'AUDITOR', 'ADMIN'])

export class UnauthorizedError extends Error {}

export async function verifyAccessToken(token: string): Promise<Principal> {
  let payload: JWTPayload & { typ?: string; realm_access?: { roles?: string[] }; acr?: string }
  try {
    ;({ payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      algorithms: ['RS256'],
      clockTolerance: 30,
      requiredClaims: ['sub', 'exp', 'iat'],
    }))
  } catch {
    throw new UnauthorizedError('invalid_token')
  }

  if (payload.typ !== 'Bearer') throw new UnauthorizedError('not_an_access_token')

  const roles = (payload.realm_access?.roles ?? []).filter((role): role is Role =>
    KNOWN_ROLES.has(role as Role))

  return { sub: payload.sub!, roles, acr: payload.acr, exp: payload.exp! }
}
```

### `services/api/auth/middleware.ts` — S-02, S-03

```ts
import type { RequestHandler } from 'express'
import { verifyAccessToken, UnauthorizedError, type Role } from './verify-token'

export const authenticate: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' })

  try {
    req.principal = await verifyAccessToken(header.slice('Bearer '.length))
    next()
  } catch (error) {
    metrics.jwtValidationFailures.inc({ reason: (error as Error).message })
    if (error instanceof UnauthorizedError) return res.status(401).json({ error: 'unauthorized' })
    next(error)
  }
}

export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, res, next) => {
    const roles = req.principal?.roles ?? []
    if (allowed.some((role) => roles.includes(role))) return next()
    metrics.authzDenied.inc({ route: req.route?.path ?? 'unknown', reason: 'role' })
    return res.status(403).json({ error: 'forbidden' })
  }
}

export function requireMfa(): RequestHandler {
  const mfaAcr = process.env.KEYCLOAK_MFA_ACR
  return (req, res, next) => {
    if (mfaAcr && req.principal?.acr === mfaAcr) return next()
    metrics.authzDenied.inc({ route: req.route?.path ?? 'unknown', reason: 'mfa' })
    return res.status(403).json({ error: 'mfa_required' })
  }
}
```

Uso — negar por padrão: o router da API só registra rotas depois de `authenticate`, e cada rota declara a role.

```ts
app.use('/healthz', healthRouter)
app.use(authenticate)
app.use('/contracts', requireRole('USER'), contractsRouter)
app.use('/wallet', requireRole('USER'), walletRouter)
app.use('/candles', requireRole('USER', 'AUDITOR', 'ADMIN'), candlesRouter)
app.use('/admin', requireRole('AUDITOR', 'ADMIN'), requireMfa(), adminRouter)
app.use((_req, res) => res.status(404).json({ error: 'not_found' }))
```

### `services/ws-gateway/auth.ts` — S-02 no handshake

```ts
import { verifyAccessToken } from '../api/auth/verify-token'

const AUTH_DEADLINE_MS = 5000
const CLOSE_UNAUTHORIZED = 4401

export function attachAuth(socket: WebSocket, onAuthenticated: (principal: Principal) => void) {
  const deadline = setTimeout(() => socket.close(CLOSE_UNAUTHORIZED, 'auth_timeout'), AUTH_DEADLINE_MS)

  socket.once('message', async (raw) => {
    clearTimeout(deadline)
    try {
      const message = JSON.parse(String(raw))
      if (message?.type !== 'auth' || typeof message.token !== 'string') throw new Error('expected_auth')

      const principal = await verifyAccessToken(message.token)
      const msUntilExpiry = principal.exp * 1000 - Date.now()
      setTimeout(() => socket.close(CLOSE_UNAUTHORIZED, 'token_expired'), msUntilExpiry)

      socket.send(JSON.stringify({ type: 'auth_ok' }))
      onAuthenticated(principal)
    } catch {
      socket.close(CLOSE_UNAUTHORIZED, 'unauthorized')
    }
  })
}
```

### Checklist da implementação

```text
S-01 Keycloak/OIDC     : N/A
S-02 JWT validation    : PASS — jwtVerify com JWKS, alg RS256, iss/aud/exp/nbf, typ Bearer; WS fecha 4401 no exp
S-03 RBAC              : PASS — negar por padrão; requireRole em todo router; /admin com MFA
S-04 BOLA/IDOR         : N/A
S-05 Mass assignment   : N/A
S-06 Secrets           : PASS — nenhum valor literal; KEYCLOAK_URL, KEYCLOAK_REALM, API_AUDIENCE, KEYCLOAK_MFA_ACR por env

PENDÊNCIAS: valor de KEYCLOAK_MFA_ACR, nome do realm e do audience — <não definido no contexto>
VEREDITO: APROVADO
```

Sem `KEYCLOAK_MFA_ACR` configurado, `requireMfa` nega todas as rotas `/admin` (falha segura).
