---
name: 08-database-foundation
description: >
  Trigger: "banco de dados", "PostgreSQL", "RDS", "schema", "migration", "GRANT", "RLS", "réplica", "PITR", "failover". Ativar antes de criar, alterar ou revisar schema, roles, conexões ou infraestrutura do PostgreSQL.
version: 1.0.0
---

# 08-database-foundation

Base do banco de dados da **Plataforma de Índices Sintéticos — Fase 1**.
Define **o que existe** no PostgreSQL, **o que não existe**, quem pode tocar em quê e quais mecanismos impedem, **dentro do próprio banco**, que um bug ou um invasor corrompa dinheiro demo, preço ou auditoria.
Decisões herdadas de `01-project-context`: `D-02` (Blnk é o ledger), `D-05` (PostgreSQL = estado forte), `D-08` (tick + outbox na mesma transação), `D-12` (`Idempotency-Key`), `D-15` (Docker Compose).
Decisão proposta por esta skill: **`D-17` — PostgreSQL gerenciado (AWS RDS Multi-AZ) em staging e prod** (status `Pendente` em `01-project-context`).

## Mentalidade

| Regra | Pergunta mental aplicada ao banco |
|-------|-----------------------------------|
| O banco é a última linha de defesa | Se a API tiver um bug, o banco recusa o dado errado ou grava em silêncio? |
| Menor privilégio por serviço | Se a credencial deste serviço vazar, o que o invasor consegue apagar ou alterar? |
| Histórico não se reescreve | Existe algum caminho, mesmo como owner, para editar um tick ou um registro de auditoria sem deixar rastro? |
| Uma fonte de verdade por dado | Este saldo, preço ou estado mora em **um** lugar só, ou em dois que podem divergir? |
| Backup não testado não existe | Quando foi o último restore, para qual instante, e a reconciliação fechou depois? |

## Regras de ativação

**Ativar quando o pedido contém:**

- "schema", "tabela", "coluna", "índice", "constraint", "CHECK", "FOREIGN KEY", "trigger", "particionar"
- "migration", "expand/contract", "ALTER TABLE", "seed"
- "role", "GRANT", "REVOKE", "permissão no banco", "RLS", "row level security", "usuário do banco"
- "RDS", "Multi-AZ", "failover", "réplica", "read replica", "RDS Proxy", "PgBouncer", "pool de conexões"
- "PITR", "snapshot", "restore", "disaster recovery", "cross-region", "KMS", "TLS do banco"
- "lento", "lock", "deadlock", "vacuum", "conexões esgotadas", "disco do banco"
- Revisão de qualquer PR que altere `db/migrations/`, parâmetros do banco ou a infraestrutura do PostgreSQL

**Não ativar quando:**

- Regras de dinheiro em si (dupla entrada, reversão, reconciliação): usar `02-financial-invariants`. Esta skill só garante que o banco **aplica** essas regras.
- Formato do tick, CSPRNG e cálculo do hash: usar `03-synthetic-market-engine`.
- Keycloak, JWT e RBAC da API: usar `04-security-iam`. Esta skill cuida das roles **do PostgreSQL**.
- Retry, timeout e circuit breaker do lado do cliente: usar `05-resilience-patterns`.
- Pipeline, Compose, alertas gerais e rollback de imagem: usar `07-production-operations`.

## Topologia

```text
                     VPC — subnets privadas, sem IP público
 ┌───────────────────────────────────────────────────────────────────────┐
 │  serviços ──TLS + IAM──▶ RDS Proxy ──TLS──▶ RDS PostgreSQL Multi-AZ   │
 │                                            ┌────────────────────────┐ │
 │                                            │ database synth    (nós)│ │
 │                                            │ database blnk  (Blnk)  │ │
 │                                            │ database keycloak (KC) │ │
 │                                            └───────────┬────────────┘ │
 │                         standby síncrono (outra AZ) ◀──┤              │
 │                         read replica (opcional)    ◀───┘              │
 └───────────────────────────────────────────────────────────────────────┘
   backups automáticos + PITR ──▶ cópia cross-region ──▶ cofre cross-account bloqueado
```

- **Uma instância, três databases.** O `synth` é nosso. O `blnk` é do Blnk e o `keycloak` é do Keycloak, cada um com seu owner. Nenhuma role de um database conecta nos outros.
- **Por que a mesma instância:** o PITR restaura **a instância inteira para o mesmo instante**. Isso atende de graça a regra O-05 ("plataforma e Blnk restaurados para o mesmo instante").
- **Redis gerenciado fica fora daqui.** Ele **não** é fonte de verdade (`D-05`). Veja o edge case "ElastiCache sem AOF".

## O que entra e o que não entra

| Entra no database `synth` | Por quê |
|---------------------------|---------|
| `indices`, `index_state` | Catálogo do índice + estado do líder com fencing (`lease_epoch`) |
| `ticks` | Preço oficial, append-only, hash encadeado (`M-04`) |
| `candles` | OHLCV derivado; pode ser reconstruído a partir de `ticks` |
| `outbox` | Persistir antes de publicar (`D-08`) |
| `contracts` | Estado do contrato + `Idempotency-Key` (`D-12`) |
| `wallet_accounts` | Mapa `sub` → `balance_id` do Blnk. **Sem saldo** |
| `audit_logs` | Trilha de auditoria append-only |
| `admin_reversals` | Pedido, aprovação e execução de correção (`I-06`) |
| `reconciliation_runs` | Resultado de cada reconciliação (`I-05`) |

| **Não entra** | Por quê / onde mora |
|---------------|---------------------|
| Tabelas de ledger, `balances`, `wallets.balance` | O Blnk é o ledger (`D-02`). Um saldo copiado **vai** divergir |
| `users`, senhas, sessões, MFA | Keycloak (`D-01`). Aqui só existe o `sub` |
| Tabela genérica `idempotency_keys` | `UNIQUE (user_id, idempotency_key)` em `contracts` resolve na Fase 1 |
| Tabela `processed_messages` / inbox | O consumidor é idempotente pelo estado do contrato (`FOR UPDATE`) e pela `reference` do Blnk |
| TimescaleDB, sharding, multi-região ativo-ativo | O volume da Fase 1 cabe numa instância (ver `references/operations.md`) |
| Particionamento | Não é necessário na Fase 1. A estratégia já fica definida para quando for preciso |
| Read replica obrigatória | Opcional. Só vale quando houver leitura pesada de relatório |
| Soft delete (`deleted_at`) | Nada é apagado; o estado muda por `status` |
| Extensões `dblink`, `postgres_fdw`, linguagens não confiáveis | Abrem caminho entre databases ou para o sistema operacional |
| ORM com `synchronize`/auto-migrate | Schema só muda por migration versionada (DB-11) |

## Regras

### DB-01 — Topologia e rede

- **Definição:** RDS PostgreSQL **Multi-AZ** em prod (proposta `D-17`). Subnets privadas, `publicly_accessible = false`. O Security Group aceita 5432 **somente** do SG do RDS Proxy.
- **Pergunta mental:** de qual endereço da internet alguém consegue abrir conexão TCP com este banco? A resposta tem que ser "nenhum".
- **Como verificar:** IaC sem `0.0.0.0/0` na porta 5432; acesso humano só por SSM port forwarding com MFA, sem bastion com IP público; `deletion_protection = true`.
- **Violação típica:** "abre o 5432 para o meu IP só hoje"; RDS na subnet pública para facilitar o DBeaver.

### DB-02 — Tipos

- **Definição:** dinheiro em `bigint` (centavos, `*_minor`); preço em `numeric(18,6)` **igual** em `ticks`, `index_state` e `contracts`; tempo sempre `timestamptz` com o servidor em UTC; IDs públicos em `uuid`; IDs internos com `GENERATED ALWAYS AS IDENTITY`.
- **Pergunta mental:** a comparação `exit_price > entry_price` pode mudar de resultado por arredondamento entre duas colunas?
- **Proibido:** `real`, `double precision`, `money`, `timestamp` sem fuso, `numeric` sem escala em preço.
- **Violação típica:** `ticks.price numeric` (escala livre) comparado com `contracts.entry_price numeric(18,6)`.

### DB-03 — Integridade declarada no banco

- **Definição:** toda regra que o banco consegue expressar é expressa nele: `PRIMARY KEY` em toda tabela, `FOREIGN KEY`, `NOT NULL`, `CHECK` e `UNIQUE`. O contrato só aceita as transições oficiais por trigger (`contracts_guard`), tem colunas imutáveis depois de criado e o preço de entrada e de saída **precisa** existir em `ticks`.
- **Pergunta mental:** se o código mandar `UPDATE contracts SET result = 'WIN'` num contrato `OPEN`, o banco aceita?
- **DDL completo:** `references/schema.md`.
- **Violação típica:** máquina de estados só no TypeScript; `entry_price` gravado a partir do corpo do request.

### DB-04 — Append-only

- **Definição:** `ticks`, `audit_logs` e `wallet_accounts` não aceitam `UPDATE`, `DELETE` nem `TRUNCATE`. Duas camadas: nenhum `GRANT` para isso **e** trigger `forbid_mutation()` que recusa até o owner.
- **Pergunta mental:** se a credencial do migrator vazar, o invasor consegue reescrever o histórico sem disparar alerta?
- **Como verificar:** teste de integração tenta `UPDATE`/`DELETE`/`TRUNCATE` com cada role e espera erro; `DISABLE TRIGGER` e `session_replication_role` aparecem no pgaudit e geram alerta.
- **Violação típica:** "só um `UPDATE` para corrigir um tick errado"; retenção feita com `DELETE` em `audit_logs`.

### DB-05 — Menor privilégio

- **Definição:** owner `synth_owner` **NOLOGIN** é dono de tudo. `synth_migrator` só roda no CI. Cada serviço tem **uma role** com exatamente as tabelas e **colunas** de que precisa. Nenhuma role de aplicação tem `DELETE`, `TRUNCATE`, DDL, `SUPERUSER`, `BYPASSRLS` ou é dona de objeto. O usuário master do RDS é break-glass.
- **Pergunta mental:** qual é o pior `UPDATE` que esta role consegue rodar?
- **Matriz e DDL:** `references/security.md`.
- **Violação típica:** `GRANT UPDATE ON contracts` sem lista de colunas; serviço conectando como `postgres`; função `SECURITY DEFINER` executável por `PUBLIC`.

### DB-06 — Isolamento por usuário

- **Definição:** a API filtra por `sub` (`04-security-iam`) **e**, como defesa em profundidade, `contracts` tem RLS. A role `app_contract` só enxerga linhas onde `user_id = current_setting('app.user_id', true)`. Sem a variável, nenhuma linha aparece (fail-closed).
- **Pergunta mental:** se um endpoint esquecer o `WHERE user_id = $1`, o usuário A lê o contrato do B?
- **Como verificar:** `set_config('app.user_id', $sub, true)` no início de **cada** transação, com escopo de transação e nunca de sessão; teste A/B direto no banco.
- **Violação típica:** `SET app.user_id` de sessão atrás de pooler, que vaza a identidade para a próxima requisição.

### DB-07 — Transações e concorrência

- **Definição:** transações curtas; **nenhuma chamada externa** (Blnk, Redis, HTTP) com transação aberta; `SELECT ... FOR UPDATE` no contrato antes de liquidar; varredura com `FOR UPDATE SKIP LOCKED`; fencing do líder por `lease_epoch` em `index_state`.
- **Pergunta mental:** se dois workers pegarem o mesmo contrato no mesmo milissegundo, quantas liquidações saem?
- **Receitas SQL:** `references/api-guide.md`, seção "Transações oficiais".
- **Violação típica:** `BEGIN; ... await blnk.post(...); COMMIT;`; `SELECT` sem lock seguido de `UPDATE`.

### DB-08 — Leitura em réplica

- **Definição:** réplica serve **só** leitura tolerante a atraso: candles, histórico do gráfico, listagens do admin com aviso e relatórios. Settlement, abertura de contrato, conferência de idempotência, reconciliação e qualquer leitura seguida de escrita usam **sempre a primária**.
- **Pergunta mental:** se a réplica estiver 30 s atrasada, este código toma uma decisão financeira errada?
- **Violação típica:** settlement lendo o tick de saída da réplica para aliviar a primária. O tick ainda não chegou, o contrato fica preso ou é liquidado com outro tick.

### DB-09 — Conexões

- **Definição:** serviços conectam via **RDS Proxy** (ou PgBouncer em modo `transaction`). TLS com `sslmode=verify-full` e o CA bundle do RDS. Orçamento de conexões por role (`CONNECTION LIMIT`) e timeouts por role (`statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`).
- **Pergunta mental:** se o Keycloak tiver um pico de login, o settlement ainda consegue conexão?
- **Valores propostos:** `references/security.md`, seção "Configuração por role".
- **Violação típica:** `sslmode=require` (cifra, mas não valida o servidor); pool de 100 conexões por réplica de serviço.

### DB-10 — Criptografia e segredos

- **Definição:** criptografia em repouso com **KMS CMK** (só dá para ligar na criação); `rds.force_ssl = 1`; credenciais no Secrets Manager com rotação automática; serviços autenticam no Proxy por IAM, sem senha estática no container; nenhum segredo, token ou senha gravado em tabela.
- **Pergunta mental:** um snapshot copiado para outra conta é legível sem a nossa chave?
- **Violação típica:** `storage_encrypted = false` "porque é demo"; `DATABASE_URL` com senha no `.env` versionado.

### DB-11 — Migrations

- **Definição:** só por arquivo versionado `NNNN_descricao.up.sql` + `.down.sql`, aplicado pelo CI com `synth_migrator` (`SET ROLE synth_owner`). Usa expand/contract (O-02). Arquivo já aplicado é **imutável**. Toda migration abre com `lock_timeout` e `statement_timeout`. Índice em tabela com dados usa `CONCURRENTLY`; constraint nova usa `NOT VALID` + `VALIDATE`.
- **Pergunta mental:** esta migration trava o Tick Engine por mais de 1 s?
- **Procedimento:** `references/operations.md`, seção "Migrations".
- **Violação típica:** editar a `0003` já aplicada; `ALTER COLUMN TYPE` que reescreve `ticks` em produção.

### DB-12 — Backup, PITR e DR

- **Definição:** backups automáticos com PITR; cópia cross-region; cópia diária num **cofre AWS Backup em outra conta, com Vault Lock**; restore testado todo mês (O-05). Correção de dado financeiro nunca é feita restaurando backup (O-06, `I-06`).
- **Pergunta mental:** se alguém com acesso de admin à conta AWS apagar a instância e os snapshots, de onde eu volto?
- **RPO/RTO e runbook:** `references/ha-dr.md`.
- **Violação típica:** retenção 0; snapshot só na mesma região e na mesma conta; "restaurar o banco de ontem" para corrigir um saldo.

### DB-13 — Observabilidade e auditoria do banco

- **Definição:** `pg_stat_statements` + `pgaudit` (DDL e ROLE) ligados; logs sem parâmetros de bind; métricas no Prometheus (`D-14`) via `postgres_exporter` com role `app_monitor`; eventos do RDS e CloudTrail alertando failover, alteração de parâmetro e snapshot compartilhado.
- **Pergunta mental:** se alguém der `GRANT DELETE` às 3h, quem fica sabendo e quando?
- **Alertas:** `references/operations.md`, seção "Alertas do banco".
- **Violação típica:** `log_statement = 'all'`, que grava dados de outros databases da instância nos logs.

### DB-14 — Retenção

- **Definição:** `ticks`, `contracts`, `audit_logs`, `admin_reversals` e `reconciliation_runs` são mantidos (prazo legal: `<não definido no contexto>`). `outbox` publicada é purgada depois de 7 dias (PROPOSTO), **só** pela função `outbox_purge()`. Linha não publicada nunca é purgada.
- **Pergunta mental:** a limpeza consegue apagar uma mensagem que ainda não saiu?
- **Violação típica:** `DELETE FROM outbox WHERE created_at < now() - '1 day'` sem olhar `published_at`.

## Divergências com o contexto atual

Encontradas ao consolidar o banco. Cada uma precisa ser resolvida **antes da primeira migration de produção**, porque depois o custo é reescrever tabela.

| # | Onde | Divergência | Proposta |
|---|------|-------------|----------|
| 1 | `03` `ticks.price`, `index_state.last_price` | `numeric` sem escala × `contracts.entry_price numeric(18,6)` | `numeric(18,6)` em todos (DB-02) |
| 2 | `04` roles | `UPDATE` na tabela inteira para `app_contract` e `app_settlement` | `UPDATE` por coluna + trigger por role (DB-05) |
| 3 | `backend` `audit_logs` | Colunas não batem com os "campos mínimos" da `04` | Schema alinhado em `references/schema.md` |
| 4 | Wallet Adapter | Nenhuma tabela mapeia `sub` → `balance_id` | Nova `wallet_accounts`, sem saldo |
| 5 | `backend` fluxo | `expires_at = now() + 60 s` usa o relógio da API, mas o tick de saída usa o relógio do Tick Engine | `expires_at = ts do tick de entrada + 60 s`, aplicado pelo trigger. PROPOSTO |
| 6 | `D-15` | Docker Compose em prod × banco gerenciado | `D-17` pendente: Compose em dev; RDS em staging e prod |
| 7 | `07` O-05 | pgBackRest/WAL-G propostos | Substituídos pelo PITR do RDS + AWS Backup se `D-17` for aprovada |
| 8 | `04` `auditor_ro` | `GRANT ... ON ALL TABLES` não cobre tabelas futuras | Grants explícitos + `ALTER DEFAULT PRIVILEGES` |
| 9 | `03` `outbox` | Sem chave de deduplicação | Coluna `dedupe_key UNIQUE` determinística |

## Instruções

**Modo implementação** (`backend-implementation-agent`):

1. Localizar a tabela no catálogo "O que entra". Se ela não está lá, **parar**: tabela nova exige justificativa e passa por esta skill.
2. Escrever a migration seguindo DB-02, DB-03 e DB-11, junto com o `.down.sql`.
3. Na mesma migration: grants por coluna (DB-05), trigger append-only ou de estado quando couber (DB-03, DB-04) e RLS se a tabela tiver `user_id` (DB-06).
4. Para todo acesso novo: escolher primária ou réplica (DB-08), declarar a role e conferir o orçamento de conexões (DB-09).
5. Pedir ao `qa-resilience-agent` os testes de "role proibida" (UPDATE/DELETE/TRUNCATE recusados) e de RLS A/B.
6. Informação ausente (prazo de retenção, versão do PostgreSQL, ferramenta de migration) → `<não definido no contexto>`, nunca um valor inventado.

**Modo revisão** (`security-reviewer` para DB-01, DB-05, DB-06, DB-10, DB-13; `financial-correctness-reviewer` para DB-02, DB-03, DB-04, DB-07, DB-08; `qa-resilience-agent` para DB-12):

1. Para cada regra DB-01 a DB-14, marcar `PASS`, `FAIL` ou `N/A`.
2. Todo `FAIL` cita arquivo e linha e descreve o impacto: no dinheiro, no preço, na auditoria ou na disponibilidade.
3. Severidade: `CRÍTICO` (banco exposto, histórico mutável, saldo duplicado, credencial de owner em serviço, backup inexistente), `ALTO` (grant amplo, réplica em decisão financeira, migration que trava tabela quente), `MÉDIO` (tipo frouxo, timeout ausente), `BAIXO` (melhoria).
4. Rodar `scripts/health-check.sh` e anexar a saída.

## Formato de saída

```text
SKILL: 08-database-foundation
MODO: IMPLEMENTAÇÃO | REVISÃO
AMBIENTE: dev | staging | prod | todos
ESCOPO ANALISADO: <migrations, IaC, configuração>

DB-01 Topologia e rede      : PASS | FAIL | N/A — <evidência>
DB-02 Tipos                 : PASS | FAIL | N/A — <evidência>
DB-03 Integridade           : PASS | FAIL | N/A — <evidência>
DB-04 Append-only           : PASS | FAIL | N/A — <evidência>
DB-05 Menor privilégio      : PASS | FAIL | N/A — <evidência>
DB-06 Isolamento (RLS)      : PASS | FAIL | N/A — <evidência>
DB-07 Transações            : PASS | FAIL | N/A — <evidência>
DB-08 Réplica               : PASS | FAIL | N/A — <evidência>
DB-09 Conexões              : PASS | FAIL | N/A — <evidência>
DB-10 Criptografia/segredos : PASS | FAIL | N/A — <evidência>
DB-11 Migrations            : PASS | FAIL | N/A — <evidência>
DB-12 Backup/DR             : PASS | FAIL | N/A — <evidência>
DB-13 Observabilidade       : PASS | FAIL | N/A — <evidência>
DB-14 Retenção              : PASS | FAIL | N/A — <evidência>

ACHADOS:
- [CRÍTICO|ALTO|MÉDIO|BAIXO] <arquivo:linha> — <problema> — impacto: <descrição> — viola <DB-xx>

MIGRATION: reversível (<arquivo .down.sql>) | irreversível — <justificativa e plano>
PENDÊNCIAS: <itens <não definido no contexto> ou "nenhuma">
VEREDITO: APROVADO | REPROVADO
```

## Exemplos

Exemplo curto:

```text
Entrada: "revisar 0007_settlement.up.sql" — trecho:
  GRANT SELECT, UPDATE ON contracts TO app_settlement;
  GRANT DELETE ON outbox TO app_relay;

DB-05 Menor privilégio : FAIL — 0007:1 UPDATE sem colunas; 0007:2 DELETE para role de aplicação
ACHADOS:
- [ALTO] 0007_settlement.up.sql:1 — app_settlement pode alterar user_id, stake e entry_price —
  impacto: um bug ou credencial vazada reescreve o contrato antes da liquidação — viola DB-05
- [CRÍTICO] 0007_settlement.up.sql:2 — relay pode apagar mensagem não publicada —
  impacto: comando financeiro perdido sem rastro — viola DB-05, DB-14
VEREDITO: REPROVADO
```

Exemplos completos: `examples/example-1.md` (migration de `admin_reversals`) e `examples/example-2.md` (failover Multi-AZ durante liquidação).

## Edge cases

- **Failover Multi-AZ (60 a 120 s):** a primária some, o Tick Engine não consegue persistir e por isso **não publica** (`D-08`). O resultado é um buraco no tempo, sem buraco de `sequence`. Contratos que vencem nesse intervalo liquidam com o **primeiro tick depois** do retorno (B-08). Nunca inventar DRAW.
- **Commit com resultado desconhecido:** a conexão cai no meio do `COMMIT`. O cliente repete com a mesma `Idempotency-Key`; o `UNIQUE (user_id, idempotency_key)` garante que nada duplica.
- **Relógios diferentes:** `expires_at` gerado pela API e `ticks.ts` gerado pelo Tick Engine vêm de relógios diferentes. Por isso a proposta é derivar `expires_at` do `ts` do tick de entrada (divergência 5). NTP continua obrigatório.
- **`id` da outbox fora de ordem de commit:** transações concorrentes fazem commit fora da ordem dos IDs. O relay não pode assumir sequência sem buraco; consumidores de tick ordenam por `sequence`.
- **ElastiCache sem AOF:** Redis gerenciado replica de forma assíncrona e pode perder mensagens pendentes no failover. O varredor de contratos vencidos (`SKIP LOCKED` na primária) recupera o que o Stream perdeu. Alternativa durável: MemoryDB (decisão da `07`).
- **Restore do Keycloak:** como os três databases voltam juntos, usuários criados depois do instante restaurado somem, junto com as carteiras deles. Reconciliar `wallet_accounts` × Keycloak antes de reabrir.
- **Vizinho barulhento:** Keycloak e Blnk dividem CPU e IO com o `synth`. Os limites de conexão por role e o alerta de CPU indicam a hora de separar o Keycloak em outra instância.
- **XID wraparound:** transação esquecida aberta impede o vacuum. `idle_in_transaction_session_timeout` por role e o alerta `PostgresXidAgeHigh` cobrem.
- **Major upgrade:** usar RDS Blue/Green Deployments. Antes, validar a compatibilidade de Keycloak e Blnk com a versão nova; a troca derruba as conexões por alguns segundos.
- **Snapshot compartilhado:** `ModifyDBSnapshotAttribute` tornando um snapshot público ou de outra conta é exfiltração clássica. Alerta crítico via CloudTrail.
- **Dev sem RDS:** em dev, o Compose sobe o mesmo major do PostgreSQL com o **mesmo script de roles** e as mesmas migrations. Porta só em `127.0.0.1` (O-01).

## Modos de falha cobertos

| Modo de falha | Mitigação nesta skill |
|---------------|-----------------------|
| Falha de ativação | Triggers de schema, migration, role, RDS, réplica, PITR e failover |
| Ativação espúria | Fronteiras com `02`, `03`, `04`, `05` e `07` em "Não ativar quando" |
| Execução parcial | Saída exige status para DB-01 a DB-14, reversibilidade da migration e pendências |
| Deriva de instrução | DDL, roles, parâmetros e runbooks fixos em `references/` |
| Conflito de tools | Blnk dono do ledger (`D-02`); Keycloak dono da identidade (`D-01`); `D-17` explícita como pendente |
| Context overflow | DDL completo e procedimentos em `references/`; casos completos em `examples/` |
| Feedback loop negativo | Restore nunca é correção; histórico protegido por grant **e** trigger |

## Recursos

- Índice, catálogo de tabelas, matriz de acesso e transações oficiais: `references/api-guide.md`
- DDL completo do database `synth`: `references/schema.md`
- Roles, grants, RLS, rede, criptografia, segredos e auditoria: `references/security.md`
- Multi-AZ, réplica, backups, PITR, DR e runbook de restore: `references/ha-dr.md`
- Migrations, dimensionamento, parâmetros, manutenção e alertas: `references/operations.md`
- Exemplos completos: `examples/example-1.md`, `examples/example-2.md`
- Casos de teste: `tests/test-case-1.md`, `tests/expected-output-1.md`, `tests/test-case-2.md`, `tests/expected-output-2.md`
- Validação da estrutura: `scripts/validate.sh`
- Varredura de migrations, IaC e configuração: `scripts/health-check.sh`
