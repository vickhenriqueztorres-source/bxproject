-- =============================================================================
-- MIGRAÇÃO 0003: GUARD DE MÁQUINA DE ESTADOS DE CONTRATOS (PERIGO 5 TÉCNICA 4 / DB-03)
-- Impede matematicamente dentro do PostgreSQL que contratos SETTLED ou CANCELLED
-- voltem para OPEN/EXPIRING ou que colunas financeiras imutáveis sejam alteradas.
-- =============================================================================

SET lock_timeout = '3s';
SET statement_timeout = '10s';

CREATE OR REPLACE FUNCTION enforce_contract_state_machine()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Proíbe alteração de colunas imutáveis após a criação do contrato (DB-03)
  IF OLD.user_id <> NEW.user_id
     OR OLD.symbol <> NEW.symbol
     OR OLD.direction <> NEW.direction
     OR OLD.stake_minor <> NEW.stake_minor
     OR OLD.entry_price <> NEW.entry_price
     OR OLD.idempotency_key <> NEW.idempotency_key THEN
    RAISE EXCEPTION 'CONTRACT_IMMUTABLE_FIELD_VIOLATION: Cannot mutate user_id, symbol, direction, stake_minor, entry_price, or idempotency_key on contract %', OLD.id;
  END IF;

  -- 2. Estados terminais (SETTLED e CANCELLED) jamais podem regredir para outro estado (Perigo 5 Técnica 4)
  IF OLD.status = 'SETTLED' AND NEW.status <> 'SETTLED' THEN
    RAISE EXCEPTION 'INVALID_CONTRACT_STATE_TRANSITION: Terminal contract % in status SETTLED cannot transition to %', OLD.id, NEW.status;
  END IF;

  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    RAISE EXCEPTION 'INVALID_CONTRACT_STATE_TRANSITION: Terminal contract % in status CANCELLED cannot transition to %', OLD.id, NEW.status;
  END IF;

  -- 3. Quando já SETTLED, resultado e payout_minor não podem ser reescritos (I-01, I-06)
  IF OLD.status = 'SETTLED' AND (
     OLD.result IS DISTINCT FROM NEW.result
     OR OLD.exit_price IS DISTINCT FROM NEW.exit_price
     OR OLD.payout_minor IS DISTINCT FROM NEW.payout_minor
  ) THEN
    RAISE EXCEPTION 'SETTLED_CONTRACT_MUTATION_FORBIDDEN: Cannot alter result, exit_price, or payout_minor of settled contract %', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_contract_state_machine ON contracts;
CREATE TRIGGER trg_enforce_contract_state_machine
BEFORE UPDATE ON contracts
FOR EACH ROW
EXECUTE FUNCTION enforce_contract_state_machine();
