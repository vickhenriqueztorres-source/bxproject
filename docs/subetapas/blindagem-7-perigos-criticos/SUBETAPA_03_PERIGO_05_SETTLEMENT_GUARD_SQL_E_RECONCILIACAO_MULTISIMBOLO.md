# Subetapa 03 — Perigo 5: Settlement Guard SQL, Validação Estrita de Tick de Saída e Reconciliador Multi-Símbolo

**Agentes**: `backend-implementation-agent`, `financial-correctness-reviewer`, `qa-resilience-agent`  
**Skills**: `02-financial-invariants` (`I-03`, `I-04`, `I-05`), `08-database-foundation` (`DB-03`, `DB-07`), `06-testing-quality`

---

## 1. Problema Identificado
1. **Técnica 2 (`ContractSettler`)**: Em [`services/settlement-worker/src/settlement/settler.ts:65-86`](file:///d:/brokerproject/services/settlement-worker/src/settlement/settler.ts#L65-L86), a query busca o primeiro tick com `ts >= expires_at`, mas não seleciona `symbol` para asserção defensiva (`exitTick.symbol === contract.symbol`), não valida `Number(exitTick.sequence) >= Number(contract.entry_tick_sequence)` e não verifica se a diferença `exitTick.ts - expires_at` excede o limite de staleness máxima de liquidação (`maxExitTickDelayMs`).
2. **Técnica 4 (Máquina de Estados no PostgreSQL)**: Falta migration com trigger/constraint (`enforce_contract_state_machine`) no banco que impeça matematicamente um contrato `SETTLED` ou `CANCELLED` de voltar para `OPEN` ou sofrer mutação em `result`/`payout_minor` após liquidado.
3. **Técnica 5 (Reconciliação Multi-Símbolo)**: Em [`services/settlement-worker/src/reconciliation/financial-reconciler.ts:98-124`](file:///d:/brokerproject/services/settlement-worker/src/reconciliation/financial-reconciler.ts#L98-L124), a query `SELECT sequence, price, ts, prev_hash, hash FROM ticks ORDER BY sequence DESC LIMIT 500` mistura ticks de símbolos diferentes na mesma verificação sequencial, causando falsos alertas de gap e de quebra de hash quando múltiplos ativos estão ativos.

## 2. Passo a Passo Cirúrgico
1. **Blindar `ContractSettler.settleContract` (`services/settlement-worker/src/settlement/settler.ts`)**:
   - Incluir `symbol` no `SELECT symbol, sequence, price, ts FROM ticks WHERE symbol = $1 AND ts >= $2 ORDER BY sequence ASC LIMIT 1`.
   - Validar explicitamente:
     - `exitTick.symbol === contract.symbol` (protecão anti-cross-asset).
     - `BigInt(exitTick.sequence) >= BigInt(contract.entry_tick_sequence)` (proteção contra regressão de sequence).
     - Staleness máxima na liquidação (`exitTickLagMs = new Date(exitTick.ts).getTime() - new Date(contract.expires_at).getTime()`): registrar métrica/log de auditoria e, se `maxExitTickAgeMs` estiver configurado e for violado, lançar erro auditável / reter para reconciliação sem jamais inventar `DRAW`.
2. **Criar Migration `db/migrations/0003_contract_state_machine_guard.sql`**:
   - Adicionar constraint `CHECK (status IN ('CREATED', 'OPEN', 'EXPIRING', 'SETTLED', 'CANCELLED', 'FAILED_COMPENSATION', 'FAILED_RETRYABLE'))` e trigger `trg_enforce_contract_state_machine` que recusa qualquer `UPDATE` que tente tirar um contrato de `SETTLED` ou `CANCELLED` ou alterar `entry_price`, `stake_minor`, `user_id` ou `symbol`.
3. **Corrigir `FinancialReconciler` para Multi-Símbolo (`services/settlement-worker/src/reconciliation/financial-reconciler.ts`)**:
   - Na checagem 4 (`ticks`), selecionar `symbol, sequence, price, ts, prev_hash, hash` e validar a continuidade de `sequence` e `prev_hash === newer.prev_hash` **agrupado por `symbol`**, garantindo zero falso-positivo em múltiplos ativos e 100% de detecção de adulteração por símbolo.

## 3. Testes Obrigatórios (Estresse, Caos e Segurança)
- Tentativa de liquidar contrato com tick de outro símbolo (`BTCUSDT` vs `EURUSD-OTC`) → rejeitado imediatamente com erro crítico.
- Reconciliador auditando 3 ativos simultâneos (`R_100`, `EURUSD-OTC`, `BTCUSDT`) → zero falso-positivo em sequência íntegra e detecção exata quando 1 ativo tem gap ou hash adulterado.
- Teste da máquina de estados impedindo regressão `SETTLED -> OPEN`.
