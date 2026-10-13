# PLANO MESTRE: Renomeação e Padronização Institucional dos Índices Sintéticos

> **Data:** 12/10/2026  
> **Status:** 100% HOMOLOGADO E APROVADO EM PRODUÇÃO (TODOS OS 6 GATES VERDES)  
> **Orquestrador:** `tech-lead-orchestrator`  
> **Feature:** Renomeação Segura e Homogênea dos Índices Sintéticos da Plataforma BINMAX  
> **Evidência Visual de Origem:** `media_1791818225045_518be501.png` (Modal Catálogo de Ativos - Índices Sintéticos)

---

## 1. Convocação da Mesa de Especialistas e Skills Permanentes

Conforme o [ORCHESTRATOR.md](../../ORCHESTRATOR.md) e [AGENTS.md](../../AGENTS.md), este plano foi arquitetado e será supervisionado pela seguinte composição de workers especializados:

| Especialista | Papel na Feature | Skills Chave |
|---|---|---|
| **`tech-lead-orchestrator`** | Gestão de handoffs, controle de budget, supervisão e enforcement de gates de transição | `01-project-context`, `20-conduzir-etapa` |
| **`broker-architect-agent`** | Modelagem da arquitetura de migração (Dual-Alias / Canonical Symbol vs Display Name), preservação da cadeia de hash e Blnk references | `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `08-database-foundation` |
| **`backend-implementation-agent`** | Alteração atômica em migrations PostgreSQL, seeds, Tick Engine, Candle Worker, Gateway e Chart API | `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `08-database-foundation` |
| **`frontend-realtime-agent`** | Atualização do catálogo de ativos (`assets.ts`), headers, abas, fallbacks de localStorage e painel admin | `01-project-context`, `11-chart-trading-tools`, `12-tokens-binmax`, `13-textos-es`, `17-mudanca-cirurgica` |
| **`financial-correctness-reviewer`** | Verificação de integridade contábil (I-01 a I-06), inviolabilidade de contratos em aberto e liquidação | `02-financial-invariants`, `08-database-foundation`, `09-ai-failure-map` |
| **`security-reviewer`** | Validação contra spoofing de símbolos, injeções SQL em query params, sanitização de WebSocket payloads | `04-security-iam`, `08-database-foundation` |
| **`qa-resilience-agent`** | Criação e execução de testes de estresse, caos, saturação de ticks e validação de regressão | `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification` |
| **`post-implementation-verifier`** | Auditoria final pós-implementação em banco real, Redis e WebSocket com comprovação de zero falha | `10-post-implementation-verification` |

---

## 2. Diagnóstico Arquitetural e Zonas Sensíveis Mapeadas

A alteração do identificador e/ou nome dos 6 índices sintéticos:
- `SYNTH_VOL_10` ➔ `VOL_10`
- `SYNTH_VOL_25` ➔ `VOL_25`
- `SYNTH_VOL_50` ➔ `VOL_50`
- `SYNTH_VOL_75` ➔ `VOL_75`
- `SYNTH_VOL_100` ➔ `VOL_100`
- `SYNTH_CRASH_BOOM_100` ➔ `CRASH_BOOM_100`

Toca em **todas as 5 camadas críticas da corretora**:
1. **Banco de Dados (PostgreSQL):** Tabela `indices` (PK `symbol`), tabela `contracts` (FK `symbol`), tabela `ticks` e `candles`.
2. **Motor de Cotações Estocásticas (Tick Engine):** `genesisHash(symbol)`, geradores CSPRNG Box-Muller, cálculo canônico de hash encadeado SHA-256 e Redis Streams `ticks:{symbol}`.
3. **Agregação e Distribuição:** `candle-worker` agregando em buckets OHLCV 1m/5m/1h e `websocket-gateway` roteando inscrições de clientes.
4. **Interface e Catálogo do Traderoom (Frontend):** `ASSET_CATALOG` (`apps/web/src/catalog/assets.ts`), `TerminalHeader.tsx`, tabs abertas no `localStorage`, seletor in-chart e `PriceChart.tsx`.
5. **Mock Dev Live Feed & Admin:** `scripts/dev-live-feed.mjs` (porta 3001) e `apps/admin/src/pages/RiskLimitsPage.tsx`.

### Estratégia de Não-Ruptura (Dual-Alias Architecture):
Para garantir **zero tempo de inatividade** e **zero contratos corrompidos**, os serviços aceitam os novos símbolos canônicos (ex: `VOL_10`) e mantêm suporte/redirecionamento transparente para os legados (`SYNTH_VOL_10`).

---

## 3. Status de Execução das Subetapas

| Subetapa | Escopo | Gate de Aceite | Status |
|---|---|---|---|
| **[01-DB-MIGRATION-SCHEMA-ALIAS](./01-SUBETAPA-DB-MIGRATION-SCHEMA-ALIAS.md)** | Migrations PostgreSQL, seeds e dual-alias em `indices` | Gate 1 Pass (`test-subetapa-1-rename-db-seed.mjs`) | ✅ **HOMOLOGADO** |
| **[02-TICK-ENGINE-GENESIS-HASHES](./02-SUBETAPA-TICK-ENGINE-GENESIS-HASHES.md)** | Tick Engine, CSPRNG Box-Muller, hashes canônicos SHA-256 | Gate 2 Pass (`test-subetapa-2-rename-tick-engine.mjs`) | ✅ **HOMOLOGADO** |
| **[03-CANDLE-WORKER-WS-CHART-API](./03-SUBETAPA-CANDLE-WORKER-WS-CHART-API.md)** | Candle Worker, Trading Calendar e rotas `/chart/history` | Gate 3 Pass (`test-subetapa-3-rename-candle-chart-api.mjs`) | ✅ **HOMOLOGADO** |
| **[04-FRONTEND-CATALOG-MODAL-HEADER](./04-SUBETAPA-FRONTEND-CATALOG-MODAL-HEADER.md)** | Catálogo web, Modal de Ativos, abas, badge sintético e fallback | Gate 4 Pass (`subetapa-04-rename-catalog-header.unit.test.tsx`) | ✅ **HOMOLOGADO** |
| **[05-DEV-LIVE-FEED-E-ADMIN](./05-SUBETAPA-DEV-LIVE-FEED-E-ADMIN.md)** | Dev Live Feed (porta 3001), TradingView UDF e ordens dual-alias | Gate 5 Pass (`test-subetapa-5-dev-feed-admin.mjs`) | ✅ **HOMOLOGADO** |
| **[06-SUITE-ESTRESSE-CAOS-CERTIFICACAO](./06-SUBETAPA-SUITE-ESTRESSE-CAOS-CERTIFICACAO.md)** | Caos, estresse com 30 ordens concorrentes, churn WS e E2E | Gate 6 Pass (`test-synthetic-rename-certification.mjs`) | ✅ **HOMOLOGADO** |

---

## 4. Tabela de Nomenclatura Aprovada (Padrão Ouro das Opções Binárias)

| Índice Legado | Novo Símbolo Canônico | Título na UI (`name`) | Subtítulo no Catálogo (`subtitle`) | Categoria | Payout | Precisão |
|---|---|---|---|---|---|---|
| `SYNTH_VOL_10` | `VOL_10` | Volatilidad 10 | Índice V-10 (24/7) | Sintéticos | 85% | 4 |
| `SYNTH_VOL_25` | `VOL_25` | Volatilidad 25 | Índice V-25 (24/7) | Sintéticos | 85% | 4 |
| `SYNTH_VOL_50` | `VOL_50` | Volatilidad 50 | Índice V-50 (24/7) | Sintéticos | 85% | 4 |
| `SYNTH_VOL_75` | `VOL_75` | Volatilidad 75 | Índice V-75 (24/7) | Sintéticos | 85% | 4 |
| `SYNTH_VOL_100` | `VOL_100` | Volatilidad 100 | Índice V-100 (24/7) | Sintéticos | 85% | 4 |
| `SYNTH_CRASH_BOOM_100` | `CRASH_BOOM_100` | Crash & Boom 100 | Índice Crash / Boom (Spikes) | Sintéticos | 85% | 4 |
