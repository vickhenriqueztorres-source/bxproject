# API guide — 04-security-iam

Referência carregada sob demanda pelo `security-reviewer` e pelos agentes de implementação.
Confirmar nomes de opções na documentação oficial do Keycloak antes de configurar: https://www.keycloak.org/documentation

Valores entre `{}` são placeholders. Itens `<não definido no contexto>` devem ser devolvidos ao orquestrador.

## Realm Keycloak

| Configuração | Valor |
|--------------|-------|
| Realm | `{realm}` — `<não definido no contexto>` |
| Login com e-mail | Ligado; verificação de e-mail obrigatória |
| Password policy | Comprimento mínimo, não reutilizar, não igual ao username |
| Brute force detection | Ligado |
| OTP | TOTP; obrigatório para `ADMIN` e `AUDITOR` (fluxo condicional por role) |
| Access token lifespan | `<não definido no contexto>` (recomendação ≤ 5 min) |
| Revoke refresh token | Ligado, reuse 0 (rotação) |
| SSO session idle / max | `<não definido no contexto>` |

## Clients

| Client | Tipo | Flows | Observações |
|--------|------|-------|-------------|
| `frontend` | Público | Standard flow + PKCE `S256` obrigatório | Implicit off, Direct Access Grants off, redirect URIs exatos, Web Origins exatos |
| `{api_audience}` | Sem flows (audience) | — | Audience mapper no `frontend` adiciona `{api_audience}` ao `aud` |
| `admin-panel` | Público | Standard flow + PKCE | Só usuários com `ADMIN` ou `AUDITOR` |

Front-end (`oidc-client-ts`):

```ts
new UserManager({
  authority: `${KEYCLOAK_URL}/realms/{realm}`,
  client_id: 'frontend',
  redirect_uri: `${window.location.origin}/callback`,
  response_type: 'code',
  scope: 'openid',
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  automaticSilentRenew: true,
})
```

## Validação de JWT

| Checagem | Regra |
|----------|-------|
| Assinatura | JWKS de `/realms/{realm}/protocol/openid-connect/certs`, em cache |
| `alg` | Allowlist `["RS256"]`; rejeitar `none` e `HS*` |
| `iss` | Igual a `${KEYCLOAK_URL}/realms/{realm}` |
| `aud` | Contém `{api_audience}` |
| `exp` / `nbf` | Tolerância de relógio ≤ 30 s |
| `typ` | `Bearer` (rejeitar ID token) |
| `sub` | Obrigatório; é o `user_id` |
| Roles | `realm_access.roles` |
| MFA | `acr` = `<não definido no contexto>` nas rotas `/admin/*` |

Códigos de resposta: token ausente/inválido → `401`; role insuficiente → `403`; recurso de outro dono → `404`.

## Matriz RBAC

| Ação | USER | AUDITOR | ADMIN |
|------|------|---------|-------|
| `POST /contracts` | sim (próprio) | não | não |
| `GET /contracts`, `GET /contracts/{id}` | sim (próprio) | não | não |
| `GET /wallet`, `GET /wallet/transactions` | sim (próprio) | não | não |
| `GET /candles`, WebSocket de ticks | sim | sim | sim |
| `GET /admin/users` | não | sim | sim |
| `GET /admin/contracts` | não | sim | sim |
| `GET /admin/audit-log` | não | sim | sim |
| `POST /admin/reversals` (correção `I-06`) | não | não | sim + MFA + motivo |
| `GET /indices/{symbol}` (status `ACTIVE`/`PAUSED` para a boleta) | sim | sim | sim |
| `POST /admin/indices/{symbol}/pause`, `.../resume` (PRD US-10) | não | não | sim + MFA + motivo |
| `GET /admin/users/{id}/transactions` (consulta de ledger) | não | sim | sim |
| `POST /admin/users/{id}/block`, `.../unblock` (Persona Admin) | não | não | sim + MFA + motivo |
| `GET /admin/alerts` (proxy somente leitura do Prometheus) | não | sim | sim |
| Editar saldo diretamente | não | não | não |
| Alterar roles | não | não | somente pelo console do Keycloak |

Aprovação dupla para reversões: `<não definido no contexto>`.

## Roles de banco (menor privilégio)

```sql
CREATE ROLE app_contract LOGIN;   -- Contract Service / API
GRANT SELECT, INSERT, UPDATE ON contracts TO app_contract;
GRANT INSERT ON outbox TO app_contract;
GRANT SELECT ON ticks, index_state TO app_contract;

CREATE ROLE app_tick LOGIN;       -- Tick Engine
GRANT SELECT, UPDATE ON index_state TO app_tick;
GRANT INSERT ON ticks, outbox TO app_tick;

CREATE ROLE app_relay LOGIN;      -- Outbox Relay
GRANT SELECT, UPDATE (published_at) ON outbox TO app_relay;

CREATE ROLE app_candle LOGIN;     -- Candle Worker
GRANT SELECT ON ticks TO app_candle;
GRANT SELECT, INSERT, UPDATE ON candles TO app_candle;

CREATE ROLE app_settlement LOGIN; -- Settlement Worker
GRANT SELECT, UPDATE ON contracts TO app_settlement;
GRANT SELECT ON ticks TO app_settlement;
GRANT INSERT ON outbox TO app_settlement;

CREATE ROLE app_chart_ro LOGIN;   -- Chart API (somente leitura)
GRANT SELECT ON candles, ticks TO app_chart_ro;

CREATE ROLE auditor_ro LOGIN;     -- Auditoria
GRANT SELECT ON ALL TABLES IN SCHEMA public TO auditor_ro;

-- Nenhuma role de aplicação tem DELETE, nem UPDATE em ticks.
-- Nenhum serviço usa o superusuário postgres.
```

## Inventário de segredos

| Variável | Dono | Escopo | Rotação |
|----------|------|--------|---------|
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak | Bootstrap; trocar após setup | Após setup e em incidente |
| `DATABASE_URL_CONTRACT` | Contract Service | `app_contract` | `<não definido no contexto>` |
| `DATABASE_URL_TICK` | Tick Engine | `app_tick` | `<não definido no contexto>` |
| `DATABASE_URL_RELAY` | Outbox Relay | `app_relay` | `<não definido no contexto>` |
| `DATABASE_URL_CANDLE` | Candle Worker | `app_candle` | `<não definido no contexto>` |
| `DATABASE_URL_SETTLEMENT` | Settlement Worker | `app_settlement` | `<não definido no contexto>` |
| `DATABASE_URL_CHART` | Chart API | `app_chart_ro` | `<não definido no contexto>` |
| `REDIS_URL` | Serviços internos | ACL por serviço | `<não definido no contexto>` |
| `BLNK_API_KEY` | Wallet Adapter | Somente o adapter | `<não definido no contexto>` |
| `SENTRY_DSN` | Todos | Não é segredo crítico; não versionar mesmo assim | — |

Regras:

- `.env` no `.gitignore`; versionar apenas `.env.example` sem valores.
- `docker-compose` usa `env_file` ou `secrets`, nunca valor literal.
- Variáveis `VITE_*` vão para o bundle público: nunca colocar segredo nelas.
- Redação nos logs: `authorization`, `cookie`, `set-cookie`, `access_token`, `refresh_token`, `password`, `*_API_KEY`.

## Auditoria

Campos mínimos do log de auditoria: `timestamp`, `actor_sub`, `actor_roles`, `action`, `resource`, `resource_id`, `result` (`allowed`/`denied`), `reason`, `ip`, `trace_id`.

Métricas: `authz_denied_total{route,reason}`, `jwt_validation_failures_total{reason}`, `idor_attempts_total`.
Alerta sugerido: mais de 20 respostas 404 de recurso por usuário em 1 minuto.
