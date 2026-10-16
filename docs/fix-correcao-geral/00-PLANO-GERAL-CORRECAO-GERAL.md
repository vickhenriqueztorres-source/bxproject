# Plano Geral — Correção Pós-Verificação (P0, P1, P2, P3)

**Projeto:** Binmax (`brokerproject`)  
**Base:** `origin/main` (`1c6474c`)  
**Branch de Trabalho:** `fix/correcao-geral`  
**Data:** 2026-10-16  
**Orquestrador:** `tech-lead-orchestrator`  

---

## 1. Governança do Orquestrador: Seleção de Agentes e Skills

Conforme definido em [`AGENTS.md`](../../AGENTS.md) e [`ORCHESTRATOR.md`](../../ORCHESTRATOR.md), o `tech-lead-orchestrator` coordena o pool de agentes especializados e ativa as skills permanentes do projeto para solucionar os 9 itens abertos na auditoria pós-verificação sem regredir nenhum subsistema já homologado.

### 1.1 Mapa de Agentes Selecionados por Subetapa

| Subetapa | Item | Agente Implementador | Agentes Revisores / Verificadores | Skills Ativadas |
|---|---|---|---|---|
| **Subetapa 01** | **P0-1** — Débito de Stake sem Blnk, Modo Real Fail-Closed, `BLNK_ENABLED` e Consistência | `backend-implementation-agent` + `bug-fix-agent` | `financial-correctness-reviewer`, `security-reviewer`, `qa-resilience-agent`, `post-implementation-verifier` | `01-project-context`, `02-financial-invariants`, `04-security-iam`, `05-resilience-patterns`, `06-testing-quality`, `08-database-foundation`, `10-post-implementation-verification`, `17-mudanca-cirurgica` |
| **Subetapa 02** | **P0-2** — Outbox (2M Pendentes): Diagnóstico, Decisão, Arquivamento em Lote, Retenção 7d e Alerta | `backend-implementation-agent` + `broker-architect-agent` | `financial-correctness-reviewer`, `qa-resilience-agent`, `post-implementation-verifier` | `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `07-production-operations`, `08-database-foundation` |
| **Subetapa 03** | **P1-1** — Payout Configurável (`payout_pct` Snapshot no Contrato + Aritmética Inteira) | `backend-implementation-agent` | `financial-correctness-reviewer`, `qa-resilience-agent`, `post-implementation-verifier` | `01-project-context`, `02-financial-invariants`, `06-testing-quality`, `08-database-foundation`, `17-mudanca-cirurgica` |
| **Subetapa 04** | **P1-2** — Empate (`DRAW`) com Inteiro Escalado pela Precisão do Ativo + `fast-check` | `backend-implementation-agent` | `financial-correctness-reviewer`, `qa-resilience-agent` | `02-financial-invariants`, `03-synthetic-market-engine`, `06-testing-quality`, `17-mudanca-cirurgica` |
| **Subetapa 05** | **P1-3** — Suíte Completa `.mjs` em `pnpm test` e Workflow `.github/workflows/ci.yml` | `qa-resilience-agent` + `backend-implementation-agent` | `regression-guardian-agent`, `post-implementation-verifier` | `06-testing-quality`, `07-production-operations`, `09-ai-failure-map`, `10-post-implementation-verification` |
| **Subetapa 06** | **P2-1** — `sanitizeBootPrice` Estrito (`lastClose` ±5%, Base `[0.7×; 1.4×]`, Log WARN) | `backend-implementation-agent` | `broker-architect-agent`, `qa-resilience-agent` | `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `17-mudanca-cirurgica` |
| **Subetapa 07** | **P2-2** — Diagnóstico de Correlação Cross-Asset ($36 \times 36$, `limit=1440`) | `qa-resilience-agent` + `broker-architect-agent` | `post-implementation-verifier` | `03-synthetic-market-engine`, `06-testing-quality`, `10-post-implementation-verification` |
| **Subetapa 08** | **P3-1 & P3-2** — Nginx `gzip on;` + Cache Imutável e Documentação `.env.example` via Grep | `backend-implementation-agent` | `security-reviewer`, `regression-guardian-agent` | `04-security-iam`, `07-production-operations`, `17-mudanca-cirurgica` |

---

## 2. Regras Invioláveis da Operação

1. **Branch e Commits Atômicos:**
   - Branch `fix/correcao-geral` criada a partir de `origin/main` (`1c6474c`).
   - Um commit atômico por item (`P0-1`, `P0-2`, `P1-1`, `P1-2`, `P1-3`, `P2-1`, `P2-2`, `P3-1`, `P3-2`), com a mensagem iniciando pelo ID do item (ex.: `P0-1: debit demo stake atomically when Blnk is disabled and add wallet consistency diag`).
2. **Zonas Protegidas (Não Tocar):**
   - **Proibido alterar**: `candle-aggregation-engine.mjs`, `aligned-tick-scheduler.mjs`, `scripts/sentiment/**`, câmbio (`deposit-instructions.mjs`), catálogos i18n.
   - **`scripts/lib/ou-engine.mjs`**: A **ÚNICA** função cuja lógica estocástica/boot pode ser alterada é `sanitizeBootPrice` (em `P2-1`), além da propriedade de leitura `payout_pct` em `ASSETS_CONFIG` se aplicável sem tocar nas equações OU (`stepPrice1s`, `generateSeededHistoricalCandlesUnified`, `generateForwardGapCandles`).
3. **Contratos de API e WebSocket Congelados:**
   - Nenhum formato de resposta de `/candles`, `/wallet`, `/api/sentiment`, `/api/currencies` ou eventos do WebSocket pode ser quebrado.
4. **Ciclo TDD Obrigatório (Red → Green):**
   - Antes de cada correção: escrever o teste que reproduz o defeito e **falha** no código atual.
   - Depois da correção: comprovar o teste passando (`PASS`), junto com testes de estresse, segurança e caos da subetapa.
5. **Migrations Seguras:**
   - Zero migrations destrutivas. Numerar após `0063` (`0064_contracts_payout_pct.up.sql` / `.down.sql`) e torná-la 100% idempotente (`ADD COLUMN IF NOT EXISTS`).
6. **Progressão Sequencial Estrita (Gate Lock):**
   - Só avançar para a subetapa $N+1$ quando a subetapa $N$ estiver 100% implementada, testada (unitário + integração + estresse + segurança + caos), validada e commitada.

---

## 3. Visão Geral das Subetapas e Arquivos de Especificação

1. [`01-SUBETAPA-P0-1-DEBITO-STAKE-E-CONSISTENCIA-CARTEIRA.md`](./01-SUBETAPA-P0-1-DEBITO-STAKE-E-CONSISTENCIA-CARTEIRA.md)
   - Reprodução Red/Green de `OPEN` + `LOSS` / `WIN` / `DRAW` sem Blnk e com Blnk.
   - Débito atômico `UPDATE users SET demo_balance_minor = demo_balance_minor - $1 WHERE id = $2 AND demo_balance_minor >= $1 RETURNING demo_balance_minor` na mesma transação `BEGIN...COMMIT` de `INSERT INTO contracts`.
   - Crédito atômico na liquidação (`settlement-engine.mjs`) dentro da transação `BEGIN...COMMIT` quando `!blnkEnabled`.
   - Garantia de zero débito/crédito duplo quando `blnkEnabled === true`.
   - Recusa `503 LEDGER_UNAVAILABLE` para conta `REAL` quando Blnk não está ativo.
   - Substituição da heurística `endsWith(':1')` por flag explícita `BLNK_ENABLED=true` + healthcheck no boot com log claro do modo operacional.
   - Varredura completa de todos os caminhos de saldo (tabela auditada) e script read-only `scripts/diag/wallet-consistency.mjs`.

2. [`02-SUBETAPA-P0-2-OUTBOX-DIAGNOSTICO-ARQUIVAMENTO-RETENCAO-ALERTA.md`](./02-SUBETAPA-P0-2-OUTBOX-DIAGNOSTICO-ARQUIVAMENTO-RETENCAO-ALERTA.md)
   - Diagnóstico read-only (`scripts/diag/outbox-diagnostic.mjs`) e mapeamento de consumidores por `event_type` (`TICK`, `RESERVE_STAKE`, `CONTRACT_SETTLED`).
   - Decisão fundamentada: no monólito `dev-live-feed.mjs` com `live-market-store.mjs`, o broadcast WS e a atualização de velas 1m/5s ocorrem diretamente após o commit do tick, e `outbox-relay` só consome `TICK_GENERATED`, `RESERVE_STAKE` e `CONTRACT_SETTLED`. Eventos `TICK` gravados sem consumidor acumulavam ~36 linhas/s (~2,09M).
   - Parar de gravar `TICK` inútil quando sem relay externo (ou gravar apenas quando `OUTBOX_TICK_ENABLED=true`) e processar/arquivar eventos pendentes legados em lotes de `10.000` (`SKIP LOCKED`) como `ARCHIVED` sem reprocessar liquidações antigas às cegas.
   - Job periódico de retenção que expurga `PROCESSED` / `ARCHIVED` com mais de 7 dias em lotes sem lock longo.
   - Exposição da métrica `outbox_oldest_pending_seconds` e `outbox_lag_alert` (> 300s) em `/metrics` e regra Prometheus.

3. [`03-SUBETAPA-P1-1-PAYOUT-DINAMICO-INTEIRO-SNAPSHOT.md`](./03-SUBETAPA-P1-1-PAYOUT-DINAMICO-INTEIRO-SNAPSHOT.md)
   - Migration idempotente `db/migrations/0064_contracts_payout_pct.up.sql` e `.down.sql`.
   - Gravação de `payout_pct` no contrato no momento da abertura (snapshot imutável).
   - `computeContractOutcome` exigindo `payoutPct` obrigatório dentro de `[0, 100]` com aritmética inteira exata: `payoutMinor = stake + Math.floor((stake * payoutPct) / 100)`.
   - Fallback seguro (`85` com `console.warn`) apenas para contratos legados sem `payout_pct`.

4. [`04-SUBETAPA-P1-2-EMPATE-INTEIRO-ESCALADO-FAST-CHECK.md`](./04-SUBETAPA-P1-2-EMPATE-INTEIRO-ESCALADO-FAST-CHECK.md)
   - Conversão de `entryPrice` e `exitPrice` para inteiro escalado pela precisão do ativo (`getAssetConfig(symbol).precision`) via escalonamento determinístico (`scalePriceToInt` / `Math.round(price * 10**decimals)` / `BigInt`) em `computeContractOutcome`.
   - Testes property-based com `fast-check` validando equivalência com strings normalizadas e casos clássicos de IEEE-754 (`1.10000` vs `1.1`, `0.1 + 0.2` vs `0.3`).

5. [`05-SUBETAPA-P1-3-SUITE-TESTES-MJS-E-CI-WORKFLOW.md`](./05-SUBETAPA-P1-3-SUITE-TESTES-MJS-E-CI-WORKFLOW.md)
   - Adição do script `"test:mjs"` e unificação no `"test"` do `package.json` para rodar tanto `test:unit` (Vitest `.ts`/`.tsx`) quanto todos os testes `.test.mjs` (`node --test`).
   - Criação de `.github/workflows/ci.yml` executando `pnpm install --frozen-lockfile`, typecheck, `pnpm test:unit` e `pnpm test:mjs` em PR e push.

6. [`06-SUBETAPA-P2-1-SANITIZE-BOOT-PRICE-ESTRITO.md`](./06-SUBETAPA-P2-1-SANITIZE-BOOT-PRICE-ESTRITO.md)
   - Atualização cirúrgica de `sanitizeBootPrice` em `scripts/lib/ou-engine.mjs`:
     1) Com `lastClose` válido: aceita se `|boot / lastClose - 1| <= 0.05` (5%);
     2) Sem `lastClose`: aceita na faixa `[0.7 * base, 1.4 * base]`;
     3) Fora disso: retorna `lastClose` (ou `base`) formatado na precisão e emite `console.warn` com símbolo, valor rejeitado e motivo;
     4) Se `base` ausente/inválida: lança erro explícito (`INVALID_BASE_PRICE`).

7. [`07-SUBETAPA-P2-2-DIAGNOSTICO-CORRELACAO-CROSS-ASSET.md`](./07-SUBETAPA-P2-2-DIAGNOSTICO-CORRELACAO-CROSS-ASSET.md)
   - Criação de `scripts/diag/cross-asset-correlation.mjs`: consulta `/candles?symbol=...&interval=1m&limit=1440` (ou gera/lê as 1440 velas dos 36 ativos), calcula retornos logarítmicos e matriz de correlação de Pearson $36 \times 36$ (630 pares), verificando `|corr| < 0.10` (com reteste em segunda janela independente para distinguir ruído amostral de acoplamento real).

8. [`08-SUBETAPA-P3-1-E-P3-2-NGINX-GZIP-E-ENV-EXAMPLE.md`](./08-SUBETAPA-P3-1-E-P3-2-NGINX-GZIP-E-ENV-EXAMPLE.md)
   - `P3-1`: Habilitação de `gzip on;`, `gzip_static on;`, `gzip_types` para JSON/JS/CSS/SVG e `Cache-Control: public, max-age=31536000, immutable` para `/assets/` em `scripts/update-nginx-ssl.mjs`, tornando `tests/subetapa-4-candles-performance-build.test.mjs` 100% verde.
   - `P3-2`: Mapeamento exaustivo por grep de todas as variáveis `process.env.*` em `scripts/` e `services/` e documentação completa em `.env.example` com valor padrão e efeito.

---

## 4. Ordem de Deploy e Plano de Rollback por Item

### 4.1 Checklist e Ordem de Deploy em Produção
1. **Backup pré-deploy:** `pg_dump -Fc broker_platform > backup_pre_correcao_geral_$(date +%Y%m%d_%H%M%S).dump` e confirmação de zero contratos `OPEN` no instante do restart.
2. **Ordem de aplicação:**
   - `P0-1` (Débito atômico de stake sem Blnk + guarda de conta REAL + `BLNK_ENABLED`)
   - `P1-1` e `P1-2` (Migration `0064` + Payout inteiro por snapshot + Empate escalado por inteiro)
   - `P0-2` (Arquivamento em lotes de 10k → ativação da retenção e métricas da outbox)
   - `P2-1`, `P2-2`, `P3-1`, `P3-2` e `P1-3`
3. **Verificação imediata pós-deploy:**
   - `curl -s https://binmaxbroker.com/metrics | grep -E "outbox_pending_total|outbox_oldest_pending_seconds"`
   - `curl -s -o /dev/null -w "%{http_code}\n" "https://binmaxbroker.com/api/sentiment?symbol=VOL_50"` → `200`
   - `curl -s -o /dev/null -w "%{http_code}\n" https://binmaxbroker.com/api/currencies` → `200`
   - Teste de ordem Demo de `$100` (`10000` minor): saldo cai `$100` na abertura, `LOSS` mantém `-100`, `DRAW` devolve `+100`, `WIN` credita `+$185` (`+$85` líquido).

### 4.2 Plano de Rollback por Item (≤ 5 minutos)

| Item | Comando / Ação de Rollback | Impacto em Dados |
|---|---|---|
| **P0-1** | `git revert <sha-P0-1>` e restart do serviço (`BLNK_ENABLED=false` continua suportado) | Nenhum dado perdido; saldos já atualizados permanecem íntegros no PostgreSQL |
| **P0-2** | `git revert <sha-P0-2>`; eventos marcados como `ARCHIVED` permanecem consultáveis (`UPDATE outbox_events SET status='PENDING' WHERE status='ARCHIVED'` se necessário) | Zero perda de contratos/ticks |
| **P1-1** | `git revert <sha-P1-1>`; coluna `payout_pct` tem `DEFAULT 85`, logo a versão N-1 do código ignora a coluna sem erro (Expand/Contract) | 100% compatível com versão N-1 |
| **P1-2** | `git revert <sha-P1-2>` | Apenas cálculo em memória no settlement; sem alteração de schema |
| **P1-3** | `git revert <sha-P1-3>` | Apenas scripts de teste e workflow CI |
| **P2-1** | `git revert <sha-P2-1>` | Apenas validação de preço de boot em `ou-engine.mjs` |
| **P2-2** | `git revert <sha-P2-2>` | Apenas script read-only em `scripts/diag/` |
| **P3-1** | `git revert <sha-P3-1>` + `nginx -t && systemctl reload nginx` | Apenas compressão HTTP e headers de cache estático |
| **P3-2** | `git revert <sha-P3-2>` | Apenas documentação em `.env.example` |
