# Changelog — 04-security-iam

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (controle, role ou matriz alterados), MINOR (controle, checagem ou segredo novo), PATCH (texto/correção).

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers de Keycloak, OIDC, JWT, RBAC, BOLA/IDOR, mass assignment e secrets.
- Seção **Mentalidade** aplicada a identidade.
- Controles `S-01` a `S-06`: Keycloak/OIDC, JWT validation, RBAC, BOLA/IDOR, mass assignment, secrets.
- Lista de campos proibidos no body.
- Autenticação do WebSocket pela primeira mensagem, com fechamento `4401` no `exp`.
- Modos implementação e revisão com formato de saída por controle e vetor de ataque.
- `references/api-guide.md` com config do realm, matriz RBAC, roles de banco e inventário de segredos.
- `examples/`, `tests/`, `scripts/validate.sh`, `scripts/health-check.sh`.

### Pendente

- TTL do access token e do refresh token.
- Valor de `acr` que representa MFA concluído.
- Nome do realm e do audience da API.
- Gerenciador de segredos para staging e prod.
- Estratégia de revogação imediata de sessão.
