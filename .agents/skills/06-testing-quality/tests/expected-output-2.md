# Expected output 2

## Deve conter

- Pelo menos 9 critérios `AC-42-n`
- Valores exatos para WIN, LOSS e DRAW
- Cenários de duplicata, concorrência, falta de tick, Blnk fora e worker morto
- Regras, nível e teste por critério
- Pendências de arredondamento e regra do tick de saída

## Não deve conter

- Regra de arredondamento inventada
- Critério sem teste associado
- "funciona corretamente", "rápido", "estável" sem número

## Saída de referência

```text
SKILL: 06-testing-quality
MODO: CRITÉRIOS
REGRAS COBERTAS: I-02, I-03, I-04, I-05, R-04, R-05, R-06, D-10
ESCOPO ANALISADO: Issue #42 — Settlement Worker

AC-42-1 — WIN em contrato UP
Dado    contrato OPEN, UP, stake 50,00, entry_price 1000,25, expires_at no passado
Quando  o worker processa a mensagem de expiração com tick de saída 1000,90
Então   contrato SETTLED, result WIN, payout 42,50
E       ledger: settlement:{id} 50,00 reserved → available; credit:{id}:WIN 42,50 house_payout → available
Regras: I-02, I-03, D-10 | Nível: integration | Teste: settlement.int.test.ts::"[AC-42-1] WIN UP"

AC-42-2 — WIN em contrato DOWN
Dado    contrato OPEN, DOWN, stake 50,00, entry_price 1000,25
Quando  tick de saída 999,80
Então   SETTLED, WIN, payout 42,50
Regras: I-02 | Nível: unit + integration | Teste: settlement.test.ts::"[AC-42-2] WIN DOWN"

AC-42-3 — LOSS
Dado    contrato OPEN, UP, stake 50,00, entry_price 1000,25
Quando  tick de saída 1000,10
Então   SETTLED, LOSS, payout 0
E       ledger: stake 50,00 reserved → house_revenue; nenhuma transação credit:{id}:*
Regras: I-02 | Nível: integration | Teste: settlement.int.test.ts::"[AC-42-3] LOSS"

AC-42-4 — DRAW
Dado    contrato OPEN, stake 50,00, entry_price 1000,25
Quando  tick de saída 1000,25
Então   SETTLED, DRAW, stake 50,00 reserved → available
Regras: I-02 | Nível: unit + integration | Teste: settlement.int.test.ts::"[AC-42-4] DRAW"

AC-42-5 — Mensagem duplicada
Dado    contrato já SETTLED
Quando  a mesma mensagem de expiração é entregue de novo
Então   nenhuma transação nova no ledger; mensagem recebe XACK
Regras: I-03, R-06 | Nível: integration | Teste: "[AC-42-5] duplicata não liquida 2x"

AC-42-6 — Liquidação concorrente
Dado    contrato EXPIRING
Quando  2 workers processam o mesmo contrato em paralelo (20 repetições)
Então   exatamente 1 settlement:{id} e no máximo 1 credit:{id}:* em todas as repetições
Regras: I-03, I-04 | Nível: integration | Teste: "[AC-42-6] concorrência"

AC-42-7 — Sem tick de saída
Dado    contrato EXPIRING sem tick com timestamp ≥ expires_at
Quando  o worker processa a mensagem
Então   contrato continua EXPIRING; mensagem sem XACK; nenhuma transação; nunca DRAW
Regras: I-04, R-06 | Nível: integration | Teste: "[AC-42-7] sem tick de saída"

AC-42-8 — Blnk indisponível por 3 min
Dado    10 contratos vencendo durante a indisponibilidade
Quando  o Blnk volta
Então   breaker abriu (circuit_breaker_state = OPEN registrado); dlq:contracts:expiring vazia;
        os 10 contratos SETTLED em ≤ 10 s após o breaker fechar
Regras: R-04, R-05, I-05 | Nível: chaos (C-03) | Teste: tests/chaos/C-03-blnk-down.test.ts::"[AC-42-8]"

AC-42-9 — Worker morto no meio do lote
Dado    lote de 10 mensagens em processamento
Quando  kill -9 no worker após 5 liquidações
Então   os 10 contratos SETTLED exatamente 1× após XAUTOCLAIM
Regras: I-03, R-06 | Nível: chaos (C-08) | Teste: "[AC-42-9] worker morto"

AC-42-10 — Prazo de liquidação
Dado    100 contratos com o mesmo expires_at
Quando  o horário de expiração passa
Então   100 SETTLED em ≤ 10 s; nenhum EXPIRING há mais de 10 s
Regras: I-05 | Nível: load | Teste: tests/load/settlement-burst.k6.js

PÓS-CONDIÇÃO DE TODOS: reconciliação sem divergência (I-05); soma dos balances = 0 (I-02)

LACUNAS: nenhuma para a issue
PENDÊNCIAS:
- arredondamento do payout de 85% <não definido no contexto> — it.todo('[AC-42-x] arredondamento')
- regra exata de escolha do tick de saída <não definido no contexto> — AC-42-7 usa "timestamp ≥ expires_at" como hipótese a confirmar
VEREDITO: N/A (modo critérios)
```
