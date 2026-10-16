# Fase 3 — Blindagem Total de Idempotência (Anti-Duplo Crédito e Anti-Duplo Saque)

## 1. Por que o "if já existe" Comum Falha e Causa Duplo Crédito?

O erro mais comum em sistemas de pagamento é fazer um `SELECT` antes e um `UPDATE` depois:
```js
// ❌ VULNERÁVEL A RACE CONDITION (DUPLO CRÉDITO / DUPLO SAQUE):
const dep = await db.query("SELECT * FROM deposits WHERE id = $1", [id]);
if (dep.rows[0].status === 'COMPLETED') return; // <-- Se 2 webhooks chegarem juntos com 2ms de diferença, os DOIS passam por aqui!
await creditarCarteira(userId, valor);          // <-- Credita 2 vezes!
```
Quando a **Binance**, o **PIX** ou o **Cartão** enviam 2 webhooks seguidos (ou quando um usuário malicioso dispara 10 cliques de **Saque** no mesmo milissegundo com scripts/abas simultâneas), duas requisições leem `status = 'PENDING'` ao mesmo tempo e **duplicam o saldo ou sacam o dobro do que tinham**.

---

## 2. Como Resolvemos com 100% de Garantia Matemática (As 4 Travas Ácidas)

Implementamos um motor de idempotência em **4 níveis simultâneos** (Memória + Chave Persistida Antes + Lock de Linha SQL + Referência Única no Blnk):

```text
[Requisição / Webhook chega]
   │
   ├─► TRAVA 1: Persistência da Chave ANTES de Processar
   │            INSERT INTO idempotency_keys ... ON CONFLICT DO NOTHING RETURNING *
   │            └── Se retornar 0 linhas -> Chave já existe! Retorna o mesmo resultado salvo (NÃO reprocessa)
   │
   ├─► TRAVA 2: Lock Exclusivo da Carteira + Compare-and-Swap de Estado no PostgreSQL
   │            SELECT ... FROM wallets WHERE user_id = $1 FOR UPDATE
   │            UPDATE deposits SET status = 'COMPLETED' WHERE id = $1 AND status = 'PENDING' RETURNING *
   │            └── O banco enfileira as transações: só 1 muda de PENDING para COMPLETED!
   │
   ├─► TRAVA 3: Validação de Hash do Payload (Anti-Adulteração de Chave)
   │            └── Se tentar usar a mesma Idempotency-Key mudando o valor de $10 para $100 -> Erro 422!
   │
   └─► TRAVA 4: Reference Determinística Única no Blnk Ledger
                reference = "deposit_credit:binance:TX_12345" ou "withdrawal_reserve:WD_98765"
                └── O próprio Blnk possui UNIQUE(reference) e rejeita duplicatas na camada contábil!
```

---

## 3. Como Cada Operação Fica Blindada na Prática

### A) Nos Depósitos e Torneios (Webhooks de Binance, PIX e Cartão)
Nos webhooks, o provedor pode mandar o mesmo aviso 2, 3 ou 10 vezes (retry automático).
1. A chave de idempotência do webhook é derivada do identificador único da transação real:
   `idempotency_key = "webhook:" + provider + ":" + provider_tx_id`
2. **Passo 1 (Persistência Prévia na Transação SQL)**:
   ```sql
   BEGIN;

   -- 1. Grava a chave ANTES de qualquer crédito. Se já existir, aborta na hora.
   INSERT INTO idempotency_keys (scope, idempotency_key, status, created_at)
   VALUES ('WEBHOOK_DEPOSIT', $1, 'PROCESSING', NOW())
   ON CONFLICT (scope, idempotency_key) DO NOTHING
   RETURNING idempotency_key;
   -- Se rowCount === 0 -> ROLLBACK e retorna 200 OK (já foi processado antes!)

   -- 2. Atualiza o depósito APENAS se ainda estiver PENDING
   UPDATE deposits
      SET status = 'COMPLETED',
          provider_tx_id = $2,
          paid_at = NOW()
    WHERE id = $3
      AND status = 'PENDING'
   RETURNING *;
   -- Se rowCount === 0 -> ROLLBACK e retorna 200 OK!

   -- 3. Credita o saldo exatamente 1 vez
   UPDATE wallets
      SET balance_real_minor = balance_real_minor + $4
    WHERE user_id = $5;

   COMMIT;
   ```
- **Resultado**: Mesmo que um atacante ou o gateway dispare **50 webhooks iguais no mesmo milissegundo**, o PostgreSQL trava a chave no passo 1: **apenas 1 transação passa** e as outras 49 batem no `ON CONFLICT DO NOTHING` sem somar 1 centavo a mais!

---

### B) Nos Pedidos de Saque do Cliente (`POST /api/withdrawals`)
Para impedir que o cliente abra 5 abas no navegador e clique em "Sacar $100" nas 5 abas ao mesmo tempo tentando sacar $500 tendo só $100 de saldo:
1. **Header `Idempotency-Key` Obrigatório**:
   - Sem o header `Idempotency-Key` → rejeita na hora com `400 Bad Request (IDEMPOTENCY_KEY_REQUIRED)`.
2. **Lock Pessimista da Carteira (`SELECT ... FOR UPDATE`) + Regra de "1 Saque Pendente por Vez"**:
   ```sql
   BEGIN;

   -- 1. Persiste a Idempotency-Key antes de processar
   INSERT INTO idempotency_keys (scope, idempotency_key, user_id, request_hash, status)
   VALUES ('WITHDRAWAL_CREATE', $1, $2, $3, 'PROCESSING')
   ON CONFLICT (scope, idempotency_key) DO NOTHING
   RETURNING *;

   -- 2. Trava a linha da carteira do usuário (nenhuma outra aba consegue ler o saldo até este COMMIT terminar!)
   SELECT balance_real_minor
     FROM wallets
    WHERE user_id = $2
      FOR UPDATE;

   -- 3. Verifica se já não existe saque PENDING e se tem saldo suficiente
   -- 4. Debita de balance_real_minor e move para pending_withdrawal_minor na MESMA transação!

   COMMIT;
   ```
3. **Índice Único Parcial no Banco para Saques Pendentes**:
   ```sql
   CREATE UNIQUE INDEX idx_one_pending_withdrawal_per_user
     ON withdrawals (user_id)
    WHERE status IN ('PENDING', 'PROCESSING');
   ```
   - Com esse índice no PostgreSQL, é **fisicamente impossível** no banco de dados um mesmo usuário abrir 2 pedidos de saque pendentes ao mesmo tempo!

---

### C) Na Sua Aprovação Manual ou Estorno no Painel Admin (`POST /api/admin/withdrawals/:id/approve` ou `reject`)
E se você no Admin clicar duas vezes sem querer no botão **"Confirmar Pago"** ou **"Estornar para Carteira"**?
- A query de aprovação/estorno também usa `Idempotency-Key` + trava de estado:
  ```sql
  UPDATE withdrawals
     SET status = 'COMPLETED',
         approved_by = $1,
         processed_at = NOW()
   WHERE id = $2
     AND status = 'PENDING'
  RETURNING *;
  ```
- Se você clicar 2 vezes em **"Estornar"**, o 1º clique muda de `PENDING` para `REJECTED` e devolve o saldo para a carteira do cliente; o 2º clique encontra `status = 'REJECTED'` (`0 linhas afetadas`) e **nunca devolve o saldo em dobro**!
