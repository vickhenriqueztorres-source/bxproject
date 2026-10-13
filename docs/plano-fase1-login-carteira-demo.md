# Plano de Implementação — Fase 1: Login (Keycloak) e Carteira Demo (Blnk)
**Plataforma de Índices Sintéticos BINMAX — Governança e Engenharia Financeira**

---

## 1. Pool de Especialistas e Matriz de Responsabilidades

| Agente / Especialista | Papel Técnico | Skills Ativadas | Permissão |
| :--- | :--- | :--- | :---: |
| **`tech-lead-orchestrator`** | Coordenação, gates de aprovação e governança de arquitetura | `01-project-context`, `20-conduzir-etapa` | Read / Orchestrate |
| **`broker-architect-agent`** | Desenho arquitetural do ledger Blnk, modelo de contas e FMEA | `01`, `02`, `03`, `08` | Architecture / Write |
| **`security-reviewer`** | Revisão estrita de IAM, OIDC PKCE, RS256 JWKS, RBAC e IDOR | `04-security-iam`, `09-ai-failure-map` | Read-only |
| **`financial-correctness-reviewer`** | Validação de invariantes financeiras I-01 a I-06 (dupla entrada) | `02-financial-invariants`, `08` | Read-only |
| **`backend-implementation-agent`** | Implementação de BFF, rotas de Auth, Wallet Adapter Blnk e Postgres | `01`, `02`, `04`, `05`, `08` | Write-code (backend) |
| **`surgical-frontend-agent`** | Gateway de entrada na Landing Page, páginas de Login/Registro e Router | `12-tokens-binmax`, `13`, `17`, `21` | Write-code (frontend) |
| **`qa-resilience-agent`** | Testes de caos, concorrência, estresse, segurança e regressão | `05`, `06-testing-quality` | Write-tests-only |
| **`post-implementation-verifier`** | Prova matemática e validação de pós-condições V-01 a V-13 | `10-post-implementation-verification` | Read-only |

---

## 2. Diagnóstico Atual da Infraestrutura (Executado)

| Componente | Container / Processo | Porta | Status Conexão | Observação |
| :--- | :--- | :---: | :---: | :--- |
| **PostgreSQL App** | `broker-postgres` | 5432 | ✅ Healthy | Schema `broker_platform` ativo com migrations |
| **PostgreSQL Blnk** | `broker-blnk-postgres`| 5432 | ✅ Healthy | Banco `blnk_ledger` isolado e saudável |
| **Blnk Core Ledger** | `broker-blnk-core` | 5001 | ✅ Online | API responde `"server running..."` |
| **Keycloak IAM** | `broker-keycloak` | 8080 | ✅ Healthy | Realm `broker-demo` ativo, OIDC disponível |
| **Redis Cache/PubSub**| `broker-redis` | 6379 | ✅ Healthy | Responde `PONG` |
| **Nginx Edge Proxy** | `nginx` (Ubuntu) | 80 / 443 | ✅ Ativo | SSL habilitado, rotas `/`, `/api/`, `/realms/`, `/ws` |
| **Live Feed & API** | `broker-feed` (PM2) | 3001 | ✅ Online | 36 ativos gerando ticks e candles contínuos |

---

## 3. Matriz de Subetapas da Fase 1

```
[SUBETAPA 01] Gateway de Entrada: Landing Page Oficial vs Traderoom
       │ (Aprovado 100% com testes de rota e isolamento)
       ▼
[SUBETAPA 02] Identidade IAM com Keycloak: Cadastro, Login, OIDC PKCE e JWT RS256
       │ (Aprovado 100% com testes de segurança S-01 a S-06)
       ▼
[SUBETAPA 03] Carteira Demo com Blnk Ledger: Partidas Dobradas e $10.000 USD
       │ (Aprovado 100% com auditoria financeira I-01 a I-06)
       ▼
[SUBETAPA 04] Testes de Caos, Concorrência, Resiliência e Certificação Final
```

---

### SUBETAPA 01 — Diagnóstico de Conexões e Gateway de Entrada Oficial
- **Objetivo**: Ao acessar `https://binmaxbroker.com/`, carregar imediatamente a **Landing Page Institucional da BINMAX** com CTA claro para Login (`/login`) ou Criar Conta (`/registro`), e NÃO jogar o usuário direto na Traderoom sem autenticação.
- **Mudanças**:
  - `apps/web/src/App.tsx`: Rota `/` mapeada exclusivamente para `<LandingPage />`.
  - A rota `/operar` e `/traderoom` passa a ser a sala de trading protegida (com sessão autenticada ou modo demo explícito).
  - Header da Landing Page com links de alta conversão: "Iniciar Sesión" -> `/login`, "Abrir Cuenta Gratis" -> `/registro`.
- **Testes Obrigatórios**:
  - Teste 1: Acesso a `/` renderiza o container `landing-page-container` (HTTP 200).
  - Teste 2: Botão "Iniciar Sesión" redireciona para `/login`.
  - Teste 3: Botão "Registrarse" redireciona para `/registro`.
  - Teste 4: Botão "Probar Demo" navega para `/operar` com saldo $10.000 USD e ativos ativos.

---

### SUBETAPA 02 — Identidade IAM com Keycloak (OIDC PKCE + JWT RS256)
- **Objetivo**: Conectar o fluxo de cadastro e login com o Keycloak oficial, garantindo emissão e validação segura de tokens no backend.
- **Mudanças**:
  - Realm `broker-demo` configurado com client público `broker-web` com PKCE S256 e sem client secret exposto no front.
  - Backend (`services/api/src/plugins/auth.ts`): Validação criptográfica do access token via JWKS RS256 contra `https://binmaxbroker.com/realms/broker-demo/protocol/openid-connect/certs`.
  - Extração estrita de `sub` (user_id) no backend sem confiar em campos enviados pelo cliente (S-01, S-02).
- **Testes Obrigatórios**:
  - Teste de Segurança: Rejeição de tokens adulterados ou com `alg: none`.
  - Teste de Força Bruta: Bloqueio progressivo após 5 falhas consecutivas.
  - Teste de Expiração: Rejeição de tokens expirados (401 Unauthorized).

---

### SUBETAPA 03 — Carteira Demo no Blnk Ledger (Contabilidade de Dupla Entrada)
- **Objetivo**: Criar no Blnk Ledger a conta de carteira demo do usuário assim que ele se registrar, provisionando exatamente $10.000 USD demo (`1000000` centavos).
- **Invariantes Invioláveis**:
  - `I-01`: Ledger append-only, saldo derivado de transações, proibido `UPDATE balance`.
  - `I-02`: Dupla entrada (`source: "house_demo_faucet"`, `destination: "customer_wallet_{user_id}"`).
  - `I-03`: Idempotência garantida via chave `init_faucet:{user_id}`.
- **Testes Obrigatórios**:
  - Teste Financeiro: Verificação de soma zero no Blnk.
  - Teste de Idempotência: Repetição da chamada de abertura de conta resulta no mesmo saldo de $10.000 USD sem duplicar crédito.

---

### SUBETAPA 04 — Testes de Caos, Concorrência e Certificação Final
- **Objetivo**: Provar resiliência sob concorrência e falhas de infraestrutura.
- **Baterias de Teste**:
  - Carga concorrente: 50 usuários simultâneos abrindo ordens e consultando carteira.
  - Teste de Caos: Reinício temporário do Keycloak e Blnk com fallback e recuperação sem perda de estado.
  - Verificação de Pós-condições V-01 a V-13.
