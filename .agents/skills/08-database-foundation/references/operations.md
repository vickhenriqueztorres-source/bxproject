# Operação do banco

## Dimensionamento da Fase 1

| Carga | Volume | Efeito no banco |
|-------|--------|-----------------|
| Ticks | 1/s × 1 índice = 86.400/dia ≈ 31,5 mi/ano | ~250 B/linha com índices ≈ 8 GB/ano |
| Outbox | ~90 mil/dia, purga em 7 dias | ≤ ~650 mil linhas vivas |
| Contratos | 50/min no pico = 72 mil/dia | ~4 UPDATEs por linha (`fillfactor = 90`) |
| Candles 1m | 1.440/dia | Desprezível |
| WebSockets (300) | Não tocam o banco: o feed vem do Redis | — |

Conclusão: uma instância de propósito geral com 2 vCPU e 8 GiB (ex.: família `m7g.large`) sobra para a Fase 1. **Não usar classe burstable (`t*`) em prod**, porque créditos de CPU esgotados viram latência no settlement. Storage `gp3` de 100 GiB com autoscaling e limite máximo definido. Tudo PROPOSTO, a validar com o teste de carga da `06`.

### Orçamento de conexões

| Origem | Instâncias × pool | Total |
|--------|-------------------|-------|
| Contract Service / API | 2 × 10 | 20 |
| Settlement Worker | 2 × 5 | 10 |
| Wallet Adapter | 2 × 5 | 10 |
| Chart API | 2 × 5 | 10 |
| Tick Engine, Relay, Candle | 3 × 2 | 6 |
| Admin, Reconciliação, Manutenção, Monitor | — | 8 |
| Blnk | `<não definido no contexto>` | ~20 |
| Keycloak | `<não definido no contexto>` | ~20 |
| **Total estimado** | | **~105** |

O `max_connections` padrão do RDS escala com a memória da instância e fica bem acima disso. O orçamento existe para que **nenhum** serviço consiga sozinho esgotar o banco (`CONNECTION LIMIT`, `security.md`).

## Parameter group (PROPOSTO)

Vale para a instância inteira, ou seja, também para `blnk` e `keycloak`.

| Parâmetro | Valor | Motivo |
|-----------|-------|--------|
| `rds.force_ssl` | `1` | Recusa conexão sem TLS |
| `ssl_min_protocol_version` | `TLSv1.2` | — |
| `password_encryption` | `scram-sha-256` | — |
| `timezone` | `UTC` | Todo `timestamptz` em UTC |
| `shared_preload_libraries` | `pg_stat_statements,pgaudit` | Diagnóstico + auditoria |
| `pgaudit.log` | `ddl, role` | Mudança de schema e de privilégio |
| `log_statement` | `ddl` | **Nunca** `all`: gravaria dados de todos os databases |
| `log_min_duration_statement` | `500` (ms) | Queries lentas |
| `log_parameter_max_length` | `0` | Não grava parâmetros de bind (podem ser dados do Keycloak) |
| `log_parameter_max_length_on_error` | `0` | Idem, em erro |
| `log_lock_waits` | `on` | Lock acima do `deadlock_timeout` |
| `log_connections` / `log_disconnections` | `on` | Trilha de acesso |
| `log_autovacuum_min_duration` | `1000` (ms) | Vacuum lento |
| `track_io_timing` | `on` | Diagnóstico de IO |
| `idle_in_transaction_session_timeout` | `60000` (ms) | Rede de segurança global; por role é menor |

## Migrations (DB-11)

### Estrutura

```text
db/
├── bootstrap/
│   └── 0000_roles.sql            roles, grants de database e schema (security.md) — idempotente
└── migrations/
    ├── 0001_core.up.sql          tabelas, constraints, triggers, grants, RLS (schema.md)
    ├── 0001_core.down.sql
    ├── 0002_seed_synth_vol_50.up.sql
    ├── 0002_seed_synth_vol_50.down.sql
    └── ...
```

### Regras

1. **Cabeçalho obrigatório** em todo `.up.sql`:
   ```sql
   SET lock_timeout = '5s';
   SET statement_timeout = '60s';
   SET ROLE synth_owner;
   ```
2. **Imutável depois de aplicada.** Correção vira uma migration nova. A ferramenta precisa guardar o checksum e falhar se o arquivo mudar.
3. **Uma transação por arquivo.** Exceção: `CREATE INDEX CONCURRENTLY`, que não roda dentro de transação e por isso fica num arquivo próprio marcado como não transacional.
4. **Expand/contract** (O-02): o código N-1 continua funcionando com o schema N.
5. **Grants na mesma migration** que cria a tabela. Tabela sem grant explícito fica inacessível, o que é o comportamento desejado.
6. **CI:** banco efêmero no mesmo major → `up` → `down` → `up` → diff de schema → testes de role proibida e de RLS.
7. **Produção:** snapshot manual → migration pelo pipeline (`synth_migrator`) → deploy. Nunca do laptop.

### Operações seguras × perigosas

| Objetivo | Perigoso (trava ou reescreve) | Seguro |
|----------|-------------------------------|--------|
| Índice novo | `CREATE INDEX` | `CREATE INDEX CONCURRENTLY` em arquivo próprio |
| `CHECK` novo | `ADD CONSTRAINT ... CHECK` | `ADD CONSTRAINT ... NOT VALID` e depois `VALIDATE CONSTRAINT` |
| FK nova | `ADD FOREIGN KEY` | `NOT VALID` e depois `VALIDATE CONSTRAINT` |
| Coluna `NOT NULL` | `ADD COLUMN x NOT NULL` sem default | `ADD COLUMN` com default constante, ou nullable → backfill em lotes → `SET NOT NULL` |
| Mudar tipo | `ALTER COLUMN TYPE` (reescreve a tabela) | Coluna nova → dupla escrita → backfill → troca de leitura → remover a antiga |
| Limitar escala do preço | `ALTER TYPE numeric(18,6)` em `ticks` | `CHECK (scale(price) <= 6) NOT VALID` + `VALIDATE`, sem reescrita |
| Renomear | `RENAME COLUMN` no mesmo deploy | Coluna nova + view de compatibilidade; remover só no release seguinte |
| Remover | `DROP COLUMN` com código que ainda lê | Só depois que N-1 não usa mais (fase contract) |

`ticks` é a tabela mais sensível: o Tick Engine escreve nela a cada segundo com `lock_timeout = 200ms`. Uma migration que pega lock exclusivo em `ticks` por mais de 200 ms faz o tick falhar. Isso é aceitável **só** dentro de uma janela monitorada.

## Manutenção

| Item | Rotina |
|------|--------|
| Autovacuum | Ligado sempre. `outbox` com scale factor baixo (`schema.md`). Alertar se `n_dead_tup` crescer sem vacuum |
| XID | Alerta `PostgresXidAgeHigh` em `age(datfrozenxid) > 1e9`. A causa costuma ser uma transação esquecida |
| Purga da outbox | Job diário de `app_maint`: `SELECT outbox_purge();` em loop até devolver 0 |
| Estatísticas | `pg_stat_statements` revisado toda semana: top 10 por tempo total |
| Bloat | Verificar todo mês; `pg_repack` só com janela e decisão |
| Minor upgrade | Primeiro em staging, depois em prod, na janela de manutenção |
| Major upgrade | RDS Blue/Green Deployments + snapshot + validação de compatibilidade de Keycloak e Blnk |
| CA do RDS | Acompanhar a rotação; atualizar o bundle nas imagens antes do prazo |

## Alertas do banco

Complementam a tabela "Alertas mínimos" da `07`. Todo alerta tem `runbook_url` (O-04).

| Alerta | Condição | `for` | Severidade |
|--------|----------|-------|------------|
| `PostgresDown` | `pg_up == 0` ou `absent(pg_up)` | 1m | crítico |
| `RDSFailoverOccurred` | Evento do RDS de failover | 0m | alto |
| `PostgresConnectionsHigh` | Conexões > 80% de `max_connections` | 5m | alto |
| `PostgresRoleConnectionsAtLimit` | Role a ≥ 90% do `CONNECTION LIMIT` | 5m | médio |
| `PostgresLongTransaction` | Transação aberta > 60 s | 2m | alto |
| `PostgresLockWaitsHigh` | Lock waits ou deadlocks crescendo | 5m | médio |
| `PostgresStorageLow` | Espaço livre < 20% | 10m | alto |
| `PostgresXidAgeHigh` | `age(datfrozenxid) > 1e9` | 30m | alto |
| `PostgresReplicaLagHigh` | Réplica atrasada > 30 s | 5m | médio |
| `PostgresBackupStale` | Último instante restaurável há > 15 min | 15m | crítico |
| `OutboxBacklogGrowing` | `published_at IS NULL` crescendo há 5 min | 5m | alto |
| `AppendOnlyViolationAttempt` | Log com `append-only:` | 0m | alto (segurança) |
| `ContractGuardRejected` | Log com `transição` ou `exit tick inválido` | 0m | alto (bug financeiro) |
| `DatabasePrivilegeChanged` | pgaudit classe `ROLE` fora de deploy | 0m | crítico (segurança) |
| `TriggerDisabled` | pgaudit com `DISABLE TRIGGER` ou `session_replication_role` | 0m | crítico (segurança) |
| `RDSSnapshotShared` | CloudTrail `ModifyDBSnapshotAttribute` com conta externa ou `all` | 0m | crítico (segurança) |
| `RDSDeletionProtectionOff` | CloudTrail `ModifyDBInstance` desligando a proteção | 0m | crítico |
