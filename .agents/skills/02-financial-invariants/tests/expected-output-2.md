# Expected output 2

## Deve conter

- Chave única `(user_id, idempotency_key)`
- Resposta idêntica para a repetição
- `reserve:{contract_id}`
- Transação única: contrato + idempotência + outbox
- Rejeição de mesma chave com body diferente

## Não deve conter

- Deduplicação apenas no front-end
- Lock em memória do processo como única proteção
- `entry_price` aceito do body

## Saída de referência

```text
SKILL: 02-financial-invariants
MODO: IMPLEMENTAÇÃO
ESCOPO ANALISADO: POST /contracts

Passos:
1. user_id do JWT (sub). Body validado por DTO: direction ∈ {UP, DOWN}, stake.
2. BEGIN
3. Buscar (user_id, idempotency_key):
   - existe com mesmo hash de body → COMMIT e devolver a resposta salva
   - existe com hash diferente     → ROLLBACK e 422
4. Ler último tick oficial no PostgreSQL → entry_price.
5. INSERT contrato (status CREATED, expires_at = now + 60s).
6. INSERT idempotência (user_id, idempotency_key, body_hash, contract_id, resposta).
   Constraint UNIQUE(user_id, idempotency_key).
7. INSERT outbox RESERVE_STAKE { contract_id, reference: "reserve:{contract_id}" }.
8. COMMIT
9. Outbox relay chama Blnk: user:available → user:reserved, stake,
   reference reserve:{contract_id}. Sucesso → contrato OPEN.

I-03 Idempotência : PASS — repetição devolve o mesmo contrato; Blnk recebe a mesma reference
I-04 ACID         : PASS — contrato, idempotência e outbox no mesmo COMMIT

VEREDITO: APROVADO
```
