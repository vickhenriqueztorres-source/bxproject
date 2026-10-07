# Subetapa 5 — Reconciliação Periódica e Audit Hash Chain

## 1. Objetivo
Criar uma trilha de auditoria contínua e imutável que verifique a cada 1 minuto a integridade matemática de todos os contratos liquidados contra os saldos e ticks correspondentes.

## 2. Implementação
1. **Hash Encadeado de Settlement:**
   - Cada liquidação calcula `hash = SHA256(prev_hash + contract_id + symbol + result + payout_minor + event_time)`.
2. **Job de Reconciliação Contínua (1 minuto):**
   - Verifica contratos em `EXPIRING` há mais de 10s.
   - Confirma se todo contrato `SETTLED` possui entrada correspondente no Blnk Ledger.
   - Valida que a soma de débitos e créditos obedece à equação de conservação financeira.

## 3. Critérios de Aceite e Testes
- Se qualquer registro for alterado manualmente no banco, a cadeia de hash detecta a quebra instantaneamente.
