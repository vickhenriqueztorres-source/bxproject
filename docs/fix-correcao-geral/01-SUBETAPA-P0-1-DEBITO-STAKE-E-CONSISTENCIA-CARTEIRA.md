# Subetapa 01 (P0-1) — Stake Não Debitado sem Blnk, Guarda de Conta Real, `BLNK_ENABLED` e Consistência de Carteira

**Item:** `P0-1` (Crítico — Dinheiro / Saldo)  
**Agentes:** `backend-implementation-agent` + `bug-fix-agent` (Implementação) | `financial-correctness-reviewer` + `security-reviewer` + `qa-resilience-agent` + `post-implementation-verifier` (Revisão e Verificação)  
**Skills:** `01-project-context`, `02-financial-invariants`, `04-security-iam`, `05-resilience-patterns`, `06-testing-quality`, `08-database-foundation`, `10-post-implementation-verification`, `17-mudanca-cirurgica`

---

## 1. Diagnóstico Forense do Problema

1. **Abertura de ordem sem débito (`scripts/dev-live-feed.mjs:2972-2988`):**
   - No modo sem Blnk, o código atual apenas executa `SELECT demo_balance_minor FROM users WHERE id = $1` e valida `stake > userBalance`, mas **não debita** o `stake` de `users.demo_balance_minor` na transação `BEGIN ... COMMIT` de criação do contrato (`INSERT INTO contracts`).
   - O commit `bc0be5a` removeu o `UPDATE users SET demo_balance_minor = demo_balance_minor - $1 WHERE id = $2 AND demo_balance_minor >= $1`.
2. **Liquidação (`scripts/lib/settlement-engine.mjs`):**
   - Na liquidação em banco (`settleOpenContract`), quando `payoutMinor > 0`, o saldo recebe `+payoutMinor` (`WIN` = `+185%`, `DRAW` = `+100%`), enquanto `LOSS` soma `0`. Como o stake nunca foi debitado na abertura:
     - `WIN` = `+185%` líquido em vez de `+85%`;
     - `LOSS` = `0` de perda em vez de `-100%`;
     - `DRAW` = ganha `+100%` do stake em vez de `0` líquido.
   - Adicionalmente, no ramo `hasRealPg && isAuthenticatedUser` (`settlement-engine.mjs:277-422`), quando `!blnkEnabled`, faltava o `UPDATE users SET demo_balance_minor = demo_balance_minor + $1` dentro da transação `dbClient`!
3. **Detecção frágil do Blnk (`endsWith(':1')`):**
   - Tanto `dev-live-feed.mjs` quanto `settlement-engine.mjs` usavam `Boolean(blnk && (!blnk.baseUrl || !String(blnk.baseUrl).endsWith(':1')))`.
   - Deve ser substituída por uma flag explícita (`BLNK_ENABLED=true`) combinada com healthcheck no boot e log estruturado claro do modo ativo.
4. **Conta REAL sem Ledger:**
   - Se o cliente solicitar abertura de contrato em conta `REAL` (`account_type === 'REAL'` ou `wallet_mode === 'REAL'` ou `mode === 'REAL'`) e o Blnk não estiver ativo/saudável, o servidor **jamais** pode usar `demo_balance_minor`: deve recusar imediatamente com `503 LEDGER_UNAVAILABLE`.

---

## 2. Passo a Passo de Implementação

### Passo 1 — Reprodução (Teste TDD que falha no código atual)
Criar `tests/integration/p0-1-stake-debit-and-settlement.test.mjs` que:
- Abre ordem de `10000` minor (`$100.00`) com `BLNK_ENABLED=false` (Blnk desligado) para um usuário com saldo inicial `1000000` (`$10,000.00`).
- Confere o saldo no banco imediatamente após a abertura:
  - **Esperado:** `990000` (`−10000`). *(Falha no código atual, que mantém `1000000`)*.
- Liquida 3 contratos (`LOSS`, `WIN` a 85%, `DRAW` de `10000` cada):
  - Contrato 1 (`LOSS`): abertura `1000000 -> 990000`, após `LOSS` -> `990000` (variação líquida `-10000`).
  - Contrato 2 (`WIN`): abertura `990000 -> 980000`, após `WIN` (`+18500`) -> `998500` (variação líquida `+8500`).
  - Contrato 3 (`DRAW`): abertura `998500 -> 988500`, após `DRAW` (`+10000`) -> `998500` (variação líquida `0`).

### Passo 2 — Correção Cirúrgica
1. **Detecção explícita do Blnk (`isBlnkEnabled`) + Healthcheck no Boot:**
   - Criar helper exportável em `scripts/lib/settlement-engine.mjs` (ou módulo compartilhado) `isBlnkActive(blnk)`:
     - Exige `process.env.BLNK_ENABLED === 'true'` (ou `blnk?.enabled === true` injetado em testes) e cliente Blnk saudável (`blnk && !String(blnk.baseUrl || '').endsWith(':1')`).
   - No boot do `scripts/dev-live-feed.mjs`:
     - Se `process.env.BLNK_ENABLED === 'true'`, executar healthcheck contra `BLNK_URL` + `initializeLedgerAndHouseAccounts()`. Se suceder, `blnk.enabled = true` e logar `[WalletMode] MODO BLNK LEDGER ATIVO (fonte da verdade: Blnk Double-Entry Ledger)`. Se falhar ou `BLNK_ENABLED !== 'true'`, `blnk = null` e logar `[WalletMode] MODO POSTGRES DEMO ATIVO (BLNK_ENABLED=false — fonte da verdade para conta DEMO: PostgreSQL users.demo_balance_minor; conta REAL bloqueada com 503 LEDGER_UNAVAILABLE)`.
2. **Guarda de Conta REAL (`503 LEDGER_UNAVAILABLE`):**
   - Em `POST /contracts` (`scripts/dev-live-feed.mjs`), se `payload.account_type === 'REAL' || payload.mode === 'REAL' || payload.wallet_type === 'REAL'` e `!blnkEnabled`, abortar imediatamente com `503` e `{ code: 'LEDGER_UNAVAILABLE', message: 'Blnk Ledger obrigatório para operações em conta REAL' }`.
3. **Débito Atômico na Mesma Transação do `INSERT INTO contracts` (Modo sem Blnk):**
   - Em `scripts/dev-live-feed.mjs`, dentro do `BEGIN ... COMMIT` (`dbClient`):
     - Quando `!blnkConfigured`:
       ```sql
       UPDATE users
       SET demo_balance_minor = demo_balance_minor - $1, updated_at = NOW()
       WHERE id = $2 AND demo_balance_minor >= $1
       RETURNING demo_balance_minor
       ```
     - Se `deductRes.rowCount === 0`: executar `await dbClient.query('ROLLBACK')` e responder `400 INSUFFICIENT_BALANCE` (ou `404 USER_NOT_FOUND` se usuário inexistente).
     - Atualizar `walletReadEngine.invalidateUserWallet(authData.sub, Number(deductRes.rows[0].demo_balance_minor))` após o `COMMIT`.
4. **Liquidação Atômica em `scripts/lib/settlement-engine.mjs`:**
   - No ramo `hasRealPg && isAuthenticatedUser` (`dbClient` com `BEGIN ... COMMIT`):
     - Quando `blnkConfigured === true`: chama exclusivamente `blnk.settleContract(...)` e `blnk.getBalance(userId)` (sem `UPDATE users SET demo_balance_minor = demo_balance_minor + $1`, evitando crédito duplo).
     - Quando `blnkConfigured === false`: dentro da mesma transação `dbClient`, antes do `COMMIT`:
       - Se `payoutMinor > 0`:
         ```sql
         UPDATE users
         SET demo_balance_minor = demo_balance_minor + $1, updated_at = NOW()
         WHERE id = $2
         RETURNING demo_balance_minor
         ```
       - Se `payoutMinor === 0`:
         ```sql
         SELECT demo_balance_minor FROM users WHERE id = $1
         ```
       - Define `updatedUserBalance = Number(res.rows[0].demo_balance_minor)`.
   - No ramo fallback sem `dbClient` (`!hasRealPg`):
     - Se `blnkConfigured === true`, chama apenas `blnk.settleContract` (não executa `UPDATE users SET demo_balance_minor = demo_balance_minor + $1`).
     - Se `blnkConfigured === false`, executa o `UPDATE users SET demo_balance_minor = demo_balance_minor + $1`.
5. **Documentação da Fonte da Verdade:**
   - **Modo 1 (`BLNK_ENABLED=true` e saudável):** Fonte da verdade = **Blnk Ledger** (`reserveStake` na abertura, `settleContract` na liquidação). A coluna `users.demo_balance_minor` atua apenas como espelho read-through sincronizado por `walletReadEngine` (`IS DISTINCT FROM`).
   - **Modo 2 (`BLNK_ENABLED=false`):** Fonte da verdade para conta DEMO = **`users.demo_balance_minor` no PostgreSQL**, com débito atômico (`- stake`) no `BEGIN...COMMIT` de abertura e crédito atômico (`+ payoutMinor`) no `BEGIN...COMMIT` de liquidação. Conta REAL é estritamente recusada com `503 LEDGER_UNAVAILABLE`.

---

## 3. Passo 3 — Tabela de Varredura de Todos os Caminhos de Débito/Crédito

| Caminho / Operação | Arquivo:Linha | Debita | Credita | Transação / Atomicidade |
|---|---|---|---|---|
| **1. Cadastro de Usuário (Provisionamento Demo)** | `scripts/dev-live-feed.mjs:1098-1103` | — | `users.demo_balance_minor = 1000000` ($10.000,00) | `INSERT INTO users` atômico |
| **2. Verificação de E-mail (Ativação Demo)** | `scripts/dev-live-feed.mjs:1320-1373` | — | `users.demo_balance_minor = 1000000` | CTE atômica `WITH claimed AS (...) UPDATE users` |
| **3. Abertura de Contrato (Modo Blnk Ativo)** | `scripts/dev-live-feed.mjs:2938-2970` | `blnk.reserveStake(sub, contractId, stake)` (`available -> reserved`) | Compensação `blnk.releaseReservedStake` se DB falhar (`l.3089`) | Reserva idempotente `reserve:{id}` + `BEGIN...COMMIT` no PG |
| **4. Abertura de Contrato (Modo Demo sem Blnk)** | `scripts/dev-live-feed.mjs:3055-3095` | `UPDATE users SET demo_balance_minor = demo_balance_minor - $1 WHERE id = $2 AND demo_balance_minor >= $1` | — | Mesma transação ACID `BEGIN ... COMMIT` do `INSERT INTO contracts` |
| **5. Liquidação de Contrato (Modo Blnk Ativo)** | `scripts/lib/settlement-engine.mjs:347-362` | `user:reserved` (`stake`) | `WIN`: `stake + profit` em `user:available`; `DRAW`: `stake` em `user:available`; `LOSS`: `stake` para `house_revenue` | `SELECT ... FOR UPDATE` no PG + chaves idempotentes `settlement:{id}` e `credit:{id}:WIN` |
| **6. Liquidação de Contrato (Modo Demo sem Blnk)** | `scripts/lib/settlement-engine.mjs:364-390` | — (stake já debitado no item 4) | `WIN`: `+payoutMinor`; `DRAW`: `+stake`; `LOSS`: `+0` em `users.demo_balance_minor` | Mesma transação ACID `BEGIN ... COMMIT` com `SELECT ... FOR UPDATE` do contrato |
| **7. Confirmação de Depósito Demo/Cashier** | `scripts/dev-live-feed.mjs:1930-1939` | — | `UPDATE users SET demo_balance_minor = demo_balance_minor + $1` | Verifica `status !== 'COMPLETED'` e atualiza `wallet_transactions` + `users` |
| **8. Solicitação de Saque Demo/Cashier** | `scripts/dev-live-feed.mjs:1999-2019` | `UPDATE users SET demo_balance_minor = demo_balance_minor - $1 WHERE id = $2 AND demo_balance_minor >= $1` | — | Guarda atômica `demo_balance_minor >= $1` + `INSERT INTO wallet_transactions` |
| **9. Arena Torneio — Depósito Carteira Real** | `scripts/lib/arena-http-engine.mjs:602-612` | — | `UPDATE arena_real_balances SET available_minor = available_minor + $2` | Guarda `tx.status !== 'COMPLETED'` |
| **10. Arena Torneio — Inscrição (`BUY_IN`)** | `scripts/lib/arena-http-engine.mjs:754-815` | `UPDATE arena_real_balances SET available_minor = available_minor - $2` | `UPDATE arena_tournaments SET current_pool_minor = current_pool_minor + $2` (`70%` pool / `30%` rake) + `initial_t_balance_minor` | Idempotente por `(tournament_id, user_id)` e `arena_ledger_events` |
| **11. Arena Torneio — Trade Interno (`T$`)** | `scripts/lib/arena-http-engine.mjs:972-980` e `391-473` | Abertura: `current_t_balance_minor - stake`, `reserved_t_stake_minor + stake` | Liquidação (`FOR UPDATE`): `WIN` devolve `stake + profit + streakBonus`; `DRAW` devolve `stake`; `LOSS` consome `reserved_t_stake_minor` | Transação ACID `BEGIN ... COMMIT` com `FOR UPDATE` em `arena_trade_orders` e `arena_participants` |
| **12. Cancelamento de Contrato** | `services/api/src/services/contract-service.ts` / `02-financial-invariants` | — | Não exposto como rota mutável pelo cliente na Fase 1 (contratos são binários com expiração fixa); compensação automática em falha de abertura (`releaseReservedStake` / `ROLLBACK`) | `ROLLBACK` transacional na abertura |

---

## 4. Passo 4 — Script Read-Only de Consistência em Produção (`scripts/diag/wallet-consistency.mjs`)

Criar `scripts/diag/wallet-consistency.mjs`:
- **Modo estritamente Read-Only**: abre conexão com `SET default_transaction_read_only = on` (ou executa exclusivamente `SELECT`).
- Aceita filtro de data `--since` (default: timestamp do commit `bc0be5a` ou todos os contratos históricos do usuário) e `--json` / `--markdown`.
- Para cada usuário em `users` que possui contratos em `contracts`:
  - Calcula:
    - `initial_balance_minor = 1000000 + COALESCE(Σ depósitos COMPLETED, 0) - COALESCE(Σ saques, 0)`
    - `total_stakes_minor = COALESCE(Σ stake_minor de contratos OPEN e SETTLED, 0)`
    - `total_payouts_minor = COALESCE(Σ payout_minor de contratos SETTLED, 0)`
    - `expected_balance_minor = initial_balance_minor - total_stakes_minor + total_payouts_minor`
    - `actual_balance_minor = users.demo_balance_minor`
    - `divergence_minor = actual_balance_minor - expected_balance_minor`
- Imprime relatório detalhado com as divergências encontradas e **NÃO altera nenhum saldo automaticamente** (respeitando I-06 / L-08).

---

## 5. Bateria de Testes Obrigatórios (Unitário, Integração, Estresse, Segurança e Caos)

Arquivo: `tests/integration/p0-1-stake-debit-and-settlement.test.mjs`

1. **[Integração - Modo Sem Blnk (`BLNK_ENABLED=false`)] Ciclo Completo `OPEN -> LOSS / WIN / DRAW`:**
   - Saldo inicial `1_000_000`.
   - Abre ordem `10_000` -> saldo no banco = `990_000` (`-10_000`).
   - Liquida `LOSS` -> saldo no banco = `990_000` (`0` de variação na liquidação, `-10_000` líquido).
   - Abre 2ª ordem `10_000` -> saldo no banco = `980_000`.
   - Liquida `WIN` (85%) -> saldo no banco = `998_500` (`+18_500` na liquidação, `+8_500` líquido).
   - Abre 3ª ordem `10_000` -> saldo no banco = `988_500`.
   - Liquida `DRAW` -> saldo no banco = `998_500` (`+10_000` na liquidação, `0` líquido).
2. **[Integração - Modo Com Blnk (`BLNK_ENABLED=true`)] Garantia Anti-Débito/Crédito Duplo:**
   - Verifica que com Blnk ativo a reserva ocorre apenas no Blnk (`reserveStake` 1×) e o Postgres **não** sofre débito duplo nem crédito duplo na liquidação.
3. **[Segurança - Conta REAL sem Blnk] Recusa Fail-Closed `503 LEDGER_UNAVAILABLE`:**
   - Tentativa de abrir contrato com `account_type: 'REAL'` quando `BLNK_ENABLED=false` retorna `503 LEDGER_UNAVAILABLE` e zero linhas inseridas em `contracts`.
4. **[Estresse Concorrente - Race Condition de Saldo] 20 Ordens Simultâneas de `100_000` para Saldo de `300_000`:**
   - Dispara 20 `POST /contracts` concorrentes de `$1.000` (`100_000` minor) para um usuário com `$3.000` (`300_000` minor).
   - Exatamente **3 ordens** são abertas (`201`) e **17 ordens** são recusadas com `400 INSUFFICIENT_BALANCE`.
   - Saldo final é exatamente `0` (nunca negativo).
5. **[Caos - Falha de INSERT/Outbox após UPDATE de Saldo]:**
   - Injetar falha na query de `INSERT INTO contracts` ou `INSERT INTO outbox_events` dentro da transação `BEGIN...COMMIT`.
   - Comprovar que o `ROLLBACK` desfaz o débito de `demo_balance_minor`, preservando 100% do saldo anterior.
6. **[Auditoria - `wallet-consistency.mjs`]:**
   - Executar `wallet-consistency.mjs` sobre o estado após os testes e comprovar `divergences = 0` para os usuários operados sob o código corrigido, além de detectar corretamente uma divergência sintética injetada em usuário legado.
