# Changelog — 02-financial-invariants

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (invariante ou fluxo alterado), MINOR (invariante, chave ou checagem nova), PATCH (texto/correção).

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers financeiros (`ledger`, `saldo`, `settlement`, `payout`, `idempotência`, `reconciliação`, `estorno`).
- Seção **Mentalidade** aplicada ao dinheiro.
- Invariantes `I-01` a `I-06`: append-only, double-entry, idempotência, ACID, reconciliação, correção por reversão.
- Tabela de chaves de idempotência (`reserve:`, `settlement:`, `credit:`, `reversal:`).
- Tabela de fluxos do ledger (abrir, WIN, LOSS, DRAW).
- Máquina de estados do contrato.
- Modos implementação e revisão com formato de saída por invariante.
- Edge cases e tabela de modos de falha cobertos.
- `references/api-guide.md`, `examples/`, `tests/`, `scripts/validate.sh`, `scripts/health-check.sh`.

### Pendente

- Regra de arredondamento do payout (85%).
