# Subetapa 12.2 — Servidor: `serializeContract(row)` Única, Invariante `strike_price = entry_price` e Migração `entry_tick_sequence`

**Agentes:** `broker-architect-agent` + `backend-implementation-agent`  
**Skills:** `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `08-database-foundation`

---

## 1. Escopo Passo a Passo

### Passo 2.1 — Migração SQL Não-Bloqueante (`db/migrations/0063_contracts_entry_tick_sequence.up.sql` e `.down.sql`)
- Criar `db/migrations/0063_contracts_entry_tick_sequence.up.sql`:
  ```sql
  ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS entry_tick_sequence BIGINT;
  ```
- Criar `db/migrations/0063_contracts_entry_tick_sequence.down.sql`:
  ```sql
  ALTER TABLE contracts
    DROP COLUMN IF EXISTS entry_tick_sequence;
  ```

### Passo 2.2 — Função Canônica Única `serializeContract(row)` (`scripts/lib/settlement-engine.mjs`)
- Exportar `serializeContract(row)` em `scripts/lib/settlement-engine.mjs` para serializar de forma idêntica linhas do PostgreSQL e objetos em memória:
  - `entry_price`: `Number(row.entry_price)`
  - `strike_price`: `Number(row.entry_price)` (**sempre igual a `entry_price`**, nunca `exit_price`)
  - `entry_tick_sequence`: `row.entry_tick_sequence != null ? Number(row.entry_tick_sequence) : null`
  - `exit_price`: `row.status === 'OPEN' || row.exit_price == null ? null : Number(row.exit_price)`
  - `exit_tick_sequence`: `row.status === 'OPEN' || row.exit_tick_sequence == null ? null : Number(row.exit_tick_sequence)`
  - Preservar `id`, `user_id`, `symbol`, `direction`, `status`, `result`, `stake_minor`, `payout_minor`, `expires_at`, `created_at`, `opened_at`, `settled_at`, `idempotency_key`.

### Passo 2.3 — Liquidação sem Sobrescrever `strike_price` (`scripts/lib/settlement-engine.mjs`)
- Na linha 457 de `scripts/lib/settlement-engine.mjs`:
  - Remover `target.strike_price = exitPrice;` e garantir `target.strike_price = entryPrice;`.
- Na linha 386 de `scripts/lib/settlement-engine.mjs` (fallback `UPDATE contracts`):
  - Gravar também `exit_tick_sequence = $4` no `UPDATE contracts`.

### Passo 2.4 — Unificação dos 6 Pontos em `scripts/dev-live-feed.mjs`
- Usar `serializeContract` em:
  1. `GET /contracts/:id` (~l.1002)
  2. `GET /contracts` (~l.2693)
  3. Idempotência prévia do `POST /contracts` (~l.2871)
  4. Criação de `newContract` no `POST /contracts` (~l.3052) e gravação de `entry_tick_sequence` no `INSERT INTO contracts` (com fallback resiliente caso o banco ainda não tenha rodado a migration 0063)
  5. Idempotência concorrente `23505` do `POST /contracts` (~l.3128)
- Garantir no bootstrap do banco em `dev-live-feed.mjs` (`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS entry_tick_sequence BIGINT`) que ambientes locais existentes recebam a coluna automaticamente sem downtime.

---

## 2. Critérios de Validação da Subetapa 12.2
- `serializeContract` retorna `strike_price === entry_price` e `exit_price === null` quando `status === 'OPEN'`.
- `serializeContract` retorna `strike_price === entry_price` e `exit_price === <preço de saída>` quando `status === 'SETTLED'`.
- Respostas de `POST /contracts`, `POST /contracts` duplicado (idempotência em memória, prévia no banco e `23505`), `GET /contracts` e `GET /contracts/:id` possuem exatamente o mesmo contrato semântico.
