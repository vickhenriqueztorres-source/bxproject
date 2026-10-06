# Expected output 2

```text
SKILL: 08-database-foundation
MODO: REVISÃO
AMBIENTE: prod
ESCOPO ANALISADO: db/migrations/0011_fix_price.up.sql, compose.prod.yml (settlement-worker)

DB-01 Topologia e rede      : N/A
DB-02 Tipos                 : FAIL — divergência 1 confirmada; a correção proposta é perigosa (ver DB-11)
DB-03 Integridade           : N/A
DB-04 Append-only           : FAIL — 0011:1 ALTER TYPE reescreve ticks (histórico) fisicamente
DB-05 Menor privilégio      : N/A
DB-06 Isolamento (RLS)      : N/A
DB-07 Transações            : N/A
DB-08 Réplica               : FAIL — compose.prod.yml: settlement lendo da réplica
DB-09 Conexões              : FAIL — compose.prod.yml: sslmode=require sem verify-full
DB-10 Criptografia/segredos : N/A
DB-11 Migrations            : FAIL — 0011:1-2 ALTER TYPE com reescrita; 0011:3 índice sem CONCURRENTLY; sem cabeçalho de timeouts
DB-12 Backup/DR             : N/A
DB-13 Observabilidade       : N/A
DB-14 Retenção              : N/A

ACHADOS:
- [ALTO] 0011_fix_price.up.sql:1 — ALTER COLUMN TYPE em ticks (20 mi linhas) — impacto: lock
  ACCESS EXCLUSIVE durante a reescrita; o Tick Engine (lock_timeout 200 ms) falha a cada segundo,
  o gráfico para e contratos não abrem — viola DB-11
- [ALTO] 0011_fix_price.up.sql:3 — CREATE INDEX sem CONCURRENTLY — impacto: bloqueia INSERT em
  ticks durante a criação — viola DB-11. Além disso, ticks_symbol_ts (symbol, ts, sequence) já
  cobre a consulta do settlement; o índice provavelmente é desnecessário
- [CRÍTICO] compose.prod.yml — Settlement Worker na réplica — impacto: com atraso de réplica, o
  primeiro tick com ts >= expires_at ainda não chegou; o contrato fica preso ou é liquidado com um
  tick que não é o primeiro após o vencimento — o trigger da primária recusa o UPDATE, e o
  settlement entra em retry em loop — viola DB-08, B-08
- [ALTO] compose.prod.yml — sslmode=require — impacto: tráfego cifrado mas servidor não validado
  (MITM possível) — viola DB-09

CORREÇÃO PROPOSTA (sem reescrita):
  0011_price_scale_check.up.sql
    SET lock_timeout = '200ms';
    SET statement_timeout = '60s';
    SET ROLE synth_owner;
    ALTER TABLE ticks ADD CONSTRAINT ticks_price_scale CHECK (scale(price) <= 6) NOT VALID;
    ALTER TABLE index_state ADD CONSTRAINT index_state_price_scale CHECK (scale(last_price) <= 6) NOT VALID;
  0012_price_scale_validate.up.sql      (VALIDATE não bloqueia escrita)
    SET ROLE synth_owner;
    ALTER TABLE ticks VALIDATE CONSTRAINT ticks_price_scale;
    ALTER TABLE index_state VALIDATE CONSTRAINT index_state_price_scale;
  Se o VALIDATE falhar: existem preços com mais de 6 casas, e os contratos já liquidados contra eles
  precisam de análise financeira (02) antes de qualquer correção. Nunca UPDATE em ticks.
  A troca do tipo para numeric(18,6) fica para a próxima reconstrução planejada, ou não é feita:
  o CHECK garante o mesmo efeito.

CPU 70% NA PRIMÁRIA (causa, não sintoma):
- pg_stat_statements: top 10 por tempo total.
- Mover para a réplica só o que pode (DB-08): candles, histórico, admin, relatórios.
- Avaliar o tamanho da instância (operations.md). O settlement e a abertura de contrato ficam na primária.

MIGRATION: 0011 rejeitada; substituta reversível (DROP CONSTRAINT no .down.sql)
PENDÊNCIAS: escala oficial do preço confirmada pela 03 (assumida 6 casas)
VEREDITO: REPROVADO
```
