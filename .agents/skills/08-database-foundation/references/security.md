# Segurança do banco

O banco tem que se defender de três atacantes: **o bug** (código que manda o dado errado), **a credencial vazada** (alguém com a senha de um serviço) e **o operador** (alguém com acesso administrativo agindo errado ou de má-fé). Cada controle abaixo diz contra qual dos três ele protege.

## Ameaça × controle

| Ameaça | Atacante | Controle | Regra |
|--------|----------|----------|-------|
| Banco acessível da internet | Credencial vazada | Subnet privada; SG só do Proxy; sem IP público | DB-01 |
| Sniffing / MITM | Rede | `rds.force_ssl = 1`; `sslmode=verify-full`; TLS ≥ 1.2 | DB-09, DB-10 |
| Disco ou snapshot copiado | Operador | KMS CMK; política de chave restrita; snapshots criptografados | DB-10 |
| Serviço lê ou altera o que não é dele | Bug, credencial | Uma role por serviço; grants por coluna | DB-05 |
| Usuário A lê o contrato do B | Bug | Filtro na API + RLS fail-closed | DB-06 |
| Reescrever tick, auditoria ou mapa de carteira | Todos | Sem grant **e** trigger `forbid_mutation` | DB-04 |
| Liquidar com preço inventado | Bug | Trigger confere o tick oficial e a primeira ocorrência após `expires_at` | DB-03 |
| Liquidar duas vezes | Bug, concorrência | `FOR UPDATE`; transição `EXPIRING → SETTLED` única; `dedupe_key` na outbox | DB-03, DB-07 |
| SQL injection | Bug | Queries parametrizadas; a role não tem DDL nem `DELETE` | DB-05 |
| Esgotar conexões / query infinita | Bug, abuso | `CONNECTION LIMIT` e timeouts por role | DB-09 |
| Escalar privilégio por função | Credencial | `REVOKE EXECUTE ... FROM PUBLIC`; `SECURITY DEFINER` com `search_path` fixo | DB-05 |
| Pular para outro database | Credencial | `REVOKE CONNECT ... FROM PUBLIC`; sem `dblink`/`postgres_fdw` | DB-05 |
| Desligar trigger ou dar grant às escondidas | Operador | pgaudit (DDL, ROLE) + alerta; master user só break-glass | DB-13 |
| Apagar instância e backups | Operador, conta comprometida | `deletion_protection`; cofre cross-account com Vault Lock | DB-12 |
| Exfiltrar via snapshot compartilhado | Operador | Alerta CloudTrail em `ModifyDBSnapshotAttribute` | DB-13 |
| Vazar segredo em log | Bug | Logs sem parâmetros de bind; segredos nunca gravados em tabela | DB-10, DB-13 |

## Rede

| Item | Configuração |
|------|--------------|
| Subnets | Privadas, em ≥ 2 AZs (exigência do Multi-AZ); sem rota para Internet Gateway |
| `publicly_accessible` | `false` |
| SG do RDS | Ingress TCP 5432 **somente** do SG do RDS Proxy |
| SG do RDS Proxy | Ingress TCP 5432 somente dos SGs dos serviços que usam o banco |
| Egress do RDS | Nenhum além do necessário para a AWS |
| Acesso humano | SSM Session Manager (port forwarding) com MFA, sessão gravada; sem bastion público |
| Endpoints de VPC | Secrets Manager, KMS e logs, para o tráfego não sair da VPC |

## Criptografia e segredos

| Item | Configuração |
|------|--------------|
| Em repouso | `storage_encrypted = true` com **KMS CMK** própria. Só dá para ligar na criação |
| Política da chave | Uso só pelo RDS e pelas roles de backup; administração separada do uso |
| Snapshots e réplicas | Herdam a CMK. Cópia cross-region exige uma CMK na região de destino |
| Em trânsito | `rds.force_ssl = 1`, `ssl_min_protocol_version = TLSv1.2` |
| Clientes | `sslmode=verify-full` + CA bundle do RDS na imagem. Planejar a rotação de CA do RDS |
| Senhas | `password_encryption = scram-sha-256` |
| Master user | Senha gerenciada pelo RDS no Secrets Manager (`manage_master_user_password`). Uso só em break-glass |
| Senhas das roles | Uma secret por role no Secrets Manager, com rotação automática (período: `<não definido no contexto>`) |
| Serviços → Proxy | Autenticação IAM: o token dura 15 min e não existe senha estática no container |
| Proxy → RDS | O Proxy lê a secret de cada role no Secrets Manager |
| Dentro das tabelas | Nenhum token, senha, segredo ou header `Authorization`. Só o `sub` como identidade |

## Roles

Executado uma vez, pelo pipeline de bootstrap, com o master user. Depois disso o master user volta para o cofre.

```sql
-- ===== database e schema =====
REVOKE ALL ON DATABASE synth FROM PUBLIC;
CREATE ROLE synth_owner NOLOGIN;                       -- dono de tudo; ninguém loga como ele
ALTER DATABASE synth OWNER TO synth_owner;
ALTER SCHEMA public OWNER TO synth_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

CREATE ROLE synth_migrator LOGIN IN ROLE synth_owner;  -- só o CI; usa SET ROLE synth_owner

-- Objetos novos não ficam acessíveis por padrão.
ALTER DEFAULT PRIVILEGES FOR ROLE synth_owner IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE synth_owner IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE synth_owner IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- ===== roles de serviço =====
CREATE ROLE app_tick       LOGIN;
CREATE ROLE app_relay      LOGIN;
CREATE ROLE app_candle     LOGIN;
CREATE ROLE app_contract   LOGIN;
CREATE ROLE app_settlement LOGIN;
CREATE ROLE app_wallet     LOGIN;
CREATE ROLE app_chart_ro   LOGIN;
CREATE ROLE app_admin      LOGIN;
CREATE ROLE app_reconciler LOGIN;
CREATE ROLE app_maint      LOGIN;
CREATE ROLE app_monitor    LOGIN;
CREATE ROLE auditor_ro     LOGIN;

GRANT CONNECT ON DATABASE synth TO app_tick, app_relay, app_candle, app_contract,
  app_settlement, app_wallet, app_chart_ro, app_admin, app_reconciler, app_maint,
  app_monitor, auditor_ro;
GRANT USAGE ON SCHEMA public TO app_tick, app_relay, app_candle, app_contract,
  app_settlement, app_wallet, app_chart_ro, app_admin, app_reconciler, app_maint, auditor_ro;

-- No RDS, autenticação IAM exige a role rds_iam.
GRANT rds_iam TO app_tick, app_relay, app_candle, app_contract, app_settlement,
  app_wallet, app_chart_ro, app_admin, app_reconciler, app_maint, app_monitor, auditor_ro;
```

Atributos proibidos em qualquer role de aplicação: `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`, ser membro de `rds_superuser` ou ser dona de objeto.

## Grants

```sql
-- Tick Engine
GRANT SELECT ON indices TO app_tick;
GRANT SELECT, UPDATE (last_sequence, last_price, last_hash, last_ts, lease_epoch) ON index_state TO app_tick;
GRANT SELECT, INSERT ON ticks TO app_tick;
GRANT INSERT ON outbox TO app_tick;

-- Outbox Relay
GRANT SELECT, UPDATE (published_at) ON outbox TO app_relay;

-- Candle Worker
GRANT SELECT ON indices, ticks TO app_candle;
GRANT SELECT, INSERT, UPDATE (high, low, close, volume, last_seq) ON candles TO app_candle;

-- Contract Service / API
GRANT SELECT ON indices, index_state, ticks TO app_contract;
GRANT SELECT, INSERT (id, user_id, symbol, direction, stake_minor, entry_price, entry_sequence,
                      expires_at, status, idempotency_key, request_hash) ON contracts TO app_contract;
GRANT UPDATE (status) ON contracts TO app_contract;
GRANT SELECT ON wallet_accounts TO app_contract;
GRANT INSERT ON outbox, audit_logs TO app_contract;

-- Settlement Worker
GRANT SELECT ON ticks TO app_settlement;
GRANT SELECT, UPDATE (status, exit_price, exit_sequence, result, payout_minor, settled_at)
  ON contracts TO app_settlement;
GRANT INSERT ON outbox TO app_settlement;

-- Wallet Adapter
GRANT SELECT ON contracts TO app_wallet;
GRANT SELECT, INSERT ON wallet_accounts TO app_wallet;
GRANT SELECT, UPDATE (status, blnk_transaction_id) ON admin_reversals TO app_wallet;

-- Chart API (somente leitura)
GRANT SELECT ON indices, ticks, candles TO app_chart_ro;

-- Painel admin
GRANT SELECT ON indices, index_state, ticks, candles, contracts, wallet_accounts,
  reconciliation_runs TO app_admin;
GRANT SELECT, INSERT ON audit_logs TO app_admin;
GRANT SELECT, INSERT (original_reference, user_id, amount_minor, reason, requested_by)
  ON admin_reversals TO app_admin;
GRANT UPDATE (status, approved_by, approved_at) ON admin_reversals TO app_admin;

-- Reconciliação (lê da PRIMÁRIA — DB-08)
GRANT SELECT ON index_state, ticks, contracts, wallet_accounts, admin_reversals TO app_reconciler;
GRANT SELECT, INSERT (status, checks, divergence_minor) ON reconciliation_runs TO app_reconciler;
GRANT UPDATE (finished_at, status, checks, divergence_minor) ON reconciliation_runs TO app_reconciler;

-- Manutenção: só a função de purga
GRANT EXECUTE ON FUNCTION outbox_purge(interval, integer) TO app_maint;

-- Monitoramento: catálogo e estatísticas, sem ler dados de negócio
GRANT pg_monitor TO app_monitor;

-- Auditoria: lista explícita (não usar ON ALL TABLES — não cobre tabelas futuras)
GRANT SELECT ON indices, index_state, ticks, candles, outbox, contracts, wallet_accounts,
  audit_logs, admin_reversals, reconciliation_runs TO auditor_ro;
```

Colunas com `IDENTITY` não precisam de grant na sequence (diferente de `bigserial`). Colunas preenchidas por trigger (`updated_at`) também não precisam de grant de `UPDATE`.

## RLS (DB-06)

```sql
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;
-- Não usar FORCE: o owner (migrations) continua sem RLS; nenhum serviço é owner.

-- Usuário final, via API: fail-closed (sem app.user_id → NULL → nenhuma linha)
CREATE POLICY contracts_own ON contracts FOR ALL TO app_contract
  USING      (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));
CREATE POLICY wallet_own ON wallet_accounts FOR SELECT TO app_contract
  USING (user_id = current_setting('app.user_id', true));

-- Serviços de sistema operam sobre todos os usuários
CREATE POLICY contracts_system ON contracts FOR ALL TO app_settlement USING (true) WITH CHECK (true);
CREATE POLICY contracts_read   ON contracts FOR SELECT
  TO app_wallet, app_admin, app_reconciler, auditor_ro USING (true);
CREATE POLICY wallet_system ON wallet_accounts FOR ALL TO app_wallet USING (true) WITH CHECK (true);
CREATE POLICY wallet_read   ON wallet_accounts FOR SELECT
  TO app_admin, app_reconciler, auditor_ro USING (true);
```

Uso correto: `SELECT set_config('app.user_id', $sub, true)` como **primeira instrução de cada transação**. O terceiro argumento `true` limita o valor à transação. `SET app.user_id` (de sessão) atrás de pooler vaza a identidade para a próxima requisição.

Pooler: com PgBouncer em modo `transaction`, `set_config(..., true)` é seguro. Com RDS Proxy, validar em staging se a chamada causa *pinning* de sessão, porque isso reduz o ganho de multiplexação, mas não a segurança.

## Configuração por role (PROPOSTO — alinhar com R-02 da 05)

```sql
ALTER ROLE app_tick       SET statement_timeout = '500ms';  -- orçamento de 1 tick/s
ALTER ROLE app_tick       SET lock_timeout      = '200ms';
ALTER ROLE app_contract   SET statement_timeout = '2s';
ALTER ROLE app_contract   SET lock_timeout      = '1s';
ALTER ROLE app_settlement SET statement_timeout = '5s';
ALTER ROLE app_settlement SET lock_timeout      = '2s';
ALTER ROLE app_chart_ro   SET statement_timeout = '3s';
ALTER ROLE app_chart_ro   SET default_transaction_read_only = on;
ALTER ROLE auditor_ro     SET statement_timeout = '30s';
ALTER ROLE auditor_ro     SET default_transaction_read_only = on;
ALTER ROLE app_reconciler SET statement_timeout = '60s';
ALTER ROLE synth_migrator SET lock_timeout      = '5s';

-- transação esquecida aberta trava vacuum e locks
ALTER ROLE app_tick       SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE app_contract   SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE app_settlement SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE app_wallet     SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE app_admin      SET idle_in_transaction_session_timeout = '10s';

ALTER ROLE app_tick       CONNECTION LIMIT 5;
ALTER ROLE app_relay      CONNECTION LIMIT 5;
ALTER ROLE app_candle     CONNECTION LIMIT 5;
ALTER ROLE app_contract   CONNECTION LIMIT 40;
ALTER ROLE app_settlement CONNECTION LIMIT 20;
ALTER ROLE app_wallet     CONNECTION LIMIT 20;
ALTER ROLE app_chart_ro   CONNECTION LIMIT 20;
ALTER ROLE app_admin      CONNECTION LIMIT 10;
ALTER ROLE app_reconciler CONNECTION LIMIT 3;
ALTER ROLE app_maint      CONNECTION LIMIT 1;
ALTER ROLE auditor_ro     CONNECTION LIMIT 3;
```

`ALTER ROLE ... SET` aceita uma role por comando. O valor vale para conexões **novas**: depois de alterar, reciclar o pool do serviço.

## Databases vizinhos

```sql
-- database keycloak
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
CREATE ROLE keycloak_owner LOGIN;            -- o Keycloak roda as próprias migrations
ALTER DATABASE keycloak OWNER TO keycloak_owner;

-- database blnk
REVOKE ALL ON DATABASE blnk FROM PUBLIC;
CREATE ROLE blnk_owner LOGIN;                -- o Blnk roda as próprias migrations
ALTER DATABASE blnk OWNER TO blnk_owner;
```

- Nenhuma role `app_*` recebe `CONNECT` em `keycloak` ou `blnk`.
- A plataforma **nunca** lê o banco do Blnk direto: o acesso é sempre pela API dele (`D-02`). A reconciliação também usa a API.
- `auditor_ro` não tem acesso a `keycloak` (hashes de senha) nem a `blnk`.

## Auditoria do banco

| Fonte | O que registra | Destino |
|-------|----------------|---------|
| `pgaudit` (`pgaudit.log = 'ddl, role'`) | `CREATE`, `ALTER`, `DROP`, `GRANT`, `REVOKE`, `ALTER ROLE` | CloudWatch Logs → Loki |
| Logs do PostgreSQL | Conexões, desconexões, lock waits, queries lentas **sem parâmetros** | CloudWatch Logs → Loki |
| CloudTrail | API do RDS: delete, modify, snapshot, parâmetros, compartilhamento | Trilha da organização |
| Eventos do RDS | Failover, reboot, manutenção, backup, storage | SNS → Alertmanager |
| `audit_logs` (tabela) | Ações de negócio de usuários e admins | O próprio banco + export |

No RDS, o pgaudit é configurado pela role `rds_pgaudit` e pelo parameter group. Seguir a documentação oficial da AWS da versão escolhida.

## Break-glass

1. Abrir um incidente com motivo e prazo.
2. Ler a secret do master user, o que gera evento no CloudTrail e dispara alerta.
3. Conectar via SSM com MFA.
4. **Preferir `auditor_ro`.** O master só entra quando a ação exige.
5. Toda ação fica registrada no pgaudit e é anexada ao incidente.
6. No fim: rotacionar a senha do master e revisar a saída do pgaudit em par.
