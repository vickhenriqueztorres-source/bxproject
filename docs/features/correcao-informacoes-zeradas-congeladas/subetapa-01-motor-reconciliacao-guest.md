# Subetapa 01: Motor de Reconciliação Autônomo e Liquidação Resiliente no Client / Mock Store

> **Agente**: `surgical-frontend-agent`  
> **Revisor**: `financial-correctness-reviewer`  
> **QA**: `qa-resilience-agent`  
> **Skills**: `01-project-context`, `02-financial-invariants`, `05-resilience-patterns`, `06-testing-quality`, `17-mudanca-cirurgica`

---

## 1. Objetivo Técnico
Eliminar o congelamento definitivo de ordens no modo Guest / Mock Local. Implementar uma função central de reconciliação determinística (`reconcileGuestContracts`) em `apps/web/src/api/client.ts` que:
1. Analisa todos os contratos presentes no mock store com `status === 'OPEN'`.
2. Se `Date.parse(c.expires_at) <= Date.now()`, executa a liquidação imediata:
   - Determina o preço de saída com base no tick mais recente ou na última vela disponível.
   - Determina o resultado (`WIN`, `LOSS` ou `DRAW`).
   - Calcula o payout conforme a porcentagem de retorno do ativo (padrão 85%).
   - Altera atomicamente o saldo da carteira (`reserved_minor -= stakeMinor`, `available_minor += payoutMinor`).
   - Altera o status para `'SETTLED'`.
   - Salva a store no `localStorage`.
   - Notifica a aplicação emitindo eventos de `contract_settled` e `wallet_balance` via `broadcastMockPrivate`.
3. Garante que `reconcileGuestContracts` seja acionado:
   - Na inicialização e a cada chamada de `getContracts()`, `getContract()` e `getWallet()`.
   - Em um batimento de intervalo leve (a cada 1000ms no client) para garantir auto-resolução mesmo se o usuário não clicar em nada.
   - Preserva o timer `setTimeout` existente apenas como otimização em memória, sem depender dele exclusivamente.

---

## 2. Arquivos Modificados
- `apps/web/src/api/client.ts`
- Novo teste de unidade & caos: `apps/web/src/api/client-guest-reconciliation.unit.test.ts`

---

## 3. Especificação dos Testes da Subetapa 01
1. **Teste de Recuperação de Crash / Reload**:
   - Criar 10 contratos abertos com `expires_at` no passado gravados diretamente no `localStorage`.
   - Chamar `getContracts('')`.
   - Provar que 100% dos contratos foram reconciliados e retornaram com `status === 'SETTLED'`.
2. **Teste de Invariante Financeiro**:
   - Saldo disponível inicial: $10.000 (1.000.000 centavos).
   - Reserva de $100 em contrato.
   - Reconciliação do contrato com WIN (85%):
     - `reserved_minor` deve zerar.
     - `available_minor` deve ser exatamente $10.085 (1.008.500 centavos).
   - Nenhuma perda ou duplicação de centavos.
3. **Teste de Estresse de Reconciliação**:
   - Reconciliar 100 contratos expirados de uma só vez em menos de 50ms.
4. **Teste de Caos e Robustez Temporal**:
   - Contratos com `expires_at` inválido, nulo ou futuro distante não devem ser liquidados indevidamente.

---

## 4. Critério de Aceite (Gate de Avanço)
- [ ] Testes de reconciliação em `client-guest-reconciliation.unit.test.ts` 100% verdes.
- [ ] Nenhuma quebra de testes em `apps/web`.
