# API guide — Blnk para a Fase 1

Referência carregada sob demanda pelo `backend-implementation-agent` e pelo `financial-correctness-reviewer`.
Confirmar nomes de campos e endpoints na documentação oficial antes de implementar: https://docs.blnkfinance.com

## Conceitos Blnk usados

| Conceito | Uso na Fase 1 |
|----------|---------------|
| Ledger | Agrupa os balances da carteira `DEMO` |
| Balance | Uma conta: `user:available`, `user:reserved`, `house_payout`, `house_revenue` |
| Transaction | Movimento de `source` para `destination` com `reference` única |
| Reference | Chave de idempotência da transação |
| Precision | Valores armazenados como inteiros (`amount × precision`) |
| Balance snapshot | Saldo histórico para auditoria |
| Reconciliation | Conferência ledger × fonte externa |

## Balances necessários

| Balance | Dono | Criado quando |
|---------|------|---------------|
| `user:{user_id}:available` | Usuário | Primeiro login (carteira DEMO, saldo inicial 10.000) |
| `user:{user_id}:reserved` | Usuário | Primeiro login |
| `house_payout` | Casa | Setup do ambiente |
| `house_revenue` | Casa | Setup do ambiente |

## Operações

### Criar ledger

```http
POST /ledgers
{ "name": "demo", "meta_data": { "phase": "1" } }
```

### Criar balance

```http
POST /balances
{ "ledger_id": "<ledger_id>", "currency": "<moeda_demo>",
  "meta_data": { "owner": "user:<user_id>", "kind": "available" } }
```

### Registrar transação

```http
POST /transactions
{
  "amount": 100.00,
  "precision": 100,
  "currency": "<moeda_demo>",
  "reference": "reserve:<contract_id>",
  "source": "<balance_id user:available>",
  "destination": "<balance_id user:reserved>",
  "description": "Reserva de stake",
  "meta_data": { "contract_id": "<contract_id>" }
}
```

Repetir a chamada com a mesma `reference` não pode gerar segundo efeito (I-03).

### Consultar saldo

```http
GET /balances/<balance_id>
```

## Mapeamento contrato → transações

| Evento | Source | Destination | Reference |
|--------|--------|-------------|-----------|
| Abertura | `user:available` | `user:reserved` | `reserve:{contract_id}` |
| WIN (stake) | `user:reserved` | `user:available` | `settlement:{contract_id}` |
| WIN (lucro) | `house_payout` | `user:available` | `credit:{contract_id}:WIN` |
| LOSS | `user:reserved` | `house_revenue` | `settlement:{contract_id}` |
| DRAW | `user:reserved` | `user:available` | `settlement:{contract_id}` |
| Reversão | destino original | origem original | `reversal:{transaction_reference}` |

## Tratamento de erro no Wallet Adapter

| Situação | Ação |
|----------|------|
| Timeout | Repetir com a mesma `reference` (backoff exponencial, limite N) |
| Erro 5xx | Repetir com a mesma `reference`; após N tentativas → DLQ |
| Reference já existente | Tratar como sucesso; ler a transação existente |
| Erro 4xx de validação | Não repetir; DLQ + alerta |
| Circuit breaker aberto | Manter evento no outbox; contrato permanece no estado atual |

## Pendências

- Moeda da carteira demo: `<não definido no contexto>`
- Regra de arredondamento do payout de 85%: `D-19` (skill 01); enquanto `Pendente`, `<não definido no contexto>`
- Política de overdraft em reversões: `<não definido no contexto>`
