# Example 1 — Ciclo completo de um contrato WIN no ledger

## Entrada

```text
Agente: backend-implementation-agent
"Quais transações o Blnk recebe para um contrato UP de 100,00 que termina em WIN?"
```

## Dados

| Campo | Valor |
|-------|-------|
| `contract_id` | `c_9a1` |
| `direction` | `UP` |
| `stake` | 100,00 |
| `entry_price` | 1000,25 |
| `exit_price` | 1000,90 |
| Resultado | `WIN` (saída > entrada) |
| Payout | 85% → 85,00 |

## Saída

```text
SKILL: 02-financial-invariants
MODO: IMPLEMENTAÇÃO
ESCOPO ANALISADO: abertura + settlement de c_9a1

Transações no Blnk (em ordem):

1. Abertura (outbox RESERVE_STAKE)
   source:      user:available
   destination: user:reserved
   amount:      100,00
   reference:   reserve:c_9a1

2. Settlement WIN — devolve stake
   source:      user:reserved
   destination: user:available
   amount:      100,00
   reference:   settlement:c_9a1

3. Settlement WIN — paga lucro
   source:      house_payout
   destination: user:available
   amount:      85,00
   reference:   credit:c_9a1:WIN

Saldos derivados após o ciclo:
   user:available  +85,00
   user:reserved     0,00
   house_payout    -85,00
   Soma global       0,00   (I-02)

Estados: CREATED → OPEN → EXPIRING → SETTLED

I-01 Append-only   : PASS — 3 transações novas, nenhuma alterada
I-02 Double-entry  : PASS — toda transação com source e destination
I-03 Idempotência  : PASS — references determinísticas por contract_id
I-04 ACID          : PASS — estado + outbox no mesmo COMMIT
I-05 Reconciliação : PASS — contrato SETTLED tem settlement no ledger
I-06 Reversão      : N/A

VEREDITO: APROVADO
```
