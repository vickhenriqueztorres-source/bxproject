# Expected output 1

## Deve conter

- Status para as 6 invariantes
- `FAIL` em M-01, M-02, M-03 e M-04
- `N/A` em M-05 e M-06
- Evidência com arquivo e linha em todo `FAIL`
- `VEREDITO: REPROVADO`

## Não deve conter

- Bloco de código com a correção
- `VEREDITO: APROVADO`
- Recomendação de `seed` fixa ou de outra biblioteca PRNG não criptográfica

## Saída de referência

```text
SKILL: 03-synthetic-market-engine
MODO: REVISÃO
ETAPAS: GERAÇÃO | PERSISTÊNCIA | PUBLICAÇÃO
ESCOPO ANALISADO: services/tick-engine/engine.ts

M-01 CSPRNG              : FAIL — engine.ts:3 usa Math.random()
M-02 Tick sequence       : FAIL — engine.ts:4 tick sem sequence; engine.ts:2 sem leader lease
M-03 Persistir→publicar  : FAIL — engine.ts:5 publica antes do INSERT (engine.ts:6); sem outbox
M-04 Hash encadeado      : FAIL — engine.ts:6 INSERT sem prev_hash/hash
M-05 Candle OHLCV        : N/A — fora do trecho analisado
M-06 WebSocket feed      : N/A — fora do trecho analisado

ACHADOS:
- [CRÍTICO] engine.ts:3 — PRNG não criptográfico; preço previsível — viola M-01
- [CRÍTICO] engine.ts:2 — sem lease, cada réplica gera um preço diferente para o mesmo índice — viola M-02
- [CRÍTICO] engine.ts:5 — tick visível ao usuário antes de existir no PostgreSQL; falha no INSERT
  deixa preço "fantasma" que pode ter sido usado como preço de entrada — viola M-03
- [ALTO] engine.ts:5 — publica só em Pub/Sub; sem Stream não há catch-up nem consumer group — viola M-03 (D-04)
- [ALTO] engine.ts:6 — sem hash encadeado; alteração posterior de preço não é detectável — viola M-04
- [ALTO] engine.ts:1 — preço em memória; reinício volta a 1000 e quebra a série
- [MÉDIO] engine.ts:3 — preço em ponto flutuante gravado sem precisão definida
- [MÉDIO] engine.ts:2 — setInterval sem correção de deriva nem métrica de gap

PENDÊNCIAS: p_0, σ e precisão do preço — <não definido no contexto>
VEREDITO: REPROVADO
```
