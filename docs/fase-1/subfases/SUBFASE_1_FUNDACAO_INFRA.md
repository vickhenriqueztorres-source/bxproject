# Subfase 1: Fundação, Monorepo & Infraestrutura de Dados

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `backend-implementation-agent`  
**Agente Revisor de Segurança:** `security-reviewer`  
**Agente de Testes:** `qa-resilience-agent`  
**Subtasks do PRD:** T01, T02, T03  
**Decisões Aplicadas:** D-01 (Keycloak), D-05 (PostgreSQL), D-15 (Docker Compose), D-17 (RDS/Multi-AZ), D-18 (Moeda USD em centavos `*_minor`)  
**Invariantes Chave:** S-01 a S-06, DB-01 a DB-14, O-01, O-02  

---

## 1. Escopo e Objetivos da Subfase
Estabelecer a fundação monorepo do projeto com pnpm workspaces, a infraestrutura completa de contêineres Docker Compose (`infra/compose.yaml`), as migrations do PostgreSQL 16 com TimescaleDB, a modelagem DDL rigorosa com tipos fixos (`numeric(18,6)` para cotações e `bigint` para centavos de dólar), as roles e permissões de menor privilégio, o realm OIDC do Keycloak e o esqueleto do API Gateway/BFF com Fastify e validação de JWT RS256.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 1.1: Estruturação do Monorepo pnpm Workspaces
- **Ação:** Configurar `pnpm-workspace.yaml` e a estrutura de pastas modular do repositório:
  ```text
  services/
    api/               (BFF, endpoints REST, autenticação)
    tick-engine/       (Motor sintético OU, CSPRNG, líder único)
    candle-worker/     (Agregação de OHLCV em Redis Streams)
    settlement-worker/ (Liquidação com lock pessimista)
    wallet-adapter/    (Tradução de operações para Blnk Ledger)
    websocket-gateway/ (Fan-out de ticks e catch-up)
  apps/
    web/               (Frontend React + Vite + Lightweight Charts)
    admin/             (Painel administrativo)
  packages/
    shared/            (DTOs, types TypeScript, utilitários matemáticos)
  infra/               (compose.yaml, Dockerfiles, configs)
  db/migrations/       (Migrations numeradas e reversas)
  tests/               (unit, integration, chaos, load)
  ```
- **Ferramentas:** `backend-implementation-agent` cria e organiza os `package.json` de cada pacote com TypeScript 5.x estrito.
- **Critério de Aceite:** `pnpm install` executa sem erros na raiz e conecta os workspaces locais via links simbólicos de desenvolvimento.

---

### Passo 1.2: Orquestração Docker Compose Completa (`infra/compose.yaml`)
- **Ação:** Criar o arquivo `infra/compose.yaml` com todos os contêineres essenciais da Fase 1 usando digests fixos (sem tags `:latest` soltas):
  - `postgres`: PostgreSQL 16 com TimescaleDB (porta interna 5432, sem exposição direta para o host em produção).
  - `redis`: Redis 7 Alpine com persistência AOF (porta interna 6379).
  - `keycloak`: Keycloak 24+ em modo produção/dev-ready com healthcheck na porta de management 9000.
  - `blnk`: Blnk Finance Core com seu PostgreSQL e Redis dedicados.
  - `mailpit`: Servidor SMTP falso para dev com interface web (1025/8025).
  - `prometheus`, `grafana`, `loki`: Stack de observabilidade e métricas.
  - Serviços de backend com endpoints `/readyz` e `/healthz`.
- **Regras:** Variáveis de ambiente sensíveis declaradas em `.env.example` sem valores reais. Rede interna isolada (`broker_internal_net`).
- **Critério de Aceite:** Todos os contêineres sobem e alcançam estado `healthy` em menos de 180 segundos.

---

### Passo 1.3: Migrations do Schema Base no PostgreSQL
- **Ação:** Criar as migrations versionadas em `db/migrations/0001_initial_schema.sql` (e seu rollback `0001_initial_schema.down.sql`):
  - Tabela `indices`: metadados do ativo sintético (`symbol`, `name`, `status`, `tick_interval_ms`, `base_price`, `volatility`, `mean_reversion_speed`).
  - Tabela `index_state`: controle de concorrência (`symbol`, `last_sequence`, `last_price numeric(18,6)`, `last_hash`, `lease_leader`, `lease_epoch`, `updated_at`).
  - Tabela `ticks`: histórico imutável (`id`, `symbol`, `sequence bigint`, `price numeric(18,6)`, `ts timestamptz`, `prev_hash`, `hash`, `created_at`). `CONSTRAINT unique_symbol_sequence UNIQUE(symbol, sequence)`.
  - Tabela `candles`: agregação OHLCV (`symbol`, `interval`, `bucket_start timestamptz`, `open numeric(18,6)`, `high numeric(18,6)`, `low numeric(18,6)`, `close numeric(18,6)`, `volume bigint`).
  - Tabela `contracts`: ordens de trading (`id uuid`, `user_id uuid`, `symbol`, `direction`, `status`, `stake_minor bigint`, `payout_minor bigint`, `entry_price numeric(18,6)`, `exit_price numeric(18,6)`, `opened_at`, `expires_at`, `settled_at`, `idempotency_key text UNIQUE`).
  - Tabela `outbox_events`: transactional outbox pattern (`id uuid`, `event_type`, `payload jsonb`, `status`, `created_at`).
  - Tabela `audit_logs`: trilha de auditoria append-only (`id uuid`, `actor_id uuid`, `action`, `target_resource`, `details jsonb`, `created_at`).
- **Regras:** `DB-02` (dinheiro em `bigint`, preço em `numeric(18,6)`, tempo em `timestamptz` UTC).
- **Critério de Aceite:** Migrations aplicam com sucesso e podem ser revertidas pelo arquivo `.down.sql` sem deixar resquícios.

---

### Passo 1.4: Configuração de Roles e Princípio do Menor Privilégio no PostgreSQL
- **Ação:** Criar a migration `db/migrations/0002_roles_and_grants.sql`:
  - `synth_owner`: role NOLOGIN proprietária de todas as tabelas.
  - `synth_migrator`: role com permissão DDL usada apenas durante o deploy e CI/CD.
  - `app_tick`: role exclusiva do Tick Engine (permissão `SELECT`, `UPDATE` em `index_state`, `INSERT` em `ticks` e `outbox_events`). Sem permissão em `contracts` ou `users`.
  - `app_contract`: role exclusiva da API/BFF (permissão em `contracts`, `indices`, `outbox_events`). Sem permissão de `UPDATE`/`DELETE` em `ticks`.
  - `app_settle`: role do Settlement Worker (`SELECT`, `UPDATE` em `contracts`, `SELECT` em `ticks`).
  - `app_reader`: role estritamente read-only para a Chart API.
- **Regras:** `DB-05` (menor privilégio estrito, nenhuma role da aplicação possui `SUPERUSER` ou `DELETE` em histórico de ticks/audit).
- **Critério de Aceite:** Testes de banco comprovam que a role `app_contract` não consegue alterar registros na tabela `ticks`.

---

### Passo 1.5: Configuração do Realm OIDC no Keycloak
- **Ação:** Criar o arquivo de exportação de realm `infra/keycloak/broker-realm.json`:
  - Realm: `broker-demo`.
  - Clients configurados:
    - `broker-web`: Public Client com PKCE (S256 obrigatório) para a aplicação React.
    - `broker-api`: Bearer-only Client para validação JWT no backend.
    - `broker-admin`: Client com restrição de roles administrativas.
  - Roles do sistema: `USER`, `ADMIN`, `AUDITOR`.
  - Configuração do Mailpit como servidor SMTP de envio de e-mails de confirmação e reset de senha.
  - Políticas de senha, rate limit de tentativas de login (5 em 15 min) e emissão de tokens assinados com `RS256`.
- **Regras:** `S-01`, `S-02`, `D-01`.
- **Critério de Aceite:** Keycloak importa o realm na inicialização e emite JWTs RS256 com claims `sub`, `iss`, `aud`, `realm_access.roles`.

---

### Passo 1.6: Setup Base do API Gateway / BFF (`services/api`)
- **Ação:** Inicializar o serviço `services/api` com Fastify + TypeScript:
  - Plugin de autenticação via JWKS (JSON Web Key Set) do Keycloak validando assinatura `RS256`, expiração, emissor e audiência.
  - Middleware de extração de tenant/user injetando `req.userId = decoded.sub`.
  - Schemas DTO com Zod em modo `.strict()` (rejeitando campos extras para prevenir Mass Assignment).
  - Middleware de CORS restrito, Helmet (security headers) e Rate Limit por IP e por `sub` (30 req/min).
  - Rotas de healthcheck `/healthz` e `/readyz` verificando conexões com Postgres e Redis.
- **Regras:** `B-10`, `B-11`, `B-13`, `S-02`.
- **Critério de Aceite:** Requisição sem token ou com JWT forjado retorna `401 Unauthorized`; rotas saudáveis respondem `200 OK`.

---

## 3. Validação e Critérios de Conclusão da Subfase
1. Execução do script `pnpm run stack:up` subindo todos os contêineres sem falhas.
2. `qa-resilience-agent` executa a suíte de testes de integração da fundação (`tests/integration/foundation.test.ts`).
3. `security-reviewer` emite parecer sobre ausência de portas expostas e isolamento de segredos.
4. Gate de qualidade da Subfase 1 marcado como `PASS`.
