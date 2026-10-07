# Subetapa 4: Ciclo Financeiro de Trading no Blnk Ledger (Reserva, Payout e Soma Zero)

**Agentes Responsáveis:** `financial-correctness-reviewer`, `broker-architect-agent`, `backend-implementation-agent`  
**Skills:** `02-financial-invariants`, `05-resilience-patterns`, `06-testing-quality`  
**Invariantes Auditadas:** I-01 a I-06, D-18

---

## 1. Objetivo Técnico
Garantir que as movimentações de saldo decorrentes de apostas (abertura e liquidação de contratos) ocorram sob rigorosa disciplina contábil no **Blnk Ledger**:
1. **Abertura de Ordem:** Reserva instantânea da stake transferindo de `@user_{sub}:available` para `@user_{sub}:reserved` com referência `reserve:{contract_id}`.
2. **Liquidação WIN:**
   - Estorno do stake reservado: `@user_{sub}:reserved` ➡️ `@user_{sub}:available`.
   - Crédito do lucro líquido (85% do stake): `@house_payout` ➡️ `@user_{sub}:available`.
   - Referência de transação: `settlement:{contract_id}:win`.
3. **Liquidação LOSS:**
   - Transferência do stake reservado diretamente para a conta da casa: `@user_{sub}:reserved` ➡️ `@house_revenue`.
   - Referência de transação: `settlement:{contract_id}:loss`.
4. **Liquidação DRAW (Empate):**
   - Reembolso do stake integral: `@user_{sub}:reserved` ➡️ `@user_{sub}:available`.
   - Referência de transação: `settlement:{contract_id}:draw`.
5. **Reversão Idempotente (I-06):** Qualquer correção deve usar a transação inversa com referência `reversal:{tx_ref}`.

---

## 2. Passo a Passo da Implementação

### 2.1 Mapeamento Contábil de Partidas Dobradas

| Evento | Origem (Source) | Destino (Destination) | Valor | Referência |
| :--- | :--- | :--- | :--- | :--- |
| **Abertura de Contrato** | `@user_{sub}:available` | `@user_{sub}:reserved` | `stake_minor` | `reserve:{contract_id}` |
| **Settlement WIN (Stake)** | `@user_{sub}:reserved` | `@user_{sub}:available` | `stake_minor` | `settle_principal:{contract_id}` |
| **Settlement WIN (Lucro)** | `@house_payout` | `@user_{sub}:available` | `profit_minor` | `settle_profit:{contract_id}` |
| **Settlement LOSS** | `@user_{sub}:reserved` | `@house_revenue` | `stake_minor` | `settle_loss:{contract_id}` |
| **Settlement DRAW** | `@user_{sub}:reserved` | `@user_{sub}:available` | `stake_minor` | `settle_refund:{contract_id}` |

### 2.2 Garantia de Soma Zero do Ledger
Para qualquer intervalo $[t_0, t_1]$:
$$\sum_{\text{todas as contas}} \Delta \text{Balance}_i = 0$$

Nenhum centavo é criado ou destruído sem contrapartida. O saldo total da soma de todas as contas da casa somadas com as contas de todos os usuários é estritamente constante.

---

## 3. Matriz de Testes & Validação Financeira
1. **Teste T-4.1 (Simulação de Vitória WIN):** Validar saldo do usuário e saldo de `@house_payout`. Comprovar que o usuário recebe exatamente stake + 85% de lucro.
2. **Teste T-4.2 (Simulação de Derrota LOSS):** Validar transferência integral do stake para `@house_revenue`. Comprovar que o saldo disponível decresceu exatamente no valor do stake e o reservado zerou.
3. **Teste T-4.3 (Concorrência de Liquidação):** 20 tentativas simultâneas de liquidar o mesmo contrato devem gerar exatamente uma movimentação financeira no Blnk (zero double-spending).

---

## 4. Critério de Aceite da Subetapa 4
- [x] Transações de reserva e settlement integradas com o `BlnkClient`.
- [x] Referências idempotentes padronizadas em todas as etapas.
- [x] Equação de soma zero verificada matematicamente.
- [x] Nenhuma alteração direta em colunas de saldo (`UPDATE balance` proibido).
