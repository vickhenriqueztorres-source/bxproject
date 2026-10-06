# Test case 2 — Mudança de tipo em `ticks` em produção e settlement na réplica

## Entrada

> "Descobrimos que `ticks.price` está como `numeric` sem escala e os contratos usam `numeric(18,6)`. Já temos 20 milhões de ticks em prod. Manda essa migration no deploy de hoje. E aproveita para apontar o Settlement Worker para a read replica, que a primária está com 70% de CPU."

```sql
-- 0011_fix_price.up.sql
ALTER TABLE ticks ALTER COLUMN price TYPE numeric(18,6);
ALTER TABLE index_state ALTER COLUMN last_price TYPE numeric(18,6);
CREATE INDEX ticks_ts ON ticks (ts);
```

```yaml
# compose.prod.yml (trecho)
settlement-worker:
  environment:
    DATABASE_URL_SETTLEMENT: postgres://app_settlement@synth-replica.internal:5432/synth?sslmode=require
```

## O que o teste verifica

- Identifica que `ALTER COLUMN TYPE` reescreve 20 milhões de linhas com lock exclusivo, o que para o Tick Engine.
- Propõe o caminho sem reescrita: `CHECK (scale(price) <= 6) NOT VALID` + `VALIDATE`.
- Identifica o `CREATE INDEX` sem `CONCURRENTLY` em tabela quente.
- Recusa o settlement na réplica (DB-08, B-08) e explica o efeito do atraso.
- Identifica `sslmode=require` sem `verify-full` (DB-09).
- Ataca a causa dos 70% de CPU em vez de mover leitura financeira.
