# WORKLOG — Plataforma de Índices Sintéticos & Trading BINMAX

**Última atualização:** 2026-10-15 (America/Fortaleza)  
**Repositório:** `d:\brokerproject`  
**HEAD Git Base:** `264c9d0` (`docs: update status of arena subphases 09-12 to validated`) + implementações ativas na working tree validadas por oráculos RED → GREEN.  
**Documento complementar:** [`CONTEXT.md`](./CONTEXT.md)

---

## Sumário Executivo

Este documento consolida de forma cronológica e auditável **tudo o que foi implementado no projeto até o momento**, abrangendo:

1. **Macro-Fase 1 — Fundação MVP Demo, Motor OTC, Ledger Blnk e Segurança (T01–T18)**
2. **Macro-Fase 2 — Expansão Multi-Ativos (36 Ativos), Multi-Chart e Histórico de 7 Dias**
3. **Macro-Fase 3 — Internacionalização Multi-Região, Geoblocking, Compliance KYC e Domínios Espelho (Fase 2)**
4. **Macro-Fase 4 — Identidade Visual BINMAX ("Turbo Prata"), Sala de Referência e Polimento (`NEW_TRADEROOM` & `TRADEROOM_POLISH`)**
5. **Macro-Fase 5 — Páginas Secundárias, Autenticação Persistente no PostgreSQL, Caixa (Depósito/Saque) e Modo Convidado**
6. **Macro-Fase 6 — Gráficos Duráveis, Log Oficial de Ticks e Persistência Aditiva (Gates A, B, C e D1–D3)** *(Working Tree validada)*
7. **Macro-Fase 7 — Latência, Liquidação Determinística, Escalabilidade 3 Níveis e Velas Reais 5s/15s/30s em 1 Hz** *(Working Tree validada)*
8. **Macro-Fase 8 — Torneios & Arena Blitz: UI, Layout 100vh e Unificação Durável Backend/PostgreSQL/Blnk (Gates T1–T3 + Subetapas 09–11)** *(Working Tree validada)*

---

## 1. Macro-Fase 1 — Fundação MVP Demo, Motor OTC, Ledger Blnk e Segurança (Commits `95d9122` → `22b46c3`)

Implementação ponta a ponta dos requisitos estruturais da Fase 1 sob governança de [`ORCHESTRATOR.md`](./ORCHESTRATOR.md) e [`AGENTS.md`](./AGENTS.md):

### 1.1 Banco de Dados & Fundação PostgreSQL (`db/migrations/`)
- [`0001_initial_schema.sql`](./db/migrations/0001_initial_schema.sql): Tabelas core `indices`, `index_state`, `ticks` (com `sequence`, `price`, `prev_hash`, `hash`), `outbox_events`, `candles` e `contracts` (com `stake_minor`, `payout_minor`, `entry_tick_sequence`, `exit_tick_sequence`, `idempotency_key`), além de triggers append-only que proíbem `UPDATE`/`DELETE` em `ticks`.
- [`0002_roles_and_grants.sql`](./db/migrations/0002_roles_and_grants.sql): Separação de privilégios (`app_tick_writer`, `app_contract`, `app_settlement`, `app_reader`) seguindo menor privilégio (DB-05).
- [`0003_contract_state_machine_guard.sql`](./db/migrations/0003_contract_state_machine_guard.sql): Trigger no PostgreSQL garantindo transição unidirecional estrita `OPEN -> SETTLED | CANCELLED` (proibição de reabertura ou dupla liquidação).

### 1.2 Microsserviços Backend (`services/`)
- **Tick Engine ([`services/tick-engine/`](./services/tick-engine/))**:
  - Gerador estocástico Ornstein-Uhlenbeck ([`ou-generator.ts`](./services/tick-engine/src/engine/ou-generator.ts), [`core.mjs`](./services/tick-engine/core.mjs)) com reversão à média $\theta$ e entropia exclusivamente via CSPRNG (`crypto.randomBytes` / `crypto.randomInt` + transformação Box-Muller). Zero `Math.random()`.
  - Cadeia criptográfica SHA-256 encadeada por tick ([`hash-chain.ts`](./services/tick-engine/src/engine/hash-chain.ts)).
  - Eleição de líder único por ativo via lease TTL no Redis + fencing token ([`leader-elector.ts`](./services/tick-engine/src/cluster/leader-elector.ts)).
  - Persistência atômica `ticks` + `index_state` + `outbox_events` ([`tick-repository.ts`](./services/tick-engine/src/persistence/tick-repository.ts)).
- **Outbox Relay ([`services/outbox-relay/src/index.ts`](./services/outbox-relay/src/index.ts))**:
  - Publicação confiável dos eventos confirmados no PostgreSQL para Redis Streams e Redis Pub/Sub.
- **Candle Worker ([`services/candle-worker/`](./services/candle-worker/))**:
  - Consumo via Redis Streams Consumer Group (`cg:candles`), agregação determinística OHLCV ([`timeframe-aggregator.ts`](./services/candle-worker/src/aggregator/timeframe-aggregator.ts)), calendário de negociação 24/7 vs OTC ([`trading-calendar.ts`](./services/candle-worker/src/aggregator/trading-calendar.ts)) e script de reconstrução ([`rebuild-candles.ts`](./services/candle-worker/src/scripts/rebuild-candles.ts)).
- **Wallet Adapter & Blnk Ledger ([`services/wallet-adapter/src/blnk-client.ts`](./services/wallet-adapter/src/blnk-client.ts))**:
  - Integração contábil de partidas dobradas (Double-Entry) com o Blnk Ledger em centavos inteiros (`*_minor`, USD).
  - Operações idempotentes (`reserve:{contract_id}`, `settlement:{contract_id}:win_return`, `settlement:{contract_id}:win_profit`, `settlement:{contract_id}:loss`, `settlement:{contract_id}:draw`) com circuit breaker, timeout e retry com backoff exponencial + jitter.
- **API / BFF Fastify ([`services/api/`](./services/api/))**:
  - Validação JWT RS256/HS256 ([`plugins/auth.ts`](./services/api/src/plugins/auth.ts)), proteção BOLA/IDOR, RBAC (`USER`, `ADMIN`, `AUDITOR`), controle de risco pré-ordem com Float Cap de 3% via scripts Lua atômicos no Redis ([`infra/redis/scripts/check_and_reserve_risk.lua`](./infra/redis/scripts/check_and_reserve_risk.lua), [`risk-manager.ts`](./services/api/src/services/risk-manager.ts)).
  - Rotas de contratos ([`routes/contracts.ts`](./services/api/src/routes/contracts.ts)), carteira ([`routes/wallet.ts`](./services/api/src/routes/wallet.ts)), candles/histórico ([`routes/chart.ts`](./services/api/src/routes/chart.ts)) e administração ([`routes/admin.ts`](./services/api/src/routes/admin.ts)).
- **Settlement Worker ([`services/settlement-worker/`](./services/settlement-worker/))**:
  - Agendamento e liquidação pessimista (`SELECT ... FOR UPDATE SKIP LOCKED`), calculadora inteira de payout (`BigInt((stake * 85) / 100)`, [`payout-calculator.ts`](./services/settlement-worker/src/settlement/payout-calculator.ts)) e reconciliador financeiro contínuo ([`financial-reconciler.ts`](./services/settlement-worker/src/reconciliation/financial-reconciler.ts)).
- **WebSocket Gateway ([`services/websocket-gateway/`](./services/websocket-gateway/))**:
  - Fan-out em tempo real com coalescer de ticks ([`coalescer.ts`](./services/websocket-gateway/src/coalescer.ts)), controle de backpressure ([`backpressure.ts`](./services/websocket-gateway/src/backpressure.ts)), rate limiting por token bucket ([`token-bucket.ts`](./services/websocket-gateway/src/token-bucket.ts)), sharding por símbolo ([`sharding.ts`](./services/websocket-gateway/src/sharding.ts)) e catch-up por `lastSequence` ([`catchup-handler.ts`](./services/websocket-gateway/src/handlers/catchup-handler.ts)).

---

## 2. Macro-Fase 2 — Expansão Multi-Ativos (36 Ativos), Multi-Chart e Histórico de 7 Dias (Commits `aac1c49` → `d67aeaf`)

1. **Catálogo de 36 Ativos Sintéticos, Forex OTC, Cripto e Commodities (`db/migrations/0010` e `0050`)**:
   - Criação da migration [`0010_seed_multi_assets.up.sql`](./db/migrations/0010_seed_multi_assets.up.sql) com 36 símbolos operáveis 24/7.
   - Renomeação proprietária dos índices sintéticos na migration [`0050_rename_synthetic_indices.up.sql`](./db/migrations/0050_rename_synthetic_indices.up.sql) (ex.: `VOL_10` → `PULSE_10`, `VOL_50` → `PULSE_50`, `VOL_100` → `PULSE_100`, `CRASH_500` → `DROP_500`, `BOOM_500` → `SURGE_500`, `JUMP_25` → `LEAP_25`, `STEP_INDEX` → `STAIR_INDEX`), mantendo aliases retrocompatíveis no backend e frontend.
2. **Hardening de Histórico Macro de 7 Dias (`10.080` velas de 1m)**:
   - Pré-agregação multi-timeframe, paginação cursor-based (`before`) e prefetch preditivo no scroll infinito do gráfico ([`PriceChart.tsx`](./apps/web/src/chart/PriceChart.tsx), [`candle-adapter.ts`](./apps/web/src/chart/candle-adapter.ts)).
3. **Motor Gráfico Isolado & Multi-Chart Grid**:
   - Isolamento do host do TradingView Lightweight Charts ([`IsolatedChartHost.tsx`](./apps/web/src/chart/IsolatedChartHost.tsx)) com ciclo de vida blindado contra dimensão zero (`0x0`), vazamento de memória em unmount e WebSockets zumbis.
   - Suporte a grade de múltiplos gráficos simultâneos ([`MultiChartGrid.tsx`](./apps/web/src/chart/MultiChartGrid.tsx), [`GridLayoutPopover.tsx`](./apps/web/src/chart/GridLayoutPopover.tsx)) com pausa por visibilidade (`IntersectionObserver`, [`useVisibilityPause.ts`](./apps/web/src/chart/useVisibilityPause.ts)).
   - Ferramentas de desenho vetorial a 60 FPS ([`ChartDrawingOverlay.tsx`](./apps/web/src/chart/ChartDrawingOverlay.tsx), [`ChartDrawingToolbar.tsx`](./apps/web/src/chart/ChartDrawingToolbar.tsx)) e indicadores matemáticos nativos SMA, EMA, Bollinger Bands e RSI ([`indicator-calculator.ts`](./apps/web/src/chart/indicator-calculator.ts)).
4. **Blindagem dos 7 Perigos Críticos de Escala**:
   - Reconexão com backoff exponencial + full jitter ([`backoff.ts`](./apps/web/src/feed/backoff.ts)), circuit breaker por feed ([`circuit-breaker.ts`](./apps/web/src/feed/circuit-breaker.ts)), watermark e validação cross-asset ([`watermark-engine.ts`](./apps/web/src/feed/watermark-engine.ts), [`cross-asset-validator.ts`](./apps/web/src/feed/cross-asset-validator.ts)) e banner de staleness por símbolo ([`StalenessOverlay.tsx`](./apps/web/src/chart/StalenessOverlay.tsx)).

---

## 3. Macro-Fase 3 — Internacionalização Multi-Região, Geoblocking, Compliance KYC e Domínios Espelho

1. **Migrations de Expansão Regional e Regulatória**:
   - [`0020_phase2_countries_flags_kyc_payments.up.sql`](./db/migrations/0020_phase2_countries_flags_kyc_payments.up.sql), [`0021_system_feature_flags_spec.up.sql`](./db/migrations/0021_system_feature_flags_spec.up.sql), [`0030_regulatory_zones_mirrors_kyc_tiers.up.sql`](./db/migrations/0030_regulatory_zones_mirrors_kyc_tiers.up.sql) e [`0060_phase2_spec_completeness.up.sql`](./db/migrations/0060_phase2_spec_completeness.up.sql).
2. **Serviços e Plugins de Conformidade Regional (`services/api/src/`)**:
   - Roteamento regulatório e geoblocking por país ([`geoblock.ts`](./services/api/src/services/geoblock.ts), [`regulatory-zones.ts`](./services/api/src/services/regulatory-zones.ts)).
   - Rotação de domínios espelho ([`mirror-domains.ts`](./services/api/src/services/mirror-domains.ts), [`routes/mirrors.ts`](./services/api/src/routes/mirrors.ts)) e painel administrativo de espelhos ([`apps/admin/src/pages/RegulatoryMirrorsPage.tsx`](./apps/admin/src/pages/RegulatoryMirrorsPage.tsx)).
   - Tiers dinâmicos de KYC ([`compliance-kyc.ts`](./services/api/src/services/compliance-kyc.ts), [`routes/kyc.ts`](./services/api/src/routes/kyc.ts)).
   - Adaptador de feed real + guardião de preço e normalizador ([`real-feed-adapter.ts`](./services/tick-engine/src/engine/real-feed-adapter.ts), [`price-guard.ts`](./services/tick-engine/src/engine/price-guard.ts), [`price-normalizer.ts`](./services/tick-engine/src/engine/price-normalizer.ts)).
3. **Internacionalização (i18n) e Multi-Moeda**:
   - Suporte a `pt-BR`, `es-ES`, `es-MX`, `es-CO`, `es-AR`, `es-CL`, `es-PE` ([`apps/web/src/i18n/`](./apps/web/src/i18n/)) e conversão de exibição multi-moeda (`USD`, `BRL`, `MXN`, `COP`, `ARS`, `CLP`, `PEN`) mantendo contabilidade interna 100% em centavos de USD ([`packages/shared/src/currency.ts`](./packages/shared/src/currency.ts)).

---

## 4. Macro-Fase 4 — Identidade Visual BINMAX ("Turbo Prata"), Sala de Operação e Polimento (`7f04eb5` → `e705d2f`)

1. **Tokens de Precisão e Identidade BINMAX**:
   - Paleta industrial escura (`--bg-0: #0B0E14`, `--bg-1: #101622`, `--bg-2: #151D2B`, `--bg-3: #1C2738`), tipografia `Geist` + `Geist Mono` (`tabular-nums`), física de movimento (`cubic-bezier(0.16, 1, 0.3, 1)`) em [`tokens-precision.css`](./apps/web/src/styles/tokens-precision.css) e [`design-tokens.ts`](./apps/web/src/lib/design-tokens.ts).
2. **Arquitetura da Sala de Operação Full-Bleed (`100vw × 100vh`)**:
   - [`TerminalLayout.tsx`](./apps/web/src/components/layout/TerminalLayout.tsx), [`TerminalHeader.tsx`](./apps/web/src/components/header/TerminalHeader.tsx) (abas de ativos, seletor de conta Demo/Real, botão de depósito e perfil), [`SidebarDock.tsx`](./apps/web/src/components/sidebar/SidebarDock.tsx), [`OrderTicket.tsx`](./apps/web/src/trade/OrderTicket.tsx) (boleta SUBE/BAJA com simetria visual D2 e piso mínimo de expiração de 60s em [`expiry-calculator.ts`](./apps/web/src/trade/expiry-calculator.ts)), [`PortfolioDrawer.tsx`](./apps/web/src/components/drawer/PortfolioDrawer.tsx) e [`TerminalFooter.tsx`](./apps/web/src/components/footer/TerminalFooter.tsx) (com aviso de risco regulatório D8, relógio UTC e medidor de latência).
3. **Polimento Visual (`TRADEROOM_POLISH`, Subetapas 00 a 08)**:
   - Bandeiras de strike e posições agrupadas no gráfico ([`OrderFlagsOverlay.tsx`](./apps/web/src/chart/OrderFlagsOverlay.tsx)), linhas verticais de trava/expiração ([`TimeLinesOverlay.tsx`](./apps/web/src/chart/TimeLinesOverlay.tsx)), barra de sentimento do mercado ([`TradersMoodBar.tsx`](./apps/web/src/chart/TradersMoodBar.tsx)), pino de resultado na expiração ([`ExpirationResultPin.tsx`](./apps/web/src/chart/ExpirationResultPin.tsx)) e sintetizador de áudio Web Audio API sem arquivos externos ([`sound-engine.ts`](./apps/web/src/lib/sound-engine.ts)).

---

## 5. Macro-Fase 5 — Páginas Secundárias, Autenticação PostgreSQL e Caixa (Commits `9a2943c` → `a3d4060`)

1. **Autenticação Híbrida (PostgreSQL + Keycloak OIDC) e Persistência de Conta**:
   - Migrations [`0040_users_and_auth.up.sql`](./db/migrations/0040_users_and_auth.up.sql) a [`0045_kyc_and_community_modules.up.sql`](./db/migrations/0045_kyc_and_community_modules.up.sql).
   - Cadastro, login, verificação de e-mail por código OTP, recuperação de senha e edição de perfil real conectados ao PostgreSQL e ao Blnk Ledger ([`services/api/src/services/auth-service.ts`](./services/api/src/services/auth-service.ts), [`routes/auth.ts`](./services/api/src/routes/auth.ts), [`scripts/dev-live-feed.mjs`](./scripts/dev-live-feed.mjs)).
2. **Ecossistema Completo de Páginas (`apps/web/src/pages/`)**:
   - [`LandingPage.tsx`](./apps/web/src/pages/LandingPage.tsx) (página pública na raiz `/` com mini-gráfico ao vivo e CTAs diretos), [`LoginPage.tsx`](./apps/web/src/pages/LoginPage.tsx), [`RegisterPage.tsx`](./apps/web/src/pages/RegisterPage.tsx), [`PasswordRecoveryPage.tsx`](./apps/web/src/pages/PasswordRecoveryPage.tsx), [`EmailVerificationPage.tsx`](./apps/web/src/pages/EmailVerificationPage.tsx).
   - [`DepositPage.tsx`](./apps/web/src/pages/DepositPage.tsx), [`WithdrawPage.tsx`](./apps/web/src/pages/WithdrawPage.tsx), [`HistoryPage.tsx`](./apps/web/src/pages/HistoryPage.tsx), [`VerificationPage.tsx`](./apps/web/src/pages/VerificationPage.tsx) (KYC), [`SettingsPage.tsx`](./apps/web/src/pages/SettingsPage.tsx), [`TournamentsPage.tsx`](./apps/web/src/pages/TournamentsPage.tsx), [`ArenaPage.tsx`](./apps/web/src/pages/ArenaPage.tsx), [`AnalysisPage.tsx`](./apps/web/src/pages/AnalysisPage.tsx), [`TutorialsPage.tsx`](./apps/web/src/pages/TutorialsPage.tsx) e [`PromotionsPage.tsx`](./apps/web/src/pages/PromotionsPage.tsx).

---

## 6. Macro-Fase 6 — Gráficos Duráveis, Log Oficial de Ticks e Persistência Aditiva (Gates A, B, C e D1–D3)

Documentado em [`docs/subetapas/grafico-duravel/EXECUCAO.md`](./docs/subetapas/grafico-duravel/EXECUCAO.md) e validado com PostgreSQL 16 e Redis 7 reais descartáveis:

| Gate / Subetapa | O que foi implementado | Arquivos Principais | Evidência / Oráculo |
|---|---|---|---|
| **Subetapa 02 (Atomicidade `TickRepository`)** | Transação única com lock `FOR UPDATE` em `index_state`, verificação de hash encadeado, sequence monotônica e tratamento seguro de queda de conexão no rollback | [`services/tick-engine/src/persistence/tick-repository.ts`](./services/tick-engine/src/persistence/tick-repository.ts) | `24/24 PASS` em PostgreSQL 16 efêmero (`repository-post-patch2-run.log`) |
| **Subetapa 03 (Cadeia de Migrations `0001`→`0010`→`0050`)** | Correção de colunas (`params`, `last_ts`) e preservação de histórico existente em upgrades/rollbacks de índices | [`db/migrations/0010_seed_multi_assets.up.sql`](./db/migrations/0010_seed_multi_assets.up.sql), [`0050_rename_synthetic_indices.up.sql`](./db/migrations/0050_rename_synthetic_indices.up.sql) | `chart-durability-schema*.oracle.test.mjs` (`3/3 PASS`) |
| **Gate A (Feed Ativo, Log Oficial e Produtor Único)** | `bootstrapMarketState()` hidrata `index_state`, `ticks` e `candles` do PostgreSQL antes de abrir tráfego; lease Redis (`PX 3000 NX`) + fencing monotônico (`lease_epoch`); persistência antes de publicar | [`services/tick-engine/live-market-store.mjs`](./services/tick-engine/live-market-store.mjs), [`scripts/dev-live-feed.mjs`](./scripts/dev-live-feed.mjs) | `active-feed-durability*.oracle.test.mjs` (`5/5 PASS`) + caos/stress/segurança (`7/7 PASS`) |
| **Gate B (Contratos Abertos e Liquidação pelo Tick Oficial)** | `SELECT ... FOR UPDATE` no contrato; liquidação exclusivamente pelo 1º tick oficial em `ticks` com `ts >= expires_at`; idempotência `409` no Blnk (`WIN_PROFIT` retryable); JWT `timingSafeEqual` + anti-BOLA | [`scripts/lib/settlement-engine.mjs`](./scripts/lib/settlement-engine.mjs), [`services/wallet-adapter/src/blnk-client.ts`](./services/wallet-adapter/src/blnk-client.ts), [`scripts/dev-live-feed.mjs`](./scripts/dev-live-feed.mjs) | `active-feed-contracts-settlement.oracle.test.mjs` + `subetapa-1-settlement-resilience.test.mjs` (`8/8 PASS`) |
| **Gate C (Velas Derivadas e Corte de Leitura)** | `rebuildCandles` transacional a partir de `ticks`; bitmask anti-duplicata em `aggregateCandlesToInterval`; endpoints `/v2/candles` (100% oficial) e `/candles` com marcação `legacy_visual` pré-corte | [`services/tick-engine/live-market-store.mjs`](./services/tick-engine/live-market-store.mjs), [`scripts/lib/candle-aggregation-engine.mjs`](./scripts/lib/candle-aggregation-engine.mjs) | `active-feed-candles-cutover.oracle.test.mjs` (`6/6 PASS`) |
| **Gate D1 / Doc10.1 (Retenção Segura)** | `pruneMarketStorage` com `FOR UPDATE SKIP LOCKED`, preservando head atual, ticks de contratos `OPEN`/`exit_tick_sequence`, eventos financeiros e velas de `1m` | [`services/tick-engine/live-market-store.mjs`](./services/tick-engine/live-market-store.mjs) | `doc10-subetapa1-retention.oracle.test.mjs` (`1/1 PASS`) |
| **Gate D2 / Doc10.2 (Batch Atômico 36 Ativos)** | `produceTicksBatch` ordenando `symbol ASC` (zero deadlocks) e gravando os 36 ativos em 1 única transação PostgreSQL por segundo | [`services/tick-engine/live-market-store.mjs`](./services/tick-engine/live-market-store.mjs), [`scripts/dev-live-feed.mjs`](./scripts/dev-live-feed.mjs) | `doc10-subetapa2-batch-ticks.oracle.test.mjs` (`1/1 PASS`) |
| **Gate D3 / Doc10.3 (Auditoria Contínua e Métricas)** | `verifyMarketAuditIntegrity`, endpoint `/api/v1/audit/market-integrity` e métricas Prometheus (`tick_persist_ms`, `tick_persist_p99_ms`, `outbox_pending_total`, `market_audit_diffs_total`) | [`services/tick-engine/live-market-store.mjs`](./services/tick-engine/live-market-store.mjs), [`scripts/dev-live-feed.mjs`](./scripts/dev-live-feed.mjs) | `doc10-subetapa3-audit-metrics.oracle.test.mjs` (`1/1 PASS`) |

---

## 7. Macro-Fase 7 — Latência, Escalabilidade (3 Níveis) e Velas Reais 5s/15s/30s em 1 Hz

Documentado em [`docs/plano-latencia-resiliencia-3-niveis.md`](./docs/plano-latencia-resiliencia-3-niveis.md) e [`docs/plano-velas-reais-agendador-1hz.md`](./docs/plano-velas-reais-agendador-1hz.md):

1. **Nível 1A — Liquidação Determinística & Sweeper Pós-Restart ([`scripts/lib/settlement-engine.mjs`](./scripts/lib/settlement-engine.mjs))**:
   - Eliminação da dependência volátil de `setTimeout` via `SettlementSweeper` a cada `500ms` e histórico circular de ticks (`resolveSettlementTick`).
2. **Nível 1B — Blindagem de Topologia de URLs ([`apps/web/src/api/config.ts`](./apps/web/src/api/config.ts))**:
   - Resolvedores `resolveApiUrl` e `resolveWsUrl` com suporte a `VITE_API_URL`/`VITE_WS_URL`, prevenção contra protocolos maliciosos (`javascript:`, `data:`) e fallback relativo transparente.
3. **Nível 2 — Fim da Tempestade de Polling e Write-Amplification ([`scripts/lib/wallet-read-engine.mjs`](./scripts/lib/wallet-read-engine.mjs), [`apps/web/src/App.tsx`](./apps/web/src/App.tsx))**:
   - Cache isolado por `userId` (TTL 5s) com invalidação imediata Read-After-Write, eliminação de `UPDATE users` redundantes em leituras ociosas (>95% de redução de carga) e relaxamento do polling de fallback para 15s mantendo push WebSocket `< 50ms`.
4. **Nível 3 — Cache O(1) de Agregação de Velas, Code-Splitting Vite e Gzip/Immutable no Nginx**:
   - Cache O(1) por assinatura da última barra em [`scripts/lib/candle-aggregation-engine.mjs`](./scripts/lib/candle-aggregation-engine.mjs), separação de chunks (`vendor-charts`, `vendor-motion`, `vendor-auth-query`) em [`apps/web/vite.config.ts`](./apps/web/vite.config.ts) e compressão Gzip + cache imutável em [`scripts/update-nginx-ssl.mjs`](./scripts/update-nginx-ssl.mjs).
5. **Velas Reais (`5s`, `15s`, `30s`), Agendador Alinhado 1 Hz e Motor OU Unificado (Subetapas 5.1 a 5.4)**:
   - [`scripts/lib/aligned-tick-scheduler.mjs`](./scripts/lib/aligned-tick-scheduler.mjs): Agendador autocorretivo alinhado ao segundo Unix (`:00.000`), garantindo exatamente 5 ticks por janela de 5s, proteção contra clock skew/NTP rollback e pulo determinístico de slots sob pausa de CPU.
   - [`scripts/lib/ou-engine.mjs`](./scripts/lib/ou-engine.mjs) e [`services/tick-engine/core.mjs`](./services/tick-engine/core.mjs): Unificação matemática do motor estocástico Ornstein-Uhlenbeck entre produção e feed.
   - Buffer circular `state.candles5s` (3.600 barras = 5h reais por ativo), derivação exata de `15s` (3×5s) e `30s` (6×5s) e reconciliação sem salto visual no frontend ([`apps/web/src/chart/candle-adapter.ts`](./apps/web/src/chart/candle-adapter.ts), [`PriceChart.tsx`](./apps/web/src/chart/PriceChart.tsx)).

---

## 8. Macro-Fase 8 — Torneios & Arena Blitz: Layout 100vh e Unificação Durável (Gates T1–T3 + Subetapas 09–11)

Documentado em [`docs/subetapas/torneios-arena-duravel/00-PLANO-GERAL-ARENA-04.md`](./docs/subetapas/torneios-arena-duravel/00-PLANO-GERAL-ARENA-04.md) e [`docs/subetapas/torneios-arena-i18n/09-PLANO-GERAL-CONFINAMENTO-SCROLL-TOP-RANKING-ARENA.md`](./docs/subetapas/torneios-arena-i18n/09-PLANO-GERAL-CONFINAMENTO-SCROLL-TOP-RANKING-ARENA.md):

1. **Subetapa 04.1 (Gate T1) — Paridade Matemática Hare-Niemeyer, CSPRNG e Persistência PostgreSQL (`0061` + `0062`)**:
   - Unificação exata de `TIER_WEIGHTS_BPS` e distribuição Hare-Niemeyer (`remainingEscrowMinor === 0`) para `TOP_3`, `TOP_10`, `TOP_20` e `TOP_30` entre [`services/wallet-adapter/src/blnk-client.ts`](./services/wallet-adapter/src/blnk-client.ts) e [`apps/web/src/arena/engine.ts`](./apps/web/src/arena/engine.ts).
   - Criação da migration [`0062_arena_trade_orders.up.sql`](./db/migrations/0062_arena_trade_orders.up.sql) (`arena_trade_orders`, `arena_real_balances`, `arena_wallet_transactions`) e hidratação completa (`hydrateFromDatabase`) em [`tournament-arena-service.ts`](./services/api/src/services/tournament-arena-service.ts).
   - Oráculo: [`tests/integration/doc04-subetapa1-arena-persistence-math.oracle.test.mjs`](./tests/integration/doc04-subetapa1-arena-persistence-math.oracle.test.mjs).
2. **Subetapa 04.2 (Gate T2) — Liquidação Oficial pelo Tick do Banco (`ts >= expires_at`) e Blindagem RBAC/BOLA**:
   - Erradicação da fraude `body.result || "WIN"`: `openArenaTrade` grava `entry_price` e `entry_tick_sequence` do último tick oficial confirmado em `ticks`, e `settleArenaTrade` liquida exclusivamente pelo primeiro tick oficial com `ts >= expires_at`.
   - Proteção BOLA/IDOR e RBAC em [`services/api/src/routes/arena.ts`](./services/api/src/routes/arena.ts) (`/settle` autenticado, bloqueio de `/dev/*` em produção e validação de `tx.user_id === user.id` nas rotas `/wallet/real/*`).
   - Oráculo: [`tests/integration/doc04-subetapa2-arena-settlement-security.oracle.test.mjs`](./tests/integration/doc04-subetapa2-arena-settlement-security.oracle.test.mjs).
3. **Subetapa 04.3 (Gate T3) — Rotas `/api/v1/arena/*` no Processo Ativo (`scripts/dev-live-feed.mjs`) e Sweeper Automático**:
   - Exposição completa das rotas `/api/v1/arena/*` e `/api/v1/wallet/real/*` no servidor ativo ([`scripts/dev-live-feed.mjs`](./scripts/dev-live-feed.mjs)) + sweeper automático de ordens expiradas da Arena no loop de mercado.
   - Oráculo: [`tests/integration/doc04-subetapa3-active-feed-arena-e2e.oracle.test.mjs`](./tests/integration/doc04-subetapa3-active-feed-arena-e2e.oracle.test.mjs).
4. **Subetapas 09, 10 e 11 — Confinamento de Scroll e Layout 100vh no Ranking da Arena (`Top 5 / 10 / 20 / 30`)**:
   - Correção dos seletores compostos `.arena-root.flex`, `.arena-root.h-full`, `.arena-root.overflow-hidden` em [`apps/web/src/arena/arena.css`](./apps/web/src/arena/arena.css).
   - Trava de altura `100vh` na cadeia flex de [`ArenaPage.tsx`](./apps/web/src/pages/ArenaPage.tsx) e [`ArenaRoom.tsx`](./apps/web/src/arena/ArenaRoom.tsx) e scroll interno confinado (`data-testid="leaderboard-table-scroll"`) com cabeçalho sticky em [`Leaderboard.tsx`](./apps/web/src/arena/Leaderboard.tsx), garantindo `0px` de deslocamento no gráfico e na boleta (`47/47` testes verdes em `apps/web/src/arena`).
