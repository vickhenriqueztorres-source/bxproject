# Relatório Final — Correção Geral Pós-Verificação (`fix/correcao-geral`)

**Data:** 2026-10-16  
**Branch:** `fix/correcao-geral` (baseada em `origin/main` `1c6474c`)  
**Orquestrador:** `tech-lead-orchestrator`  

---

## 1. Resumo Executivo e Commits por Item

| Ordem | ID | Escopo | Commit SHA | Status |
|---|---|---|---|---|
| 1 | **P0-1** | Débito atômico do stake sem Blnk na mesma transação do `INSERT INTO contracts`, bloqueio `503 LEDGER_UNAVAILABLE` para conta `REAL` sem ledger, flag explícita `BLNK_ENABLED` + healthcheck no boot e script `scripts/diag/wallet-consistency.mjs` | `ba12919` | ✅ Testes passando (simulador/unit; sem execução em produção) |
| 2 | **P0-2** | Diagnóstico read-only (`scripts/diag/outbox-diagnostic.mjs`), desativação da gravação de `TICK` órfão por padrão (`OUTBOX_WRITE_TICK_EVENTS=false`), arquivamento em lotes de 10k com `FOR UPDATE SKIP LOCKED`, retenção de 7 dias para `PROCESSED`/`ARCHIVED` e métrica `outbox_oldest_pending_seconds` (alerta > 300s) | `95136da` | ✅ Testes passando (simulador/unit; sem execução em produção) |
| 3 | **P1-1** | Payout dinâmico inteiro `stake + Math.floor((stake * payoutPct) / 100)` usando o snapshot `payout_pct` gravado no contrato na abertura (Migration `0064`), validação `[0, 100]` e fallback `85` com `WARN` apenas para contratos legados | `945dc8c` | ✅ Testes passando (simulador/unit; sem execução em produção) |
| 4 | **P1-2** | Comparação de empate (`DRAW`) com inteiro escalado (`BigInt`) pela precisão do ativo (`getAssetConfig(symbol).decimals`) via `scalePriceToBigInt` + 500 execuções `fast-check` | `c26084c` | ✅ Testes passando (simulador/unit; sem execução em produção) |
| 5 | **P1-3** | Inclusão dos 74 testes `.mjs` + novos testes em `pnpm test` (`test:mjs` + `test:unit`) e criação de `.github/workflows/ci.yml` | `36b805d` | ✅ Testes passando (simulador/unit; sem execução em produção) |
| 6 | **P2-1** | `sanitizeBootPrice` estrito em `scripts/lib/ou-engine.mjs`: (1) `lastClose` ±5%, (2) faixa `[0.7×; 1.4×]` da base (rejeita `VOL_50` em `999.64`), (3) fallback com log `WARN` e erro explícito para base inválida | `c72708b` | ✅ Testes passando (simulador/unit; sem execução em produção) |
| 7 | **P2-2** | Diagnóstico `scripts/diag/cross-asset-correlation.mjs` (`1m`, `limit=1440`, 36 ativos / 630 pares, dupla janela): `corr(VOL_100, EURUSD_OTC) = -0.004839` (`|corr| < 0.10`), zero correlação persistente | `641b5b2` | ✅ Testes passando (simulador/unit; sem execução em produção) |
| 8 | **P3-1** | Habilitação de `gzip on;`, `gzip_static on;` e `Cache-Control: public, max-age=31536000, immutable` para `/assets/` em `scripts/update-nginx-ssl.mjs` | `b81de31` | ✅ Testes passando (simulador/unit; sem execução em produção) |
| 9 | **P3-2** | Documentação completa de todas as flags e variáveis `process.env.*` de `scripts/` e `services/` no `.env.example` + teste automatizado | `8d8207f` | ✅ Testes passando (simulador/unit; sem execução em produção) |

---

## 2. Varredura de Caminhos de Saldo (P0-1 Passo 3)

Evidência: `git grep -E "demo_balance_minor\s*=|real_balance_minor\s*="` em `scripts/` e `services/api/src` (2026-10-16).

| Caminho | Arquivo:Linha | Debita | Credita | Mesma transação? |
|---|---|---|---|---|
| Abertura de contrato, sem Blnk | `scripts/lib/settlement-engine.mjs:406` (`executeAtomicContractOpen`) | `users.demo_balance_minor - stake` com `AND demo_balance_minor >= stake` | — | Sim, junto com `INSERT INTO contracts` |
| Abertura de contrato, com Blnk | `executeAtomicContractOpen` (ramo `blnkActive`) | `blnk.reserveStake` | — | Não aplicável (Blnk é a fonte da verdade; `users` não é debitado) |
| Conta REAL sem Blnk | `executeAtomicContractOpen` e `scripts/dev-live-feed.mjs` (checagem `accountType === 'REAL' && !blnkEnabled`) | recusa antes de mutar | — | `503 LEDGER_UNAVAILABLE` |
| Liquidação, sem Blnk (pool real) | `settlement-engine.mjs:706` | — | `+payoutMinor` | Sim, junto com `UPDATE contracts` |
| Liquidação, caminho em memória/mock | `settlement-engine.mjs:833` | — | `+payoutMinor` | **Não**: `UPDATE contracts` e `UPDATE users` são queries separadas (comportamento preexistente, só alcançado sem pool transacional) |
| Confirmação de depósito | `scripts/dev-live-feed.mjs:1969` | — | `+amount_minor` | Não: `UPDATE wallet_transactions` e `UPDATE users` são queries separadas; **não passa pelo Blnk** |
| Saque | `scripts/dev-live-feed.mjs:2035` | `- amount_minor` com guarda de saldo | — | Não verificado até o fim (a leitura parou antes do `INSERT INTO wallet_transactions`); **não passa pelo Blnk** |
| Sincronização de leitura | `scripts/lib/wallet-read-engine.mjs:129` | — | sobrescreve `users.demo_balance_minor` com o saldo lido do Blnk | — |
| Verificação de e-mail (reseta saldo demo para 1.000.000) | `dev-live-feed.mjs:1361/1381/1400`, `services/api/src/services/auth-service.ts:460/483` | — | `= 1000000` | — |
| Arena / torneio | `scripts/lib/arena-http-engine.mjs` | **não revisado**: o grep não achou `SET demo_balance_minor` nesse arquivo | — | **Pendente de revisão manual** |

### Pontos em aberto (não corrigidos nesta branch, fora do escopo dos 9 itens)
1. Depósito e saque mexem em `users.demo_balance_minor` sem passar pelo Blnk. Com `BLNK_ENABLED=true`, o `wallet-read-engine.mjs:129` sobrescreve esse campo com o saldo do Blnk, então um depósito confirmado pode ser apagado na próxima leitura. Precisa de decisão de produto/arquitetura.
2. O caminho de liquidação em memória (`settlement-engine.mjs:833`) não é atômico com o `UPDATE contracts`.
3. Arena/torneio não foi revisado.
4. O script de diagnóstico de produção (`wallet-consistency.mjs`) foi escrito e testado apenas contra simulador em memória. **Não foi executado contra o banco de produção.** O mesmo vale para `outbox-diagnostic.mjs`, que no ambiente local só devolveu o mapeamento estático de consumidores porque o PostgreSQL local estava offline.
5. `scripts/update-nginx-ssl.mjs` e `scripts/deploy-to-vps.mjs` contêm host e senha SSH em texto puro, preexistentes. Não foram tocados além do bloco gzip, mas precisam ser rotacionados e movidos para variáveis de ambiente.

---

## 3. Decisão Arquitetural da Outbox (P0-2 Passo 1 & 2)

1. **Mapeamento de `event_type` em `outbox_events`:**
   - `TICK`: gravado em `services/tick-engine/live-market-store.mjs` (`produceTick` e `produceTicksBatch`) a 36 eventos/s (~3,11M/dia), **sem consumidor** no código do repositório (não conferido contra o banco de produção) (o `dev-live-feed.mjs` transmite ticks diretamente em memória para o WebSocket após o `COMMIT`, e `services/outbox-relay` procurava `TICK_GENERATED`).
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

