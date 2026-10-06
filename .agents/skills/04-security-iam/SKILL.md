---
name: 04-security-iam
description: >
  Trigger: "Keycloak", "OIDC", "JWT", "RBAC", "BOLA", "IDOR", "mass assignment", "secrets", "autorização". Ativar antes de escrever ou revisar autenticação, autorização ou manuseio de segredos.
version: 1.0.0
---

# 04-security-iam

Identidade, autorização e segredos da **Plataforma de Índices Sintéticos — Fase 1**.
Identidade: **Keycloak** (decisão `D-01` em `01-project-context`). Toda rota da API/BFF, todo handshake do WebSocket Gateway e todo segredo passam por esta skill.

## Mentalidade

| Regra | Pergunta mental aplicada a identidade |
|-------|---------------------------------------|
| O cliente sempre mente | Se eu trocar o `id` na URL ou adicionar `"user_id"` no JSON, vejo ou altero dados de outra pessoa? |
| Menor privilégio sempre | Esse usuário, serviço ou credencial de banco precisa mesmo dessa permissão? |
| Segurança é camada, não promessa | Se o token vazar, o que limita o dano: TTL, escopo, MFA, rate limit, auditoria? |
| Se não é observável, não é confiável | Uma tentativa de IDOR em massa gera alerta ou passa despercebida? |
| Deploy precisa ter volta | Se um segredo vazar, consigo rotacioná-lo sem derrubar a plataforma? |

## Regras de ativação

**Ativar quando o pedido contém:**

- "Keycloak", "realm", "client", "OIDC", "PKCE", "login", "logout", "MFA", "TOTP"
- "JWT", "access token", "refresh token", "JWKS", "validar token", "Authorization header"
- "RBAC", "role", "permissão", "USER", "ADMIN", "AUDITOR", "rota admin"
- "BOLA", "IDOR", "acessar dado de outro usuário", "autorização por objeto"
- "mass assignment", "DTO", "campo extra no body", "validação de entrada"
- "secret", "segredo", "senha", "API key", ".env", "credencial", "rotação"
- Revisão de qualquer PR que crie rota, handler do WebSocket ou variável de ambiente

**Não ativar quando:**

- Regras de ledger, saldo ou settlement — usar `02-financial-invariants`
- Protocolo de ticks e catch-up do feed — usar `03-synthetic-market-engine` (esta skill só autentica o handshake)
- Timeout, retry e circuit breaker do JWKS ou do Keycloak — usar `05-resilience-patterns`
- TLS, WAF e headers da borda sem relação com identidade — `01-project-context` (componente Edge)

## Controles

### S-01 — Keycloak / OIDC

- **Definição:** front-end usa Authorization Code + **PKCE S256** via `oidc-client-ts`. Implicit flow e Direct Access Grants desligados. Redirect URIs e Web Origins exatos.
- **Pergunta mental:** um site malicioso consegue receber um token emitido para o nosso client?
- **Como verificar:** config do client no realm; tokens só em memória (`InMemoryWebStorage`); refresh token com rotação; MFA obrigatório para `ADMIN` e `AUDITOR`; brute force detection ligado.
- **TTL do access token:** `<não definido no contexto>` (recomendação: ≤ 5 min).
- **Violação típica:** `response_type: 'id_token token'`, `redirectUris: ["*"]`, token em `localStorage`.

### S-02 — JWT validation

- **Definição:** todo request e todo handshake WebSocket validam o access token **no servidor**: assinatura via JWKS, `alg` em allowlist (`RS256`), `iss` exato, `aud` contém a API, `exp`/`nbf` com tolerância ≤ 30 s, `typ = Bearer`.
- **Pergunta mental:** se eu montar um JWT com `alg: none` ou assinado com outra chave, a API aceita?
- **Como verificar:** uso de `jwtVerify` com JWKS remoto em cache; nenhum `jwt.decode` para decisão de acesso; WebSocket fecha com código `4401` ao atingir `exp`.
- **Violação típica:** `jwt.decode(token)` e uso direto de `claims.sub`; `ignoreExpiration: true`; aceitar ID token como access token.

### S-03 — RBAC

- **Definição:** roles do realm `USER`, `AUDITOR`, `ADMIN`, lidas de `realm_access.roles` do token validado. **Negar por padrão.** Matriz oficial em `references/api-guide.md`.
- **Pergunta mental:** existe alguma rota que funciona sem declarar a role exigida?
- **Como verificar:** toda rota declara `requireRole(...)`; `/admin/*` exige `ADMIN` ou `AUDITOR` + MFA (`acr`); `AUDITOR` só tem `GET`; ninguém edita saldo (`I-06`).
- **Violação típica:** `if (req.body.isAdmin)`; role checada só no front-end.

### S-04 — BOLA / IDOR

- **Definição:** todo acesso a recurso do usuário filtra por `user_id = sub` **na query**. Recurso inexistente ou de outro dono retorna **404** (não revela existência).
- **Pergunta mental:** trocando o `id` por um de outro usuário, a resposta muda de 404 para 200?
- **Como verificar:** `WHERE id = $1 AND user_id = $2` em contratos, carteira e transações; listagens sempre escopadas; tentativas negadas viram métrica e log de auditoria.
- **Violação típica:** `SELECT * FROM contracts WHERE id = $1`; checar dono depois de carregar e responder 403.

### S-05 — Mass assignment

- **Definição:** entrada passa por DTO com allowlist estrita (`zod.strict()`), rejeitando campos desconhecidos. Campos de servidor nunca vêm do cliente.
- **Pergunta mental:** se eu enviar `status`, `entry_price`, `payout` ou `user_id` no body, algum é gravado?
- **Campos proibidos no body:** `user_id`, `entry_price`, `entry_sequence`, `exit_price`, `result`, `status`, `payout`, `payout_rate`, `expires_at`, `balance`, `role`.
- **Violação típica:** `create({ ...req.body })`, `Object.assign(entity, req.body)`.

### S-06 — Secrets

- **Definição:** segredos nunca no repositório, em imagem Docker, em log ou no bundle do front-end. Cada serviço tem credencial própria com menor privilégio. Inventário e rotação em `references/api-guide.md`.
- **Pergunta mental:** se este repositório ficar público agora, qual credencial eu preciso rotacionar?
- **Como verificar:** `.env` no `.gitignore` e fora do `git ls-files`; `docker-compose` lê `env_file`/`secrets`; redação de `Authorization`, cookies e tokens nos logs; usuário de banco por serviço (Chart API read-only).
- **Gerenciador de segredos em staging/prod:** `<não definido no contexto>`.
- **Violação típica:** `KEYCLOAK_ADMIN_PASSWORD: admin123` no compose; API usando o usuário `postgres`.

## Instruções

**Modo implementação** (`backend-implementation-agent` / `frontend-realtime-agent`):

1. Toda rota nova: `authenticate` (S-02) → `requireRole` (S-03) → DTO estrito (S-05) → query escopada por `sub` (S-04).
2. `user_id` sempre de `claims.sub`; preço, resultado e status sempre do servidor.
3. WebSocket: autenticar na primeira mensagem `{ "type": "auth", "token": ... }` em até 5 s; nunca por query string.
4. Variável de ambiente nova: registrar no inventário de `references/api-guide.md` e no `.env.example`, sem valor real.
5. Rotas `/admin/*`: exigir MFA (`acr`) e registrar auditoria (quem, o quê, quando, motivo).

**Modo revisão** (`security-reviewer`, somente leitura):

1. Para cada controle S-01 a S-06, marcar `PASS`, `FAIL` ou `N/A`.
2. Todo `FAIL` cita arquivo e linha.
3. Severidade: `CRÍTICO` (bypass de autenticação, acesso a dado de outro usuário, segredo exposto), `ALTO` (escalada de privilégio, token mal guardado), `MÉDIO` (falta de detecção, TTL longo), `BAIXO` (endurecimento).
4. Não sugerir código; descrever o problema, o vetor de ataque e o controle violado.

## Formato de saída

```text
SKILL: 04-security-iam
MODO: IMPLEMENTAÇÃO | REVISÃO
ESCOPO ANALISADO: <arquivos / rotas / configs>

S-01 Keycloak/OIDC     : PASS | FAIL | N/A — <evidência>
S-02 JWT validation    : PASS | FAIL | N/A — <evidência>
S-03 RBAC              : PASS | FAIL | N/A — <evidência>
S-04 BOLA/IDOR         : PASS | FAIL | N/A — <evidência>
S-05 Mass assignment   : PASS | FAIL | N/A — <evidência>
S-06 Secrets           : PASS | FAIL | N/A — <evidência>

ACHADOS:
- [CRÍTICO|ALTO|MÉDIO|BAIXO] <arquivo:linha> — <problema> — vetor: <ataque> — viola <S-xx>

PENDÊNCIAS: <itens <não definido no contexto> ou "nenhuma">
VEREDITO: APROVADO | REPROVADO
```

## Exemplos

Exemplo curto:

```text
Entrada: "revisar GET /contracts/:id" — trecho:
  const c = await db.one('SELECT * FROM contracts WHERE id = $1', [req.params.id])

S-04 BOLA/IDOR : FAIL — contracts.ts:3 query sem filtro por user_id
ACHADOS:
- [CRÍTICO] contracts.ts:3 — qualquer usuário lê contrato alheio — vetor: trocar o id na URL — viola S-04
VEREDITO: REPROVADO
```

Exemplos completos: `examples/example-1.md` e `examples/example-2.md`.

## Edge cases

- **JWKS indisponível:** usar chaves em cache; `kid` desconhecido força 1 refresh com rate limit; sem chave válida → 401 (nunca aceitar sem validar). Resiliência do fetch → `05-resilience-patterns`.
- **Rotação de chave no Keycloak:** aceitar as chaves publicadas no JWKS durante a janela de rotação; não fixar uma chave no código.
- **Token expira com WebSocket aberto:** fechar com `4401`; o cliente renova o token e reconecta com `lastSequence`.
- **Usuário desativado no Keycloak:** access token segue válido até `exp`; por isso o TTL é curto. Revogação imediata: `<não definido no contexto>`.
- **ADMIN quer operar como usuário:** contas separadas; `ADMIN` não abre contratos.
- **Recurso de outro usuário:** 404 idêntico ao de inexistente, mesmo corpo e tempo de resposta similar.
- **Segredo commitado por engano:** rotacionar primeiro, depois limpar o histórico; remover do Git não revoga a credencial.

## Modos de falha cobertos

| Modo de falha | Mitigação nesta skill |
|---------------|-----------------------|
| Falha de ativação | Triggers de identidade, autorização e segredos no `description` |
| Ativação espúria | Fronteiras com `02`, `03` e `05` em "Não ativar quando" |
| Execução parcial | Saída exige status para os 6 controles |
| Deriva de instrução | Matriz RBAC e lista de campos proibidos fixas |
| Conflito de tools | Handshake do WebSocket aqui; protocolo de ticks na `03` |
| Context overflow | Config do realm, matriz e inventário em `references/`, código em `examples/` |
| Feedback loop negativo | Revisor somente leitura; achados exigem vetor de ataque e evidência |

## Recursos

- Config do realm, matriz RBAC, roles de banco e inventário de segredos: `references/api-guide.md`
- Exemplos completos: `examples/example-1.md`, `examples/example-2.md`
- Casos de teste: `tests/test-case-1.md`, `tests/expected-output-1.md`, `tests/test-case-2.md`, `tests/expected-output-2.md`
- Validação da estrutura: `scripts/validate.sh`
- Varredura de controles no código: `scripts/health-check.sh`
