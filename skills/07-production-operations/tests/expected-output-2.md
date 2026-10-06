# Expected output 2

## Deve conter

- Status para as 6 regras
- `FAIL` em O-02, O-05 e O-06
- `N/A` em O-01, O-03 e O-04
- Explicação de por que o `RENAME` quebra durante o deploy **e** no rollback
- Explicação de por que restore não é rollback
- `PLANO DE VOLTA: inexistente`
- `VEREDITO: REPROVADO`

## Não deve conter

- Pipeline ou migration corrigidos em bloco de código
- Aceitar o restore do backup como plano de rollback
- `VEREDITO: APROVADO`

## Saída de referência

```text
SKILL: 07-production-operations
MODO: REVISÃO
AMBIENTE: prod
ESCOPO ANALISADO: .github/workflows/deploy.yml, db/migrations/0012_rename_stake.sql, RELEASE.md

O-01 Docker Compose   : N/A — fora do escopo
O-02 CI/CD            : FAIL — deploy.yml:2-4 push em main = prod; :10 build no servidor; 0012:1-2 migration destrutiva
O-03 Logs e métricas  : N/A — fora do escopo
O-04 Alertas          : N/A — fora do escopo (janela pós-deploy cobrada em O-06)
O-05 Backups          : FAIL — RELEASE.md: pg_dump diário como única proteção
O-06 Rollback         : FAIL — RELEASE.md: rollback = restore + rebuild

ACHADOS:
- [CRÍTICO] deploy.yml:2-4 :10 — todo push em main vai para prod sem testes, staging nem
  aprovação — impacto em produção: qualquer merge quebrado chega ao usuário — viola O-02
- [CRÍTICO] 0012_rename_stake.sql:1 — RENAME no mesmo deploy do código — impacto: entre o migrate e
  o up -d, a versão em execução consulta stake e falha em todo POST /contracts; após o deploy, a
  versão anterior também não funciona mais, então não há rollback por imagem — viola O-02, O-06
- [CRÍTICO] 0012_rename_stake.sql:2 — DROP COLUMN legacy_payout no mesmo release — impacto: dado
  apagado sem volta; nenhum down possível — viola O-02, O-06
- [CRÍTICO] RELEASE.md — rollback por restore do dump das 02:00 — impacto: perde todos os contratos,
  liquidações e outbox desde 02:00; o Blnk não volta junto e a reconciliação diverge (I-05);
  correção financeira só por transação reversa (I-06) — viola O-06
- [ALTO] deploy.yml:10 — git pull + docker compose build no servidor — impacto: o que roda em prod
  não é o artefato testado; sem scan nem digest para voltar — viola O-02
- [ALTO] deploy.yml:10 — migrate sem lock_timeout no caminho do deploy — impacto: RENAME espera lock
  em contracts e bloqueia o Contract Service inteiro — viola O-02
- [ALTO] RELEASE.md — git checkout + rebuild — impacto: volta leva o tempo de um build e gera outra
  imagem; não cumpre ≤ 5 min — viola O-06
- [ALTO] RELEASE.md — pg_dump diário — impacto: RPO de até 24 h, sem PITR; banco do Blnk e do
  Keycloak não citados — viola O-05
- [ALTO] deploy.yml — sem smoke test, janela de observação nem critério de rollback — impacto:
  regressão só é percebida por reclamação de usuário — viola O-06

PLANO DE VOLTA: inexistente
PENDÊNCIAS: RPO/RTO <não definido no contexto>; ferramenta de CI <não definido no contexto> (arquivo usa GitHub Actions)
VEREDITO: REPROVADO
```
