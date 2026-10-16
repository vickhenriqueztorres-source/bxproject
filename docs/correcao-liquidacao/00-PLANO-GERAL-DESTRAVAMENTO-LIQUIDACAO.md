# Plano Geral — Destravamento de Operações em `"Liquidando..."` e Otimização do Pipeline de Liquidação

**Data:** 2026-10-16  
**Orquestrador:** `tech-lead-orchestrator` ([ORCHESTRATOR.md](file:///d:/brokerproject/ORCHESTRATOR.md) / [AGENTS.md](file:///d:/brokerproject/AGENTS.md))  
**Status:** Planejado e pronto para execução sequencial por subetapas (Gate-by-Gate)

---

## 1. Ativação do Orquestrador: Seleção de Agentes e Skills

Conforme a governança definida em [ORCHESTRATOR.md](file:///d:/brokerproject/ORCHESTRATOR.md) e [AGENTS.md](file:///d:/brokerproject/AGENTS.md), o `tech-lead-orchestrator` selecionou o seguinte pool de especialistas e skills permanentes para diagnosticar, planejar, implementar e validar a correção sem regressões:

### 1.1. Agentes Selecionados (Pool de Workers)
| Ordem | Agente | Papel na Força-Tarefa | Escopo de Permissão |
| :--- | :--- | :--- | :--- |
| **1** | `bug-fix-agent` | Triagem forense no código e banco de produção (VPS), reprodução determinística da falha antes da correção e diff cirúrgico na cadeia causal. | `write-code` (cadeia causal do defeito) |
| **2** | `backend-implementation-agent` | Correção da resolução bidirecional de símbolos (`VOL_*` $\leftrightarrow$ `SYNTH_VOL_*`) no motor de liquidação transacional e otimização da query de cabeçalho de ticks (`CROSS JOIN LATERAL`). | `write-code` (`scripts/**`, `services/**`) |
| **3** | `frontend-realtime-agent` | Implementação do watchdog de reconciliação para operações em `"Liquidando..."`, autenticação no handshake WebSocket e normalização de símbolos/payout inteiro no drawer de portfólio. | `write-code` (`apps/web/**`) |
| **4** | `qa-resilience-agent` | Construção e execução das baterias de testes unitários, integração, estresse (concorrência massiva), segurança (BOLA/IDOR, imutabilidade) e caos (queda de WS, atraso de tick, crash recovery). | `write-tests-only` (`tests/**`, `apps/web/src/__tests__/**`) |
| **5** | `financial-correctness-reviewer` | Revisão estrita das invariantes financeiras (I-01 a I-06, D-14, D-18): garantia de que nenhum contrato seja liquidado duas vezes e que o tick oficial `ts >= expires_at` seja respeitado. | `read-only` (Poder de Veto) |
| **6** | `security-reviewer` | Revisão de segurança (S-01 a S-06): escopo de `user_id` nas consultas e broadcasts, proibição de mass assignment e integridade de estados terminais. | `read-only` (Poder de Veto) |
| **7** | `post-implementation-verifier` | Validação independente pós-implementação local e na VPS (`169.58.159.77`), comprovando por execução que 100% dos contratos travados foram liquidados e novos contratos liquidam em tempo real. | `read-only` (Fechamento de Gate) |

### 1.2. Skills Permanentes Ativadas
- [`01-project-context`](file:///d:/brokerproject/.agents/skills/01-project-context/SKILL.md): Arquitetura da plataforma, separação de responsabilidades e decisões imutáveis (D-01 a D-18).
- [`02-financial-invariants`](file:///d:/brokerproject/.agents/skills/02-financial-invariants/SKILL.md): Invariantes financeiras I-01 a I-06, aritmética inteira `*_minor` (D-18) e liquidação pelo primeiro tick oficial `ts >= expires_at` (D-14).
- [`03-synthetic-market-engine`](file:///d:/brokerproject/.agents/skills/03-synthetic-market-engine/SKILL.md): Geração CSPRNG, sequência monotônica sem gaps, hash-chain SHA-256 e persistência transacional.
- [`04-security-iam`](file:///d:/brokerproject/.agents/skills/04-security-iam/SKILL.md): Prevenção de BOLA/IDOR, validação de token e isolamento de dados por `user_id`.
- [`05-resilience-patterns`](file:///d:/brokerproject/.agents/skills/05-resilience-patterns/SKILL.md): Idempotência, locks pessimistas (`SELECT ... FOR UPDATE`), backoff e recuperação automática por sweeper.
- [`06-testing-quality`](file:///d:/brokerproject/.agents/skills/06-testing-quality/SKILL.md): Pirâmide de testes reais (unitários, integração, estresse, segurança e caos).
- [`08-database-foundation`](file:///d:/brokerproject/.agents/skills/08-database-foundation/SKILL.md): Performance de consultas PostgreSQL, uso de índices B-Tree (`uq_ticks_symbol_sequence`, `idx_ticks_symbol_ts`) e prevenção de table scans.
- [`09-ai-failure-map`](file:///d:/brokerproject/.agents/skills/09-ai-failure-map/SKILL.md): Prevenção de alucinações, condições de corrida (TOCTOU) e cálculos float.
- [`10-post-implementation-verification`](file:///d:/brokerproject/.agents/skills/10-post-implementation-verification/SKILL.md): Prova matemática pós-implementação das garantias V-01 a V-13.

---

## 2. Diagnóstico Forense Comprovado (Cadeia Causal Raiz)

A inspeção forense no código-fonte e no banco de dados PostgreSQL em execução na VPS (`169.58.159.77`) identificou **4 causas raiz encadeadas** que explicam por que os contratos da imagem (`#e847d79e`, `#f3ff54fa`, `#a5ade895`, etc.) ficaram travados em `"Liquidando..."` (`0s`) com `status = 'OPEN'`:

### Causa Raiz #1 (Bloqueio Principal): Inversão de Símbolo (`SYNTH_VOL_50` $\to$ `VOL_50`) na Busca do Tick Oficial de Expiração
1. Na tabela `indices` e na tabela `ticks` do PostgreSQL, os índices sintéticos estão persistidos com o prefixo `SYNTH_` (`SYNTH_VOL_10`, `SYNTH_VOL_25`, `SYNTH_VOL_50`, `SYNTH_VOL_75`, `SYNTH_VOL_100`, `SYNTH_CRASH_BOOM_100`).
2. Na abertura de contrato (`POST /contracts` em [`scripts/dev-live-feed.mjs`](file:///d:/brokerproject/scripts/dev-live-feed.mjs#L2931-L2938)), o backend resolve `dbSymbol = 'SYNTH_VOL_50'` consultando `SELECT symbol FROM indices WHERE symbol IN ($1, $2)` e grava o contrato na tabela `contracts` com `symbol = 'SYNTH_VOL_50'`.
3. Porém, no momento de liquidar o contrato em [`scripts/lib/settlement-engine.mjs`](file:///d:/brokerproject/scripts/lib/settlement-engine.mjs#L629-L637) (`executeTransactionalDbSettlement`), o código executava:
   ```javascript
   const dbCanonicalSymbol = resolveSymbol(contractRow.symbol); // Converte 'SYNTH_VOL_50' -> 'VOL_50'!
   const tickRes = await client.query(
     `SELECT sequence, price, ts, hash
      FROM ticks
      WHERE symbol = $1 AND ts >= $2
      ORDER BY ts ASC, sequence ASC
      LIMIT 1`,
     [dbCanonicalSymbol, contractRow.expires_at]
   );
   ```
4. Como `resolveSymbol('SYNTH_VOL_50')` retorna `'VOL_50'`, a query buscava `WHERE symbol = 'VOL_50'` na tabela `ticks`, onde **todas as 19.050 linhas têm `symbol = 'SYNTH_VOL_50'`** e **nenhuma linha tem `symbol = 'VOL_50'`**!
5. Consequentemente, `tickRes.rowCount === 0` em 100% das tentativas, fazendo `executeTransactionalDbSettlement` dar `ROLLBACK` e retornar `{ ok: false, settled: false, retryable: true, reason: 'WAITING_FOR_OFFICIAL_EXPIRY_TICK' }` infinitamente (2.265 ciclos de sweeper executados na VPS e `0` contratos liquidados).
6. A mesma fragilidade existe em `resolveExpiryTickFromMarket` ([`scripts/lib/settlement-engine.mjs`](file:///d:/brokerproject/scripts/lib/settlement-engine.mjs#L482-L504)), em [`scripts/lib/arena-http-engine.mjs`](file:///d:/brokerproject/scripts/lib/arena-http-engine.mjs#L505-L512) e em [`services/settlement-worker/src/settlement/settler.ts`](file:///d:/brokerproject/services/settlement-worker/src/settlement/settler.ts#L60-L68).

### Causa Raiz #2 (Gargalo Grave de Banco): `SELECT DISTINCT ON (symbol)` com External Disk Merge Sort (`2.384 ms` por lote de ticks)
1. Nas métricas Prometheus da VPS (`/metrics`), identificou-se:
   - `tick_persist_ms = 2384.442` (2,38 segundos para gravar 1 lote de ticks de 1s!)
   - `tick_persist_p99_ms = 2757.563`
   - `ticks_per_5s_bucket = 1` (em vez de `5`)
   - `missed_tick_slots_total = 756` e `tick_dropped_total = 324`
2. O `EXPLAIN ANALYZE` no PostgreSQL comprovou que a consulta em [`services/tick-engine/live-market-store.mjs`](file:///d:/brokerproject/services/tick-engine/live-market-store.mjs#L330-L336):
   ```sql
   SELECT DISTINCT ON (symbol) symbol, sequence, price, hash, ts
   FROM ticks
   WHERE symbol = ANY($1::varchar[])
   ORDER BY symbol ASC, sequence DESC
   ```
   faz um **Bitmap Heap Scan de ~685.000 linhas seguido de External Merge Sort em Disco** a cada 1 segundo!
3. Ao substituir por busca indexada `UNNEST($1::varchar[]) CROSS JOIN LATERAL (SELECT ... FROM ticks WHERE symbol = u.sym ORDER BY sequence DESC LIMIT 1)`, o PostgreSQL usa `Index Scan Backward using uq_ticks_symbol_sequence` (1 leitura O(log N) por ativo), reduzindo o tempo de execução no banco de **`2.384 ms` para `0.48 ms`** (ganho de **>1.250x**).

### Causa Raiz #3 (Contenção no Sweeper): Dupla Tentativa no Mesmo Ciclo de 500ms
1. Em [`scripts/lib/settlement-engine.mjs`](file:///d:/brokerproject/scripts/lib/settlement-engine.mjs#L963-L1021) (`runSweepCycle`), contratos abertos presentes tanto em `devContracts` (memória) quanto na tabela `contracts` (PostgreSQL) sofriam duas tentativas de transação SQL dentro do mesmo ciclo de 500ms caso a primeira tentativa retornasse `WAITING_FOR_OFFICIAL_EXPIRY_TICK`.

### Causa Raiz #4 (Sincronização Frontend): Ausência de Reconciliação Ativa para Contratos em `"Liquidando..."`
1. Em [`apps/web/src/App.tsx`](file:///d:/brokerproject/apps/web/src/App.tsx#L322-L513), a atualização por timer após expirar (`setTimeout` em `expires_at + 500ms`) só era agendada dentro de `handleBuy`. Se o usuário recarregasse a página com operações abertas, ou se o commit do tick levasse >500ms após `expires_at` e o frame WebSocket sofresse reconexão, o estado local não voltava a consultar `GET /contracts`, mantendo o card em `"Liquidando..."` até um evento de `window.focus`.
2. Em [`apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`](file:///d:/brokerproject/apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx#L177-L185), o lookup `currentPrices?.[c.symbol]` não buscava o alias canônico sem `SYNTH_` (`VOL_50`) quando `c.symbol === 'SYNTH_VOL_50'`, e o cálculo de lucro estimado usava float (`Math.round(stake * 0.85)`) em vez de inteiro estrito (`Math.floor((stake * pct) / 100)`).

---

## 3. Divisão em Subetapas Sequenciais (Gate-by-Gate)

> [!IMPORTANT]
> **Regra de Ouro de Execução:**  
> Nenhuma subetapa será iniciada antes que a subetapa anterior esteja **100% implementada, testada (unitário, integração, estresse, segurança e caos) e validada sem quebrar nenhuma funcionalidade existente**.

| Subetapa | Documento Passo a Passo | Foco Técnico | Testes Obrigatórios (Gate) |
| :--- | :--- | :--- | :--- |
| **Subetapa 1** | [`01-SUBETAPA-1-MOTOR-LIQUIDACAO-SIMBOLOS-CANONICOS.md`](./01-SUBETAPA-1-MOTOR-LIQUIDACAO-SIMBOLOS-CANONICOS.md) | Resolução bidirecional de símbolos (`buildSymbolCandidates`) em `settlement-engine.mjs`, `arena-http-engine.mjs`, `settler.ts` e `contract-service.ts` + deduplicação por ciclo no `runSweepCycle`. | `tests/settlement-symbol-resolution-stress-chaos.test.mjs` (Unitário, Integração ACID, Estresse 200 contratos simultâneos, Segurança/Imutabilidade e Caos/Atraso de Tick + Crash Recovery). |
| **Subetapa 2** | [`02-SUBETAPA-2-OTIMIZACAO-PERSISTENCIA-TICKS-LATERAL.md`](./02-SUBETAPA-2-OTIMIZACAO-PERSISTENCIA-TICKS-LATERAL.md) | Otimização O(log N) em `live-market-store.mjs` (`CROSS JOIN LATERAL` no `uq_ticks_symbol_sequence`) eliminando o External Disk Merge Sort de `2.38s`. | `tests/tick-persistence-lateral-chaos.test.mjs` + `services/tick-engine/test/live-market-store.integration.test.mjs` (Performance, Hash-Chain, Fencing Token Security e Rollback Caos). |
| **Subetapa 3** | [`03-SUBETAPA-3-RECONCILIACAO-FRONTEND-TEMPO-REAL.md`](./03-SUBETAPA-3-RECONCILIACAO-FRONTEND-TEMPO-REAL.md) | Watchdog de reconciliação ativa em `App.tsx` para contratos vencidos + auth WS + normalização `SYNTH_` e cálculo inteiro em `BinmaxPortfolioDrawer.tsx`. | `apps/web/src/__tests__/settlement-reconciliation-resilience.test.tsx` + suíte Vitest e build completo de produção (`pnpm --filter @synth-broker/web build`). |
| **Subetapa 4** | [`04-SUBETAPA-4-DEPLOY-VERIFICACAO-PRODUCAO-POS-IMPLEMENTACAO.md`](./04-SUBETAPA-4-DEPLOY-VERIFICACAO-PRODUCAO-POS-IMPLEMENTACAO.md) | Regressão global, deploy na VPS (`169.58.159.77`) e auditoria pós-implementação das 8 operações travadas + teste real ponta a ponta na VPS. | Auditoria SQL na VPS (`0` contratos `OPEN` vencidos), `tick_persist_ms < 50ms`, `ticks_per_5s_bucket = 5` e abertura/liquidação real verificada. |
