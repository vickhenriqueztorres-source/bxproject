# CONTEXT — Arquitetura, Estado Atual e Guia Operacional (BINMAX)

**Última atualização:** 2026-10-15 (America/Fortaleza)  
**Repositório:** `d:\brokerproject`  
**Governança:** [`ORCHESTRATOR.md`](./ORCHESTRATOR.md) • [`AGENTS.md`](./AGENTS.md) • [`WORKLOG.md`](./WORKLOG.md)

---

## 1. Visão Geral do Sistema

A **BINMAX** é uma plataforma de negociação de **Índices Sintéticos 24/7, Pares OTC, Criptoativos, Commodities e Torneios (Arena Blitz)** projetada sob a filosofia **"Instrumento de Precisão, Não um Cassino"** (identidade visual *Turbo Prata*).

O sistema opera com contabilidade de dupla entrada no **Blnk Ledger**, persistência forte transacional no **PostgreSQL 16**, mensageria/leases no **Redis 7**, autenticação **Keycloak OIDC + PostgreSQL Auth** e gráficos de alta frequência (60 FPS) baseados em **TradingView Lightweight Charts**.

---

## 2. Topologia do Monorepo (`pnpm` Workspace)

```text
d:\brokerproject
├── apps/
│   ├── web/                    # Frontend principal (React 18 + Vite 6 + TS + Lightweight Charts 4)
│   └── admin/                  # Painel Administrativo e Gestão de Domínios Espelho / Monitoramento
├── services/
│   ├── api/                    # API/BFF Fastify (Contratos, Carteira, Chart API, Auth, KYC, Geo, Arena)
│   ├── tick-engine/            # Motor Estocástico OU (CSPRNG), Hash Chain SHA-256, Lease Redis e LiveMarketStore
│   ├── outbox-relay/           # Relay transacional PostgreSQL Outbox -> Redis Streams & Pub/Sub
│   ├── candle-worker/          # Agregador OHLCV via Redis Consumer Group (cg:candles) + Rebuild
│   ├── settlement-worker/      # Liquidador pessimista (FOR UPDATE SKIP LOCKED) + Reconciliador Financeiro
│   ├── wallet-adapter/         # Cliente Blnk Ledger (Double-Entry, Reserva/Liquidação Idempotente, Hare-Niemeyer)
│   └── websocket-gateway/      # Gateway WS com Coalescer, Backpressure, Token Bucket, Sharding e Catch-up
├── packages/
│   └── shared/                 # Tipos compartilhados, formatador multi-moeda (minor units) e datas
├── scripts/
│   ├── dev-live-feed.mjs       # Servidor unificado ativo (REST + WS + LiveMarketStore + Settlement + Arena)
│   └── lib/                    # Motores modulares (aligned-tick-scheduler, ou-engine, settlement-engine, etc.)
├── db/
│   └── migrations/             # 14 pares de migrations SQL (0001 a 0062) com rollback (.down.sql)
├── infra/                      # Docker Compose, Keycloak realm, Blnk config, Prometheus alerts e scripts Lua Redis
├── tests/                      # Oráculos de integração (.oracle.test.mjs), testes unitários, matemáticos e k6
└── docs/                       # Especificações, planos de subetapas, relatórios de gates e referências visuais
```

---

## 3. Arquitetura de Runtime e Fluxo de Dados Críticos

### 3.1 Dualidade de Execução Backend (Microsserviços vs. Servidor Ativo Unificado)
- **Arquitetura Distribuída (`services/*`)**: Separa cada responsabilidade em processos independentes (`api`, `tick-engine`, `outbox-relay`, `candle-worker`, `settlement-worker`, `websocket-gateway`).
- **Servidor Ativo Unificado ([`scripts/dev-live-feed.mjs`](./scripts/dev-live-feed.mjs))**: É o processo HTTP + WebSocket (porta padrão `3001` ou `DEV_FEED_PORT`) que o frontend (`apps/web`) consome via proxy Vite/Nginx e que os scripts de deploy da VPS gerenciam.
  - Ele integra diretamente o [`services/tick-engine/live-market-store.mjs`](./services/tick-engine/live-market-store.mjs), [`scripts/lib/aligned-tick-scheduler.mjs`](./scripts/lib/aligned-tick-scheduler.mjs), [`scripts/lib/settlement-engine.mjs`](./scripts/lib/settlement-engine.mjs), [`scripts/lib/candle-aggregation-engine.mjs`](./scripts/lib/candle-aggregation-engine.mjs), [`scripts/lib/wallet-read-engine.mjs`](./scripts/lib/wallet-read-engine.mjs) e [`services/api/src/services/tournament-arena-service.ts`](./services/api/src/services/tournament-arena-service.ts).

### 3.2 Ciclo de Vida do Tick e das Velas (Gates A, C, D1–D3 e Subetapas 5.1–5.4)
1. **Agendamento 1 Hz Exato**: [`aligned-tick-scheduler.mjs`](./scripts/lib/aligned-tick-scheduler.mjs) dispara nos limites exatos do segundo Unix (`:00.000`), garantindo 5 ticks por vela de `5s` e imunidade a clock skew.
2. **Geração CSPRNG + Ornstein-Uhlenbeck**: Preço gerado sem `Math.random()`, encadeado por SHA-256 (`prev_hash -> hash`) e protegido por lease Redis (`PX 3000 NX`) + fencing monotônico (`lease_epoch`) no PostgreSQL.
3. **Escrita Atômica em Lote (`produceTicksBatch`)**: Todos os 36 ativos são ordenados por `symbol ASC` e gravados em **uma única transação PostgreSQL por segundo** (`ticks` + `index_state` + `outbox_events` + `candles`) **antes** de qualquer broadcast WebSocket ou atualização em memória.
4. **Agregação OHLCV e Sub-Minuto Real**:
   - Regra única entre servidor e cliente: `open` = primeiro tick do período (menor `sequence`), `close` = último tick do período (maior `sequence`).
   - O servidor mantém buffer circular de `5s` (`3.600` barras = 5h) e `1m` (`10.080` barras = 7d), derivando `15s` (3×5s), `30s` (6×5s), `5m`, `15m`, `30m` e `1h` com cache O(1) por assinatura da última barra.

### 3.3 Ciclo de Vida de Contratos e Liquidação (Gate B e Nível 1A)
1. **Abertura (`POST /contracts`)**: Exige JWT válido e header `Idempotency-Key`. Captura o último tick oficial confirmado em `ticks` e reserva o `stake_minor` no Blnk Ledger (`reserve:{contract_id}`).
2. **Liquidação Oficial (`settleOpenContract`)**:
   - O `SettlementSweeper` varre contratos vencidos a cada `500ms` (inclusive contratos `OPEN` recuperados do PostgreSQL após restart do servidor).
   - Tranca o contrato com `SELECT ... FOR UPDATE`, busca no PostgreSQL o **primeiro tick oficial onde `symbol = $1 AND ts >= expires_at ORDER BY ts ASC, sequence ASC LIMIT 1`** (se não houver tick elegível ainda, mantém `OPEN`).
   - Liquida no Blnk Ledger com referências determinísticas idempotentes antes de comitar `status = 'SETTLED'` e `exit_tick_sequence`.

### 3.4 Torneios & Arena Blitz (Gates T1–T3 e Subetapas 09–11)
- **Economia e Matemática**: Buy-in e Rebuy divididos em `30%` House Rake e `70%` Prize Pool Escrow (`house_rake_bps + prize_pool_bps = 10000`). Distribuição de prêmios (`TOP_3`, `TOP_10`, `TOP_20`, `TOP_30`) via método dos maiores restos de **Hare-Niemeyer** (`remainingEscrowMinor === 0`), 100% idêntica entre [`blnk-client.ts`](./services/wallet-adapter/src/blnk-client.ts) e [`apps/web/src/arena/engine.ts`](./apps/web/src/arena/engine.ts).
- **Liquidação Oficial na Arena**: Ordens da Arena (`arena_trade_orders`) capturam `entry_price`/`entry_tick_sequence` da tabela `ticks` e são liquidadas pelo sweeper ou rota `/settle` exclusivamente pelo primeiro tick oficial `ts >= expires_at`, ignorando qualquer `result` enviado pelo cliente.
- **Layout 100vh Confinado**: Na sala ao vivo da Arena ([`ArenaPage.tsx`](./apps/web/src/pages/ArenaPage.tsx), [`ArenaRoom.tsx`](./apps/web/src/arena/ArenaRoom.tsx), [`Leaderboard.tsx`](./apps/web/src/arena/Leaderboard.tsx), [`arena.css`](./apps/web/src/arena/arena.css)), alternar entre `Top 5`, `Top 10`, `Top 20` e `Top 30` aciona scroll interno apenas na tabela do ranking (`data-testid="leaderboard-table-scroll"`), mantendo o gráfico e a boleta SUBE/BAJA 100% imóveis (`0px` de deslocamento).

---

## 4. Schema do Banco de Dados PostgreSQL (`db/migrations/`)

| Migration | Tabelas / Objetos Criados ou Alterados | Propósito |
|---|---|---|
| `0001_initial_schema.sql` | `indices`, `index_state`, `ticks`, `outbox_events`, `candles`, `contracts` | Estado forte de preços, cadeia de hash, outbox e contratos binários/digitais |
| `0002_roles_and_grants.sql` | Roles `app_tick_writer`, `app_contract`, `app_settlement`, `app_reader` | Segregação de permissões no banco (DB-05) |
| `0003_contract_state_machine_guard.sql` | Trigger `trg_contracts_state_machine` | Impede regressão de estado ou dupla liquidação em `contracts` |
| `0010_seed_multi_assets.up.sql` | Seed de 36 ativos em `indices` e `index_state` + `lease_leader`, `lease_epoch` | Catálogo multi-ativos 24/7 e controle de liderança distribuída |
| `0020_phase2_countries_flags_kyc_payments.up.sql` | `supported_countries`, `system_feature_flags`, `kyc_verifications`, `payment_transactions` | Fundação multi-país, KYC e pagamentos da Fase 2 |
| `0021_system_feature_flags_spec.up.sql` | Ajustes em `system_feature_flags` | Especificação completa de feature flags |
| `0030_regulatory_zones_mirrors_kyc_tiers.up.sql` | `regulatory_zones`, `mirror_domains`, `kyc_tier_limits` | Geoblocking, domínios espelho e limites por nível de KYC |
| `0040_users_and_auth.up.sql` | `users`, `auth_sessions`, `password_reset_tokens` | Autenticação própria respaldada por PostgreSQL |
| `0041_identity_subject_links.up.sql` | `identity_subject_links` | Vínculo canônico entre identidades legadas/OIDC e `users.id` |
| `0042_user_profile_fields.up.sql` | Colunas de perfil em `users` (`phone`, `country_code`, `avatar_url`, etc.) | Dados reais de perfil na página de Configurações |
| `0043_email_verification.up.sql` | `email_verification_codes` e flags em `users` | Verificação de e-mail por código OTP |
| `0044_cashier_deposits_withdrawals.up.sql` | `cashier_transactions` | Histórico persistente de depósitos e saques |
| `0045_kyc_and_community_modules.up.sql` | `kyc_documents`, tabelas de suporte a módulos secundários | Persistência de documentos KYC e comunidade |
| `0050_rename_synthetic_indices.up.sql` | Renomeação (`PULSE_*`, `DROP_*`, `SURGE_*`, `LEAP_*`, `STAIR_INDEX`) | Nomenclatura proprietária de índices sintéticos preservando histórico |
| `0060_phase2_spec_completeness.up.sql` | Índices e constraints complementares da Fase 2 | Fechamento de especificação multi-região |
| `0061_arena_blitz_escrow_and_real_wallet.up.sql` | `arena_tournaments`, `arena_participants`, `arena_ledger_events`, `user_bonus_grants` | Estrutura contábil e de participantes da Arena Blitz + Rollover 25x |
| `0062_arena_trade_orders.up.sql` | `arena_trade_orders`, `arena_real_balances`, `arena_wallet_transactions` | Persistência durável de ordens de torneio com `entry_tick_sequence`/`exit_tick_sequence` |

---

## 5. Invariantes Invioláveis do Projeto

1. **Dinheiro e Contabilidade (`02-financial-invariants`)**:
   - Todo valor monetário é inteiro na menor fração (`*_minor`, centavos USD). Proibido aritmética IEEE-754 float para dinheiro (`* 0.85` proibido; usar `BigInt((stake * 85n) / 100n)`).
   - Saldo oficial reside no Blnk Ledger; proibido usar `UPDATE users SET demo_balance_minor` como fonte de verdade contábil.
   - Preço de entrada, preço de saída, resultado (`WIN`/`LOSS`/`DRAW`), payout e `user_id` **nunca** vêm do cliente.
2. **Motor de Mercado (`03-synthetic-market-engine`)**:
   - Proibido `Math.random()` em geração de preços, IDs ou sorteios (usar `crypto.randomInt`, `crypto.randomBytes`, `crypto.randomUUID`).
   - Persistir no PostgreSQL (`ticks` + `index_state` + `outbox_events`) **antes** de publicar no WebSocket ou servir no REST.
3. **Segurança (`04-security-iam`)**:
   - Todas as rotas privadas validam JWT (`RS256` via JWKS ou `HS256` com `timingSafeEqual`, `exp`, `sub`, `iss`, `aud`).
   - Todas as queries e caches de carteira/contratos filtram explicitamente por `user_id = :sub` (anti-BOLA/IDOR).
4. **Design e Ergonomia (`21-designer-senior-binmax`)**:
   - A sala de operação (`TerminalLayout` e `ArenaRoom` live) tem viewport travada em `100vw × 100vh` (`overflow: hidden` na raiz). Tabelas e listas internas usam scroll confinado (`min-h-0` + `overflow-y: auto`).

---

## 6. Estado Atual do Git / Workspace (2026-10-15)

O último commit consolidado é `264c9d0`. Na working tree atual encontram-se implementadas e **100% validadas por testes/oráculos** quatro frentes prontas para commit ou inspeção:

1. **Gráfico Durável & Persistência Aditiva (Gates A, B, C e D1–D3)**:
   - [`services/tick-engine/live-market-store.mjs`](./services/tick-engine/live-market-store.mjs), [`services/tick-engine/src/persistence/tick-repository.ts`](./services/tick-engine/src/persistence/tick-repository.ts), [`scripts/dev-live-feed.mjs`](./scripts/dev-live-feed.mjs), [`db/migrations/0010_*`](./db/migrations/0010_seed_multi_assets.up.sql), [`db/migrations/0050_*`](./db/migrations/0050_rename_synthetic_indices.up.sql), [`services/wallet-adapter/src/blnk-client.ts`](./services/wallet-adapter/src/blnk-client.ts).
2. **Latência, Resiliência 3 Níveis & Velas Reais 5s/15s/30s em 1 Hz (Subetapas 1–4 e 5.1–5.4)**:
   - [`scripts/lib/aligned-tick-scheduler.mjs`](./scripts/lib/aligned-tick-scheduler.mjs), [`scripts/lib/candle-aggregation-engine.mjs`](./scripts/lib/candle-aggregation-engine.mjs), [`scripts/lib/ou-engine.mjs`](./scripts/lib/ou-engine.mjs), [`scripts/lib/settlement-engine.mjs`](./scripts/lib/settlement-engine.mjs), [`scripts/lib/wallet-read-engine.mjs`](./scripts/lib/wallet-read-engine.mjs), [`apps/web/src/api/config.ts`](./apps/web/src/api/config.ts), [`apps/web/src/chart/candle-adapter.ts`](./apps/web/src/chart/candle-adapter.ts), [`apps/web/src/chart/PriceChart.tsx`](./apps/web/src/chart/PriceChart.tsx), [`apps/web/src/chart/IsolatedChartHost.tsx`](./apps/web/src/chart/IsolatedChartHost.tsx).
3. **Torneios & Arena Blitz Durável (Gates T1, T2 e T3)**:
   - [`db/migrations/0062_arena_trade_orders.up.sql`](./db/migrations/0062_arena_trade_orders.up.sql), [`services/api/src/services/tournament-arena-service.ts`](./services/api/src/services/tournament-arena-service.ts), [`services/api/src/routes/arena.ts`](./services/api/src/routes/arena.ts), [`apps/web/src/arena/engine.ts`](./apps/web/src/arena/engine.ts).
4. **Confinamento de Scroll e Layout 100vh no Ranking da Arena (Subetapas 09–11)**:
   - [`apps/web/src/arena/arena.css`](./apps/web/src/arena/arena.css), [`apps/web/src/arena/ArenaRoom.tsx`](./apps/web/src/arena/ArenaRoom.tsx), [`apps/web/src/arena/Leaderboard.tsx`](./apps/web/src/arena/Leaderboard.tsx), [`apps/web/src/pages/ArenaPage.tsx`](./apps/web/src/pages/ArenaPage.tsx), [`apps/web/src/arena/arena-substep09-flex-chain-lock.unit.test.tsx`](./apps/web/src/arena/arena-substep09-flex-chain-lock.unit.test.tsx), [`apps/web/src/arena/arena-substep10-leaderboard-scroll.unit.test.tsx`](./apps/web/src/arena/arena-substep10-leaderboard-scroll.unit.test.tsx).

---

## 7. Comandos Úteis de Desenvolvimento, Teste e Verificação

| Operação | Comando |
|---|---|
| **Subir servidor de feed/API unificado** | `node scripts/dev-live-feed.mjs` |
| **Subir frontend em modo dev (Vite)** | `pnpm --filter @broker/web run dev` |
| **Build de produção do frontend** | `pnpm --filter @broker/web run build` |
| **Typecheck (Web, Tick Engine, Wallet Adapter)** | `pnpm --filter @broker/web exec tsc --noEmit` |
| **Testes unitários da Arena Blitz (47 testes)** | `npx vitest run apps/web/src/arena` |
| **Suíte de resiliência, scheduler 1Hz e velas 5s** | `node --test tests/subetapa-*.test.mjs` |
| **Oráculos de Gráfico Durável (Gates A, B, C, D1–D3)** | `node --test tests/integration/active-feed-*.oracle.test.mjs tests/integration/doc10-*.oracle.test.mjs` |
| **Oráculos da Arena Durável (Gates T1, T2, T3)** | `node --test tests/integration/doc04-*.oracle.test.mjs` |
