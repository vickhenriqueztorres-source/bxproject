# Expected output 1

## Deve conter

- Status para os 6 padrões
- `FAIL` em R-02, R-03, R-04 e R-05
- `N/A` em R-01 e R-06
- Cenário de falha em todo achado
- Nota positiva sobre a `reference` fixa
- `VEREDITO: REPROVADO`

## Não deve conter

- Bloco de código com a correção
- Recomendação de trocar a `reference` por UUID a cada tentativa
- `VEREDITO: APROVADO`

## Saída de referência

```text
SKILL: 05-resilience-patterns
MODO: REVISÃO
DEPENDÊNCIAS: Blnk
ESCOPO ANALISADO: services/wallet-adapter/reserve.ts

R-01 Outbox            : N/A — fora do trecho analisado
R-02 Retry + backoff   : FAIL — reserve.ts:2 loop infinito; reserve.ts:11 espera fixa de 1 s; reserve.ts:8 repete 4xx
R-03 Timeout           : FAIL — reserve.ts:4 fetch sem signal/timeout
R-04 Circuit breaker   : FAIL — nenhuma proteção para a dependência Blnk
R-05 DLQ               : FAIL — reserve.ts:10 nunca desiste; sem DLQ; erro descartado
R-06 Consumer groups   : N/A — fora do trecho analisado

ACHADOS:
- [ALTO] reserve.ts:4 — sem timeout, uma conexão pendurada segura o worker indefinidamente —
  cenário: Blnk aceita TCP e não responde; todos os workers param — viola R-03
- [ALTO] reserve.ts:2 — retry sem limite por mensagem — cenário: o worker nunca chega à próxima
  mensagem enquanto o Blnk estiver fora — viola R-02
- [ALTO] reserve.ts:11 — espera fixa sem jitter — cenário: N pods voltam no mesmo segundo e
  derrubam o Blnk de novo (thundering herd) — viola R-02
- [ALTO] reserve.ts:8 — 400/422 tratados como transitórios — cenário: payload inválido repetido
  para sempre (poison message) — viola R-02, R-05
- [ALTO] reserve.ts — sem circuit breaker — cenário: workers continuam martelando o Blnk degradado — viola R-04
- [MÉDIO] reserve.ts:10 — erro engolido sem log, métrica nem trace — viola R-05
- [MÉDIO] reserve.ts:8 — 409 "reference já existe" tratado como erro, não como sucesso — viola R-02

PONTO POSITIVO: reserve.ts:6 usa reference fixa reserve:{contract_id}; repetir é financeiramente seguro (I-03).

PENDÊNCIAS: valores definitivos de timeout/tentativas/breaker — PROPOSTOS em references/api-guide.md
VEREDITO: REPROVADO
```
