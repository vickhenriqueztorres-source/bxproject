# Subetapa 04 — Bateria Industrial de Certificação E2E, Testes de Caos, Carga e Homologação na VPS

**Agente Responsável:** `post-implementation-verifier`  
**QA Líder:** `qa-resilience-agent`  
**Auditor Forense:** `broker-architect-agent`  
**Skills Chave:** `02-financial-invariants`, `05-resilience-patterns`, `06-testing-quality`, `07-production-operations`, `10-post-implementation-verification`  

---

## 1. Objetivo da Subetapa

Executar uma **certificação ponta a ponta (E2E) em ambiente real na VPS e local**, comprovando matematicamente e por execução forense que:
1. O saldo demo de uma conta logada permanece 100% persistido após múltiplos ciclos operacionais (trades ganhos e perdidos) e após múltiplos recarregamentos de página (F5 reload storm).
2. O salvamento e leitura da tela de Configurações de Conta (`/ajustes`) funcionam de ponta a ponta sem qualquer erro de banco de dados.
3. Não há vazamento de memória, degradação de performance ou corrupção de estado sob estresse concorrente.

---

## 2. Roteiro de Testes e Certificação

### 2.1. Teste E2E de Persistência Real de Saldo (10 F5s e 5 Trades)
- **Passo 1:** Criação ou autenticação de um usuário real no banco de dados com saldo inicial.
- **Passo 2:** Abertura de 5 ordens reais com stakes conhecidos.
- **Passo 3:** Liquidação das ordens pelo motor oficial (gerando lucros e prejuízos legítimos).
- **Passo 4:** Leitura do saldo gravado em `users.demo_balance_minor` no PostgreSQL e no Blnk Ledger.
- **Passo 5:** Disparo de 10 requisições consecutivas simulando F5s rápidos na página.
- **Critério de Sucesso:** Em todas as 10 verificações, o saldo retornado é rigorosamente idêntico ao valor do banco após os trades, sem qualquer retorno de 10.000.

### 2.2. Teste E2E de Ajustes e Configuração de Conta
- **Passo 1:** Leitura do perfil atual via `GET /api/v1/auth/me`.
- **Passo 2:** Envio de atualização via `PUT /api/v1/auth/me` alterando nome para "Trader Certificado 2026", país para "BR", telefone para "+55 11 99999-8888".
- **Passo 3:** Verificação direta no banco PostgreSQL de que as colunas `name`, `country_code`, `phone_code` e `phone_number` foram atualizadas.
- **Passo 4:** Alteração de senha via `PUT /api/v1/auth/password` e teste de login imediato com a nova senha.
- **Critério de Sucesso:** Atualização persistida no banco; login bem-sucedido com a nova senha; senha antiga rejeitada.

### 2.3. Teste de Caos & Falha Injetada
- **Passo 1:** Simulação de indisponibilidade do Blnk Ledger por 5 segundos.
- **Passo 2:** Consulta de saldo e validação de que o fallback do banco atende sem lentidão e sem reset de saldo.
- **Passo 3:** Restabelecimento do serviço e validação de autocura do sistema.

### 2.4. Deploy Seguro e Validação dos Serviços na VPS
- **Passo 1:** Sincronização dos arquivos atualizados para a VPS (`169.58.159.77`).
- **Passo 2:** Build e deploy do frontend em `/root/app/apps/web/dist`.
- **Passo 3:** Reinicialização dos serviços no PM2 (`pm2 restart broker-feed`).
- **Passo 4:** Verificação de logs com ausência total de erros.

---

## 3. Critérios Finais de Fechamento do Gate

- [x] Script automatizado `test-certificacao-e2e-subetapa-4.mjs` executado com status PASS em 100% dos testes.
- [x] Nenhum log de erro de Blnk ou Banco de Dados no PM2 da VPS.
- [x] Frontend servido e respondendo 200 via Nginx.
- [x] Confirmação de que o problema 1 (saldo resetando para 10 mil no reload) e problema 2 (erro no banco na configuração de conta) foram eliminados em definitivo.
