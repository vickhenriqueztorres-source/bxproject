# Subetapa 1: Configuração do Keycloak (OIDC, PKCE, MFA, Sessões e RBAC)

**Agentes Responsáveis:** `security-reviewer`, `frontend-realtime-agent`  
**Skills:** `04-security-iam`, `06-testing-quality`  
**Controles Auditados:** S-01 (OIDC / PKCE), S-03 (RBAC), S-06 (Secrets)

---

## 1. Objetivo Técnico
Configurar e validar o servidor de identidade Keycloak para operação em modo oficial de produção, garantindo:
1. Protocolo OIDC (OpenID Connect) Authorization Code Flow com **PKCE S256** (RFC 7636).
2. Desativação completa de fluxos inseguros: Implicit Flow e Direct Access Grants desativados.
3. Configuração de políticas de credenciais, auto-cadastro de usuários e suporte a MFA/TOTP.
4. Armazenamento seguro de tokens exclusivamente em memória RAM no frontend (`InMemoryWebStorage`), imune a ataques XSS contra `localStorage`.
5. Rotação automática de Refresh Tokens e detecção de ataques de brute-force.

---

## 2. Passo a Passo da Implementação

### 2.1 Especificação do Realm (`infra/keycloak/broker-realm.json`)
O realm `broker-demo` já provisionado define:
- **Client ID:** `broker-web`
- **Client Protocol:** `openid-connect`
- **Access Type:** `public` (com PKCE code_challenge_method = S256)
- **Standard Flow:** Ativado (Authorization Code)
- **Direct Access Grants:** Desativado
- **Redirect URIs:** `http://localhost:5173/callback`, `http://localhost:5173/*`
- **Web Origins:** `http://localhost:5173`, `+`
- **Roles do Realm:** `USER`, `ADMIN`, `AUDITOR`

### 2.2 Frontend OIDC Client (`apps/web/src/auth/oidc.ts`)
Configurado com a biblioteca institucional `oidc-client-ts`:
```typescript
export const userManager = new UserManager({
  authority: 'http://localhost:8080/realms/broker-demo',
  client_id: 'broker-web',
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
  loadUserInfo: false,
  automaticSilentRenew: true,
  accessTokenExpiringNotificationTimeInSeconds: 30,
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }), // S-01: Zero localStorage!
});
```

---

## 3. Matriz de Testes & Validação de Segurança

### Teste de Segurança S-01: Prova de Inviolabilidade de Armazenamento
- **Ação:** Inspecionar `window.localStorage` e `window.sessionStorage`.
- **Critério de Sucesso:** Nenhum JWT ou Refresh Token é exposto no armazenamento local do navegador.
- **Defesa:** Se um script malicioso (XSS) for injetado, ele não consegue extrair tokens de credenciais persistentes.

### Teste de Autenticação PKCE: Validação de Desafio Criptográfico
- **Ação:** Verificar o request inicial de autorização para o Keycloak.
- **Critério de Sucesso:** Presença obrigatória dos parâmetros `code_challenge` e `code_challenge_method=S256`.

---

## 4. Critério de Aceite da Subetapa 1
- [x] Realm `broker-demo` configurado com client público `broker-web`.
- [x] Implicit flow rejeitado pelo servidor.
- [x] Tokens geridos em memória volátil via `InMemoryWebStorage`.
- [x] Teste automatizado validando a estrutura e segurança das configurações do Keycloak.
