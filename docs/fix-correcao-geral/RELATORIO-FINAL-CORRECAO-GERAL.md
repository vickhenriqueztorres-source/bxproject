# Relatório Final — Correção Geral Pós-Verificação (`fix/correcao-geral`)

**Data:** 2026-10-16  
**Branch:** `fix/correcao-geral` (baseada em `origin/main` `1c6474c`)  
**Orquestrador:** `tech-lead-orchestrator`  

---

## 1. Resumo Executivo e Commits por Item

| Ordem | ID | Escopo | Commit SHA | Status |
|---|---|---|---|---|
| 1 | **P0-1** | Débito atômico do stake sem Blnk na mesma transação do `INSERT INTO contracts`, bloqueio `503 LEDGER_UNAVAILABLE` para conta `REAL` sem ledger, flag explícita `BLNK_ENABLED` + healthcheck no boot e script `scripts/diag/wallet-consistency.mjs` | `ba12919` | ✅ 100% Validado |
| 2 | **P0-2** | Diagnóstico read-only (`scripts/diag/outbox-diagnostic.mjs`), desativação da gravação de `TICK` órfão por padrão (`OUTBOX_WRITE_TICK_EVENTS=false`), arquivamento em lotes de 10k com `FOR UPDATE SKIP LOCKED`, retenção de 7 dias para `PROCESSED`/`ARCHIVED` e métrica `outbox_oldest_pending_seconds` (alerta > 300s) | `95136da` | ✅ 100% Validado |
| 3 | **P1-1** | Payout dinâmico inteiro `stake + Math.floor((stake * payoutPct) / 100)` usando o snapshot `payout_pct` gravado no contrato na abertura (Migration `0064`), validação `[0, 100]` e fallback `85` com `WARN` apenas para contratos legados | `945dc8c` | ✅ 100% Validado |
| 4 | **P1-2** | Comparação de empate (`DRAW`) com inteiro escalado (`BigInt`) pela precisão do ativo (`getAssetConfig(symbol).decimals`) via `scalePriceToBigInt` + 500 execuções `fast-check` | `c26084c` | ✅ 100% Validado |
| 5 | **P1-3** | Inclusão dos 74 testes `.mjs` + novos testes em `pnpm test` (`test:mjs` + `test:unit`) e criação de `.github/workflows/ci.yml` | `36b805d` | ✅ 100% Validado |
| 6 | **P2-1** | `sanitizeBootPrice` estrito em `scripts/lib/ou-engine.mjs`: (1) `lastClose` ±5%, (2) faixa `[0.7×; 1.4×]` da base (rejeita `VOL_50` em `999.64`), (3) fallback com log `WARN` e erro explícito para base inválida | `c72708b` | ✅ 100% Validado |
| 7 | **P2-2** | Diagnóstico `scripts/diag/cross-asset-correlation.mjs` (`1m`, `limit=1440`, 36 ativos / 630 pares, dupla janela): `corr(VOL_100, EURUSD_OTC) = -0.004839` (`|corr| < 0.10`), zero correlação persistente | `641b5b2` | ✅ 100% Validado |
| 8 | **P3-1** | Habilitação de `gzip on;`, `gzip_static on;` e `Cache-Control: public, max-age=31536000, immutable` para `/assets/` em `scripts/update-nginx-ssl.mjs` | `b81de31` | ✅ 100% Validado |
| 9 | **P3-2** | Documentação completa de todas as flags e variáveis `process.env.*` de `scripts/` e `services/` no `.env.example` + teste automatizado | `b968ed5` | ✅ 100% Validado |

---

## 2. Varredura de Caminhos de Saldo (P0-1 Passo 3)

| Caminho | Arquivo:Linha | Debita | Credita | Transação / Fonte da Verdade |
|---|---|---|---|---|
| **Abertura de Contrato (Modo sem Blnk: `BLNK_ENABLED=false`)** | `scripts/lib/settlement-engine.mjs:313-378` (`executeAtomicContractOpen`) | `UPDATE users SET demo_balance_minor = demo_balance_minor - $1 WHERE id = $2 AND demo_balance_minor >= $1 RETURNING demo_balance_minor` | — | **Sim** (`BEGIN ... COMMIT` atômico junto com `INSERT INTO contracts` e `INSERT INTO outbox_events`) |
| **Abertura de Contrato (Modo com Blnk: `BLNK_ENABLED=true`)** | `scripts/lib/settlement-engine.mjs:277-311` (`executeAtomicContractOpen`) | `blnk.reserveStake(userId, contractId, stakeMinor)` (`@UserAvailable -> @UserReserved`) | — | Idempotente no Blnk (`reserve:{contractId}`); **não** debita `users.demo_balance_minor` (evita débito duplo) |
| **Abertura de Contrato Conta REAL sem Blnk** | `scripts/lib/settlement-engine.mjs:256-267` e `scripts/dev-live-feed.mjs:2964-2970` | Bloqueado antes de qualquer mutação | — | Recusa imediata com HTTP `503 LEDGER_UNAVAILABLE` |
| **Liquidação de Contrato (Modo sem Blnk: `BLNK_ENABLED=false`)** | `scripts/lib/settlement-engine.mjs:614-636` (`settleOpenContract`) | — | `WIN`: `+payoutMinor` (`stake + floor(stake*pct/100)`); `DRAW`: `+stake`; `LOSS`: `0` | **Sim** (`BEGIN ... SELECT FOR UPDATE ... UPDATE contracts ... UPDATE users ... COMMIT`) |
| **Liquidação de Contrato (Modo com Blnk: `BLNK_ENABLED=true`)** | `scripts/lib/settlement-engine.mjs:576-592` (`settleOpenContract`) | `LOSS`: `@UserReserved -> @HouseRevenue` | `WIN`: `@UserReserved + @HousePool -> @UserAvailable`; `DRAW`: `@UserReserved -> @UserAvailable` | Idempotente no Blnk (`settle:{contractId}`); **não** credita `users.demo_balance_minor` |
| **Recarga / Reset de Conta Demo (`POST /wallet/reload` / `/wallet/reset`)** | `scripts/dev-live-feed.mjs:2725-2765` | — | Ajusta `demo_balance_minor = 1000000` ($10,000.00) | Operação explícita exclusiva de conta Demo |
| **Arena / Torneio (`joinArenaTournament`)** | `scripts/lib/arena-http-engine.mjs:215-310` | Debita `entry_fee_minor` (`demo_balance_minor` em Demo ou `real_balance_minor` + escrow em Real) | Credita premiação na distribuição final do torneio | **Sim** (`BEGIN ... SELECT FOR UPDATE ... COMMIT`) |

---

## 3. Decisão Arquitetural da Outbox (P0-2 Passo 1 & 2)

1. **Mapeamento de `event_type` em `outbox_events`:**
   - `TICK`: gravado em `services/tick-engine/live-market-store.mjs` (`produceTick` e `produceTicksBatch`) a 36 eventos/s (~3,11M/dia), **sem consumidor** em produção (o `dev-live-feed.mjs` transmite ticks diretamente em memória para o WebSocket após o `COMMIT`, e `services/outbox-relay` procurava `TICK_GENERATED`).
   - `RESERVE_STAKE` e `CONTRACT_SETTLED`: já gravados com `status = 'PROCESSED'` dentro da própria transação de abertura/liquidação; eventuais `PENDING` legados são consumidos por `services/outbox-relay` (`LIMIT 500`, `FOR UPDATE SKIP LOCKED`, `FAILED` após 5 tentativas).
2. **Ação Implementada (Opção B para `TICK` + Arquivamento e Retenção):**
   - Gravação de `TICK` na `outbox_events` desativada por padrão no `dev-live-feed.mjs` (`OUTBOX_WRITE_TICK_EVENTS=false`).
   - `archiveLegacyPendingOutbox(pgPool, { cutoffIso, batchLimit: 10_000 })` marca pendentes antigos como `ARCHIVED` em lotes de 10.000 com `FOR UPDATE SKIP LOCKED`.
   - `pruneProcessedAndArchivedOutbox(pgPool, { retentionDays: 7, batchLimit: 10_000 })` remove `PROCESSED` e `ARCHIVED` com mais de 7 dias em lotes.
   - `/metrics` expõe `outbox_oldest_pending_seconds` e `outbox_oldest_pending_alert` (`> 300s`).

---

## 4. Resultado da Matriz de Correlação 36×36 em 1440m (P2-2)

- **Ativos analisados:** 36 (`630` pares únicos, `1440` velas de `1m` por ativo).
- **Par `VOL_100 × EURUSD_OTC`:**
  - Janela 1 (`1440` min): `-0.004839` (`|corr| = 0.0048 < 0.10`)
  - Janela 2 (`1440` min): `-0.041064` (`|corr| = 0.0411 < 0.10`)
- **Máxima correlação absoluta entre todos os 630 pares:**
  - Janela 1: `0.093227` (`0` pares `>= 0.10`)
  - Janela 2: `0.096908` (`0` pares `>= 0.10`)
  - Pares persistentes `>= 0.10` nas duas janelas: **`0` (`[]`)**.
- **Conclusão:** O valor `-0.107` observado anteriormente em 398 minutos era ruído amostral de janela curta; nenhuma alteração em `ou-engine.mjs` foi necessária para correlação.

---

## 5. Arquivos Intocados Conforme Regra Geral

Confirmado via `git diff 1c6474c..HEAD`:
- `scripts/lib/candle-aggregation-engine.mjs` — **0 linhas alteradas**
- `scripts/lib/aligned-tick-scheduler.mjs` — **0 linhas alteradas**
- `scripts/sentiment/**` — **0 linhas alteradas**
- Catálogos de câmbio e i18n — **0 linhas alteradas**
- `scripts/lib/ou-engine.mjs` — **Apenas `sanitizeBootPrice` (P2-1) e alias `decimals` em `getAssetConfig` (P1-2)**; motor OU (`stepPrice1s`, `generateSeededHistoricalCandlesUnified`, `generateForwardGapCandles`) **intocado**.
