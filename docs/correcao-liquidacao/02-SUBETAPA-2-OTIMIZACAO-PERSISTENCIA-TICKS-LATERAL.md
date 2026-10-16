# Subetapa 2 — Otimização O(log N) da Persistência em Lote de Ticks (`CROSS JOIN LATERAL`)

**Orquestrador:** `tech-lead-orchestrator`  
**Agentes Alocados:** `backend-implementation-agent`, `broker-architect-agent`, `qa-resilience-agent`, `financial-correctness-reviewer`  
**Skills Ativadas:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `08-database-foundation`, `10-post-implementation-verification`

---

## 1. Objetivo da Subetapa
Eliminar o gargalo severo de banco de dados em [`services/tick-engine/live-market-store.mjs`](file:///d:/brokerproject/services/tick-engine/live-market-store.mjs#L330-L336), onde a consulta `SELECT DISTINCT ON (symbol) ... FROM ticks WHERE symbol = ANY($1::varchar[]) ORDER BY symbol ASC, sequence DESC` executava um *Bitmap Heap Scan* de ~685.000 linhas + *External Merge Sort em Disco* a cada 1 segundo (`tick_persist_ms = 2.384 ms`, derrubando `ticks_per_5s_bucket` para `1` e atrasando o tick oficial de liquidação).

---

## 2. Passo a Passo de Implementação

### Passo 2.1 — Substituição de `SELECT DISTINCT ON` por `UNNEST(...) CROSS JOIN LATERAL` em [`services/tick-engine/live-market-store.mjs`](file:///d:/brokerproject/services/tick-engine/live-market-store.mjs)
1. Em `produceTicksBatch` ([`services/tick-engine/live-market-store.mjs`](file:///d:/brokerproject/services/tick-engine/live-market-store.mjs#L330-L336)):
   - Substituir:
     ```sql
     SELECT DISTINCT ON (symbol) symbol, sequence, price, hash, ts
     FROM ticks
     WHERE symbol = ANY($1::varchar[])
     ORDER BY symbol ASC, sequence DESC
     ```
   - Por:
     ```sql
     SELECT t.symbol, t.sequence, t.price, t.hash, t.ts
     FROM UNNEST($1::varchar[]) AS u(sym)
     CROSS JOIN LATERAL (
       SELECT symbol, sequence, price, hash, ts
       FROM ticks
       WHERE symbol = u.sym
       ORDER BY sequence DESC
       LIMIT 1
     ) t
     ```
   - **Por que funciona em $O(\log N)$**: Para cada um dos 36 símbolos em `UNNEST`, o PostgreSQL executa `Index Scan Backward using uq_ticks_symbol_sequence on ticks` com `LIMIT 1`, lendo **apenas 1 página de índice por símbolo** (36 tuplas no total em `< 0.5 ms`), eliminando 100% do sort em disco de 685.000 linhas.

### Passo 2.2 — Preservação Inviolável das Garantias de Hash-Chain e Fencing Token
1. Manter intacta a verificação `checkHead({ ...row, symbol: item.dbSym }, latestByDbSym.get(item.dbSym))` para cada ativo do lote.
2. Manter intacta a verificação de `lease_epoch` e `lease_leader` (`FENCED` / `LEASE_LOST`) e a renovação atômica via Lua script no Redis (`renewLease`).

---

## 3. Baterias Obrigatórias de Testes (`tests/tick-persistence-lateral-chaos.test.mjs`)

1. **Teste Unitário e Estrutural da Query `CROSS JOIN LATERAL`**:
   - Verifica que `produceTicksBatch` utiliza a estratégia `CROSS JOIN LATERAL` com `ORDER BY sequence DESC LIMIT 1` e valida paridade exata de `checkHead` quando há 0 ticks (gênese) ou múltiplos ticks por ativo.
2. **Teste de Estresse de Persistência Multi-Ativo (36 Ativos x Múltiplos Ciclos)**:
   - Executa ciclos consecutivos de `produceTicksBatch` para todos os 36 ativos sintéticos e OTC, validando monotonicidade estrita (`sequence = prev + 1`), encadeamento criptográfico SHA-256 (`prev_hash` $\to$ `hash`) e agregação de velas de 1m.
3. **Teste de Segurança (Fencing Token / Split-Brain Protection)**:
   - Simula perda de lease (`lease_epoch` divergente ou `renewLease` retornando `0`) no meio do lote e comprova que a transação inteira sofre `ROLLBACK` sem persistir ticks parciais ou órfãos.
4. **Teste de Caos (Falha de Conexão / Rollback Atômico)**:
   - Simula erro de I/O no PostgreSQL durante o lote, verifica incremento de `tick_dropped_total`, liberação segura do cliente do pool (`client.release(broken)`) e retomada limpa no segundo seguinte sem quebrar a hash-chain.

---

## 4. Critérios de Aceite para Avançar para a Subetapa 3
- [x] `node --test tests/tick-persistence-lateral-chaos.test.mjs` 100% VERDE (3/3 testes aprovados).
- [x] `node --test tests/subetapa-5-2-real-5s-candles-unification.test.mjs` 100% VERDE (5/5 testes aprovados).
