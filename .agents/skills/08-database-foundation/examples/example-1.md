# Exemplo 1 — Migration da tabela `admin_reversals` (modo implementação)

## Entrada

> "Preciso guardar as correções do admin (I-06). O admin pede, outro admin aprova e o Wallet Adapter executa no Blnk. Cria a tabela."

## Raciocínio aplicado

1. **Catálogo:** `admin_reversals` está em "O que entra". Não é tabela nova fora do desenho.
2. **DB-02:** valor em `bigint` (`amount_minor`); tempo em `timestamptz`.
3. **DB-03:** uma reversão por transação original (`UNIQUE`); a `reference` da reversão é **derivada** (coluna gerada), então ninguém escolhe uma chave arbitrária; quem pede não aprova; `EXECUTED` exige o ID da transação no Blnk.
4. **DB-05:** o admin insere o pedido e altera só os campos de aprovação; o Wallet Adapter altera só os campos de execução; ninguém apaga.
5. **DB-11:** a tabela é nova e vazia, então não há risco de lock. O `.down.sql` é seguro **só** enquanto a tabela não tem dado real.
6. **Pendência:** a aprovação dupla depende de decisão da `04`. A constraint entra porque não atrapalha um fluxo com um só aprovador diferente de quem pediu.

## Saída

`db/migrations/0009_admin_reversals.up.sql`:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';
SET ROLE synth_owner;

CREATE TABLE admin_reversals (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  original_reference   text        NOT NULL UNIQUE,
  reversal_reference   text        GENERATED ALWAYS AS ('reversal:' || original_reference) STORED UNIQUE,
  user_id              text        NOT NULL REFERENCES wallet_accounts (user_id),
  amount_minor         bigint      NOT NULL CHECK (amount_minor > 0),
  reason               text        NOT NULL CHECK (length(reason) >= 10),
  requested_by         text        NOT NULL,
  requested_at         timestamptz NOT NULL DEFAULT now(),
  approved_by          text,
  approved_at          timestamptz,
  status               text        NOT NULL DEFAULT 'REQUESTED'
                       CHECK (status IN ('REQUESTED','APPROVED','REJECTED','EXECUTED','FAILED')),
  blnk_transaction_id  text,
  CHECK (approved_by IS NULL OR approved_by <> requested_by),
  CHECK (status NOT IN ('APPROVED','EXECUTED') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK ((status = 'EXECUTED') = (blnk_transaction_id IS NOT NULL))
);

CREATE TRIGGER admin_reversals_no_delete BEFORE DELETE ON admin_reversals
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER admin_reversals_no_truncate BEFORE TRUNCATE ON admin_reversals
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

GRANT SELECT, INSERT (original_reference, user_id, amount_minor, reason, requested_by)
  ON admin_reversals TO app_admin;
GRANT UPDATE (status, approved_by, approved_at) ON admin_reversals TO app_admin;
GRANT SELECT, UPDATE (status, blnk_transaction_id) ON admin_reversals TO app_wallet;
GRANT SELECT ON admin_reversals TO app_reconciler, auditor_ro;
```

`db/migrations/0009_admin_reversals.down.sql`:

```sql
SET lock_timeout = '5s';
SET ROLE synth_owner;
-- Seguro só antes de existir dado real. Depois disso, a remoção vira decisão de incidente.
DROP TABLE admin_reversals;
```

Testes pedidos ao `qa-resilience-agent`:

- `app_admin` tenta `UPDATE admin_reversals SET amount_minor = 1` e recebe `permission denied`.
- `app_wallet` tenta `DELETE` e recebe `permission denied`. O owner tenta `DELETE` e recebe `append-only`.
- Duas inserções com o mesmo `original_reference`: a segunda recebe `unique_violation`.
- `approved_by = requested_by` recebe `check_violation`.
- `status = 'EXECUTED'` sem `blnk_transaction_id` recebe `check_violation`.

```text
SKILL: 08-database-foundation
MODO: IMPLEMENTAÇÃO
AMBIENTE: todos
ESCOPO ANALISADO: db/migrations/0009_admin_reversals.up.sql, .down.sql

DB-01 Topologia e rede      : N/A — sem mudança de infraestrutura
DB-02 Tipos                 : PASS — amount_minor bigint; timestamptz
DB-03 Integridade           : PASS — UNIQUE na origem; reference gerada; CHECKs de aprovação e execução
DB-04 Append-only           : PASS — DELETE e TRUNCATE recusados por trigger
DB-05 Menor privilégio      : PASS — INSERT e UPDATE por coluna; sem DELETE
DB-06 Isolamento (RLS)      : N/A — tabela operada só por admin e sistema
DB-07 Transações            : PASS — execução no Blnk fora da transação (Wallet Adapter)
DB-08 Réplica               : N/A
DB-09 Conexões              : N/A
DB-10 Criptografia/segredos : PASS — nenhum segredo armazenado
DB-11 Migrations            : PASS — cabeçalho com timeouts; down presente; tabela nova sem lock em tabela quente
DB-12 Backup/DR             : N/A
DB-13 Observabilidade       : PASS — rejeições aparecem como ContractGuardRejected/AppendOnlyViolationAttempt
DB-14 Retenção              : PASS — permanente

ACHADOS: nenhum

MIGRATION: reversível (0009_admin_reversals.down.sql) somente antes de existir dado real
PENDÊNCIAS: aprovação dupla obrigatória (04-security-iam)
VEREDITO: APROVADO
```
