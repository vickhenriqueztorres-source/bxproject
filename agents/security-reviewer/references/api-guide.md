# API guide — security-reviewer

Referência carregada sob demanda durante a revisão. Os controles de origem estão na skill
`04-security-iam` (S-01 a S-06, matriz RBAC e inventário de segredos no `api-guide` da skill).
Este guia diz **qual superfície mapear**, **qual ataque simular mentalmente** e **como classificar**.

## Superfície por subtask

| Subtask | Superfície a mapear | Controles prioritários |
|---------|---------------------|------------------------|
| T01 Compose base | Portas publicadas, redes, `env_file`/`secrets`, usuários de banco por serviço | S-06 (+ O-01 da skill 07) |
| T02 Keycloak | Clients, flows, redirect URIs, Web Origins, MFA, brute force, rotação de refresh token | S-01 |
| T03 API/BFF | Middleware de JWT, `requireRole`, DTOs, rate limit | S-02, S-03, S-05 |
| T04 Wallet Adapter | Origem do `sub` usado nos balances; credencial do Blnk | S-04, S-06 |
| T08 WebSocket Gateway | Mensagem `auth`, prazo de 5 s, `4401` no `exp`, limites 5 conexões / 10 símbolos | S-02 |
| T09 Contract Service | `POST /contracts`, `GET /contracts/:id`, listagens, DTO | S-04, S-05 |
| T13 Front-end | Fluxo OIDC, armazenamento de token, `VITE_*`, XSS | S-01, S-06 |
| T14 Painel admin | Guards, MFA, `AUDITOR` só leitura, ausência de edição de saldo, auditoria | S-03 |
| T16 CI/CD | Scan de segredos, segredos do pipeline, permissões do token de CI | S-06 (+ O-02 da skill 07) |
| T17 Caos | `C-07` (Keycloak fora) e "reusar refresh token" (§10.3) | S-01, S-02 |

## Roteiro de ataques por controle

Cada linha é um ataque que o revisor simula **lendo o código**. Nunca executado contra ambiente real.

| Controle | Ataque | Resposta segura esperada |
|----------|--------|--------------------------|
| S-01 | Pedir token pelo implicit flow (`response_type=token`) | Client sem implicit; erro do Keycloak |
| S-01 | Registrar `redirect_uri` de outro domínio | Redirect URIs exatas; erro do Keycloak |
| S-01 | Login por senha direto na API (Direct Access Grants) | Desligado no client público |
| S-01 | Reusar refresh token já rotacionado | Revogação da família de tokens |
| S-02 | JWT com `alg: none` | `401` |
| S-02 | JWT `HS256` assinado com a chave pública como segredo | `401` (allowlist `RS256`) |
| S-02 | Token de outro realm / `aud` de outro client | `401` (`iss` e `aud` exatos) |
| S-02 | ID token no lugar do access token | `401` (`typ = Bearer`) |
| S-02 | Token expirado com WebSocket aberto | Fechamento `4401` |
| S-03 | `USER` chamando `/admin/*` | `403` |
| S-03 | `AUDITOR` fazendo `POST`/`PATCH` em `/admin/*` | `403` |
| S-03 | `ADMIN` sem MFA (`acr` insuficiente) | `403` |
| S-03 | `isAdmin: true` ou `role` no body | Campo rejeitado (`400`) e ignorado na decisão |
| S-04 | Trocar `:id` de contrato por um de outro usuário | `404` idêntico ao inexistente |
| S-04 | Listagem com `?user_id=` de outro usuário | Parâmetro ignorado; lista só do `sub` |
| S-05 | Body com `entry_price`, `status`, `payout`, `user_id`, `expires_at` | `400` |
| S-06 | Procurar credencial em `git ls-files`, imagem, log, bundle | Nada encontrado |

## Checklists de configuração

### Realm exportado (T02)

| Item | Valor seguro |
|------|--------------|
| `implicitFlowEnabled` | `false` |
| `directAccessGrantsEnabled` (client público) | `false` |
| `pkce.code.challenge.method` | `S256` |
| `redirectUris` / `webOrigins` | Lista exata, sem `*` |
| `bruteForceProtected` | `true` (5 tentativas / 15 min, B-13) |
| Refresh token | Rotação ligada, reuso revoga |
| MFA | Obrigatório para `ADMIN` e `AUDITOR` |
| Access token TTL | `<não definido no contexto>` (recomendação ≤ 5 min) |

### Compose e pipeline (T01, T16)

| Item | Valor seguro |
|------|--------------|
| Senhas e chaves | Só via `env_file`/`secrets`; nunca literal no YAML |
| `.env` | No `.gitignore` e fora de `git ls-files` |
| Postgres, Redis, Blnk | Sem porta publicada no host em staging/prod |
| Usuário de banco | Um por serviço; Chart API somente leitura; nenhum serviço usa `postgres` |
| Logs | Redação de `Authorization`, cookies e tokens |
| CI | Scan de segredos bloqueia o merge; token do CI com menor privilégio |

## Severidade e veredito

| Severidade | Definição (skill 04) | Exemplo | Efeito no veredito |
|------------|----------------------|---------|--------------------|
| CRÍTICO | Bypass de autenticação, dado de outro usuário, segredo exposto | `jwt.decode` para decidir acesso; BOLA; senha literal no Compose | REPROVADO |
| ALTO | Escalada de privilégio, token mal guardado | Token em `localStorage`; token na URL do WS; rota admin sem MFA | REPROVADO |
| MÉDIO | Falta de detecção, TTL longo | `403` em vez de `404`; tentativas negadas sem métrica | Aprovação possível |
| BAIXO | Endurecimento | Header de segurança ausente em rota interna | Aprovação possível |

## Mascaramento (SR-06)

| Situação | Como reportar |
|----------|---------------|
| Senha literal | `infra/docker-compose.yml:14 — senha do admin do Keycloak em texto puro` |
| Chave privada | `infra/certs/dev.key — chave privada RSA versionada` |
| Token em log | `services/api/src/log.ts:9 — header Authorization registrado sem redação` |
| Proibido | Valor, prefixo, sufixo, hash ou tamanho do segredo |

`rotations_required` lista o **tipo** da credencial e onde ela é usada, nunca o valor.

## Template do relatório

```yaml
review:
  surface: [GET /contracts/:id, POST /contracts, middleware authenticate]
  controls:
    S-01: { result: N/A, evidence: "T09 não altera client nem flow" }
    S-02: { result: PASS, evidence: "auth.ts:12 jwtVerify com JWKS, algorithms [RS256], iss/aud exatos" }
    S-03: { result: PASS, evidence: "routes.ts:8 requireRole('USER')" }
    S-04: { result: FAIL, evidence: "routes.ts:31 query sem user_id" }
    S-05: { result: PASS, evidence: "dto.ts:4 z.object(...).strict()" }
    S-06: { result: PASS, evidence: "nenhum segredo no diff" }
  findings:
    - severity: CRÍTICO
      location: services/api/src/contracts/routes.ts:31
      problem: contrato carregado só pelo id
      vector: usuário A troca o id pelo de B e recebe 200 com os dados de B
      violates: [S-04]
  rotations_required: []
  verdict: REPROVADO
```
