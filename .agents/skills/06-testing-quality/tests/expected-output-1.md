# Expected output 1

## Deve conter

- Status para as 5 regras
- `FAIL` em Q-01, Q-02 e Q-05
- `N/A` em Q-03 e Q-04
- "Bug que passaria" em todo achado
- Lista de lacunas com IDs de regra
- `VEREDITO: REPROVADO`

## Não deve conter

- Bloco de código com o teste corrigido
- Sugestão de aumentar o timeout do teste
- Sugestão de `retry` automático no runner
- `VEREDITO: APROVADO`

## Saída de referência

```text
SKILL: 06-testing-quality
MODO: REVISÃO
REGRAS COBERTAS: I-03, I-04 (declaradas no PR)
ESCOPO ANALISADO: services/contract-service/test/contracts.test.ts

Q-01 Unit tests          : FAIL — contracts.test.ts:21 espera real de 61 s; :22 Math.random; :9 :15 :16 asserções fracas
Q-02 Integration tests   : FAIL — contracts.test.ts:4 banco mockado; idempotência sem constraint, ledger nem concorrência
Q-03 Chaos tests         : N/A — fora do escopo do PR
Q-04 Load tests          : N/A — fora do escopo do PR
Q-05 Acceptance criteria : FAIL — nenhum teste referencia regra ou AC; só o caminho WIN é testado

ACHADOS:
- [CRÍTICO] contracts.test.ts:4 — db mockado retornando rows vazias — bug que passaria: remover a
  UNIQUE (user_id, idempotency_key) não deixa nenhum teste vermelho — viola Q-02
- [CRÍTICO] contracts.test.ts:15-16 — só verifica que a e b existem — bug que passaria: dois contratos
  e duas reservas no Blnk para a mesma Idempotency-Key — viola Q-02
- [ALTO] contracts.test.ts:12 — sem chamadas paralelas com a mesma chave — bug que passaria: corrida
  entre dois requests simultâneos cria contrato duplicado — viola Q-02
- [ALTO] contracts.test.ts:22 — preço com Math.random — bug que passaria: teste verde ou vermelho por
  acaso; regressão em WIN/LOSS mascarada — viola Q-01
- [ALTO] contracts.test.ts:21 — setTimeout de 61 s — teste lento e dependente de relógio real;
  tende a ser desligado ou marcado flaky — viola Q-01
- [MÉDIO] contracts.test.ts:9 — toBeTruthy em objeto — bug que passaria: retorno com status errado ou
  entry_price vindo do cliente — viola Q-01
- [MÉDIO] contracts.test.ts:7 :12 :19 — títulos sem [I-xx]/[AC-xx] — falha não aponta a regra — viola Q-05

LACUNAS:
- I-03 settlement: mesma mensagem de expiração 2× → 1 liquidação
- I-04: settlement concorrente do mesmo contrato
- I-02: soma do ledger = 0 após abrir e liquidar
- Resultados LOSS e DRAW; direção DOWN
- Sem tick de saída → NACK, nunca DRAW
- Blnk indisponível durante a reserva → contrato permanece CREATED (R-04)

PENDÊNCIAS: arredondamento do payout <não definido no contexto> — registrar como it.todo
VEREDITO: REPROVADO
```
