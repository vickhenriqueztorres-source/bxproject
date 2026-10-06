# Test case 2 — Revisão de configuração OIDC no front-end e segredos no compose

- **Skill:** `04-security-iam`
- **Tipo:** modo revisão
- **Agente que envia:** `security-reviewer`

## Entrada (prompt)

```text
Antes de subir o staging, revisar a configuração de login do front e o docker-compose.
```

## Contexto fornecido

`apps/web/src/auth.ts`

```ts
export const userManager = new UserManager({
  authority: `${import.meta.env.VITE_KEYCLOAK_URL}/realms/demo`,
  client_id: 'frontend',
  redirect_uri: window.location.origin + '/callback',
  response_type: 'id_token token',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
})
userManager.events.addUserLoaded((user) => localStorage.setItem('access_token', user.access_token))
```

`infra/keycloak/realm-export.json` (trecho do client `frontend`)

```json
{
  "clientId": "frontend",
  "publicClient": true,
  "implicitFlowEnabled": true,
  "directAccessGrantsEnabled": true,
  "redirectUris": ["*"],
  "webOrigins": ["*"]
}
```

`docker-compose.yml`

```yaml
services:
  keycloak:
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin123
  api:
    environment:
      DATABASE_URL: postgres://postgres:postgres@db:5432/app
      BLNK_API_KEY: blnk_live_9f8a7c6d5e
  web:
    environment:
      VITE_BLNK_API_KEY: blnk_live_9f8a7c6d5e
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "login", "docker-compose", segredos) | Obrigatório |
| 2 | S-01 FAIL — implicit flow (`auth.ts:5`, `implicitFlowEnabled`), sem PKCE | Obrigatório |
| 3 | S-01 FAIL — `redirectUris`/`webOrigins` curinga; Direct Access Grants ligado | Obrigatório |
| 4 | S-01 FAIL — tokens em `localStorage` (`auth.ts:6` e `:8`) | Obrigatório |
| 5 | S-06 FAIL — senha admin, chave Blnk e senha do banco literais no compose | Obrigatório |
| 6 | S-06 FAIL — `VITE_BLNK_API_KEY` vai para o bundle público | Obrigatório |
| 7 | S-06 FAIL — API usa superusuário `postgres` (menor privilégio) | Obrigatório |
| 8 | Recomenda rotacionar `blnk_live_*` por já estar no repositório | Obrigatório |
| 9 | S-02 a S-05 marcados `N/A` | Obrigatório |
| 10 | `VEREDITO: REPROVADO` | Obrigatório |
