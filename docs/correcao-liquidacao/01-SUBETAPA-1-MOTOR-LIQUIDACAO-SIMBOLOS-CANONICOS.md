# Subetapa 1 — Resolução Bidirecional de Símbolos Canônicos/Legados no Motor de Liquidação e Sweeper

**Orquestrador:** `tech-lead-orchestrator`  
**Agentes Alocados:** `bug-fix-agent`, `backend-implementation-agent`, `qa-resilience-agent`, `financial-correctness-reviewer`, `security-reviewer`  
**Skills Ativadas:** `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `08-database-foundation`, `09-ai-failure-map`

---

## 1. Objetivo da Subetapa
Corrigir definitivamente o bloqueio de liquidação (`WAITING_FOR_OFFICIAL_EXPIRY_TICK`) causado pela inversão entre símbolos persistidos no PostgreSQL (`SYNTH_VOL_10`, `SYNTH_VOL_25`, `SYNTH_VOL_50`, `SYNTH_VOL_75`, `SYNTH_VOL_100`, `SYNTH_CRASH_BOOM_100`) e símbolos canônicos de memória (`VOL_10`, `VOL_25`, `VOL_50`, `VOL_75`, `VOL_100`, `CRASH_BOOM_100`), além de eliminar tentativas duplicadas no mesmo ciclo de 500ms do sweeper.

---

## 2. Passo a Passo de Implementação

### Passo 1.1 — Helper Puro `buildSymbolCandidates(rawSymbol, resolveSymbolFn)` em [`scripts/lib/settlement-engine.mjs`](file:///d:/brokerproject/scripts/lib/settlement-engine.mjs)
1. Criar e exportar a função determinística `buildSymbolCandidates(rawSymbol, resolveSymbolFn)`:
   - Recebe `rawSymbol` (ex.: `'SYNTH_VOL_50'` ou `'VOL_50'`) e a função opcional `resolveSymbolFn`.
   - Calcula `canonical = resolveSymbolFn ? resolveSymbolFn(rawSymbol) : rawSymbol.replace(/^SYNTH_/, '')`.
   - Calcula `legacy = canonical.startsWith('VOL_') || canonical === 'CRASH_BOOM_100' ? 'SYNTH_' + canonical : null`.
   - Retorna lista única ordenada priorizando o símbolo original do contrato seguido das variantes (`Array.from(new Set([rawSymbol, canonical, legacy].filter(Boolean)))`).
2. Na função `executeTransactionalDbSettlement` ([`scripts/lib/settlement-engine.mjs`](file:///d:/brokerproject/scripts/lib/settlement-engine.mjs#L629-L637)):
   - Substituir a busca restrita `WHERE symbol = $1 AND ts >= $2` com `[dbCanonicalSymbol]` por:
     ```sql
     SELECT sequence, price, ts, hash
     FROM ticks
     WHERE symbol = ANY($1::text[]) AND ts >= $2
     ORDER BY ts ASC, sequence ASC
     LIMIT 1
     ```
     passando `[symbolCandidates, contractRow.expires_at]`.
3. Na função `resolveExpiryTickFromMarket` ([`scripts/lib/settlement-engine.mjs`](file:///d:/brokerproject/scripts/lib/settlement-engine.mjs#L482-L504)):
   - Substituir o fallback SQL `WHERE symbol = $1 AND ts >= $2` por `WHERE symbol = ANY($1::text[]) AND ts >= $2` usando `buildSymbolCandidates(symbol, resolveSymbol)`.

### Passo 1.2 — Deduplicação por Ciclo em `runSweepCycle` ([`scripts/lib/settlement-engine.mjs`](file:///d:/brokerproject/scripts/lib/settlement-engine.mjs#L963-L1021))
1. Criar `const attemptedInCycle = new Set();` no início de `runSweepCycle`.
2. Ao varrer contratos em memória (`devContracts`), registrar `attemptedInCycle.add(c.id)` antes de chamar `settleOpenContract(c, 'sweeper_mem', nowMs)`.
3. Ao varrer contratos vencidos no PostgreSQL (`sweeper_db`), ignorar linhas cujo `row.id` já esteja em `attemptedInCycle`, evitando 2 transações SQL redundantes no mesmo ciclo de 500ms quando um contrato acaba de vencer e aguarda o commit do tick de 1s.

### Passo 1.3 — Paridade de Candidatos de Símbolo em [`scripts/lib/arena-http-engine.mjs`](file:///d:/brokerproject/scripts/lib/arena-http-engine.mjs) e [`services/settlement-worker/src/settlement/settler.ts`](file:///d:/brokerproject/services/settlement-worker/src/settlement/settler.ts)
1. Em [`scripts/lib/arena-http-engine.mjs`](file:///d:/brokerproject/scripts/lib/arena-http-engine.mjs):
   - Garantir que a abertura e a liquidação de trades de torneio consultem `WHERE symbol = ANY($1::text[])` incluindo `[rawSymbol, canonicalSym, 'SYNTH_' + canonicalSym]`.
2. Em [`services/settlement-worker/src/settlement/settler.ts`](file:///d:/brokerproject/services/settlement-worker/src/settlement/settler.ts):
   - Atualizar a query do tick oficial de expiração para buscar `WHERE symbol = ANY($1::text[]) AND ts >= $2` com `[contract.symbol, canonicalSymbol, 'SYNTH_' + canonicalSymbol]`.

---

## 3. Baterias Obrigatórias de Testes (`tests/settlement-symbol-resolution-stress-chaos.test.mjs`)

1. **Teste Unitário e de Paridade de Símbolos**:
   - Verifica `buildSymbolCandidates` para `SYNTH_VOL_10`, `VOL_10`, `SYNTH_VOL_25`, `VOL_25`, `SYNTH_VOL_50`, `VOL_50`, `SYNTH_VOL_75`, `VOL_75`, `SYNTH_VOL_100`, `VOL_100`, `SYNTH_CRASH_BOOM_100`, `CRASH_BOOM_100` e ativos OTC (`EURUSD_OTC`, `BTCUSD_OTC`).
2. **Teste de Integração Transacional ACID (Reprodução Exata do Bug da VPS)**:
   - Contrato gravado no banco com `symbol = 'SYNTH_VOL_50'`, `ticks` gravados no banco com `symbol = 'SYNTH_VOL_50'`, `resolveSymbol('SYNTH_VOL_50') === 'VOL_50'`.
   - Comprova que `settleOpenContract` e `runSweepCycle` encontram o primeiro tick com `ts >= expires_at`, liquidam o contrato (`status = 'SETTLED'`), gravam `exit_price` e `exit_tick_sequence` exatos e creditam `users.demo_balance_minor` com aritmética inteira `Math.floor((stake * payout_pct) / 100)`.
3. **Teste de Estresse e Concorrência Massiva (200 Contratos Simultâneos + Triplo Disparo Concorrente)**:
   - Dispara 200 contratos expirando no mesmo instante, com chamadas concorrentes de `timer`, `sweeper_mem` e `sweeper_db`.
   - Verifica que todos os 200 contratos passam para `SETTLED`, `duplicateSettlementPreventedTotal` contabiliza as colisões bloqueadas, e o saldo final do usuário reflete **exatamente 1 pagamento por contrato ganho** (Zero Double-Payout — Invariantes I-01, I-03, I-06).
4. **Teste de Segurança (Imutabilidade de Estado Terminal e Isolamento de Broadcast)**:
   - Tenta re-liquidar contrato já `SETTLED` com preço manipulado; comprova rejeição imediata (`ALREADY_SETTLED_MEM` / `ALREADY_SETTLED_IN_DB`) sem alterar `result`, `exit_price` ou `payout_minor`.
   - Verifica que o broadcast WebSocket `contract_settled` e `wallet_balance` respeita o `authenticatedUserId` de cada cliente conectado (prevenção de vazamento cross-user).
5. **Teste de Caos (Atraso de Tick Oficial, Falha Temporária de Banco e Crash Recovery)**:
   - Simula contrato vencido cujo tick oficial `ts >= expires_at` ainda não chegou nos 2 primeiros ciclos do sweeper (`WAITING_FOR_OFFICIAL_EXPIRY_TICK`), seguido da chegada do tick no 3º ciclo e liquidação imediata.
   - Simula queda temporária do PostgreSQL durante `runSweepCycle` (acionando backoff resiliente) e recuperação automática de contratos órfãos pós-restart (`contractsRecoveredFromDbTotal`).

---

## 4. Critérios de Aceite para Avançar para a Subetapa 2
- [x] `node --test tests/settlement-symbol-resolution-stress-chaos.test.mjs` 100% VERDE (5/5 testes aprovados).
- [x] Suítes existentes de settlement (`tests/subetapa-1-settlement-resilience.test.mjs`) 100% VERDES sem regressão (5/5 testes aprovados).
