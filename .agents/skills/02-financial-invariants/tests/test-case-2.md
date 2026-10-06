# Test case 2 — Clique duplo na abertura de contrato

- **Skill:** `02-financial-invariants`
- **Tipo:** modo implementação
- **Agente que envia:** `backend-implementation-agent`

## Entrada (prompt)

```text
O usuário clicou duas vezes em "Comprar UP" e abriu dois contratos.
Como garantir idempotência no POST /contracts?
```

## Contexto fornecido

- Requisições recebidas:

```text
POST /contracts  Idempotency-Key: 7f3c...  body: { "direction": "UP", "stake": 100 }
POST /contracts  Idempotency-Key: 7f3c...  body: { "direction": "UP", "stake": 100 }
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (triggers "idempotência", "clique duplo") | Obrigatório |
| 2 | Chave escopada por `user_id` (vindo do JWT) | Obrigatório |
| 3 | Segunda requisição devolve o mesmo contrato, sem nova reserva | Obrigatório |
| 4 | Reserva usa `reference = reserve:{contract_id}` | Obrigatório |
| 5 | Contrato + registro de idempotência + outbox na mesma transação (I-04) | Obrigatório |
| 6 | Mesma chave com body diferente é rejeitada | Obrigatório |
| 7 | Não usa `stake`/`entry_price` vindos do cliente sem validação | Obrigatório |
