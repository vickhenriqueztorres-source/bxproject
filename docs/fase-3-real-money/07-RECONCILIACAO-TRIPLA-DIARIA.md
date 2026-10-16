# Fase 3 — Motor de Reconciliação Tripla Automática e Diária (`Provedor ↔ Banco ↔ Blnk Ledger`)

## 1. O Problema: O que Acontece se Não Reconciliar?

Em qualquer operação com dinheiro real existem **3 registros** que precisam bater centavo por centavo:
1. **O Extrato Oficial do Provedor (`Binance / PIX / Cartão`)**: O dinheiro que realmente entrou ou saiu na instituição financeira;
2. **O Banco da Plataforma (`PostgreSQL`: `deposits`, `withdrawals`, `contracts`, `wallets`)**;
3. **O Ledger Contábil (`Blnk Ledger`)**.

Se um webhook se perder por queda de internet, se um cartão sofrer chargeback dias depois, ou se houver falha no meio de uma transação, surge uma **Divergência Silenciosa**.

---

## 2. Como Funciona a Blindagem de Reconciliação Tripla (`scripts/lib/reconciliation-engine.mjs`)

Em vez de você ter que cruzar planilhas manualmente, o servidor roda **2 motores automáticos de conciliação** + uma **Tela de Auditoria no seu Painel Admin**:

```text
[Fontes de Verdade]
  1. Extrato Oficial API (Binance / PIX / Cartão)
  2. Tabelas PostgreSQL (deposits / withdrawals / contracts)
  3. Blnk Ledger (partidas dobradas)
          │
          ▼
[Reconciliador Linha por Linha (A cada 15 min + Fechamento Diário)]
          │
          ├──► CASO 1: Pago na Binance/PIX, mas PENDING no Banco (Webhook perdido)
          │            └── Auto-corrige: credita com Idempotency-Key e marca AUTO_RECOVERED
          │
          ├──► CASO 2: COMPLETED no Banco, mas NÃO PAGO / ESTORNADO no Provedor
          │            └── Alerta Crítico! Trava saques do usuário na hora + Alerta no seu Telegram
          │
          └──► CASO 3: Saldo da Carteira ≠ Soma Matemática (Depósitos - Saques + Trades)
                       └── Trava saque daquela conta + Gera Lançamento de Ajuste Reverso no Admin
```

---

## 3. Os 3 Níveis de Conciliação na Prática

### Nível 1 — Reconciliação Contínua a Cada 15 Minutos (`Recuperação de Webhooks Perdidos`)
- A cada 15 minutos, o servidor varre todos os depósitos e compras de torneio com `status = 'PENDING'` criados há mais de 3 minutos.
- Consulta diretamente a API da **Binance**, do **PIX** ou do **Cartão**:
  - Se o pagamento consta como **PAGO** lá fora, o sistema executa o fluxo de aprovação idempotente automaticamente (o cliente recebe o saldo/fichas mesmo se o webhook tiver falhado!).
  - Se passou do prazo de validade (ex.: 30 min sem pagar), marca como `EXPIRED`.

### Nível 2 — Conciliação Diária Linha por Linha (`Settlement File × PostgreSQL × Blnk`)
Todo dia (e também via botão **"Executar Conciliação Agora"** no seu Painel Admin), o sistema baixa a lista de liquidação (`settlement`) da Binance, do PIX e do Cartão e compara **transação por transação**:
1. **Conferência de Entradas**:
   - Soma todos os pagamentos liquidados no provedor vs. soma de todos os `deposits WHERE status = 'COMPLETED'`.
   - Verifica se cada `provider_tx_id` existe nos dois lados com o mesmo valor em centavos (`*_minor`).
2. **Conferência de Saques Manuais**:
   - Compara todos os saques marcados como `COMPLETED` no Admin contra os comprovantes/saídas registradas.
3. **Auditoria Matemática de Carteira (`Invariante de Saldo por Usuário`)**:
   - Para cada cliente com saldo real, o sistema recalcula do zero:
     $$\text{Saldo Esperado} = \text{Depósitos Reais} + \text{Prêmios/Bônus} - \text{Saques} + \text{Ganhos de Contratos Reais} - \text{Perdas de Contratos Reais}$$
   - Se o `Saldo Atual na Carteira` for diferente do `Saldo Esperado` em **1 centavo sequer (`!= 0`)**:
     - O sistema **congela automaticamente o saque daquele usuário** (`security_hold = true`);
     - Cria um registro em `reconciliation_discrepancies` e te avisa no Telegram!

### Nível 3 — Correção Limpa e Auditável pelo Painel Admin (`Transação de Ajuste / Reversal`)
Seguindo a regra inviolável da arquitetura (nunca editar saldo na mão sem rastro), quando uma divergência é detectada (ex.: um chargeback de cartão que chegou dias depois):
- No seu **Painel Admin → aba Conciliação**, você vê a divergência destacada em vermelho com o motivo exato;
- Com **1 clique em "Aplicar Ajuste Contábil (`Reversal`)"**, o sistema gera uma transação oficial de estorno (`reversal:${ref}`), corrige o saldo no Blnk e no PostgreSQL e grava no log de auditoria quem autorizou, quando e por quê.
