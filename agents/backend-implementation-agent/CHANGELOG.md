# Changelog — backend-implementation-agent

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (regra B-xx, fronteira de escrita ou contrato de saída alterado), MINOR (regra, subtask ou verificação nova), PATCH (texto/correção).

## [1.1.0] — 2026-03-10

### Adicionado

- `B-15`: Blnk só pela allowlist de `02-financial-invariants`; checagem de rota fora da lista e de `PUT`/`PATCH`/`DELETE`.
- `B-16`: limites do WebSocket Gateway no servidor (auth em 5 s, 5 conexões, 10 símbolos, ping 15 s / 45 s, rate limit de mensagens, limpeza no `close`); checagens correspondentes e de token na URL.
- `B-17`: trabalho crítico só por Streams com consumer group; checagens de Pub/Sub fora do gateway, `XREAD` sem grupo e `XAUTOCLAIM` com `min-idle-time` 0.

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers de API, tick engine, contrato, settlement worker, Blnk, outbox e WebSocket gateway; `permission: write-code`; skills 01 a 05.
- Identidade no pool alinhada ao catálogo do `ORCHESTRATOR.md` §4 e às subtasks T01–T12, T15, T16 (§8).
- Fronteira de escrita por diretório: `services/**`, `db/migrations/**`, `infra/**`, `.github/workflows/**` e testes unitários ao lado do código.
- Validação do contrato de entrada (§2.1) com resposta `FAILED`/`BLOCKED` para handoff malformado.
- Regras invioláveis `B-01` a `B-14`, cada uma com origem (`D-xx`, `I-xx`, `M-xx`, `S-xx`, `R-xx`, PRD) e forma de verificação.
- Formato de saída do contrato §2.2 com `decisions_cited` e `pending`.
- `references/api-guide.md`: mapa de subtasks, divergências PRD × decisões, parâmetros do `SYNTH_VOL_50`, rotas, DTO de `POST /contracts`, schema, máquina de estados, resultado e valores, chaves Redis e balances Blnk.
- `examples/example-1.md` (T09) e `examples/example-2.md` (T05 corrigindo o pseudocódigo do PRD).
- `tests/`, `scripts/validate.sh`, `scripts/health-check.sh` (varredura contra B-01 a B-14).

### Pendente

- Regra de arredondamento do lucro (`stake_minor × 85 / 100` não inteiro).
- Preço inicial do `SYNTH_VOL_50` (exemplos do PRD usam 1000).
- Regra de cancelamento de contrato (`POST /contracts/:id/cancel`).
- Lista de rotas que exigem 2FA para `USER`.
- Origem contábil do crédito inicial demo no Blnk.
