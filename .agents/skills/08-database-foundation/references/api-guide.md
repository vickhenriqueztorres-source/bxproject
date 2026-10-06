# Referência — base do banco de dados

Índice da base de conhecimento do PostgreSQL da Fase 1. Itens marcados `PROPOSTO` precisam de aprovação. Itens `<não definido no contexto>` são pendências, e não se deve inventar valor para eles.

| Documento | Conteúdo |
|-----------|----------|
| `api-guide.md` (este) | Inventário, catálogo de tabelas, matriz de acesso, transações oficiais e checklist |
| `schema.md` | DDL completo do database `synth`: tabelas, constraints, triggers e funções |
| `security.md` | Roles, grants, RLS, rede, TLS, KMS, segredos, auditoria e ameaça × controle |
| `ha-dr.md` | Multi-AZ, failover, réplica, backups, PITR, cross-region, RPO/RTO e restore |
| `operations.md` | Migrations, dimensionamento, parâmetros, manutenção, upgrades e alertas |

## Inventário

| Item | Valor | Status |
|------|-------|--------|
| Motor | PostgreSQL gerenciado — AWS RDS | PROPOSTO (`D-17`) |
| Versão maior | A mais nova suportada **ao mesmo tempo** por RDS, Keycloak e Blnk. Sugestão: 16 | `<não definido no contexto>` |
| Implantação prod | Multi-AZ DB instance (1 standby síncrono, não legível) | PROPOSTO |
| Implantação staging | Multi-AZ com instância menor, para ensaiar failover | PROPOSTO |
| Implantação dev | Docker Compose, mesmo major, mesmo script de roles | `D-15` |
| Databases | `synth` (plataforma), `blnk` (Blnk), `keycloak` (Keycloak) | PROPOSTO |
| Pooler | RDS Proxy (alternativa: PgBouncer em `transaction`) | PROPOSTO |
| Réplica de leitura | Opcional na Fase 1 | PROPOSTO |
| Região secundária (DR) | `<não definido no contexto>` | — |
| Ferramenta de migration | `<não definido no contexto>` — precisa de versionamento, checksum e `.down.sql` | — |
| IaC | `<não definido no contexto>` | — |

### Alternativas avaliadas

| Opção | Prós | Contras | Veredito |
|-------|------|---------|----------|
| RDS Multi-AZ **instance** | Simples; RPO 0 em falha de AZ; o PITR cobre a instância inteira | Failover de 60 a 120 s; standby não serve leitura | **Escolhida** para a Fase 1 |
| RDS Multi-AZ **DB cluster** | Failover mais rápido; 2 standbys legíveis | Classes de instância específicas; custo maior | Reavaliar se o failover de 2 min virar problema |
| Aurora PostgreSQL | Storage distribuído; failover rápido; réplicas baratas | Outro modelo de custo e IO; lock-in maior | Não é requisito da Fase 1 |
| Cloud SQL (GCP) HA | Equivalente funcional | Resto da infraestrutura não definida na GCP | Alternativa válida se a nuvem mudar |
| PostgreSQL no VPS/Compose | Barato; controle total | HA, PITR, patch e DR por nossa conta | **Só dev** |

## Catálogo de tabelas — database `synth`

| Tabela | Dono lógico | Escrita por | Mutável? | Cresce | Retenção |
|--------|-------------|-------------|----------|--------|----------|
| `indices` | Admin / migration | `synth_migrator` | Sim (`status`, `params`) | ~1 linha | Permanente |
| `index_state` | Tick Engine | `app_tick` | Sim, com fencing | 1 linha/índice | Permanente |
| `ticks` | Tick Engine | `app_tick` | **Não** | 86.400/dia/índice | `<não definido no contexto>` |
| `candles` | Candle Worker | `app_candle` | Sim (bucket aberto) | 1.440/dia/intervalo | Reconstruível |
| `outbox` | Produtores | `app_tick`, `app_contract`, `app_settlement` | Só `published_at` | ~90 mil/dia | 7 dias após publicar (PROPOSTO) |
| `contracts` | Contract Service | `app_contract`, `app_settlement` | Por transição | ≤ 72 mil/dia no pico | `<não definido no contexto>` |
| `wallet_accounts` | Wallet Adapter | `app_wallet` | **Não** | 1 linha/usuário | Permanente |
| `audit_logs` | API / Admin | `app_contract`, `app_admin` | **Não** | Baixo | `<não definido no contexto>` |
| `admin_reversals` | Admin | `app_admin`, `app_wallet` | Por transição | Muito baixo | Permanente |
| `reconciliation_runs` | Reconciliador | `app_reconciler` | Só o fechamento | ~288/dia (5 min) | `<não definido no contexto>` |

O que mora **fora** do `synth`: saldo e transações (Blnk, database `blnk`), identidade (Keycloak, database `keycloak`), último preço para a UI e Streams (Redis).

## Matriz de acesso (resumo)

`S` = SELECT, `I` = INSERT, `U(cols)` = UPDATE só nessas colunas, `X` = EXECUTE. Ausência = sem acesso. Nenhuma role de aplicação tem `DELETE` ou `TRUNCATE`.

| Role | Serviço | indices | index_state | ticks | candles | outbox | contracts | wallet_accounts | audit_logs | admin_reversals | reconciliation_runs |
|------|---------|---------|-------------|-------|---------|--------|-----------|-----------------|------------|-----------------|---------------------|
| `app_tick` | Tick Engine | S | S, U(estado) | S, I | — | I | — | — | — | — | — |
| `app_relay` | Outbox Relay | — | — | — | — | S, U(published_at) | — | — | — | — | — |
| `app_candle` | Candle Worker | S | — | S | S, I, U(ohlc) | — | — | — | — | — | — |
| `app_contract` | Contract Service / API | S | S | S | — | I | S, I, U(status) **RLS** | S **RLS** | I | — | — |
| `app_settlement` | Settlement Worker | — | — | S | — | I | S, U(liquidação) | — | — | — | — |
| `app_wallet` | Wallet Adapter | — | — | — | — | — | S | S, I | — | S, U(execução) | — |
| `app_chart_ro` | Chart API | S | — | S | S | — | — | — | — | — | — |
| `app_admin` | Painel admin | S | S | S | S | — | S | S | S, I | S, I, U(aprovação) | S |
| `app_reconciler` | Reconciliação | — | S | S | — | — | S | S | — | S | S, I, U(fechamento) |
| `app_maint` | Job de manutenção | — | — | — | — | X `outbox_purge` | — | — | — | — | — |
| `app_monitor` | postgres_exporter | `pg_monitor` (catálogo; não lê dados) | | | | | | | | | |
| `auditor_ro` | Auditoria | S | S | S | S | S | S | S | S | S | S |

Colunas exatas e DDL de cada grant: `security.md`.

## Transações oficiais

Toda chamada ao Blnk ou ao Redis acontece **depois** do `COMMIT` (DB-07). O `XACK` do Stream só acontece depois do `COMMIT`.

### Tick (Tick Engine, `app_tick`) — 1×/s

```sql
BEGIN;
-- 1. fencing: só o líder da época atual escreve
SELECT last_sequence, last_hash, last_ts
  FROM index_state
 WHERE symbol = $1 AND lease_epoch <= $2      -- $2 = época do lease no Redis
   FOR UPDATE;                                -- 0 linhas → perdi a liderança: ROLLBACK
-- 2. tick (o trigger ticks_chain_guard confere sequence, prev_hash e ts)
INSERT INTO ticks (symbol, sequence, ts, price, prev_hash, hash)
VALUES ($1, $last_sequence + 1, $ts, $price, $last_hash, $hash);
-- 3. estado
UPDATE index_state
   SET last_sequence = last_sequence + 1, last_price = $price,
       last_hash = $hash, last_ts = $ts, lease_epoch = $2
 WHERE symbol = $1;
-- 4. outbox na mesma transação (D-08)
INSERT INTO outbox (topic, aggregate_id, sequence, dedupe_key, payload)
VALUES ('tick', $1, $last_sequence + 1, 'tick:' || $1 || ':' || ($last_sequence + 1), $payload);
COMMIT;
```

### Abertura de contrato (Contract Service, `app_contract`)

```sql
BEGIN;
SELECT set_config('app.user_id', $sub, true);          -- RLS, escopo de transação
-- idempotência: mesma chave → devolve o existente; request_hash diferente → 422
SELECT id, status, request_hash FROM contracts
 WHERE user_id = $sub AND idempotency_key = $key;      -- filtro explícito + RLS
-- tick de entrada oficial, lido da PRIMÁRIA (nunca do corpo do request)
SELECT sequence, ts, price FROM ticks
 WHERE symbol = $symbol ORDER BY sequence DESC LIMIT 1;
INSERT INTO contracts (id, user_id, symbol, direction, stake_minor,
                       entry_price, entry_sequence, expires_at, status,
                       idempotency_key, request_hash)
VALUES ($id, $sub, $symbol, $direction, $stake, $price, $sequence,
        $tick_ts + interval '60 seconds', 'CREATED', $key, $hash)
ON CONFLICT (user_id, idempotency_key) DO NOTHING;
UPDATE contracts SET status = 'PENDING_RESERVE' WHERE id = $id AND status = 'CREATED';
INSERT INTO outbox (topic, aggregate_id, dedupe_key, payload)
VALUES ('wallet:commands', $id, 'reserve:' || $id, $payload);
COMMIT;
-- depois: o Wallet Adapter reserva no Blnk com reference reserve:{id} (B-04)
```

### Liquidação (Settlement Worker, `app_settlement`)

```sql
BEGIN;
SELECT id, symbol, direction, stake_minor, entry_price, expires_at, status
  FROM contracts WHERE id = $1 FOR UPDATE;               -- SETTLED → ACK idempotente
SELECT sequence, price FROM ticks                          -- primeiro tick oficial >= expires_at
 WHERE symbol = $symbol AND ts >= $expires_at
 ORDER BY ts, sequence LIMIT 1;                            -- 0 linhas → não liquida; reagenda
UPDATE contracts
   SET status = 'SETTLED', exit_price = $price, exit_sequence = $seq,
       result = $result, payout_minor = $payout, settled_at = now()
 WHERE id = $1 AND status = 'EXPIRING';                    -- 0 linhas → outro worker liquidou
INSERT INTO outbox (topic, aggregate_id, dedupe_key, payload)
VALUES ('wallet:commands', $1, 'settlement:' || $1, $payload);
COMMIT;
```

### Varredor de contratos vencidos (recupera mensagem perdida no Redis)

```sql
SELECT id FROM contracts
 WHERE status IN ('OPEN','EXPIRING','FAILED_RETRYABLE')
   AND expires_at < now() - interval '30 seconds'          -- PROPOSTO
 ORDER BY expires_at
   FOR UPDATE SKIP LOCKED
 LIMIT 100;
```

### Primeiro login (Wallet Adapter, `app_wallet`)

```sql
-- depois de criar os balances no Blnk e creditar com reference demo-credit:{sub}
INSERT INTO wallet_accounts (user_id, ledger_id, available_balance_id,
                             reserved_balance_id, initial_credit_reference)
VALUES ($sub, $ledger, $available, $reserved, 'demo-credit:' || $sub)
ON CONFLICT (user_id) DO NOTHING;
```

O crédito inicial é idempotente pela `reference` no Blnk. A linha em `wallet_accounts` é só o mapa; ela **não** prova que o crédito aconteceu. Quem prova é a reconciliação.

## Checklist de segurança (go-live)

| # | Controle | Regra |
|---|----------|-------|
| 1 | Sem IP público; SG 5432 só do RDS Proxy | DB-01 |
| 2 | `deletion_protection = true`; snapshot final obrigatório | DB-01, DB-12 |
| 3 | Criptografia KMS CMK em repouso, backups e réplicas | DB-10 |
| 4 | `rds.force_ssl = 1`; clientes `sslmode=verify-full` | DB-09, DB-10 |
| 5 | Master user só break-glass, senha gerenciada pelo RDS no Secrets Manager | DB-05, DB-10 |
| 6 | Uma role por serviço; `UPDATE` por coluna; sem `DELETE` | DB-05 |
| 7 | `REVOKE ALL ... FROM PUBLIC` em database, schema e funções | DB-05 |
| 8 | Triggers append-only em `ticks`, `audit_logs`, `wallet_accounts` | DB-04 |
| 9 | Trigger de máquina de estados em `contracts` | DB-03 |
| 10 | RLS em `contracts` e `wallet_accounts` | DB-06 |
| 11 | Timeouts e `CONNECTION LIMIT` por role | DB-09 |
| 12 | `pgaudit` (DDL, ROLE) e logs sem parâmetros de bind | DB-13 |
| 13 | CloudTrail alertando snapshot compartilhado, delete e modify | DB-13 |
| 14 | Backups automáticos, cross-region e cofre bloqueado cross-account | DB-12 |
| 15 | Restore mensal executado e registrado | DB-12 |
| 16 | Teste de failover em staging executado e registrado | DB-12 |
