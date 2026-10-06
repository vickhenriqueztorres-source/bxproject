# Changelog — 01-project-context

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (decisão removida/alterada), MINOR (decisão ou seção nova), PATCH (texto/correção).

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers explícitos (`stack`, `arquitetura`, `escopo da Fase 1`, `decisão já tomada`).
- Seção **Mentalidade** com as 10 regras e perguntas mentais.
- Regras de ativação e lista "Não ativar quando".
- Tabela de consumidores (orquestrador + 5 agentes).
- Seções **Stack**, **Arquitetura**, **Escopo da Fase 1** e **Decisões já tomadas** (`D-01` a `D-16`).
- Formato de saída com classificação `DENTRO DO ESCOPO` / `FORA DO ESCOPO DA FASE 1` / `CONFLITA COM DECISÃO`.
- Edge cases e tabela de modos de falha cobertos.
- `references/api-guide.md`, `examples/`, `tests/`, `scripts/validate.sh`, `scripts/health-check.sh`.

### Pendente

- `D-16`: escolha entre React Admin e Refine.
