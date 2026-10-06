# Expected output 1

```text
SKILL: 08-database-foundation
MODO: REVISÃO
AMBIENTE: todos
ESCOPO ANALISADO: db/migrations/0010_wallets.up.sql

DB-01 Topologia e rede      : N/A
DB-02 Tipos                 : FAIL — 0010:3 double precision para dinheiro
DB-03 Integridade           : FAIL — 0010:1 segunda fonte de verdade de saldo
DB-04 Append-only           : FAIL — 0010:6 DELETE em contracts apaga histórico financeiro
DB-05 Menor privilégio      : FAIL — 0010:5 UPDATE livre de saldo; 0010:6 DELETE para role de aplicação
DB-06 Isolamento (RLS)      : FAIL — 0010:1 tabela com user_id sem RLS
DB-07 Transações            : N/A
DB-08 Réplica               : N/A
DB-09 Conexões              : N/A
DB-10 Criptografia/segredos : N/A
DB-11 Migrations            : FAIL — 0010 sem cabeçalho de timeouts, sem SET ROLE e sem .down.sql
DB-12 Backup/DR             : N/A
DB-13 Observabilidade       : N/A
DB-14 Retenção              : N/A

ACHADOS:
- [CRÍTICO] 0010_wallets.up.sql:1 — tabela de saldo no synth — impacto: dois saldos (Blnk e
  wallets) que divergem no primeiro retry ou falha parcial; a reconciliação perde a referência — viola D-02, DB-03
- [CRÍTICO] 0010_wallets.up.sql:6 — DELETE em contracts para app_contract — impacto: um bug ou
  credencial vazada apaga contratos liquidados e a trilha do dinheiro — viola DB-04, DB-05
- [ALTO] 0010_wallets.up.sql:3 — double precision em dinheiro — impacto: erro de arredondamento
  acumulado no saldo — viola DB-02
- [ALTO] 0010_wallets.up.sql:5 — UPDATE livre de saldo por duas roles — impacto: saldo alterável
  sem transação de dupla entrada — viola DB-05, I-01
- [MÉDIO] 0010_wallets.up.sql — migration sem lock_timeout, sem SET ROLE e sem down — viola DB-11

ALTERNATIVA (sem segunda fonte de verdade):
- Medir antes: latência do Blnk no GET /wallet (p95) e a causa (rede, pool, timeout).
- Ler o saldo do Blnk com timeout e circuit breaker (05); se falhar, devolver erro ou "indisponível",
  nunca um número inventado.
- Se ainda for lento: cache de leitura no Redis com TTL curto, invalidado pelo evento de transação,
  exibido como "atualizado há X s". O cache nunca é usado para decisão de saldo (reserva).
- Limpar dados de teste: banco efêmero por execução de teste (06), nunca grant de DELETE.

"É só demo": o dinheiro é demo, mas as regras são as mesmas da plataforma real
(01-project-context). Exceção exige mudar a decisão D-02, e não a migration.

MIGRATION: rejeitada
PENDÊNCIAS: nenhuma
VEREDITO: REPROVADO
```
