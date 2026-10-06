# Schema — database `synth`

DDL de referência da Fase 1. As migrations reais são **derivadas** deste documento, e não o contrário. Toda divergência entre este arquivo e uma migration é achado de revisão.

Convenções:

- Executado como `synth_owner` (`SET ROLE synth_owner` pelo `synth_migrator`).
- Schema `public`, com `CREATE` revogado de `PUBLIC` (`security.md`).
- Dinheiro em `bigint` (centavos), preço em `numeric(18,6)` e tempo em `timestamptz`.
- `-- PROPOSTO` marca regra que depende de aprovação. `-- PENDENTE` marca regra que depende de decisão em outra skill.

## 1. Funções utilitárias

```sql
-- Recusa qualquer mutação. Usada em tabelas append-only (DB-04).
CREATE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % em % não é permitido', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$;

-- Funções nascem executáveis por PUBLIC. Revogar sempre.
REVOKE ALL ON FUNCTION forbid_mutation() FROM PUBLIC;
```

## 2. Mercado sintético

```sql
CREATE TABLE indices (
  symbol      text        PRIMARY KEY CHECK (symbol ~ '^[A-Z0-9_]{3,32}$'),
  status      text        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED')),
  params      jsonb       NOT NULL CHECK (jsonb_typeof(params) = 'object'),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE index_state (
  symbol         text          PRIMARY KEY REFERENCES indices (symbol),
  last_sequence  bigint        NOT NULL CHECK (last_sequence >= 0),
  last_price     numeric(18,6) NOT NULL CHECK (last_price > 0),
  last_hash      char(64)      NOT NULL CHECK (last_hash ~ '^[0-9a-f]{64}$'),
  last_ts        timestamptz   NOT NULL,
  lease_epoch    bigint        NOT NULL DEFAULT 0 CHECK (lease_epoch >= 0)
);

CREATE TABLE ticks (
  symbol     text          NOT NULL REFERENCES indices (symbol),
  sequence   bigint        NOT NULL CHECK (sequence > 0),
  ts         timestamptz   NOT NULL,
  price      numeric(18,6) NOT NULL CHECK (price > 0),
  prev_hash  char(64)      NOT NULL CHECK (prev_hash ~ '^[0-9a-f]{64}$'),
  hash       char(64)      NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (symbol, sequence)
);
-- settlement: "primeiro tick com ts >= expires_at"
CREATE INDEX ticks_symbol_ts ON ticks (symbol, ts, sequence);

CREATE TRIGGER ticks_append_only BEFORE UPDATE OR DELETE ON ticks
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER ticks_no_truncate BEFORE TRUNCATE ON ticks
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- Cadeia: sequence contínua, prev_hash = último hash, ts crescente.
-- Exige a ordem oficial da transação: INSERT ticks ANTES de UPDATE index_state.
-- O hash em si NÃO é recalculado no banco: o formato canônico pertence à 03 (M-04)
-- e duplicá-lo em SQL criaria duas implementações divergentes.
CREATE FUNCTION ticks_chain_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE s index_state%ROWTYPE;
BEGIN
  SELECT * INTO s FROM index_state WHERE symbol = NEW.symbol;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'index_state ausente para %', NEW.symbol;
  END IF;
  IF NEW.sequence <> s.last_sequence + 1 THEN
    RAISE EXCEPTION 'sequence % fora de ordem (esperado %)', NEW.sequence, s.last_sequence + 1;
  END IF;
  IF NEW.prev_hash <> s.last_hash THEN
    RAISE EXCEPTION 'prev_hash não encadeia em % #%', NEW.symbol, NEW.sequence;
  END IF;
  IF NEW.ts <= s.last_ts THEN
    RAISE EXCEPTION 'ts não crescente em % #%', NEW.symbol, NEW.sequence;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ticks_chain_guard() FROM PUBLIC;
CREATE TRIGGER ticks_chain BEFORE INSERT ON ticks
  FOR EACH ROW EXECUTE FUNCTION ticks_chain_guard();

CREATE TABLE candles (
  symbol        text          NOT NULL REFERENCES indices (symbol),
  interval      text          NOT NULL CHECK (interval ~ '^[0-9]+[mhd]$'),
  bucket_start  timestamptz   NOT NULL,
  open          numeric(18,6) NOT NULL CHECK (open > 0),
  high          numeric(18,6) NOT NULL,
  low           numeric(18,6) NOT NULL CHECK (low > 0),
  close         numeric(18,6) NOT NULL CHECK (close > 0),
  volume        integer       NOT NULL CHECK (volume > 0),   -- quantidade de ticks
  first_seq     bigint        NOT NULL,
  last_seq      bigint        NOT NULL,
  PRIMARY KEY (symbol, interval, bucket_start),
  CHECK (high >= greatest(open, close) AND low <= least(open, close)),
  CHECK (last_seq >= first_seq),
  CHECK (volume = last_seq - first_seq + 1)                  -- sequence não tem buraco
);
```

## 3. Outbox

```sql
CREATE TABLE outbox (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic         text        NOT NULL CHECK (topic ~ '^[a-z][a-z0-9:._-]{1,63}$'),
  aggregate_id  text        NOT NULL,
  sequence      bigint,
  dedupe_key    text        NOT NULL UNIQUE,     -- tick:{symbol}:{seq} | reserve:{id} | settlement:{id}
  payload       jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  CHECK (published_at IS NULL OR published_at >= created_at)
);
CREATE INDEX outbox_unpublished ON outbox (id) WHERE published_at IS NULL;
ALTER TABLE outbox SET (autovacuum_vacuum_scale_factor = 0.01,
                        autovacuum_analyze_scale_factor = 0.02);

-- Única forma de apagar da outbox (DB-14). Nunca apaga linha não publicada.
CREATE FUNCTION outbox_purge(retain interval DEFAULT interval '7 days',
                             batch  integer  DEFAULT 10000)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH doomed AS (
    SELECT id FROM public.outbox
     WHERE published_at IS NOT NULL
       AND published_at < now() - greatest(retain, interval '1 day')
     ORDER BY id
     LIMIT least(batch, 50000)
  ), deleted AS (
    DELETE FROM public.outbox o USING doomed d WHERE o.id = d.id RETURNING 1
  )
  SELECT count(*) FROM deleted;
$$;
REVOKE ALL ON FUNCTION outbox_purge(interval, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION outbox_purge(interval, integer) TO app_maint;
```

## 4. Contratos

```sql
CREATE TABLE contracts (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text          NOT NULL CHECK (length(user_id) BETWEEN 1 AND 255),  -- sub
  symbol           text          NOT NULL REFERENCES indices (symbol),
  direction        text          NOT NULL CHECK (direction IN ('UP','DOWN')),
  stake_minor      bigint        NOT NULL CHECK (stake_minor BETWEEN 100 AND 10000),
  entry_price      numeric(18,6) NOT NULL CHECK (entry_price > 0),
  entry_sequence   bigint        NOT NULL,
  exit_price       numeric(18,6),
  exit_sequence    bigint,
  expires_at       timestamptz   NOT NULL,
  status           text          NOT NULL CHECK (status IN (
                     'CREATED','PENDING_RESERVE','OPEN','EXPIRING','SETTLED',
                     'CANCELLED','FAILED_COMPENSATION','FAILED_RETRYABLE')),
  result           text          CHECK (result IN ('WIN','LOSS','DRAW')),
  payout_minor     bigint        CHECK (payout_minor >= 0),
  idempotency_key  text          NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash     char(64)      NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  settled_at       timestamptz,

  UNIQUE (user_id, idempotency_key),
  FOREIGN KEY (symbol, entry_sequence) REFERENCES ticks (symbol, sequence),
  FOREIGN KEY (symbol, exit_sequence)  REFERENCES ticks (symbol, sequence),

  -- SETTLED se e somente se todos os campos de liquidação existem
  CONSTRAINT settled_complete CHECK (
    (status = 'SETTLED') = (result IS NOT NULL AND exit_price IS NOT NULL
                            AND exit_sequence IS NOT NULL AND payout_minor IS NOT NULL
                            AND settled_at IS NOT NULL)),
  CONSTRAINT exit_after_entry CHECK (exit_sequence IS NULL OR exit_sequence > entry_sequence),

  -- resultado coerente com os preços (regra de resultado do ORCHESTRATOR §9.4)
  CONSTRAINT result_matches_prices CHECK (
    result IS NULL
    OR (result = 'DRAW' AND exit_price = entry_price)
    OR (result = 'WIN'  AND ((direction = 'UP'   AND exit_price > entry_price)
                          OR (direction = 'DOWN' AND exit_price < entry_price)))
    OR (result = 'LOSS' AND ((direction = 'UP'   AND exit_price < entry_price)
                          OR (direction = 'DOWN' AND exit_price > entry_price))))

  -- PENDENTE (02): semântica de payout_minor = total devolvido a user:available.
  -- Ativar quando a regra de arredondamento for fechada:
  -- CONSTRAINT payout_by_result CHECK (
  --   result IS NULL
  --   OR (result = 'LOSS' AND payout_minor = 0)
  --   OR (result = 'DRAW' AND payout_minor = stake_minor)
  --   OR (result = 'WIN'  AND payout_minor BETWEEN stake_minor + (stake_minor * 85) / 100
  --                                            AND stake_minor + (stake_minor * 85 + 99) / 100))
) WITH (fillfactor = 90);   -- espaço para HOT updates: cada linha muda de status ~4 vezes

CREATE INDEX contracts_user_created ON contracts (user_id, created_at DESC);
-- índice parcial: SETTLED domina a tabela e não interessa ao varredor
CREATE INDEX contracts_due ON contracts (expires_at)
  WHERE status IN ('OPEN','EXPIRING','FAILED_RETRYABLE');
```

### Trigger de máquina de estados

```sql
CREATE FUNCTION contracts_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  t ticks%ROWTYPE;
  allowed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'CREATED' OR NEW.result IS NOT NULL OR NEW.exit_sequence IS NOT NULL THEN
      RAISE EXCEPTION 'contrato nasce CREATED e sem dados de liquidação';
    END IF;
    SELECT * INTO t FROM ticks WHERE symbol = NEW.symbol AND sequence = NEW.entry_sequence;
    IF t.price IS DISTINCT FROM NEW.entry_price THEN
      RAISE EXCEPTION 'entry_price difere do tick oficial #%', NEW.entry_sequence;
    END IF;
    -- PROPOSTO (divergência 5): expiração no relógio do Tick Engine
    IF NEW.expires_at <> t.ts + interval '60 seconds' THEN
      RAISE EXCEPTION 'expires_at deve ser ts do tick de entrada + 60 s';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: colunas imutáveis
  IF (NEW.id, NEW.user_id, NEW.symbol, NEW.direction, NEW.stake_minor, NEW.entry_price,
      NEW.entry_sequence, NEW.expires_at, NEW.idempotency_key, NEW.request_hash, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.user_id, OLD.symbol, OLD.direction, OLD.stake_minor, OLD.entry_price,
      OLD.entry_sequence, OLD.expires_at, OLD.idempotency_key, OLD.request_hash, OLD.created_at)
  THEN
    RAISE EXCEPTION 'coluna imutável alterada no contrato %', OLD.id;
  END IF;

  IF OLD.status IN ('SETTLED','CANCELLED','FAILED_COMPENSATION') THEN
    RAISE EXCEPTION 'contrato % em estado terminal %', OLD.id, OLD.status;
  END IF;

  allowed := (OLD.status, NEW.status) IN (
    ('CREATED','PENDING_RESERVE'), ('PENDING_RESERVE','OPEN'),
    ('PENDING_RESERVE','FAILED_COMPENSATION'), ('OPEN','CANCELLED'),
    ('OPEN','EXPIRING'), ('EXPIRING','SETTLED'),
    ('EXPIRING','FAILED_RETRYABLE'), ('FAILED_RETRYABLE','EXPIRING'));
  IF NOT allowed THEN
    RAISE EXCEPTION 'transição % → % proibida', OLD.status, NEW.status;
  END IF;

  -- quem pode fazer o quê (defesa em profundidade sobre os grants)
  IF current_user = 'app_contract'
     AND NEW.status NOT IN ('PENDING_RESERVE','OPEN','FAILED_COMPENSATION','CANCELLED') THEN
    RAISE EXCEPTION 'app_contract não executa a transição para %', NEW.status;
  END IF;
  IF current_user = 'app_settlement'
     AND NEW.status NOT IN ('EXPIRING','SETTLED','FAILED_RETRYABLE') THEN
    RAISE EXCEPTION 'app_settlement não executa a transição para %', NEW.status;
  END IF;

  -- dados de liquidação só na transição EXPIRING → SETTLED
  IF NEW.status = 'SETTLED' THEN
    SELECT * INTO t FROM ticks WHERE symbol = NEW.symbol AND sequence = NEW.exit_sequence;
    IF t.price IS DISTINCT FROM NEW.exit_price OR t.ts < NEW.expires_at THEN
      RAISE EXCEPTION 'exit tick inválido para o contrato %', NEW.id;
    END IF;
    IF EXISTS (SELECT 1 FROM ticks
                WHERE symbol = NEW.symbol AND ts >= NEW.expires_at
                  AND sequence < NEW.exit_sequence) THEN
      RAISE EXCEPTION 'exit tick não é o primeiro após expires_at (B-08)';
    END IF;
  ELSIF (NEW.result, NEW.exit_price, NEW.exit_sequence, NEW.payout_minor, NEW.settled_at)
        IS DISTINCT FROM (OLD.result, OLD.exit_price, OLD.exit_sequence, OLD.payout_minor, OLD.settled_at) THEN
    RAISE EXCEPTION 'dados de liquidação fora da transição para SETTLED';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION contracts_guard() FROM PUBLIC;

CREATE TRIGGER contracts_guard BEFORE INSERT OR UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION contracts_guard();
CREATE TRIGGER contracts_no_delete BEFORE DELETE ON contracts
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER contracts_no_truncate BEFORE TRUNCATE ON contracts
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
```

Os triggers rodam com os privilégios de quem dispara. Por isso `app_contract` e `app_settlement` precisam de `SELECT` em `ticks`, e já têm.

## 5. Carteira, auditoria e correções

```sql
-- Só o mapa sub → balances do Blnk. NENHUM saldo aqui (D-02).
CREATE TABLE wallet_accounts (
  user_id                   text        PRIMARY KEY,                -- sub
  ledger_id                 text        NOT NULL,
  available_balance_id      text        NOT NULL UNIQUE,
  reserved_balance_id       text        NOT NULL UNIQUE,
  currency                  char(3)     NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),  -- D-18
  initial_credit_reference  text        NOT NULL UNIQUE,
  created_at                timestamptz NOT NULL DEFAULT now(),
  CHECK (available_balance_id <> reserved_balance_id),
  CHECK (initial_credit_reference = 'demo-credit:' || user_id)
);
CREATE TRIGGER wallet_accounts_append_only BEFORE UPDATE OR DELETE ON wallet_accounts
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER wallet_accounts_no_truncate BEFORE TRUNCATE ON wallet_accounts
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- Campos mínimos da 04-security-iam, seção "Auditoria".
CREATE TABLE audit_logs (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  actor_sub    text        NOT NULL,
  actor_roles  text[]      NOT NULL,
  action       text        NOT NULL,
  resource     text        NOT NULL,
  resource_id  text,
  result       text        NOT NULL CHECK (result IN ('allowed','denied')),
  reason       text,
  ip           inet,                                            -- dado pessoal (LGPD)
  trace_id     text        CHECK (trace_id ~ '^[0-9a-f]{32}$'),
  details      jsonb       NOT NULL DEFAULT '{}'::jsonb         -- nunca token, senha ou header
);
CREATE INDEX audit_logs_actor ON audit_logs (actor_sub, occurred_at DESC);
CREATE INDEX audit_logs_resource ON audit_logs (resource, resource_id);
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- Correção por reversão (I-06): pedido → aprovação → execução no Blnk.
CREATE TABLE admin_reversals (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  original_reference   text        NOT NULL UNIQUE,     -- uma reversão por transação original
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
  -- PENDENTE (04): aprovação dupla. Se aprovada, quem pede não aprova.
  CHECK (approved_by IS NULL OR approved_by <> requested_by),
  CHECK (status NOT IN ('APPROVED','EXECUTED') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK ((status = 'EXECUTED') = (blnk_transaction_id IS NOT NULL))
);
CREATE TRIGGER admin_reversals_no_delete BEFORE DELETE ON admin_reversals
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER admin_reversals_no_truncate BEFORE TRUNCATE ON admin_reversals
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

CREATE TABLE reconciliation_runs (
  id                bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  status            text        NOT NULL CHECK (status IN ('RUNNING','OK','DIVERGENT','ERROR')),
  checks            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  divergence_minor  bigint      NOT NULL DEFAULT 0 CHECK (divergence_minor >= 0),
  CHECK ((status = 'RUNNING') = (finished_at IS NULL))
);
```

## 6. Seed

```sql
-- 0002_seed_synth_vol_50.up.sql
INSERT INTO indices (symbol, params)
VALUES ('SYNTH_VOL_50', '<parâmetros da 03-synthetic-market-engine>'::jsonb);

INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts)
VALUES ('SYNTH_VOL_50', 0, <preço inicial — não definido no contexto>,
        '<hash gênese definido na 03>', '<instante gênese>');
```

## 7. Particionamento (quando for necessário)

Não é necessário na Fase 1: 1 índice × 1 tick/s ≈ 31,5 milhões de linhas/ano (~8 GB com índices). Quando for necessário:

- `ticks`: particionar por **range de `sequence`**, e não de `ts`. A `PRIMARY KEY (symbol, sequence)` continua válida porque a chave de partição faz parte dela. Particionar por `ts` obrigaria a incluir `ts` na PK e perderia a unicidade global de `sequence`.
- `outbox`: particionar por range de `id`. A purga vira `DETACH` + `DROP` de partição antiga feito por migration, sem `DELETE`.
- `audit_logs`: por range de `occurred_at`, se o prazo legal permitir arquivar partições antigas em S3 com Object Lock.
