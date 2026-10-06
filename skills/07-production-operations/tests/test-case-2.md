# Test case 2 — Revisão de pipeline, migration e plano de rollback

- **Skill:** `07-production-operations`
- **Tipo:** modo revisão
- **Agente que envia:** `qa-resilience-agent`

## Entrada (prompt)

```text
Release 1.4 renomeia stake para amount. Revisar o pipeline, a migration e o plano de rollback antes de mergear.
```

## Contexto fornecido

`.github/workflows/deploy.yml`:

```yaml
name: deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ssh deploy@prod "cd /srv/sintetico && git pull && docker compose build && docker compose run --rm api pnpm migrate && docker compose up -d"
```

`db/migrations/0012_rename_stake.sql`:

```sql
ALTER TABLE contracts RENAME COLUMN stake TO amount;
ALTER TABLE contracts DROP COLUMN legacy_payout;
```

`RELEASE.md` (trecho):

```text
Plano de rollback: se der problema, restaurar o backup de ontem à noite (pg_dump das 02:00)
e subir a versão anterior com git checkout.
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "pipeline", "migration", "rollback") | Obrigatório |
| 2 | O-02 FAIL — push em `main` vai direto para prod, sem testes, staging nem aprovação (linhas 2-4, 10) | Obrigatório |
| 3 | O-02 FAIL — build no servidor de produção (linha 10) | Obrigatório |
| 4 | O-02 FAIL — `RENAME COLUMN` no mesmo deploy quebra a versão em execução e a N-1 (expand/contract) | Obrigatório |
| 5 | O-02/O-06 FAIL — `DROP COLUMN` irreversível | Obrigatório |
| 6 | O-06 FAIL — restaurar backup como rollback perde contratos e ledger desde 02:00; Blnk não restaurado junto → divergência | Obrigatório |
| 7 | O-06 FAIL — `git checkout` + rebuild não é volta em ≤ 5 min nem o mesmo artefato | Obrigatório |
| 8 | O-05 FAIL — `pg_dump` diário: RPO de até 24 h, sem PITR, sem menção ao Blnk | Obrigatório |
| 9 | Sem janela de observação pós-deploy nem critério de rollback | Obrigatório |
| 10 | O-01, O-03 e O-04 marcados `N/A` | Obrigatório |
| 11 | Não escreve o pipeline corrigido | Obrigatório |
| 12 | `VEREDITO: REPROVADO` | Obrigatório |
