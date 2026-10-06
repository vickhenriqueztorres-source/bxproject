# Changelog — frontend-realtime-agent

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (regra F-xx, fronteira de escrita ou contrato de saída alterado), MINOR (regra, tela ou verificação nova), PATCH (texto/correção).

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers de tela, React, gráfico, Lightweight Charts, cliente WebSocket, carteira demo, histórico e painel admin; `permission: write-code`; skills 01, 03 e 04.
- Identidade no pool alinhada ao catálogo do `ORCHESTRATOR.md` §4 e às subtasks T13 e T14 (§8).
- Fronteira de escrita: `apps/web/**`, `apps/admin/**` e testes unitários ao lado do código.
- Regras invioláveis `F-01` a `F-14`: front não decide preço, resultado nem saldo; tokens só em memória; WebSocket autenticado na primeira mensagem; catch-up por `lastSequence`; idempotência da boleta; admin sem edição de saldo.
- Formato de saída do contrato §2.2 com `decisions_cited` e `pending`.
- `references/api-guide.md`: stack, estrutura de pastas, rotas consumidas, protocolo WebSocket do cliente, estados de contrato na UI, mapa de erros, formatação de dinheiro e telas do admin.
- `examples/example-1.md` (feed + gráfico) e `examples/example-2.md` (boleta, carteira, histórico).
- `tests/`, `scripts/validate.sh`, `scripts/health-check.sh` (varredura contra F-01 a F-14).

### Pendente

- `D-16`: React Admin ou Refine para o painel admin.
- Comportamento do WebSocket Gateway quando o access token é renovado com a conexão aberta.
- Regra de arredondamento do lucro (afeta só a exibição antes da liquidação).
- Regra de cancelamento de contrato (botão "Cancelar" fica oculto até a decisão).
- Versão de Lightweight Charts fixada no `package.json` (exemplos usam a API v5).
