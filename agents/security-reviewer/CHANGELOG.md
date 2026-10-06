# Changelog — security-reviewer

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (regra SR-xx, permissão ou contrato de saída alterado), MINOR (roteiro de ataque, subtask ou verificação nova), PATCH (texto/correção).

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers de auth, OIDC, JWT, RBAC, BOLA/IDOR, mass assignment e segredos; `permission: read-only`; skills 01 e 04.
- Identidade no pool alinhada ao catálogo do `ORCHESTRATOR.md` §4 e às subtasks revisadas T01–T04, T08, T09, T13, T14, T16 e T17 (§8).
- Regras invioláveis `SR-01` a `SR-14`: somente leitura, seis controles sempre marcados, vetor de ataque em todo `FAIL`, autorização só no servidor, segredo nunca reproduzido.
- Separação entre `status` (execução da revisão) e `verdict` (qualidade do código); campo `rotations_required`.
- Formato de saída do contrato §2.2 com bloco `review`, `decisions_cited`, `pending` e `handoff_notes`.
- `references/api-guide.md`: superfície por subtask, roteiro de ataques por controle, checklist do realm e do Compose, severidade, regras de mascaramento e template.
- `examples/example-1.md` (rotas da API) e `examples/example-2.md` (Compose + realm).
- `tests/`, `scripts/validate.sh`, `scripts/health-check.sh` (triagem com mascaramento + modo snapshot).

### Pendente

- TTL do access token (recomendação ≤ 5 min).
- Gerenciador de segredos em staging/produção.
- Revogação imediata de sessão de usuário desativado.
- `D-16`: React Admin ou Refine (afeta a revisão das telas do T14).
