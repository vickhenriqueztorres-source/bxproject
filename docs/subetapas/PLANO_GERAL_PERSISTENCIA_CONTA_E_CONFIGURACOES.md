# PLANO GERAL: Persistência Forte de Conta, Correção do Saldo Demo e Configuração de Usuário

**Status:** Aprovado para detalhamento em subetapas  
**Orquestrador:** `tech-lead-orchestrator`  
**Data:** 13 de Outubro de 2026  
**Ambiente:** VPS de Produção/Staging (`169.58.159.77`) e Monorepo Local  

---

## 1. Contexto e Problemas Reportados

O usuário reportou dois problemas críticos operacionais e de integridade de dados:
1. **Conta logada recarregando para US$ 10.000 Demo no reload (F5):**
   - Ao operar na plataforma, ganhar ou perder trades, e em seguida atualizar a página (F5), o saldo volta para 10 mil demo em vez de ficar permanentemente salvo e acumulado na conta do usuário.
   - Ocorre um "bug visual / piscada" no cabeçalho e seletores de conta durante o carregamento inicial.
2. **Erro no banco de dados na configuração de conta (`/ajustes`):**
   - Falha ao carregar ou salvar dados de perfil e senha na tela de Ajustes/Configuração.
   - Inconsistência de schema e rotas na API backend.

---

## 2. Diagnóstico Técnico de Causa Raiz

Após análise aprofundada do código-fonte local, banco de dados PostgreSQL e serviços ativos na VPS:

### 2.1. Causa Raiz do Saldo Demo Voltar para US$ 10.000
1. **Falha de Conectividade com o Blnk Ledger na VPS:**
   - O serviço unificado `scripts/dev-live-feed.mjs` estava configurado com o fallback de URL `http://172.18.0.11:5001`.
   - O container Docker `broker-blnk-core` na VPS estava no IP `172.18.0.10`, mas sua porta está exposta no localhost `http://127.0.0.1:5001`.
   - A tentativa de conexão em `172.18.0.11` gerou `fetch failed`, acionando o Circuit Breaker do `BlnkClient` (`CIRCUIT_BREAKER_OPEN` constante).
2. **Falta de Persistência no PostgreSQL (`users.demo_balance_minor`):**
   - No `dev-live-feed.mjs`, ao abrir e liquidar contratos, o saldo era deduzido/creditado apenas na variável volátil em memória `devWallet = { available_minor: 1000000 }` e tentava ir para o Blnk (que estava com circuito aberto).
   - A tabela `users` do PostgreSQL **NUNCA** recebia o UPDATE com o novo saldo do usuário nas ordens e settlements!
   - Quando o Blnk falhava, o endpoint `/api/v1/wallet` caía no fallback que lia do PostgreSQL (que sempre tinha os 10.000 iniciais estáticos) ou retornava a variável global `devWallet`.
3. **Bug Visual de Hidratação no Frontend:**
   - No `AccountSelectorDropdown.tsx` (linha 57) e `TerminalHeader.tsx` (linha 932), se a query da carteira estivesse em loading ou com `null`, havia um fallback hardcoded para `'$10,000.00'`.
   - Ao dar F5, o React Query começava com cache vazio para a carteira, causando o salto visual onde o número piscava em 10.000 antes de responder (ou permanecia em 10.000 se houvesse erro).

### 2.2. Causa Raiz do Erro na Configuração de Conta
1. **Rotas Faltantes na API Oficial (`services/api`):**
   - Em `services/api/src/routes/auth.ts`, as rotas `PUT /api/v1/auth/me` e `PUT /api/v1/auth/password` não estavam implementadas.
   - Em `services/api/src/services/auth-service.ts`, os métodos de atualização de perfil e senha não existiam.
2. **Validação de Schema Estrito:**
   - Em `apps/web/src/api/client.ts`, a função `openContract` enviava campos não reconhecidos pelo schema Zod do backend (`expiry_mode`, `target_expires_at`), quebrando contratos e causando 4 falhas em testes unitários.

---

## 3. Matriz de Agentes e Habilidades (Pool Especializado)

| Agente | Responsabilidade | Skills Ativadas |
|---|---|---|
| `tech-lead-orchestrator` | Governança geral, ordenação de etapas e validação de gates | `01-project-context`, `20-conduzir-etapa` |
| `backend-implementation-agent` | Correção da URL do Blnk, persistência atômica no Postgres, rotas `PUT /me` e `PUT /password` | `01-project-context`, `02-financial-invariants`, `05-resilience-patterns`, `08-database-foundation` |
| `frontend-realtime-agent` | Hidratação sem flash de saldo, eliminação do fallback hardcoded, payload limpo em `openContract` | `01-project-context`, `03-synthetic-market-engine`, `11-chart-trading-tools` |
| `financial-correctness-reviewer` | Validação das invariantes financeiras I-01 a I-06 e auditoria do saldo `*_minor` | `02-financial-invariants`, `08-database-foundation`, `09-ai-failure-map` |
| `qa-resilience-agent` | Baterias de testes de estresse, caos, segurança e certificação E2E | `05-resilience-patterns`, `06-testing-quality` |

---

## 4. Divisão em Subetapas Independentes e Sequenciais

Cada subetapa é acompanhada de um documento `.md` executável específico com seu roteiro detalhado, baterias de testes (estresse, segurança, caos) e critérios de aceite rígidos:

1. **Subetapa 01 — Persistência Forte do Saldo Demo no PostgreSQL e Blnk Ledger com Resiliência Automática**
   - *Arquivo:* `docs/subetapas/subetapa-01-persistencia-saldo-banco-blnk.md`
   - *Foco:* Conexão Blnk na VPS (`127.0.0.1:5001`), atomicidade de atualização em `users.demo_balance_minor` nas aberturas e liquidações, e fallback robusto e consistente em caso de indisponibilidade de serviços.
2. **Subetapa 02 — Implementação dos Endpoints de Configuração de Conta e Perfil (`PUT /me` e `PUT /password`)**
   - *Arquivo:* `docs/subetapas/subetapa-02-api-configuracao-conta-perfil.md`
   - *Foco:* Implementação em `services/api` e `dev-live-feed.mjs`, hashing seguro com salt, validação anti-BOLA/IDOR, proteção contra mass assignment (saldo não pode ser alterado via perfil) e proteção de força bruta.
3. **Subetapa 03 — Blindagem do Frontend: Eliminação do Bug Visual de Reload (F5) e Sincronização de Sessão**
   - *Arquivo:* `docs/subetapas/subetapa-03-blindagem-frontend-reload-bug-visual.md`
   - *Foco:* Hidratação de cache no `TraderoomShell` e `App.tsx`, remoção de fallbacks hardcoded de 10.000, limpeza do payload de `openContract` para conformidade com schema Zod estrito e validação dos testes do vitest (399/399 passando).
4. **Subetapa 04 — Bateria Industrial de Certificação E2E, Testes de Caos, Carga e Validação na VPS**
   - *Arquivo:* `docs/subetapas/subetapa-04-certificacao-e2e-caos-estresse-vps.md`
   - *Foco:* Teste de 100 recargas consecutivas (reload storm), teste de caos com queda de conexões, auditoria forense do saldo salvo no banco e fechamento dos gates de integridade.

---

## 5. Regras Invioláveis de Execução

1. **Nunca implementar nada sem testes robustos prévios e posteriores.**
2. **Nunca avançar para a próxima subetapa sem a anterior estar 100% testada, validada e funcional.**
3. **Nunca quebrar nenhuma funcionalidade existente (gráficos, cotações, autenticação, trading).**
4. **Respeito absoluto às invariantes financeiras I-01 a I-06:**
   - Saldo sempre em inteiros centavos (`*_minor`).
   - Saldo nunca manipulável pelo cliente via requests de perfil.
   - Idempotência rigorosa em todas as aberturas e settlements.
