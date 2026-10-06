# Changelog — 06-testing-quality

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (regra ou matriz obrigatória alterada), MINOR (regra, cenário de chaos ou SLO novo), PATCH (texto/correção).

## [1.1.0] — 2026-03-10

### Adicionado

- Catálogo de caos `C-09` (tick repetido, com salto ou hash errado), `C-10` (mensagem reentregue N×), `C-11` (WebSocket zumbi, 6ª conexão, flood, ciclos) e `C-12` (reconciliador com worker e relay pausados).

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers de unit, integration, chaos, load test, k6, critério de aceite e flaky.
- Seção **Mentalidade** aplicada ao teste.
- Regras `Q-01` a `Q-05`: unit tests, integration tests, chaos tests, load tests, acceptance criteria.
- Rastreabilidade obrigatória: título do teste começa com o ID da regra (`[I-03]`) ou do critério (`[AC-42-3]`).
- Pós-condições obrigatórias de chaos: reconciliação, soma do ledger, sequência contínua, efeito único.
- Modos implementação, critérios e revisão com formato de saída por regra e "bug que passaria".
- `references/api-guide.md` com matriz regra → nível, ferramentas propostas, catálogo `C-01` a `C-08`, SLOs propostos e template de critério.
- `examples/`, `tests/`, `scripts/validate.sh`, `scripts/health-check.sh`.

### Pendente

- Ferramentas de teste não constam em `01-project-context` (Vitest, fast-check, Testcontainers, Toxiproxy, k6, Playwright são PROPOSTAS).
- SLOs e perfil de carga definitivos (capacidade alvo de usuários).
- Regra de arredondamento do payout e regra exata de escolha do tick de saída.
