# Changelog — financial-correctness-reviewer

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (regra FC-xx, permissão ou contrato de saída alterado), MINOR (checklist, subtask ou verificação nova), PATCH (texto/correção).

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers de ledger, settlement, idempotência, reconciliação, double-entry, payout e estorno; `permission: read-only`; skills 01, 02 e 05.
- Identidade no pool alinhada ao catálogo do `ORCHESTRATOR.md` §4 e às subtasks revisadas T04–T11 e T17 (§8).
- Regras invioláveis `FC-01` a `FC-14`: somente leitura, seis invariantes sempre marcadas, `FAIL` com arquivo:linha e cenário, sem sugestão de código, regra não decidida vira pendência.
- Separação entre `status` (execução da revisão) e `verdict` (qualidade do código).
- Formato de saída do contrato §2.2 com bloco `review`, `decisions_cited`, `pending` e `handoff_notes`.
- `references/api-guide.md`: checklist por subtask, linhas do tempo de falha (abertura e settlement), sinais de violação por invariante, tabela de severidade e template.
- `examples/example-1.md` (T10 reprovado) e `examples/example-2.md` (T09 aprovado).
- `tests/`, `scripts/validate.sh`, `scripts/health-check.sh` (triagem estática + modo snapshot para provar que o revisor não alterou arquivos).

### Pendente

- Regra de arredondamento do lucro (`stake × 0,85`).
- Balance de origem do crédito demo de 10.000.
- Regra de cancelamento de contrato (`OPEN → CANCELLED`).
- Ações automáticas da reconciliação (§14 do orquestrador, seção 11.2 pendente).
