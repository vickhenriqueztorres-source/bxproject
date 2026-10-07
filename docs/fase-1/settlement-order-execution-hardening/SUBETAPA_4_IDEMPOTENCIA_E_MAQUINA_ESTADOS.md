# Subetapa 4 — Idempotência por settlement:{contract_id} e Máquina de Estados com Guard

## 1. Objetivo
Garantir que cada contrato seja liquidado exatamente uma única vez, prevenindo dupla liquidação, divergência de saldo ou corrupção de ledger, independentemente de retentativas ou concorrência.

## 2. Implementação
1. **Chave Fixa de Idempotência:**
   - Chave no formato canônico `settlement:{contract_id}` registrada no Blnk Ledger e no banco de dados com constraint `UNIQUE`.
2. **Máquina de Estados Estrita:**
   - Transições válidas: `OPEN -> EXPIRING -> SETTLED`.
   - Um contrato em estado `SETTLED` jamais pode ser reaberto ou reliquidado.
   - Bloqueio pessimista via `SELECT ... FOR UPDATE` no PostgreSQL para isolamento concorrente absoluto.

## 3. Critérios de Aceite e Testes
- Disparar 50 workers concorrentes tentando liquidar o mesmo contrato: exatamente 1 vence e 49 recebem o mesmo recibo idempotente com 0 centavos duplicados.
