# Subetapa 01 — Persistência Forte do Saldo Demo no PostgreSQL e Blnk Ledger com Resiliência Automática

**Agente Responsável:** `backend-implementation-agent`  
**Revisor de Integridade:** `financial-correctness-reviewer`  
**QA & Caos:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `02-financial-invariants`, `05-resilience-patterns`, `08-database-foundation`  

---

## 1. Objetivo da Subetapa

Garantir que todo saldo demo de usuário autenticado seja **persistido atomicamente e permanentemente no PostgreSQL (`users.demo_balance_minor`) e sincronizado no Blnk Ledger**, de modo que:
1. Quando o usuário abrir uma ordem, o valor de stake seja deduzido imediatamente no banco e no ledger.
2. Quando a ordem for liquidada (WIN/LOSS/DRAW), o payout/lucro seja creditado com precisão matemática no banco e no ledger.
3. Se a página for recarregada (F5), fechada ou aberta em outro dispositivo, o saldo consultado seja exatamente o valor persistido da conta do usuário.
4. Se o Blnk estiver indisponível ou reiniciar, o PostgreSQL atue como fonte de verdade forte resiliente, sem jamais resetar o saldo para os 10.000 iniciais.

---

## 2. Diagnóstico & O Que Deve Ser Corrigido

1. **Correção de Conectividade do Blnk na VPS:**
   - Em `scripts/dev-live-feed.mjs`, substituir a URL do Blnk de `http://172.18.0.11:5001` (que causava `fetch failed` e trip do circuit breaker) por `http://127.0.0.1:5001` (porta do host exposta e ativa) com timeout calibrado de 2500ms.
2. **Atualização Atômica na Abertura de Contratos (`POST /api/contracts`):**
   - Ao processar uma nova ordem válida de stake $S$, executar atomicamente no PostgreSQL:
     ```sql
     UPDATE users 
     SET demo_balance_minor = demo_balance_minor - $1, updated_at = NOW() 
     WHERE id = $2 AND demo_balance_minor >= $1 
     RETURNING demo_balance_minor;
     ```
   - Se a query não retornar linha, rejeitar a ordem com código `INSUFFICIENT_BALANCE` (invariante I-01).
3. **Atualização Atômica na Liquidação de Contratos (`CONTRACT_SETTLED`):**
   - Ao liquidar contrato com resultado WIN/LOSS/DRAW e payout $P$, executar no PostgreSQL:
     ```sql
     UPDATE users 
     SET demo_balance_minor = demo_balance_minor + $1, updated_at = NOW() 
     WHERE id = $2 
     RETURNING demo_balance_minor;
     ```
   - Sincronizar o Blnk via `settleContract` em paralelo protegido com try/catch para garantir que falhas transitórias do ledger externo não corrompam a base local.
4. **Endpoint de Carteira (`GET /api/v1/wallet`):**
   - Consultar o saldo real do usuário no Blnk e no PostgreSQL.
   - Retornar sempre o saldo real vinculado ao `authData.sub` (ID do usuário no token JWT).
   - Eliminar qualquer retorno que caia no fallback de saldo estático global de 10.000 para usuários logados.

---

## 3. Arquivos Alvo

- `scripts/dev-live-feed.mjs`
- `services/api/src/routes/wallet.ts`
- `services/wallet-adapter/src/blnk-client.ts`

---

## 4. Bateria de Testes Obrigatórios da Subetapa

### 4.1. Testes de Estresse (Stress Testing)
- **Cenário ST-01:** Execução sequencial de 30 aberturas e liquidações de ordens para uma mesma conta logada.
  - *Critério:* A cada operação, `demo_balance_minor` no banco reflete rigorosamente a soma algébrica das stakes e payouts, sem deriva de 1 centavo sequer.
- **Cenário ST-02:** Concorrência de 10 requisições simultâneas de abertura de ordens com saldo limitado.
  - *Critério:* Bloqueio atômico impede saldo negativo (`demo_balance_minor >= 0`). Nenhuma race condition permitida.

### 4.2. Testes de Segurança (Security Testing)
- **Cenário SEC-01:** Tentativa de consultar ou movimentar saldo de outro usuário fornecendo token JWT alterado ou sem credencial (BOLA/IDOR).
  - *Critério:* Retorno 401 Unauthorized imediato; nenhuma informação de saldo alheio exposta.
- **Cenário SEC-02:** Invariante D-18: O saldo é armazenado e transitado exclusivamente como inteiro na menor fração (`*_minor`, centavos USD). Nenhum float é gravado no banco de dados.

### 4.3. Testes de Caos (Chaos Testing)
- **Cenário CH-01 (Queda do Blnk):** Parada simulada ou timeout forçado do container Blnk durante a consulta de carteira.
  - *Critério:* O endpoint `/api/v1/wallet` responde com o saldo persistido do PostgreSQL de forma transparente, sem travar o frontend e sem resetar para 10.000.
- **Cenário CH-02 (Reload Storm):** 50 requisições consecutivas de `GET /api/v1/wallet` simulando múltiplos F5s do usuário.
  - *Critério:* Todas as 50 requisições retornam o saldo exato e idêntico persistido.

---

## 5. Critérios de Aceite para Aprovação e Avanço

- [ ] URL do Blnk na VPS comunicando em `127.0.0.1:5001` sem erros de conexão no log do PM2.
- [ ] Usuário de teste opera, ganha/perde um trade, tem o saldo gravado no PostgreSQL.
- [ ] Recarregamento via script de probe (`GET /api/v1/wallet`) retorna exatamente o valor modificado, comprovando que o reset para 10 mil foi eliminado.
- [ ] Relatório de teste com execução sem falhas.
