# Example 2 — Correção por reversão após settlement errado

## Entrada

```text
Agente: tech-lead-orchestrator
"O reconciliador encontrou o contrato c_77b liquidado como WIN, mas o tick de
 saída oficial indica LOSS. Como corrigir?"
```

## Dados

| Campo | Valor |
|-------|-------|
| `contract_id` | `c_77b` |
| `stake` | 50,00 |
| Liquidado como | `WIN` |
| Resultado correto | `LOSS` |
| Transações existentes | `settlement:c_77b` (50,00 reserved → available), `credit:c_77b:WIN` (42,50 house_payout → available) |

## Raciocínio esperado

1. Trigger: "corrigir" + "liquidado" + reconciliação.
2. I-01 e I-06: nada é editado nem apagado.
3. Cada transação errada recebe uma transação inversa com `reversal:{transaction_reference}`.
4. Em seguida, o efeito correto (LOSS) é aplicado com reference própria.

## Saída

```text
SKILL: 02-financial-invariants
MODO: IMPLEMENTAÇÃO
ESCOPO ANALISADO: correção de c_77b

1. Reverter lucro pago indevidamente
   source:      user:available
   destination: house_payout
   amount:      42,50
   reference:   reversal:credit:c_77b:WIN

2. Reverter devolução do stake
   source:      user:available
   destination: user:reserved
   amount:      50,00
   reference:   reversal:settlement:c_77b

3. Aplicar resultado correto (LOSS)
   source:      user:reserved
   destination: house_revenue
   amount:      50,00
   reference:   settlement:c_77b:correction

Saldo líquido do usuário após correção: -50,00 em relação à abertura (LOSS)
Trilha de auditoria: transação original + reversão + correção visíveis

Registro obrigatório em audit_logs: contrato, transações revertidas, motivo
(divergência detectada pelo reconciliador), aprovação humana.

I-01 Append-only : PASS — nenhuma transação alterada ou apagada
I-02 Double-entry: PASS — reversões com source/destination invertidos
I-03 Idempotência: PASS — references reversal:* determinísticas
I-06 Reversão    : PASS — correção por transação inversa

PENDÊNCIAS: se user:available não tiver saldo para a reversão, decisão de
            overdraft é <não definido no contexto> — devolver ao orquestrador.

VEREDITO: APROVADO (após aprovação humana)
```
