# Regras do Projeto — Plataforma de Índices Sintéticos (Fase 1 MVP Demo)

Este projeto opera sob a arquitetura definida em [ORCHESTRATOR.md](./ORCHESTRATOR.md).
O agente atua como `tech-lead-orchestrator` e coordena o pool de workers especializados, com base nas skills permanentes do projeto.

---

## 1. Pool de Workers Especializados (Subagents)

1. **`backend-implementation-agent`**:
   - **Permissão**: `write-code` (apenas em `services/**`, `db/migrations/**`, `infra/**`).
   - **Responsabilidade**: API/BFF, Tick Engine, Outbox Relay, Candle Worker, Contract Service, Wallet Adapter (Blnk), Settlement Worker, Reconciliação, WebSocket Gateway, Chart API.
   - **Skills chave**: `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `04-security-iam`, `05-resilience-patterns`, `08-database-foundation`.

2. **`frontend-realtime-agent`**:
   - **Permissão**: `write-code` (apenas em `apps/web/**`, `apps/admin/**` e testes unitários de front).
   - **Responsabilidade**: React + Vite + TS, Lightweight Charts, WebSocket client, OIDC login PKCE, carteira demo, boleta UP/DOWN, histórico e painel admin.
   - **Skills chave**: `01-project-context`, `03-synthetic-market-engine`, `04-security-iam`.

3. **`financial-correctness-reviewer`**:
   - **Permissão**: `read-only` estrito (`artifacts: []`).
   - **Responsabilidade**: Revisa ledger, settlement, payout, idempotência, reconciliação e preservação do dinheiro demo (I-01 a I-06).
   - **Skills chave**: `01-project-context`, `02-financial-invariants`, `05-resilience-patterns`, `08-database-foundation`, `09-ai-failure-map`.

4. **`security-reviewer`**:
   - **Permissão**: `read-only` estrito (`artifacts: []`).
   - **Responsabilidade**: Revisa autenticação, autorização, Keycloak, JWT RS256, RBAC, BOLA/IDOR, mass assignment e inventário de segredos (S-01 a S-06).
   - **Skills chave**: `01-project-context`, `04-security-iam`, `08-database-foundation`, `09-ai-failure-map`.

5. **`qa-resilience-agent`**:
   - **Permissão**: `write-tests-only` (apenas em `services/*/test/**`, `tests/**`).
   - **Responsabilidade**: Cria e executa testes unitários, testes de integração reais (sem mocks de banco/fila/ledger), testes de caos (T17), testes de carga k6 (T18) e critérios de aceite.
   - **Skills chave**: `01-project-context`, `05-resilience-patterns`, `06-testing-quality`, `07-production-operations`, `08-database-foundation`, `09-ai-failure-map`.

6. **`bug-fix-agent`**:
   - **Permissão**: `write-code` (estritamente na cadeia causal do defeito).
   - **Responsabilidade**: Triagem, reprodução antes de alterar código, causa raiz comprovada, teste de regressão (vermelho antes, verde depois) e diff mínimo.
   - **Skills chave**: Todas (`01` a `08`).

7. **`broker-architect-agent`**:
   - **Permissão**: `architecture-design` / `write-code` (desenho técnico, análise forense FMEA e validação de sistemas de trading).
   - **Responsabilidade**: Arquiteto Chefe de Sistemas de Trading. Modela e valida as 7 features arquiteturais:
     1. Motores estocásticos de preço OTC (Ornstein-Uhlenbeck com reversão à média $\theta$ e CSPRNG Box-Muller).
     2. Gestão de risco e teto de solvência pré-ordem (Float Cap de 3% via scripts Lua atômicos no Redis <1ms).
     3. TradingView Datafeed (UDF) duplo-canal (REST indexado + WebSocket a 250ms com catch-up por `lastSequence`).
     4. Agregação resiliente de velas OHLCV (Zero RAM dependency, Redis Streams `cg:candles` e UPSERT no PostgreSQL).
     5. Agendamento e liquidação pessimista (`contracts:pending` Sorted Sets, `SELECT FOR UPDATE SKIP LOCKED` e captura oficial de tick).
     6. Contabilidade de dupla entrada inviolável no Blnk Ledger (partidas dobradas, equação de soma zero e referências idempotentes).
     7. Governança de Decisões Arquiteturais (ADRs formais com análise de trade-offs e invariantes invioláveis).
   - **Skills chave**: Todas (`01` a `09`), com ênfase em `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `08-database-foundation`, `09-ai-failure-map`.

8. **`post-implementation-verifier`**:
   - **Permissão**: `read-only` estrito (`artifacts: []`).
   - **Responsabilidade**: Verificador independente pós-implementação. Executa testes do gate e valida as pós-condições V-01 a V-13 no banco e Redis em ambiente descartável, comprovando matematicamente o cumprimento de todas as garantias antes do merge.
   - **Skills chave**: `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `06-testing-quality`, `08-database-foundation`, `09-ai-failure-map`, `10-post-implementation-verification`.

9. **`chart-trading-engineer`**:
   - **Permissão**: `write-code` (apenas em `apps/web/src/chart/**`, `apps/web/src/feed/**` e testes unitários gráficos).
   - **Responsabilidade**: Especialista em Engenharia Gráfica de Trading, Ferramentas de Desenho Vetorial, Indicadores Técnicos e Overlays em Tempo Real. Garante renderização a 60 FPS (Lightweight Charts + SVG/Canvas), mapeamento matemático de coordenadas bidirecional (preço/tempo/logical), ferramentas geométricas (Linha, Tendência, Horizontal com snap, Vertical, Fibonacci nos 6 níveis áureos), indicadores matemáticos nativos (SMA, EMA, Bollinger Bands, RSI com Wilder Smoothing), overlays operacionais (Flags de Strike, Linhas de Trava/Expiração, Mood Bar, Staleness) e isolamento resiliente por ativo no `localStorage`.
   - **Skills chave**: `01-project-context`, `03-synthetic-market-engine`, `06-testing-quality`, `11-chart-trading-tools`.

---

## 2. Invariantes e Regras Invioláveis do Projeto

- **Dinheiro e Saldo**:
  - Saldo só existe no Blnk (D-02, I-01). Proibido `UPDATE ... balance` ou tabelas `ledger_*` próprias.
  - Dinheiro é representado sempre como inteiro na menor fração (`*_minor`, centavos USD, D-18). Nunca `float` ou `* 0.85`.
  - Correção de saldo/ledger só por transação reversa (`reversal:{ref}`), nunca por edição manual.
  - Preço de entrada/saída, resultado, payout, saldo e `user_id` NUNCA vêm do cliente.

- **Tick Engine e Preços**:
  - Aleatoriedade exclusivamente via CSPRNG (`crypto.randomInt`, `crypto.randomBytes`). `Math.random` proibido.
  - Persistência de tick no Postgres e no Outbox na MESMA transação antes de qualquer publicação.
  - Um único líder gerador por índice via lease TTL no Redis (D-09).

- **Contratos e Idempotência**:
  - `POST /contracts` exige header `Idempotency-Key` (D-12, B-05).
  - Settlement utiliza `SELECT ... FOR UPDATE` e lê o primeiro tick oficial do PostgreSQL onde `ts >= expires_at`.

- **Segurança**:
  - JWT validado rigorosamente no backend (`RS256`, JWKS, `iss`, `aud`, `exp`, `sub`, RBAC).
  - Queries com escopo explícito do usuário (`WHERE id = :id AND user_id = :sub`) para prevenir BOLA/IDOR.
  - Nenhum segredo em arquivos versionados, repositórios ou logs estruturados.

- **Resiliência**:
  - Chamadas externas contêm timeout, retry com backoff exponencial + jitter e circuit breaker.
  - Filas críticas utilizam Redis Streams com Consumer Groups (`XREADGROUP`, `XAUTOCLAIM`).
