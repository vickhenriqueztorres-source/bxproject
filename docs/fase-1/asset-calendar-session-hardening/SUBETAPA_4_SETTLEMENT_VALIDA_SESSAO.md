# Subetapa 4 — Settlement Valida Sessão Antes de Liquidar

> **Documento:** `docs/fase-1/asset-calendar-session-hardening/SUBETAPA_4_SETTLEMENT_VALIDA_SESSAO.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** V-08 (Settlement no Primeiro Tick Oficial), V-13 (Zero-Sum Ledger)

---

## 1. Objetivo Técnico

No `contract-service.ts` e no `settlement-worker`, antes de aplicar o resultado financeiro (WIN/LOSS) de um contrato expirado:
1. Validar que o ativo estava em sessão de trading oficial no momento da expiração (`expires_at`).
2. Validar que o tick de liquidação capturado ocorreu dentro da sessão oficial.
3. Se o ativo estiver fora de sessão (ex: fim de semana para Forex), o settlement não deve usar ticks atrasados nem liquidar arbitrariamente: o worker emite NACK/retry seguro até a reabertura da sessão.

---

## 2. Critérios de Aceite

- [x] Zero liquidações ocorrem fora do calendário oficial do ativo.
- [x] Tentativas de liquidação em fins de semana para Forex aguardam com segurança sem quebrar idempotência.
