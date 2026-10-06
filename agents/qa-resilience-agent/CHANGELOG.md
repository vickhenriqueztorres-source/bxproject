# Changelog — qa-resilience-agent

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (regra QA-xx, fronteira de escrita ou contrato de saída alterado), MINOR (cenário, nível de teste ou verificação nova), PATCH (texto/correção).

## [1.1.0] — 2026-03-10

### Adicionado

- Plano por subtask: `C-09` (T05), `C-10` (T07, T10), `C-11` e limites do WebSocket (T08), `422` e `429` (T09), `C-12` (T11), log sem token/PII (T15); T17 passa a cobrir `C-01` a `C-12`.

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers de teste, integração, caos, carga, k6, critério de aceite e flaky; `permission: write-tests-only`; skills 01, 05, 06 e 07.
- Identidade no pool alinhada ao catálogo do `ORCHESTRATOR.md` §4, ao §8 (testa T01–T16, dono de T17 e T18) e ao plano de testes §10.
- Fronteira de escrita: `services/*/test/**` e `tests/**`; produção, migrations, infra e CI proibidos.
- Regras invioláveis `QA-01` a `QA-14`: nunca consertar o produto, nunca afrouxar asserção, integração sem mock, prova de injeção e pós-condições no caos, thresholds de erro na carga, produção proibida.
- Separação entre `status` (trabalho de QA) e `verdict` (produto); campos `test_results`, `rules_covered`, `coverage_gaps` e `defects`.
- `references/api-guide.md`: fronteira, plano por subtask, mapa da Definição de Pronto §11, contrato dos helpers, ambientes, perfil de carga e template de defeito.
- `examples/example-1.md` (T09 integração) e `examples/example-2.md` (T17 caos com defeito).
- `tests/`, `scripts/validate.sh`, `scripts/health-check.sh` (varredura dos testes contra QA-01 a QA-14).

### Pendente

- Usuários simultâneos alvo da carga.
- Divergência de SLO: §10.4 (p95 < 200 ms) × skill 06 PROPOSTO (p95 < 300 ms) — aplicado o §10.4.
- Ferramentas marcadas PROPOSTO na skill 06 (Vitest, Testcontainers, Toxiproxy, k6, Playwright).
- Regra de arredondamento do lucro e regra exata do tick de saída (ficam `it.todo`).
